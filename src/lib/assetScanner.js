import fsPromises from 'fs/promises';
import path from 'path';
import { pathToFileURL } from 'url';

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const AUDIO_EXTENSIONS = new Set(['.mp3', '.ogg', '.wav', '.opus']);

// A single directory can legitimately contain tens of thousands of assets
// (e.g. a large art-asset library dropped in via "Add scan directory"); cap
// it so one scan can't consume unbounded memory or block indefinitely.
export const DEFAULT_MAX_ENTRIES = 20000;

/** Converts an absolute filesystem path to a `media://` URL displayable via the app's custom protocol. */
export function pathToMediaUrl(absolutePath) {
    return pathToFileURL(absolutePath).toString().replace(/^file:/, 'media:');
}

/**
 * Recursively scans `dirPath` for image/audio assets.
 * Cancellable via `isCancelled`, bounded via `maxEntries`, and resilient to
 * per-entry stat failures (permission-denied files, broken links) which are
 * skipped and recorded in `errors` rather than aborting the whole scan.
 */
export async function scanDirectoryForAssets(dirPath, options = {}) {
    const {
        maxEntries = DEFAULT_MAX_ENTRIES,
        isCancelled = () => false,
        onProgress = null,
        readdirFn = (p) => fsPromises.readdir(p, { withFileTypes: true }),
        statFn = (p) => fsPromises.stat(p),
    } = options;

    const results = { images: [], audios: [], truncated: false, cancelled: false, errors: [] };
    let scanned = 0;

    const scanRecursive = async (currentPath) => {
        if (results.truncated || results.cancelled) return;
        if (isCancelled()) {
            results.cancelled = true;
            return;
        }

        let entries;
        try {
            entries = await readdirFn(currentPath);
        } catch (err) {
            results.errors.push({ path: currentPath, message: err.message });
            return;
        }

        for (const entry of entries) {
            if (results.truncated || results.cancelled) return;
            if (isCancelled()) {
                results.cancelled = true;
                return;
            }
            // Symlinks/junctions can point back at an ancestor directory,
            // turning a recursive walk into an infinite loop — skip them.
            if (entry.isSymbolicLink()) continue;

            scanned++;
            if (scanned > maxEntries) {
                results.truncated = true;
                return;
            }
            if (onProgress && scanned % 200 === 0) onProgress(scanned);

            const fullPath = path.join(currentPath, entry.name);
            const normalizedPath = fullPath.replace(/\\/g, '/');

            if (entry.isDirectory()) {
                await scanRecursive(fullPath);
            } else if (entry.isFile()) {
                const ext = path.extname(entry.name).toLowerCase();
                const isImage = IMAGE_EXTENSIONS.has(ext);
                const isAudio = AUDIO_EXTENSIONS.has(ext);
                if (!isImage && !isAudio) continue;

                try {
                    const stats = await statFn(fullPath);
                    const mediaUrl = pathToMediaUrl(fullPath);
                    const record = {
                        path: normalizedPath,
                        fileName: entry.name,
                        dataUrl: mediaUrl,
                        lastModified: stats.mtimeMs,
                        size: stats.size,
                    };
                    (isImage ? results.images : results.audios).push(record);
                } catch (err) {
                    results.errors.push({ path: normalizedPath, message: err.message });
                }
            }
        }
    };

    await scanRecursive(dirPath);
    return results;
}
