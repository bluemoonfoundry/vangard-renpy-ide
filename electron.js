import { logger, electronLog } from './src/lib/logger.main.js';
import { isAppImageRuntime, shouldDisableSandbox } from './src/lib/sandboxProbe.js';
import { classifyFsReadError } from './src/lib/fsErrorClassification.js';

// CRITICAL: Fix AppImage sandbox and shared memory issues
// Must inject flags into process.argv BEFORE importing electron
if (isAppImageRuntime()) {
    logger.info('[Vangard] Running in AppImage mode');
    if (!process.argv.includes('--disable-dev-shm-usage')) {
        process.argv.push('--disable-dev-shm-usage');
    }
    // --no-sandbox is only injected when the setuid chrome-sandbox helper is
    // confirmed unusable (AppImage's FUSE/extraction mount is commonly
    // nosuid). This is a scoped, tested fallback — see
    // docs/security/appimage-sandbox.md for the residual threat model. It
    // never applies to Windows, macOS, or Linux .deb installs.
    if (shouldDisableSandbox() && !process.argv.includes('--no-sandbox')) {
        logger.warn('[Vangard] chrome-sandbox helper unusable in this AppImage environment - falling back to --no-sandbox. See docs/security/appimage-sandbox.md');
        process.argv.push('--no-sandbox');
    }
    logger.info('[Vangard] process.argv:', process.argv);
} else {
    logger.info('[Vangard] Not running in AppImage mode');
}

import { app, BrowserWindow, ipcMain, dialog, Menu, protocol, shell, safeStorage, globalShortcut, Notification } from 'electron';

import electronUpdaterPkg from 'electron-updater';
const { autoUpdater } = electronUpdaterPkg;
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { createReadStream, watch } from 'fs';
import { Readable } from 'stream';
import { spawn } from 'child_process';
import { Worker } from 'worker_threads';
import { deriveGuiColors } from './src/lib/colorUtils.js';
import { updateGuiRpy, updateOptionsRpy, generateSaveDirectory } from './src/lib/templateProcessor.js';
import { validateProjectPath, validateExternalUrl, canonicalize } from './src/lib/ipcSecurity.js';
import { scanDirectoryForAssets, pathToMediaUrl } from './src/lib/assetScanner.js';
import { searchInDirectory } from './src/lib/projectSearch.js';
import { atomicWriteFile, cleanupStaleTempFiles } from './src/lib/atomicFileWrite.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Lazy-load image generator to avoid blocking app startup if Sharp fails
let generateGuiImages = null;
let sharpLoadError = null;

// Register custom protocol privileges BEFORE app is ready
protocol.registerSchemesAsPrivileged([
  { 
      scheme: 'media', 
      privileges: { 
          secure: true, 
          supportFetchAPI: true, 
          bypassCSP: true, 
          corsEnabled: true,
          stream: true,
          standard: true
      } 
  }
]);

// --- CLI startup flags ---
// Supports: electron . --project /path/to/project
//           electron . --user-data-dir /path/to/userData
//           electron . --window-size 2560x1440
// Used by the Playwright demo recording script and power users.
const _projectArgIdx = process.argv.indexOf('--project');
const startupProjectPath = (_projectArgIdx !== -1 && _projectArgIdx + 1 < process.argv.length)
    ? process.argv[_projectArgIdx + 1]
    : null;

const _windowSizeArgIdx = process.argv.indexOf('--window-size');
const _windowSizeArg = (_windowSizeArgIdx !== -1 && _windowSizeArgIdx + 1 < process.argv.length)
    ? process.argv[_windowSizeArgIdx + 1]
    : null;
const _windowSizeMatch = _windowSizeArg?.match(/^(\d+)x(\d+)$/);
const startupWindowWidth  = _windowSizeMatch ? parseInt(_windowSizeMatch[1], 10) : null;
const startupWindowHeight = _windowSizeMatch ? parseInt(_windowSizeMatch[2], 10) : null;

// Allow overriding settings via env var (used by Playwright screenshot capture).
// RENIDE_SETTINGS_OVERRIDE: JSON string of AppSettings to merge over the saved file.
// More reliable than --user-data-dir because Chromium intercepts that flag at the
// C++ level before process.argv is readable in Node.js code.

// --- Game Process Management ---
let gameProcess = null;

// --- Main Window Reference (for auto-updater callbacks) ---
let mainWindowRef = null;

// --- Popped-out tab windows ---
// Each detached tab gets its own BrowserWindow, keyed by tabId. The main window
// remains the sole owner of app state (blocks, analysisResult, etc.) -- these
// windows are thin remote views relayed over the popout:* IPC channels below.
const popoutWindows = new Map(); // tabId -> BrowserWindow
// tabIds with a createPopoutWindow() call in flight -- awaiting loadPopoutWindowState()
// before popoutWindows.set() registers the window, so 'window:popout-tab''s own dedup
// check (popoutWindows.has(tabId)) can't by itself protect against a second rapid
// pop-out request for the same tabId landing before the first's await resolves.
const popoutWindowsPending = new Set();
let popoutCallRequestId = 0;
const pendingPopoutCalls = new Map(); // requestId -> { resolve, reject, timeout }
// Safety net against a permanently hung popout:call-handler request -- if the main
// window's renderer reloads or crashes mid-request, 'popout:invoke-handler' is never
// seen and no 'popout:handler-result' ever comes back, so without this the popout's
// await would hang forever and the map entry would leak for the life of the process.
// Generous on purpose: some relayed handlers (e.g. handleGenerateTranslations) can
// legitimately run for a while.
const POPOUT_CALL_TIMEOUT_MS = 2 * 60 * 1000;

/** Settles every in-flight popout:call-handler request -- used when the main window's
 *  renderer is confirmed gone (crashed) rather than making callers wait out the full
 *  timeout above for something we already know isn't coming back. */
function rejectAllPendingPopoutCalls(message) {
    for (const { reject, timeout } of pendingPopoutCalls.values()) {
        clearTimeout(timeout);
        reject(new Error(message));
    }
    pendingPopoutCalls.clear();
}
// tabIds whose window.close() we're letting through because we already ran (or gave
// up waiting on) its pre-close flush -- without this, calling win.close() again after
// the flush completes would just re-enter the same 'close' handler forever.
const popoutClosingForced = new Set();
const pendingPopoutFlushAcks = new Map(); // tabId -> { resolvers: Array<() => void>, timeout }

/** Sends `channel` to the main window and every popped-out tab window. */
function broadcastToAllWindows(channel, payload) {
    if (mainWindowRef && !mainWindowRef.isDestroyed()) {
        mainWindowRef.webContents.send(channel, payload);
    }
    for (const win of popoutWindows.values()) {
        if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
    }
}

function getTabIdForPopoutWindow(win) {
    for (const [tabId, w] of popoutWindows) {
        if (w === win) return tabId;
    }
    return null;
}

/**
 * Asks one popout to flush any pending edit (e.g. Monaco content still sitting in
 * onContentChange's 800ms debounce, not yet relayed into the main window's real
 * state) into blocks[] before we do anything that depends on that state being
 * current -- checking for unsaved changes, saving, or destroying the window.
 * Resolves once the popout acks, or after a short timeout if it doesn't (crashed
 * renderer, etc.) so this can never hang the app.
 *
 * Can be called more than once concurrently for the same tabId (e.g. the main
 * window's close handler and that popout's own close handler both firing around
 * the same moment) -- each entry in pendingPopoutFlushAcks holds every caller's
 * resolver so a single ack (or a single timeout) settles all of them, rather than
 * a second call's resolver silently overwriting the first's.
 */
function requestPopoutFlush(tabId) {
    const win = popoutWindows.get(tabId);
    if (!win || win.isDestroyed()) return Promise.resolve();
    return new Promise((resolve) => {
        const existing = pendingPopoutFlushAcks.get(tabId);
        if (existing) {
            existing.resolvers.push(resolve);
            return;
        }
        const entry = {
            resolvers: [resolve],
            timeout: setTimeout(() => {
                const e = pendingPopoutFlushAcks.get(tabId);
                if (!e) return;
                pendingPopoutFlushAcks.delete(tabId);
                e.resolvers.forEach((r) => r());
            }, 1500),
        };
        pendingPopoutFlushAcks.set(tabId, entry);
        win.webContents.send('popout:flush-requested');
    });
}

/** Closes every popped-out tab window -- called once we're actually committed to
 *  quitting (forceQuit is true), by which point each has already had a chance to
 *  flush via the main window's own close-flow (see mainWindow.on('close') below).
 *  Uses destroy() rather than close() since we're not giving the user a chance to
 *  cancel at this point -- but destroy() never fires the 'close' event that
 *  win.on('close') (see createPopoutWindow) relies on to persist window state, so
 *  each window's bounds are saved explicitly here first. */
function closeAllPopoutWindows() {
    for (const win of popoutWindows.values()) {
        if (win && !win.isDestroyed()) {
            if (win.popoutTabType) savePopoutWindowState(win.popoutTabType, win);
            win.destroy();
        }
    }
    popoutWindows.clear();
}

// --- Project Root Tracking (for screenshots and other features) ---
let currentProjectRoot = null;

/**
 * Throws ACCESS_DENIED if filePath is not within the current project root.
 * Applied to all fs:* IPC handlers to prevent renderer-side path traversal.
 */
async function guardProjectPath(filePath) {
    const err = await validateProjectPath(filePath, currentProjectRoot);
    if (err) {
        logger.warn(`IPC path guard blocked: ${err} — path: ${filePath}`);
        throw new Error(`ACCESS_DENIED: ${err}`);
    }
}

// --- Vetted Project Roots ---
// guardProjectPath (above) only contains fs:* access to *whatever* root is
// currently open -- it does nothing to stop a compromised renderer from
// simply calling electronAPI.loadProject('/anywhere') to repoint that root
// at an attacker-chosen directory and then read/write anywhere the OS user
// can access. This set closes that gap: project:load/refresh/refresh-tree
// and dialog:checkRenpyProject only accept a *new* root (one that isn't
// already currentProjectRoot) if it was vetted by a real user-mediated,
// main-process-owned event -- a native file dialog result, a native "Open
// Recent" menu click, or the --project startup flag -- never a bare string
// the renderer passed in on its own.
const vettedProjectRoots = new Set();

async function vetProjectRoot(rootPath) {
    if (!rootPath || typeof rootPath !== 'string') return;
    try {
        vettedProjectRoots.add(await canonicalize(rootPath));
    } catch {
        // Path doesn't exist / inaccessible -- nothing to vet.
    }
}

async function isVettedProjectRoot(rootPath) {
    if (!rootPath || typeof rootPath !== 'string') return false;
    try {
        const target = await canonicalize(rootPath);
        const targetKey = process.platform === 'win32' ? target.toLowerCase() : target;

        if (currentProjectRoot) {
            const current = await canonicalize(currentProjectRoot);
            const currentKey = process.platform === 'win32' ? current.toLowerCase() : current;
            if (targetKey === currentKey) return true;
        }

        if (process.platform === 'win32') {
            for (const v of vettedProjectRoots) {
                if (v.toLowerCase() === targetKey) return true;
            }
            return false;
        }
        return vettedProjectRoots.has(target);
    } catch {
        return false;
    }
}

/**
 * Throws ACCESS_DENIED if rootPath was never vetted (see vettedProjectRoots
 * above) and isn't the already-open project root. Applied to project:load,
 * project:refresh, project:refresh-tree, and dialog:checkRenpyProject.
 */
async function guardVettedProjectRoot(rootPath) {
    if (!(await isVettedProjectRoot(rootPath))) {
        logger.warn(`Project root guard blocked unvetted path: ${rootPath}`);
        throw new Error('ACCESS_DENIED: path was not opened via a dialog, the recent-projects list, or --project');
    }
}

// --- External File Change Watcher ---
let projectWatcher = null;
const recentSelfWrites = new Map(); // normalizedAbsPath -> write timestamp ms
const watchDebounceTimers = new Map(); // normalizedAbsPath -> timeout id
const SELF_WRITE_SUPPRESS_MS = 3000;
const WATCH_DEBOUNCE_MS = 400;

function startProjectWatcher(rootPath) {
    if (projectWatcher) {
        try { projectWatcher.close(); } catch {
            // Ignore errors when closing watcher
        }
        projectWatcher = null;
    }
    watchDebounceTimers.forEach(t => clearTimeout(t));
    watchDebounceTimers.clear();

    try {
        projectWatcher = watch(rootPath, { recursive: true }, (eventType, filename) => {
            if (!filename) return;
            if (!/\.rpy$/i.test(filename)) return;
            if (/^(renpy|lib|cache|tmp)[/\\]/i.test(filename)) return;

            const absolutePath = path.join(rootPath, filename);
            const normalizedAbs = absolutePath.replace(/\\/g, '/');

            const existing = watchDebounceTimers.get(normalizedAbs);
            if (existing) clearTimeout(existing);
            watchDebounceTimers.set(normalizedAbs, setTimeout(() => {
                watchDebounceTimers.delete(normalizedAbs);

                const lastWrite = recentSelfWrites.get(normalizedAbs);
                if (lastWrite && Date.now() - lastWrite < SELF_WRITE_SUPPRESS_MS) return;

                const relativePath = path.relative(rootPath, absolutePath).replace(/\\/g, '/');
                broadcastToAllWindows('fs:file-changed-externally', { relativePath, absolutePath: normalizedAbs });
            }, WATCH_DEBOUNCE_MS));
        });
    } catch (err) {
        logger.error(`Failed to start file watcher for project root ${rootPath}:`, err);
        broadcastToAllWindows('fs:watcher-error', { message: err.message });
    }
}

// --- Window State Management ---

// Shared read/write idiom for the small JSON state files below (window bounds,
// popout bounds). Read failures (missing file, first launch, corrupted content)
// are swallowed and reported as null -- callers treat that as "no saved state".
async function readJsonStateFile(filePath) {
    try {
        return JSON.parse(await fs.readFile(filePath, 'utf-8'));
    } catch {
        return null;
    }
}

async function writeJsonStateFile(filePath, data, description) {
    try {
        await fs.writeFile(filePath, JSON.stringify(data));
    } catch (error) {
        logger.error(`Failed to save ${description}:`, error);
    }
}

const windowStatePath = path.join(app.getPath('userData'), 'window-state.json');

async function loadWindowState() {
    const state = await readJsonStateFile(windowStatePath);
    if (state && typeof state.width === 'number' && typeof state.height === 'number') {
        return state;
    }
    return null;
}

function saveWindowState(window) {
    if (!window) return;
    void writeJsonStateFile(windowStatePath, window.getBounds(), 'window state');
}

// Popout bounds are remembered per tab *type* (e.g. every 'editor' popout shares
// one remembered size/position), not per tab id -- a tab id is usually unique to
// one file and popouts are typically short-lived, so per-id storage would just
// grow unboundedly without ever being reused.
const popoutWindowStatePath = path.join(app.getPath('userData'), 'popout-window-state.json');

async function loadPopoutWindowState(tabType) {
    const state = await readJsonStateFile(popoutWindowStatePath);
    const entry = state?.[tabType];
    if (entry && typeof entry.width === 'number' && typeof entry.height === 'number') {
        return entry;
    }
    return null;
}

// Serializes every read-modify-write of popoutWindowStatePath behind one promise
// chain -- multiple popout windows can close within a short window of each other
// (e.g. during app-quit's popout teardown), and without this, two concurrent calls
// would both read the same pre-update file and whichever write lands second would
// silently discard the other's just-saved bounds (lost update).
let popoutWindowStateWriteQueue = Promise.resolve();

function savePopoutWindowState(tabType, window) {
    if (!window || window.isDestroyed()) return popoutWindowStateWriteQueue;
    const bounds = window.getBounds();
    popoutWindowStateWriteQueue = popoutWindowStateWriteQueue.then(async () => {
        const state = (await readJsonStateFile(popoutWindowStatePath)) || {};
        state[tabType] = bounds;
        await writeJsonStateFile(popoutWindowStatePath, state, 'popout window state');
    });
    return popoutWindowStateWriteQueue;
}

// --- App Settings Management ---
const appSettingsPath = path.join(app.getPath('userData'), 'app-settings.json');

async function loadAppSettings() {
    let settings = null;
    let warning = null;
    try {
        const data = await fs.readFile(appSettingsPath, 'utf-8');
        settings = JSON.parse(data);
    } catch (err) {
        const category = classifyFsReadError(err);
        if (category !== 'missing') {
            // Corrupt or inaccessible settings file — distinct from "no settings yet".
            logger.warn(`App settings could not be read (${category}) at ${appSettingsPath}:`, err);
            warning = { code: category, message: err.message };
        }
    }
    // Playwright screenshot capture injects the production app's settings via
    // this env var so the correct theme and layout prefs are used.
    if (process.env.RENIDE_SETTINGS_OVERRIDE) {
        try {
            const override = JSON.parse(process.env.RENIDE_SETTINGS_OVERRIDE);
            settings = { ...settings, ...override };
        } catch { /* ignore malformed override */ }
    }
    return { settings, warning };
}

async function saveAppSettings(settings) {
    try {
        await fs.writeFile(appSettingsPath, JSON.stringify(settings, null, 2));
        return { success: true };
    } catch (error) {
        logger.error('Failed to save app settings:', error);
        return { success: false, error: error.message };
    }
}

// --- API Key Management ---
const apiKeysPath = path.join(app.getPath('userData'), 'api-keys.enc');

async function loadApiKeys() {
    try {
        if (!safeStorage.isEncryptionAvailable()) {
            return {};
        }
        const encryptedData = await fs.readFile(apiKeysPath);
        const decryptedData = safeStorage.decryptString(encryptedData);
        return JSON.parse(decryptedData);
    } catch {
        return {};
    }
}

async function saveApiKey(provider, key) {
    try {
        if (!safeStorage.isEncryptionAvailable()) {
            throw new Error('Safe storage encryption not available');
        }
        const keys = await loadApiKeys();
        keys[provider] = key;
        const jsonData = JSON.stringify(keys);
        const encryptedData = safeStorage.encryptString(jsonData);
        await fs.writeFile(apiKeysPath, encryptedData);
        return { success: true };
    } catch (error) {
        logger.error('Failed to save API key:', error);
        return { success: false, error: error.message };
    }
}

async function getApiKey(provider) {
    try {
        const keys = await loadApiKeys();
        return keys[provider] || null;
    } catch (error) {
        logger.error('Failed to get API key:', error);
        return null;
    }
}


async function checkRenpyProject(rootPath) {
    try {
        const entries = await fs.readdir(rootPath, { withFileTypes: true });
        const hasGameFolder = entries.some(e => e.isDirectory() && e.name.toLowerCase() === 'game');
        const hasRpyAtRoot = entries.some(e => e.isFile() && /\.rpy$/i.test(e.name));
        let hasRpyInGame = false;
        if (hasGameFolder) {
            try {
                const gameEntries = await fs.readdir(path.join(rootPath, 'game'), { withFileTypes: true });
                hasRpyInGame = gameEntries.some(e => e.isFile() && /\.rpy$/i.test(e.name));
            } catch { /* ignore */ }
        }
        return { hasGameFolder, isRenpyProject: hasGameFolder || hasRpyAtRoot || hasRpyInGame };
    } catch {
        return { hasGameFolder: false, isRenpyProject: false };
    }
}

// Active worker for project loading — replaced on each load, terminated on cancel.
let activeLoadWorker = null;

// Cancellation state for the in-flight asset scan / project search (single-flight,
// mirroring activeLoadWorker above) — set to null once the operation settles.
let activeScanState = null;
let activeSearchState = null;

// Inline worker code for reading project files in a dedicated thread.
// Using String.raw to preserve backslashes in regex patterns.
const PROJECT_LOAD_WORKER_CODE = String.raw`
const { workerData, parentPort } = require('worker_threads');
const path = require('path');
const fs = require('fs/promises');
const { pathToFileURL } = require('url');

const progress = (value, message) => parentPort.postMessage({ type: 'progress', value, message });

async function run() {
    const { rootPath, readContent } = workerData;
    const results = {
        rootPath,
        files: [],
        images: [],
        audios: [],
        settings: null,
        tree: { name: path.basename(rootPath), path: '', children: [] }
    };

    progress(5, 'Scanning directory...');

    // Directories that are part of the Ren'Py SDK or build output — never contain
    // user-authored .rpy files and must be excluded to avoid inflating file counts.
    const EXCLUDED_DIRS = new Set(['renpy', 'lib', 'cache', 'tmp', '.git', 'node_modules']);

    // Phase 1: Build directory tree and collect .rpy paths (no content yet)
    const rpyPaths = [];
    let scannedEntries = 0;
    const readDirRecursive = async (dirPath, treeNode) => {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        const children = [];
        for (const entry of entries) {
            scannedEntries++;
            // Emit scan progress every 500 entries (5% → 18%, capped)
            if (scannedEntries % 500 === 0) {
                const pct = Math.min(18, 5 + Math.floor(scannedEntries / 500));
                progress(pct, 'Scanning... (' + scannedEntries.toLocaleString() + ' entries)');
            }
            const fullPath = path.join(dirPath, entry.name);
            const relativePath = path.relative(rootPath, fullPath).replace(/\\/g, '/');
            const childNode = { name: entry.name, path: relativePath, children: entry.isDirectory() ? [] : undefined };

            if (entry.isDirectory()) {
                if (EXCLUDED_DIRS.has(entry.name.toLowerCase())) continue;
                await readDirRecursive(fullPath, childNode);
            } else if (entry.isFile()) {
                if (/\.(rpy)$/i.test(entry.name)) {
                    rpyPaths.push({ fullPath, relativePath });
                } else if (relativePath.startsWith('game/')) {
                    // Project assets (images/audio) are only recognized inside game/ --
                    // media files elsewhere in the project root (docs, marketing assets,
                    // etc.) are not part of the Ren'Py project and must not be scanned in.
                    if (/\.(png|jpe?g|webp)$/i.test(entry.name)) {
                        const stats = await fs.stat(fullPath);
                        const mediaUrl = pathToFileURL(fullPath).toString().replace(/^file:/, 'media:');
                        results.images.push({ path: relativePath, dataUrl: mediaUrl, lastModified: stats.mtimeMs, size: stats.size });
                    } else if (/\.(mp3|ogg|wav|opus)$/i.test(entry.name)) {
                        const stats = await fs.stat(fullPath);
                        const mediaUrl = pathToFileURL(fullPath).toString().replace(/^file:/, 'media:');
                        results.audios.push({ path: relativePath, dataUrl: mediaUrl, lastModified: stats.mtimeMs, size: stats.size });
                    }
                }
            }
            children.push(childNode);
        }
        children.sort((a, b) => {
            if (a.children && !b.children) return -1;
            if (!a.children && b.children) return 1;
            return a.name.localeCompare(b.name);
        });
        treeNode.children = children;
    };

    await readDirRecursive(rootPath, results.tree);
    progress(20, 'Found ' + rpyPaths.length + ' script file' + (rpyPaths.length !== 1 ? 's' : '') + ', ' + results.images.length + ' image' + (results.images.length !== 1 ? 's' : '') + '...');

    // Phase 2: Read .rpy content with per-file progress (20% → 88%)
    if (readContent) {
        for (let i = 0; i < rpyPaths.length; i++) {
            const { fullPath, relativePath } = rpyPaths[i];
            const content = await fs.readFile(fullPath, 'utf-8');
            results.files.push({ path: relativePath, content });
            const pct = 20 + Math.round(((i + 1) / Math.max(rpyPaths.length, 1)) * 68);
            progress(pct, 'Reading ' + path.basename(relativePath) + '...');
        }
    } else {
        results.files = rpyPaths.map(({ relativePath }) => ({ path: relativePath, content: '' }));
    }

    progress(92, 'Loading project settings...');

    const settingsPath = path.join(rootPath, 'game', 'project.ide.json');
    try {
        const settingsContent = await fs.readFile(settingsPath, 'utf-8');
        results.settings = JSON.parse(settingsContent);
    } catch (err) {
        results.settings = {};
        // ENOENT (no settings file yet) is expected and stays silent; anything
        // else (malformed JSON, permission errors) is a real failure the
        // renderer should surface instead of quietly using defaults.
        if (err.code !== 'ENOENT') {
            const category = err instanceof SyntaxError ? 'corrupted'
                : (err.code === 'EACCES' || err.code === 'EPERM') ? 'permission-denied'
                : 'unknown';
            results.settingsWarning = { code: category, message: err.message };
        }
    }

    parentPort.postMessage({ type: 'result', ok: true, data: results });
}

run().catch(err => parentPort.postMessage({ type: 'result', ok: false, error: err.message }));
`;

function readProjectFiles(rootPath, { readContent = true } = {}, onProgress = null) {
    return new Promise((resolve, reject) => {
        const worker = new Worker(PROJECT_LOAD_WORKER_CODE, {
            eval: true,
            workerData: { rootPath, readContent }
        });
        activeLoadWorker = worker;
        let settled = false;

        worker.on('message', (msg) => {
            if (msg.type === 'progress') {
                if (onProgress) onProgress(msg.value, msg.message);
                return;
            }
            // type === 'result'
            settled = true;
            activeLoadWorker = null;
            if (msg.ok) {
                resolve(msg.data);
            } else {
                reject(new Error(msg.error));
            }
        });

        worker.on('error', (err) => {
            if (settled) return;
            settled = true;
            activeLoadWorker = null;
            reject(err);
        });

        worker.on('exit', (code) => {
            if (activeLoadWorker === worker) activeLoadWorker = null;
            // Non-zero exit without a prior message means the worker was terminated
            // (e.g. via worker.terminate() on cancel) or crashed. Either way, reject
            // so the caller's catch block runs; the cancel flag in App.tsx suppresses
            // any UI error in the cancel case.
            if (!settled && code !== 0) {
                settled = true;
                reject(new Error('LOAD_CANCELLED'));
            }
        });
    });
}

function getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
        case '.png': return 'image/png';
        case '.jpg': 
        case '.jpeg': return 'image/jpeg';
        case '.webp': return 'image/webp';
        case '.gif': return 'image/gif';
        case '.mp3': return 'audio/mpeg';
        case '.ogg': return 'audio/ogg';
        case '.wav': return 'audio/wav';
        case '.opus': return 'audio/opus';
        default: return 'application/octet-stream';
    }
}

let forceQuit = false;

// NOTE(#61): macOS 15.1+ installed builds fail to launch by default --
// confirmed root cause is that v1.0.0 ships unsigned/unnotarized (no Apple
// Developer Program membership), a deliberate, accepted decision for this
// release (see RELEASE_CHECKLIST.md). Workaround is documented in README.md/
// SUPPORT.md (`xattr -r -d com.apple.quarantine`). Separately, still worth
// noting: this function's darwin-only submenu branch (below) and the other
// process.platform === 'darwin' branches in this file are unguarded --  if
// menu construction ever throws here, it would surface only as "app never
// opens" with no diagnosable error, which is independent of the signing gap.
async function updateApplicationMenu() {
  const { settings } = await loadAppSettings();
  const recentProjects = settings?.recentProjects || [];

  const openRecentSubmenu = recentProjects.length > 0
    ? recentProjects.map(p => ({
        label: p,
        click: async (item, focusedWindow) => {
          await vetProjectRoot(p);
          if (focusedWindow) focusedWindow.webContents.send('menu-command', { command: 'open-recent', path: p });
        }
      }))
    : [{ label: 'No Recent Projects', enabled: false }];

  const menuTemplate = [
    ...(process.platform === 'darwin' ? [{
        label: app.getName(),
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' }
        ]
      }] : []),
    {
        label: 'File',
        submenu: [
            {
                label: 'New Project...',
                accelerator: 'CmdOrCtrl+N',
                click: (item, focusedWindow) => { if (focusedWindow) focusedWindow.webContents.send('menu-command', { command: 'new-project' }); }
            },
            {
                label: 'Open Project...',
                accelerator: 'CmdOrCtrl+O',
                click: (item, focusedWindow) => { if (focusedWindow) focusedWindow.webContents.send('menu-command', { command: 'open-project' }); }
            },
            {
                label: 'Open Recent',
                submenu: openRecentSubmenu
            },
            {
                id: 'new-untitled-file',
                label: 'New File',
                accelerator: 'CmdOrCtrl+Alt+N',
                enabled: false,
                click: (item, focusedWindow) => { if (focusedWindow) focusedWindow.webContents.send('menu-command', { command: 'new-untitled-file' }); }
            },
            { type: 'separator' },
            {
                label: 'Save All',
                accelerator: 'CmdOrCtrl+S',
                click: (item, focusedWindow) => { if (focusedWindow) focusedWindow.webContents.send('menu-command', { command: 'save-all' }); }
            },
            {
                id: 'explorer-refresh',
                label: 'Refresh',
                enabled: false,
                click: (item, focusedWindow) => { if (focusedWindow) focusedWindow.webContents.send('menu-command', { command: 'explorer-refresh' }); }
            },
            {
                id: 'open-screenshots-folder',
                label: 'Open Screenshots Folder',
                enabled: false,
                click: (item, focusedWindow) => { if (focusedWindow) focusedWindow.webContents.send('menu-command', { command: 'open-screenshots-folder' }); }
            },
            { type: 'separator' },
            {
                id: 'explorer-new-file',
                label: 'New File in Folder',
                enabled: false,
                click: (item, focusedWindow) => { if (focusedWindow) focusedWindow.webContents.send('menu-command', { command: 'explorer-new-file' }); }
            },
            {
                id: 'explorer-new-folder',
                label: 'New Folder',
                enabled: false,
                click: (item, focusedWindow) => { if (focusedWindow) focusedWindow.webContents.send('menu-command', { command: 'explorer-new-folder' }); }
            },
            {
                id: 'explorer-rename',
                label: 'Rename',
                enabled: false,
                click: (item, focusedWindow) => { if (focusedWindow) focusedWindow.webContents.send('menu-command', { command: 'explorer-rename' }); }
            },
            {
                id: 'explorer-delete',
                label: 'Delete',
                enabled: false,
                click: (item, focusedWindow) => { if (focusedWindow) focusedWindow.webContents.send('menu-command', { command: 'explorer-delete' }); }
            },
            { type: 'separator' },
            ...(process.platform !== 'darwin' ? [{
                label: 'Settings',
                accelerator: 'CmdOrCtrl+,',
                click: (item, focusedWindow) => { if (focusedWindow) focusedWindow.webContents.send('menu-command', { command: 'open-settings' }); }
            },
            { type: 'separator' }] : []),
            {
                id: 'run-project',
                label: 'Run Project',
                accelerator: 'F5',
                click: (item, focusedWindow) => { if (focusedWindow) focusedWindow.webContents.send('menu-command', { command: 'run-project' }); }
            },
            {
                id: 'stop-project',
                label: 'Stop Project',
                accelerator: 'Shift+F5',
                enabled: false,
                click: (item, focusedWindow) => { if (focusedWindow) focusedWindow.webContents.send('menu-command', { command: 'stop-project' }); }
            },
            { type: 'separator' },
            {
                label: 'Close Tab',
                accelerator: 'CmdOrCtrl+W',
                click: (item, focusedWindow) => { if (focusedWindow) focusedWindow.webContents.send('menu-command', { command: 'close-tab' }); }
            },
            { type: 'separator' },
            { role: 'quit' }
        ]
    },
    {
        label: 'Edit',
        submenu: [
            { role: 'undo' },
            { role: 'redo' },
            { type: 'separator' },
            { role: 'cut' },
            { role: 'copy' },
            { role: 'paste' },
            { type: 'separator' },
            {
                label: 'Find in Files',
                accelerator: 'CmdOrCtrl+Shift+F',
                click: (item, focusedWindow) => { if (focusedWindow) focusedWindow.webContents.send('menu-command', { command: 'toggle-search' }); }
            },
        ]
    },
    {
        label: 'View',
        submenu: [
            {
              label: 'Story Canvas',
              click: (item, focusedWindow) => { if (focusedWindow) focusedWindow.webContents.send('menu-command', { command: 'open-static-tab', type: 'canvas' }); }
            },
            {
              label: 'Route Canvas',
              click: (item, focusedWindow) => { if (focusedWindow) focusedWindow.webContents.send('menu-command', { command: 'open-static-tab', type: 'route-canvas' }); }
            },
            {
              label: 'Choice Canvas',
              click: (item, focusedWindow) => { if (focusedWindow) focusedWindow.webContents.send('menu-command', { command: 'open-static-tab', type: 'choice-canvas' }); }
            },
            {
                label: 'Diagnostics',
                click: (item, focusedWindow) => { if (focusedWindow) focusedWindow.webContents.send('menu-command', { command: 'open-static-tab', type: 'diagnostics' }); }
            },
            {
                label: 'Stats',
                click: (item, focusedWindow) => { if (focusedWindow) focusedWindow.webContents.send('menu-command', { command: 'open-static-tab', type: 'stats' }); }
            },
            {
                label: 'Translation Dashboard',
                click: (item, focusedWindow) => { if (focusedWindow) focusedWindow.webContents.send('menu-command', { command: 'open-static-tab', type: 'translations' }); }
            },
            { type: 'separator' },
            {
                label: 'Toggle Left Sidebar',
                click: (item, focusedWindow) => { if (focusedWindow) focusedWindow.webContents.send('menu-command', { command: 'toggle-left-sidebar' }); }
            },
            {
                label: 'Toggle Right Sidebar',
                click: (item, focusedWindow) => { if (focusedWindow) focusedWindow.webContents.send('menu-command', { command: 'toggle-right-sidebar' }); }
            },
            { type: 'separator' },
            ...(!app.isPackaged ? [
                { role: 'reload' },
                { role: 'forceReload' },
                { role: 'toggleDevTools' },
                { type: 'separator' },
            ] : []),
            { role: 'resetZoom' },
            { role: 'zoomIn' },
            { role: 'zoomOut' },
            { type: 'separator' },
            { role: 'togglefullscreen' }
        ]
    },
    {
        role: 'window',
        submenu: [
            { role: 'minimize' },
            { role: 'zoom' },
        ]
    },
    {
        label: 'Help',
        submenu: [
            {
                label: 'Show Tutorial',
                click: (item, focusedWindow) => { if (focusedWindow) focusedWindow.webContents.send('menu-command', { command: 'show-tutorial' }); }
            },
            {
                label: 'User Guide',
                click: () => {
                    shell.openExternal('https://bluemoonfoundry.github.io/bmf-vangard-renpy-ide/').catch(err => {
                        logger.error('Failed to open user guide:', err);
                        dialog.showErrorBox('Error', 'Could not open the user guide. Please check your internet connection.');
                    });
                }
            },
            {
                label: 'Keyboard Shortcuts',
                accelerator: 'CmdOrCtrl+/',
                click: (item, focusedWindow) => { if (focusedWindow) focusedWindow.webContents.send('menu-command', { command: 'open-shortcuts' }); }
            },
            { type: 'separator' },
            {
                label: 'Show Logs',
                click: async () => {
                    try {
                        const logPath = electronLog.transports.file.getFile()?.path;
                        if (logPath) {
                            // Open the directory containing the log file
                            const logDir = path.dirname(logPath);
                            await shell.openPath(logDir);
                        } else {
                            dialog.showErrorBox('Error', 'Log file not found.');
                        }
                    } catch (err) {
                        logger.error('Failed to open log directory', err);
                        dialog.showErrorBox('Error', 'Could not open log directory.');
                    }
                }
            },
            { type: 'separator' },
            {
                label: 'Check for Updates',
                click: () => {
                    if (app.isPackaged) {
                        autoUpdater.checkForUpdates().catch(err => logger.error('Auto-update check failed:', err));
                    }
                }
            },
            { type: 'separator' },
            ...(process.platform !== 'darwin' ? [{
                label: 'About',
                click: (item, focusedWindow) => { if (focusedWindow) focusedWindow.webContents.send('menu-command', { command: 'open-about' }); }
            }] : []),
        ]
    },
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);
}

async function createWindow() {
  const savedState = await loadWindowState();

  const mainWindow = new BrowserWindow({
    width: startupWindowWidth || savedState?.width || 1280,
    height: startupWindowHeight || savedState?.height || 800,
    x: savedState?.x,
    y: savedState?.y,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, 'vangard.png')
  });

  mainWindowRef = mainWindow;

  // Settle any in-flight popout:call-handler request immediately once the main
  // window's renderer is confirmed gone -- otherwise every waiting popout sits out
  // the full POPOUT_CALL_TIMEOUT_MS for a reply that's already known to never come.
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    rejectAllPendingPopoutCalls(`Main window renderer is gone (${details.reason})`);
  });

  mainWindow.on('close', (e) => {
    if (forceQuit) {
      saveWindowState(mainWindow);
      closeAllPopoutWindows();
      return;
    }
    e.preventDefault();
    // Flush every open popout's pending edits into the main window's real state before
    // asking it whether anything is unsaved -- otherwise a block being actively typed
    // in a popout wouldn't be reflected in blocks[] yet, and neither the dirty-check nor
    // "Save & Quit" would see it. Popout windows are deliberately NOT closed here: the
    // user might still cancel the exit (see the unsaved-changes modal flow below), and
    // until forceQuit is actually set there's nothing to gain from tearing them down.
    Promise.all(Array.from(popoutWindows.keys(), requestPopoutFlush)).then(() => {
      if (!mainWindow.isDestroyed()) mainWindow.webContents.send('check-unsaved-changes-before-exit');
    });
  });

  // Register global screenshot shortcut - handled entirely in main process for reliability
  globalShortcut.register('CommandOrControl+Shift+C', async () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;

    try {
      // Capture immediately, bypassing renderer
      if (!currentProjectRoot) {
        logger.warn('Screenshot attempted but no project loaded');
        return;
      }

      const screenshotsDir = path.join(currentProjectRoot, '.renide', 'screenshots');
      await fs.mkdir(screenshotsDir, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filename = `renide-screenshot-${timestamp}.png`;
      const filepath = path.join(screenshotsDir, filename);

      const image = await mainWindow.webContents.capturePage();
      const buffer = image.toPNG();
      await fs.writeFile(filepath, buffer);

      logger.info(`Screenshot captured: ${filename}`);

      // Try to notify renderer to update state (best effort - might fail if renderer crashed)
      try {
        if (!mainWindow.webContents.isDestroyed()) {
          mainWindow.webContents.send('screenshot-captured', { filename, filepath });
        }
      } catch (e) {
        logger.warn('Could not notify renderer of screenshot capture:', e.message);
      }

      // Show native OS notification (works even if renderer is dead)
      if (Notification.isSupported()) {
        const notification = new Notification({
          title: 'Screenshot Captured',
          body: `Saved to .renide/screenshots/`,
          silent: true
        });
        notification.on('click', async () => {
          await shell.openPath(screenshotsDir);
        });
        notification.show();
      }
    } catch (error) {
      logger.error('Failed to capture screenshot:', error);
      // Try to show error notification
      try {
        if (Notification.isSupported()) {
          new Notification({
            title: 'Screenshot Failed',
            body: error.message,
            silent: true
          }).show();
        }
      } catch {
        // Silently fail if even notification doesn't work
      }
    }
  });

  await updateApplicationMenu();

  applyContentSecurityPolicy(mainWindow.webContents.session);
  mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
}

/**
 * Creates the detached window for one popped-out tab. It loads the exact same
 * renderer bundle as the main window (dist/index.html) but with a `?mode=popout`
 * query param that tells src/index.tsx to mount a minimal standalone root
 * instead of the full App shell. It shares the main window's default session,
 * so the CSP already applied in createWindow() covers it too -- no need to
 * call applyContentSecurityPolicy again here.
 */
async function createPopoutWindow(tabId, tabType) {
  const savedState = await loadPopoutWindowState(tabType);
  const win = new BrowserWindow({
    width: savedState?.width || 900,
    height: savedState?.height || 700,
    x: savedState?.x,
    y: savedState?.y,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, 'vangard.png'),
  });

  win.popoutTabType = tabType;
  popoutWindows.set(tabId, win);

  // Intercept every path a popout can close through (its own native close button,
  // Cmd+W, the Redock button calling window.close(), ...) so a pending Monaco edit
  // still in onContentChange's debounce always gets flushed first -- previously only
  // the Redock button's own JS handler did this, so closing via the OS chrome could
  // silently drop the last few hundred ms of typing.
  //
  // Skipped once forceQuit is true: at that point the main window's own close flow
  // has already flushed every open popout (see mainWindow.on('close') below) before
  // ever asking about unsaved changes, so there's nothing new to flush here. This
  // isn't just a redundant-work optimization -- app.quit() (which is what sets
  // forceQuit) tries to close every window as part of one quit attempt, and calling
  // event.preventDefault() on any of them appears to cancel that whole attempt in
  // Electron, not just that window's close; destroying the window separately
  // afterward (as closeAllPopoutWindows does) does not resume it, so the app never
  // actually exits. Confirmed live: without this check the process hung indefinitely
  // after the user confirmed "Don't Save".
  win.on('close', (e) => {
    savePopoutWindowState(tabType, win);
    if (popoutClosingForced.has(tabId) || forceQuit) return;
    e.preventDefault();
    requestPopoutFlush(tabId).then(() => {
      popoutClosingForced.add(tabId);
      if (!win.isDestroyed()) win.close();
    });
  });

  win.on('closed', () => {
    popoutWindows.delete(tabId);
    popoutClosingForced.delete(tabId);
    // Settle any flush still awaiting this window's ack immediately -- it's never
    // coming now that the window is gone -- rather than making every waiter sit
    // out the full 1.5s timeout.
    const pendingFlush = pendingPopoutFlushAcks.get(tabId);
    if (pendingFlush) {
      clearTimeout(pendingFlush.timeout);
      pendingPopoutFlushAcks.delete(tabId);
      pendingFlush.resolvers.forEach((r) => r());
    }
    if (mainWindowRef && !mainWindowRef.isDestroyed()) {
      mainWindowRef.webContents.send('window:tab-redocked', { tabId });
    }
  });

  win.loadFile(path.join(__dirname, 'dist/index.html'), {
    search: `mode=popout&tabId=${encodeURIComponent(tabId)}`,
  });

  return win;
}

/**
 * Installs a Content-Security-Policy header on every response in this session.
 *
 * Renderer scripts run with contextIsolation, but window.electronAPI (the
 * contextBridge surface) is intentionally reachable from page scripts — so any
 * script that ends up executing in the renderer (e.g. via an HTML-injection bug
 * in a Markdown/notecard renderer that a future change reintroduces) can call
 * fs read/write, shell.openExternal, etc. Without a CSP, that same script could
 * also `fetch()`/`XMLHttpRequest` to any attacker-controlled host to exfiltrate
 * whatever it read — `connect-src` closes that off to just this app's own
 * origin plus the one CDN Monaco's default loader currently depends on.
 *
 * `media:` is deliberately left OUT of connect-src: nothing in the renderer
 * ever fetch()s a media:// URL (it's only ever used as <img>/<audio> src), so
 * omitting it means that even if the media:// protocol handler's project-root
 * guard (see guardProjectPath call in the 'media' protocol.handle above) were
 * ever bypassed or regressed, a script-based read via fetch('media:///...')
 * is still blocked by CSP as a second, independent layer.
 */
function applyContentSecurityPolicy(session) {
  const MONACO_CDN = 'https://cdn.jsdelivr.net';
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'wasm-unsafe-eval' ${MONACO_CDN}`,
    `style-src 'self' 'unsafe-inline' ${MONACO_CDN}`,
    "img-src 'self' media: data: blob:",
    "media-src 'self' media: blob:",
    `font-src 'self' data: ${MONACO_CDN}`,
    `connect-src 'self' ${MONACO_CDN}`,
    `worker-src 'self' blob: ${MONACO_CDN}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-src 'none'",
  ].join('; ');

  session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp],
      },
    });
  });
}

app.whenReady().then(async () => {
  // Trust the --project CLI flag as a vetted root up front (see
  // vettedProjectRoots above) -- it's process.argv, not renderer input.
  await vetProjectRoot(startupProjectPath);

  // Robust 'media' protocol handler for serving local files with streaming support
  protocol.handle('media', async (request) => {
    try {
        const parsedUrl = new URL(request.url);
        let filePath;

        // On Windows, if scheme is standard, URL parser might move drive letter to hostname
        // e.g. media:///C:/path -> media://c:/path (hostname: c)
        if (process.platform === 'win32' && parsedUrl.hostname && parsedUrl.hostname.length === 1) {
             // Handle drive letters normalized as hostnames
             // Reconstruct as c:/pathname
             filePath = `${parsedUrl.hostname}:${decodeURIComponent(parsedUrl.pathname)}`;
        } else if (parsedUrl.hostname) {
            // UNC Path (Network share): //Server/Share/Path...
            // parsedUrl.pathname will be /Share/Path...
            // We reconstruct it as \\Server\Share\Path... or //Server/Share/Path...
            filePath = `//${parsedUrl.hostname}${decodeURIComponent(parsedUrl.pathname)}`;
        } else {
            // Standard path with empty hostname (media:///path)
            let pathPart = decodeURIComponent(parsedUrl.pathname);
            
            // On Windows, URLs from pathToFileURL look like /C:/path/to/file
            // We need to strip the leading slash to get C:/path/to/file
            if (process.platform === 'win32' && /^\/[a-zA-Z]:/.test(pathPart)) {
                pathPart = pathPart.substring(1);
            }
            filePath = pathPart;
        }

        // Same containment check as every fs:* IPC handler — this protocol is
        // registered with bypassCSP/corsEnabled/supportFetchAPI so it's directly
        // fetchable from renderer script; without this it would be an arbitrary
        // local file read primitive reachable from any renderer-side script.
        await guardProjectPath(filePath);

        // Use fs.stat to get size and createReadStream for streaming
        const stats = await fs.stat(filePath);
        const mimeType = getMimeType(filePath);
        
        // Convert Node stream to Web stream for Response
        const stream = createReadStream(filePath);
        const webStream = Readable.toWeb(stream);

        return new Response(webStream, {
            status: 200,
            headers: { 
                'Content-Type': mimeType,
                'Content-Length': stats.size
            }
        });
    } catch (e) {
        logger.error(`Media protocol error for URL: ${request.url}`, e);
        return new Response('Not Found', { status: 404 });
    }
  });

  ipcMain.handle('app:get-startup-args', () => ({ projectPath: startupProjectPath }));

  ipcMain.handle('dialog:openDirectory', async () => {
    try {
      const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openDirectory']
      });
      if (canceled) {
        return null;
      } else {
        await vetProjectRoot(filePaths[0]);
        return filePaths[0];
      }
    } catch (error) {
      logger.error('Failed to open directory dialog:', error);
      return null;
    }
  });

  ipcMain.handle('dialog:selectImage', async () => {
    try {
      const { canceled, filePaths } = await dialog.showOpenDialog({
        title: 'Select Portrait Image',
        properties: ['openFile'],
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
      });
      if (canceled) {
        return null;
      } else {
        return filePaths[0];
      }
    } catch (error) {
      logger.error('Failed to open image selection dialog:', error);
      return null;
    }
  });

  /**
   * Resolve the Ren'Py executable from an SDK directory.
   * Returns the full path to renpy.exe (Windows) or renpy.sh (macOS/Linux).
   */
  function getRenpyExecutable(sdkDir) {
    if (!sdkDir) return null;
    const exe = process.platform === 'win32' ? 'renpy.exe' : 'renpy.sh';
    return path.join(sdkDir, exe);
  }

  ipcMain.handle('dialog:selectRenpy', async () => {
    try {
      const { canceled, filePaths } = await dialog.showOpenDialog({
          title: 'Select Ren\'Py SDK Directory',
          properties: ['openDirectory'],
      });
      if (canceled) {
          return null;
      } else {
          return filePaths[0];
      }
    } catch (error) {
      logger.error('Failed to open Ren\'Py SDK selection dialog:', error);
      return null;
    }
  });

  ipcMain.handle('renpy:check-path', async (event, sdkDir) => {
    if (!sdkDir) return false;
    try {
      const execPath = getRenpyExecutable(sdkDir);
      if (!execPath) return false;
      await fs.access(execPath, fs.constants.F_OK | fs.constants.X_OK);
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle('renpy:generate-translations', async (event, sdkDir, projectPath, language) => {
    const executable = getRenpyExecutable(sdkDir);
    if (!executable) return { success: false, output: '', error: 'Ren\'Py SDK path is not configured' };

    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let settled = false;
      const proc = spawn(executable, [projectPath, 'translate', language]);

      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        proc.kill();
        resolve({ success: false, output: '', error: 'Translation generation timed out after 60 seconds' });
      }, 60000);

      proc.stdout.on('data', (data) => { stdout += data.toString(); });
      proc.stderr.on('data', (data) => { stderr += data.toString(); });

      proc.on('close', (code) => {
        clearTimeout(timeout);
        if (settled) return;
        settled = true;
        if (code === 0) {
          resolve({ success: true, output: stdout });
        } else {
          const combined = [stderr, stdout].filter(Boolean).join('\n').trim();
          resolve({ success: false, output: stdout, error: combined || `Process exited with code ${code}` });
        }
      });

      proc.on('error', (err) => {
        clearTimeout(timeout);
        if (settled) return;
        settled = true;
        resolve({ success: false, output: '', error: `Failed to start Ren'Py: ${err.message}` });
      });
    });
  });

  ipcMain.handle('dialog:createProject', async () => {
    const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'Create New Ren\'Py Project',
        buttonLabel: 'Create Project',
        defaultPath: path.join(app.getPath('documents'), 'NewRenPyProject')
    });
    if (canceled || !filePath) {
        return null;
    }
    try {
        await fs.mkdir(path.join(filePath, 'game', 'images'), { recursive: true });
        await fs.mkdir(path.join(filePath, 'game', 'audio'), { recursive: true });
        await vetProjectRoot(filePath);
        return filePath;
    } catch (error) {
        logger.error('Failed to create project directory:', error);
        dialog.showErrorBox('Project Creation Failed', `Could not create project directory: ${error.message}`);
        return null;
    }
  });

  /**
   * Helper: Resolve template source directory
   * Tries SDK path first, falls back to bundled template
   */
  function getTemplateSource(sdkPath) {
    if (sdkPath) {
      const sdkTemplate = path.join(sdkPath, 'gui', 'game');
      try {
        // Check if SDK template exists synchronously
        require('fs').accessSync(sdkTemplate, require('fs').constants.R_OK);
        logger.info('Using SDK template:', sdkTemplate);
        return sdkTemplate;
      } catch {
        logger.info('SDK template not found, falling back to bundled template');
      }
    }
    // Fallback to bundled template (extraResources places it at resourcesPath in packaged builds)
    const bundledTemplate = app.isPackaged
      ? path.join(process.resourcesPath, 'renpy-template')
      : path.join(__dirname, 'resources', 'renpy-template');
    logger.info('Using bundled template:', bundledTemplate);
    return bundledTemplate;
  }

  ipcMain.handle('dialog:createProjectFromTemplate', async (event, options) => {
    const { projectDir, projectName, width, height, accentColor, isLight, sdkPath } = options;

    try {
      logger.info('Creating project from template:', { projectDir, projectName, width, height, accentColor, isLight });

      // 1. Resolve template source (SDK or bundled)
      const templateSource = getTemplateSource(sdkPath);

      // 2. Create project directory if it doesn't exist
      await fs.mkdir(projectDir, { recursive: true });

      // 3. Copy template to project/game directory
      const gameDir = path.join(projectDir, 'game');
      try {
        await fs.cp(templateSource, gameDir, { recursive: true });
        logger.info('Template copied successfully');
      } catch (copyError) {
        logger.error('Failed to copy template:', copyError);
        throw new Error(`Failed to copy template: ${copyError.message}`);
      }

      // 4. Derive GUI colors from accent + theme
      const colors = deriveGuiColors(accentColor, isLight);
      logger.info('Derived colors:', colors);

      // 5. Update gui.rpy (gui.init + all color defines)
      const guiRpyPath = path.join(gameDir, 'gui.rpy');
      try {
        await updateGuiRpy(guiRpyPath, width, height, colors);
      } catch (guiError) {
        logger.error('Failed to update gui.rpy:', guiError);
        throw new Error(`Failed to update gui.rpy: ${guiError.message}`);
      }

      // 6. Update options.rpy (project name, save dir, build name)
      const optionsRpyPath = path.join(gameDir, 'options.rpy');
      const saveDir = generateSaveDirectory(projectName);
      try {
        await updateOptionsRpy(optionsRpyPath, projectName, saveDir);
      } catch (optionsError) {
        logger.error('Failed to update options.rpy:', optionsError);
        throw new Error(`Failed to update options.rpy: ${optionsError.message}`);
      }

      // 7. Generate GUI images (optional - lazy load Sharp)
      try {
        // Lazy-load the image generator on first use
        if (!generateGuiImages && !sharpLoadError) {
          try {
            const imageGenModule = await import('./src/lib/guiImageGenerator.js');
            generateGuiImages = imageGenModule.generateGuiImages;
            logger.info('Successfully loaded Sharp for GUI image generation');
          } catch (loadError) {
            sharpLoadError = loadError;
            logger.warn('Failed to load Sharp module:', loadError.message);
            logger.warn('GUI images will use template defaults. This is not critical.');
          }
        }

        if (generateGuiImages) {
          await generateGuiImages(projectDir, colors, width, height);
          logger.info('Custom GUI images generated successfully');
        } else {
          logger.info('Skipping GUI image generation - using template defaults');
        }
      } catch (imageError) {
        logger.error('Failed to generate GUI images:', imageError);
        // Don't fail the entire operation - images are optional
        logger.info('Continuing with template default images');
      }

      // 8. Ensure images/ and audio/ directories exist
      await fs.mkdir(path.join(gameDir, 'images'), { recursive: true });
      await fs.mkdir(path.join(gameDir, 'audio'), { recursive: true });

      logger.info('Project created successfully');
      await vetProjectRoot(projectDir);
      return { success: true, path: projectDir };
    } catch (error) {
      logger.error('Failed to create project from template:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('dialog:showSaveDialog', async (event, options) => {
    try {
      const { canceled, filePath } = await dialog.showSaveDialog(options);
      if (canceled) return null;
      return filePath;
    } catch (error) {
      logger.error('Failed to open save dialog:', error);
      return null;
    }
  });

  ipcMain.handle('dialog:checkRenpyProject', async (event, rootPath) => {
    await guardVettedProjectRoot(rootPath);
    return await checkRenpyProject(rootPath);
  });

  // Fire-and-forget: renderer sends this to immediately terminate the active load worker.
  ipcMain.on('project:cancel-load', () => {
    if (activeLoadWorker) {
      activeLoadWorker.terminate();
      activeLoadWorker = null;
    }
  });

  ipcMain.handle('project:load', async (event, rootPath) => {
    await guardVettedProjectRoot(rootPath);
    currentProjectRoot = rootPath; // Track for screenshots
    // Best-effort: remove any atomic-write temp files stranded by a previous
    // crashed/killed session. The files they were meant to replace were never
    // touched (see atomicWriteFile), so this is pure tidy-up, not recovery.
    cleanupStaleTempFiles(rootPath).catch((err) => logger.warn('Stale temp file cleanup failed:', err));
    const result = await readProjectFiles(rootPath, { readContent: true }, (value, message) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send('project:load-progress', value, message);
      }
    });
    // Surface the project in the macOS Dock's "Recent" menu / Windows taskbar Jump List
    app.addRecentDocument(rootPath);
    // Start watching the project for external file changes
    startProjectWatcher(rootPath);
    return result;
  });

  ipcMain.handle('project:refresh-tree', async (event, rootPath) => {
    await guardVettedProjectRoot(rootPath);
    const result = await readProjectFiles(rootPath, { readContent: false });
    return result.tree;
  });

  ipcMain.handle('project:refresh', async (event, rootPath) => {
    await guardVettedProjectRoot(rootPath);
    return await readProjectFiles(rootPath, { readContent: true });
  });

  ipcMain.handle('fs:writeFile', async (event, filePath, content, encoding) => {
    try {
      await guardProjectPath(filePath);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      // Record self-write so the watcher ignores this change
      const normalizedPath = filePath.replace(/\\/g, '/');
      recentSelfWrites.set(normalizedPath, Date.now());
      // Atomic write (temp file + rename) so a crash/power-loss mid-write can
      // never leave filePath truncated -- it's either the old content or the
      // fully-written new content, never a partial state.
      await atomicWriteFile(filePath, content, encoding);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('fs:createDirectory', async (event, dirPath) => {
    try {
      await guardProjectPath(dirPath);
      await fs.mkdir(dirPath, { recursive: true });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('fs:removeEntry', async (event, entryPath) => {
    try {
      await guardProjectPath(entryPath);
      await fs.rm(entryPath, { recursive: true, force: true });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('fs:moveFile', async (event, oldPath, newPath) => {
    try {
      await guardProjectPath(oldPath);
      await guardProjectPath(newPath);
      await fs.mkdir(path.dirname(newPath), { recursive: true });
      await fs.rename(oldPath, newPath);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('fs:copyEntry', async (event, sourcePath, destPath) => {
    try {
      await guardProjectPath(sourcePath);
      await guardProjectPath(destPath);
      // Ensure the directory exists before copying
      await fs.mkdir(path.dirname(destPath), { recursive: true });
      await fs.cp(sourcePath, destPath, { recursive: true });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Imports a file from OUTSIDE the project (an OS drag-and-drop or a native file-dialog
  // selection -- both genuine user gestures) into game/images/portraits/. Deliberately
  // does NOT guardProjectPath the source: unlike fs:copyEntry, that path is expected to be
  // external. To keep this from becoming an arbitrary-write primitive for a compromised
  // renderer, the destination is computed entirely here (never renderer-supplied) and the
  // filename is reduced to its basename, so no path segment from the input can escape the
  // portraits folder.
  ipcMain.handle('fs:importPortraitImage', async (event, sourcePath) => {
    try {
      if (!currentProjectRoot) throw new Error('No project loaded');
      const stat = await fs.stat(sourcePath);
      if (!stat.isFile()) throw new Error('Source is not a file');

      const fileName = path.basename(sourcePath);
      const destDir = path.join(currentProjectRoot, 'game', 'images', 'portraits');
      await fs.mkdir(destDir, { recursive: true });
      const destPath = path.join(destDir, fileName);
      await fs.cp(sourcePath, destPath, { recursive: false });

      const relPath = `game/images/portraits/${fileName}`;
      return { success: true, relPath, absPath: destPath, mediaUrl: pathToMediaUrl(destPath) };
    } catch (error) {
      logger.error('Failed to import portrait image:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('fs:scanDirectory', async (event, dirPath) => {
      try {
          await guardProjectPath(dirPath);
          const state = { cancelled: false };
          activeScanState = state;
          return await scanDirectoryForAssets(dirPath, {
              isCancelled: () => state.cancelled,
              onProgress: (count) => {
                  if (!event.sender.isDestroyed()) event.sender.send('fs:scan-progress', count);
              },
          });
      } catch (error) {
          logger.error("Scan directory failed:", error);
          return { images: [], audios: [], error: error.message };
      } finally {
          activeScanState = null;
      }
  });

  // Fire-and-forget: renderer sends this to cancel the in-flight asset scan.
  ipcMain.on('fs:cancel-scan-directory', () => {
      if (activeScanState) activeScanState.cancelled = true;
  });
  
  ipcMain.handle('fs:readFile', async (event, filePath) => {
    try {
      await guardProjectPath(filePath);
      const content = await fs.readFile(filePath, 'utf-8');
      return content;
    } catch (error) {
      logger.error("Read file failed:", error);
      throw error;
    }
  });

  ipcMain.handle('fs:fileExists', async (event, filePath) => {
    try {
      await guardProjectPath(filePath);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle('path:join', (event, ...args) => {
    return path.join(...args);
  });

  ipcMain.handle('app:getUserDataPath', () => {
    return app.getPath('userData');
  });

  // --- Snippet pack import/export ---
  // These deliberately do NOT go through guardProjectPath: the user-global path is
  // fixed and computed here (never renderer-supplied), and the export/import paths
  // are chosen by the user via a native dialog opened by this same handler, not
  // passed in from the renderer.
  function getUserGlobalSnippetsPath() {
    return path.join(app.getPath('userData'), 'snippets', 'custom.json');
  }

  ipcMain.handle('snippets:readUserGlobal', async () => {
    try {
      return await fs.readFile(getUserGlobalSnippetsPath(), 'utf-8');
    } catch {
      return null;
    }
  });

  ipcMain.handle('snippets:writeUserGlobal', async (event, content) => {
    try {
      const filePath = getUserGlobalSnippetsPath();
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, content, 'utf-8');
      return { success: true };
    } catch (error) {
      logger.error('Failed to write user global snippets:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('snippets:exportPack', async (event, suggestedFileName, content) => {
    try {
      const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'Export Snippet Pack',
        defaultPath: suggestedFileName,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });
      if (canceled || !filePath) return { success: false, canceled: true };
      await fs.writeFile(filePath, content, 'utf-8');
      return { success: true, filePath };
    } catch (error) {
      logger.error('Failed to export snippet pack:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('snippets:importPack', async () => {
    try {
      const { canceled, filePaths } = await dialog.showOpenDialog({
        title: 'Import Snippet Pack',
        filters: [{ name: 'JSON', extensions: ['json'] }],
        properties: ['openFile'],
      });
      if (canceled || filePaths.length === 0) return { success: false, canceled: true };
      const content = await fs.readFile(filePaths[0], 'utf-8');
      return { success: true, filePath: filePaths[0], content };
    } catch (error) {
      logger.error('Failed to import snippet pack:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.on('reply-unsaved-changes-before-exit', (event, hasUnsavedChanges) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) {
        if (hasUnsavedChanges) {
            window.webContents.send('show-exit-modal');
        } else {
            window.webContents.send('save-ide-state-before-quit');
        }
    }
  });

  ipcMain.on('ide-state-saved-for-quit', () => {
    forceQuit = true;
    app.quit();
  });

  ipcMain.on('force-quit', () => {
    forceQuit = true;
    app.quit();
  });

  // --- Detachable tab windows ---
  // See createPopoutWindow() above and src/hooks/usePopoutSync.ts for the
  // renderer side of this relay. The main window remains the sole owner of
  // app state; these channels just ferry snapshots and RPC calls to/from it.

  ipcMain.handle('window:popout-tab', (event, { tabId, tabType }) => {
    if (popoutWindows.has(tabId)) {
      const existing = popoutWindows.get(tabId);
      if (existing && !existing.isDestroyed()) { existing.focus(); return; }
    }
    if (popoutWindowsPending.has(tabId)) return;
    popoutWindowsPending.add(tabId);
    createPopoutWindow(tabId, tabType).finally(() => popoutWindowsPending.delete(tabId));
  });

  ipcMain.on('window:focus-main', () => {
    if (!mainWindowRef || mainWindowRef.isDestroyed()) return;
    if (mainWindowRef.isMinimized()) mainWindowRef.restore();
    mainWindowRef.focus();
  });

  // The Redock button asks the main process to close its own popout window via
  // IPC rather than calling the renderer's window.close() DOM API directly --
  // confirmed live that window.close() from a popout's renderer makes the window
  // disappear without ever firing the BrowserWindow's 'close'/'closed' events,
  // silently skipping the flush-before-close (see win.on('close') above) and the
  // window-state persistence below. Closing via BrowserWindow#close() from here
  // goes through the exact same lifecycle as the native close button or Cmd+W.
  ipcMain.on('popout:close-self', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win && !win.isDestroyed()) win.close();
  });

  // A popout renderer asks the main window's renderer to run one of its real
  // handlers (updateBlock, handleSaveBlock, ...) so app state only ever has one
  // writer regardless of which window an edit came from. This process just
  // relays the call and waits for the matching reply.
  ipcMain.handle('popout:call-handler', (event, { tabId, handlerName, args }) => {
    if (!mainWindowRef || mainWindowRef.isDestroyed()) {
      return Promise.reject(new Error('Main window is not available'));
    }
    return new Promise((resolve, reject) => {
      const requestId = ++popoutCallRequestId;
      const timeout = setTimeout(() => {
        pendingPopoutCalls.delete(requestId);
        reject(new Error(`Popout handler call '${handlerName}' timed out`));
      }, POPOUT_CALL_TIMEOUT_MS);
      pendingPopoutCalls.set(requestId, { resolve, reject, timeout });
      mainWindowRef.webContents.send('popout:invoke-handler', { requestId, tabId, handlerName, args });
    });
  });

  ipcMain.on('popout:handler-result', (event, { requestId, result, error }) => {
    const pending = pendingPopoutCalls.get(requestId);
    if (!pending) return;
    pendingPopoutCalls.delete(requestId);
    clearTimeout(pending.timeout);
    if (error !== undefined) pending.reject(new Error(error));
    else pending.resolve(result);
  });

  ipcMain.on('popout:flush-complete', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const tabId = win && getTabIdForPopoutWindow(win);
    if (!tabId) return;
    const pending = pendingPopoutFlushAcks.get(tabId);
    if (pending) {
        clearTimeout(pending.timeout);
        pendingPopoutFlushAcks.delete(tabId);
        pending.resolvers.forEach((r) => r());
    }
  });

  // The main window's renderer pushes a fresh props snapshot for one popped-out
  // tab whenever the state it depends on changes.
  ipcMain.on('popout:state-update', (event, { tabId, snapshot }) => {
    const win = popoutWindows.get(tabId);
    if (win && !win.isDestroyed()) win.webContents.send('popout:props-update', snapshot);
  });

  // A just-mounted popout asks for its initial snapshot rather than relying solely
  // on the push above, which can fire before the popout's listener (or even its
  // window) exists -- window:popout-tab is fire-and-forget from the caller's side.
  ipcMain.on('popout:request-snapshot', (event, { tabId }) => {
    if (mainWindowRef && !mainWindowRef.isDestroyed()) {
      mainWindowRef.webContents.send('popout:snapshot-requested', { tabId });
    }
  });

  // Lets the main window's renderer flush every open popout's pending edits into
  // its own state on demand (e.g. before Save All or opening a new project), the
  // same flush mainWindow's own close handler already runs before checking for
  // unsaved changes.
  ipcMain.handle('window:flush-all-popouts', async () => {
    await Promise.all(Array.from(popoutWindows.keys(), requestPopoutFlush));
  });

  // Loading a different project invalidates every open popout -- its relayed RPC
  // calls (updateBlock, setBlockContent, ...) would otherwise keep targeting block
  // ids from the project that's being replaced. The renderer clears its own
  // poppedOutTabs state alongside this call (see useProjectLoad.ts).
  ipcMain.handle('window:close-all-popouts', () => {
    closeAllPopoutWindows();
  });

  // Closes one specific popout window from the main window's side -- e.g. when the
  // tab it was showing has become orphaned (its backing block was deleted) and the
  // main window's own reconciliation has decided it's no longer valid to keep open.
  // Goes through the normal close() path (not destroy()) so the usual flush-before-
  // close and window-state persistence in win.on('close') still run.
  ipcMain.handle('window:close-popout-for-tab', (event, { tabId }) => {
    const win = popoutWindows.get(tabId);
    if (win && !win.isDestroyed()) win.close();
  });

  function setGameRunningMenuState(running) {
    const menu = Menu.getApplicationMenu();
    if (!menu) return;
    const runItem = menu.getMenuItemById('run-project');
    const stopItem = menu.getMenuItemById('stop-project');
    if (runItem) runItem.enabled = !running;
    if (stopItem) stopItem.enabled = running;
  }

  function setExplorerMenuState({ canNewFile, canNewFolder, canRename, canDelete, canRefresh, hasScreenshots, canNewUntitledFile }) {
    const menu = Menu.getApplicationMenu();
    if (!menu) return;
    const ids = {
      'explorer-new-file': canNewFile,
      'explorer-new-folder': canNewFolder,
      'explorer-rename': canRename,
      'explorer-delete': canDelete,
      'explorer-refresh': canRefresh ?? canNewFile,
      'open-screenshots-folder': hasScreenshots,
      'new-untitled-file': canNewUntitledFile
    };
    for (const [id, enabled] of Object.entries(ids)) {
      const item = menu.getMenuItemById(id);
      if (item && enabled !== undefined) item.enabled = enabled;
    }
  }

  ipcMain.on('explorer:update-menu-state', (event, state) => {
    setExplorerMenuState(state);
  });

  ipcMain.on('game:run', (event, renpyPath, projectPath, warpTarget) => {
    if (gameProcess) {
      return;
    }

    try {
      // renpyPath may be an SDK directory or a direct executable path (legacy)
      const executable = getRenpyExecutable(renpyPath) || renpyPath;
      const args = [projectPath];
      if (warpTarget) {
        args.push('--warp', warpTarget);
      }
      const env = warpTarget
        ? {
            ...process.env,
            RENPY_SKIP_MAIN_MENU: '1',
            RENPY_SKIP_SPLASHSCREEN: '1',
          }
        : process.env;
      const launchedAt = Date.now();
      gameProcess = spawn(executable, args, {
        env,
      });
      event.sender.send('game-started');
      setGameRunningMenuState(true);

      gameProcess.on('close', () => {
        gameProcess = null;
        event.sender.send('game-stopped');
        setGameRunningMenuState(false);

        // Ren'Py writes traceback.txt to the project's base directory on an
        // unhandled exception. Surface it if it's fresh (written during this
        // run) -- a stale file from a previous session should stay silent.
        const tracebackPath = path.join(projectPath, 'traceback.txt');
        fs.stat(tracebackPath)
          .then((stat) => {
            if (stat.mtimeMs < launchedAt - 1000) return;
            return fs.readFile(tracebackPath, 'utf-8');
          })
          .then((content) => {
            // Ren'Py writes traceback.txt with a UTF-8 BOM; strip it so it
            // doesn't render as a stray character in the crash modal.
            const clean = content?.replace(/^\uFEFF/, '');
            if (clean && !event.sender.isDestroyed()) {
              event.sender.send('game-crash-log', clean);
            }
          })
          .catch(() => {
            // traceback.txt not present -- normal clean exit, nothing to surface
          });
      });

      gameProcess.on('error', (err) => {
        logger.error('Failed to start game process:', err);
        event.sender.send('game-error', err.message);
        gameProcess = null;
        setGameRunningMenuState(false);
      });

    } catch (err) {
      logger.error('Spawn error:', err);
      event.sender.send('game-error', err.message);
      gameProcess = null;
      setGameRunningMenuState(false);
    }
  });

  ipcMain.on('game:stop', (event) => {
    if (gameProcess) {
      try {
        gameProcess.kill();
      } catch (error) {
        logger.error('Failed to kill game process:', error);
      }
      gameProcess = null;
      event.sender.send('game-stopped');
      setGameRunningMenuState(false);
    }
  });

  ipcMain.handle('app:get-settings', async () => {
    const { settings, warning } = await loadAppSettings();
    // Re-vet persisted recent-project paths for this session (the in-memory
    // vettedProjectRoots set above starts empty on every launch). Safe to
    // trust unconditionally here because app:save-settings (below) only ever
    // persists recentProjects entries that were already vetted.
    if (Array.isArray(settings?.recentProjects)) {
        await Promise.all(settings.recentProjects.map(vetProjectRoot));
    }
    if (warning) {
        broadcastToAllWindows('app:settings-warning', warning);
    }
    return settings;
  });

  ipcMain.handle('app:save-settings', async (event, settings) => {
      // recentProjects flows back from the renderer as part of this blob (it
      // appends to it after every successful project:load). Filter out
      // anything that isn't a vetted root before persisting, so a compromised
      // renderer can't smuggle an arbitrary path in here and have it resurface
      // -- trusted -- as a native "Open Recent" menu entry or in app:get-settings
      // on a later launch.
      if (settings && Array.isArray(settings.recentProjects)) {
          const keep = await Promise.all(settings.recentProjects.map(async (p) => (await isVettedProjectRoot(p)) ? p : null));
          settings = { ...settings, recentProjects: keep.filter(Boolean) };
      }
      const result = await saveAppSettings(settings);
      if (result.success) {
          await updateApplicationMenu();
      }
      return result;
  });

  ipcMain.handle('app:load-api-keys', async () => {
    return await loadApiKeys();
  });

  ipcMain.handle('app:save-api-key', async (event, provider, key) => {
    return await saveApiKey(provider, key);
  });

  ipcMain.handle('app:get-api-key', async (event, provider) => {
    return await getApiKey(provider);
  });

  ipcMain.handle('project:search', async (event, { projectPath, query, ...options }) => {
    if (!query) return { results: [], truncated: false, cancelled: false, skipped: [], regexError: null };
    try {
        await guardProjectPath(projectPath);
        const state = { cancelled: false };
        activeSearchState = state;
        const outcome = await searchInDirectory(projectPath, query, {
            projectPath,
            ...options,
            isCancelled: () => state.cancelled,
            onProgress: (count) => {
                if (!event.sender.isDestroyed()) event.sender.send('project:search-progress', count);
            },
        });
        return outcome;
    } catch (error) {
        logger.error('Search failed:', error);
        return { results: [], truncated: false, cancelled: false, skipped: [], regexError: null };
    } finally {
        activeSearchState = null;
    }
  });

  // Fire-and-forget: renderer sends this to cancel the in-flight project search.
  ipcMain.on('project:cancel-search', () => {
    if (activeSearchState) activeSearchState.cancelled = true;
  });

  createWindow();

  // --- Auto-updater ---
  // Only run in packaged builds; skip in dev to avoid noise.
  if (app.isPackaged) {
    autoUpdater.on('update-available', (info) => {
      if (mainWindowRef) mainWindowRef.webContents.send('update-available', info.version);
    });
    autoUpdater.on('update-not-available', () => {
      if (mainWindowRef) mainWindowRef.webContents.send('update-not-available');
    });
    autoUpdater.on('update-downloaded', (info) => {
      if (mainWindowRef) mainWindowRef.webContents.send('update-downloaded', info.version);
    });
    autoUpdater.on('error', (err) => {
      const msg = err?.message ?? '';
      // Transient server errors (5xx) from GitHub — log as warning, don't surface to user.
      const isTransient = /HttpError:\s*5\d{2}/.test(msg);
      // No latest.yml means no release on this channel yet — treat as up to date.
      const isNoRelease = msg.includes('latest.yml');
      if (isTransient) {
        logger.warn('Auto-updater: transient server error, will retry next launch', err);
        return;
      }
      if (isNoRelease) {
        logger.info('Auto-updater: no release published yet, skipping update check');
        if (mainWindowRef) mainWindowRef.webContents.send('update-not-available');
        return;
      }
      logger.error('Auto-updater error:', err);
      if (mainWindowRef) {
        mainWindowRef.webContents.send('update-error');
      }
    });
    // Delay the initial check so it doesn't compete with app startup.
    setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 5000);
  }

  ipcMain.on('install-update', () => {
    try {
      autoUpdater.quitAndInstall();
    } catch (error) {
      logger.error('Failed to install update:', error);
      dialog.showErrorBox('Update Failed', `Could not install update: ${error.message}`);
    }
  });

  ipcMain.handle('shell:openExternal', async (_event, url) => {
    const urlErr = validateExternalUrl(url);
    if (urlErr) {
      logger.warn(`shell:openExternal blocked: ${urlErr} — url: ${url}`);
      return;
    }
    try {
      await shell.openExternal(url);
    } catch (error) {
      logger.error('Failed to open external URL', error);
    }
  });

  ipcMain.handle('shell:showItemInFolder', async (_event, filePath) => {
    try {
      await guardProjectPath(filePath);
      shell.showItemInFolder(filePath);
    } catch (error) {
      logger.error('Failed to reveal item in folder', error);
    }
  });

  // Logging IPC handlers
  ipcMain.handle('app:get-log-path', () => {
    try {
      return electronLog.transports.file.getFile()?.path || null;
    } catch (error) {
      logger.error('Failed to get log path', error);
      return null;
    }
  });

  ipcMain.handle('app:open-log-directory', async () => {
    try {
      const logPath = electronLog.transports.file.getFile()?.path;
      if (logPath) {
        const logDir = path.dirname(logPath);
        await shell.openPath(logDir);
        return { success: true };
      } else {
        return { success: false, error: 'Log file not found' };
      }
    } catch (error) {
      logger.error('Failed to open log directory', error);
      return { success: false, error: error.message };
    }
  });

  // Handle logging from renderer process
  ipcMain.on('app:log', (_event, level, ...args) => {
    switch (level) {
      case 'error':
        electronLog.error(...args);
        break;
      case 'warn':
        electronLog.warn(...args);
        break;
      case 'info':
        electronLog.info(...args);
        break;
      case 'debug':
        electronLog.debug(...args);
        break;
      default:
        electronLog.info(...args);
    }
  });

  // --- Screenshot Handlers ---
  async function getScreenshotsDir() {
    if (!currentProjectRoot) {
      throw new Error('No project loaded');
    }
    const screenshotsDir = path.join(currentProjectRoot, '.renide', 'screenshots');
    await fs.mkdir(screenshotsDir, { recursive: true });
    return screenshotsDir;
  }

  ipcMain.handle('app:capture-screenshot', async (event) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (!win) throw new Error('No window found');

      const screenshotsDir = await getScreenshotsDir();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filename = `renide-screenshot-${timestamp}.png`;
      const filepath = path.join(screenshotsDir, filename);

      const image = await win.webContents.capturePage();
      const buffer = image.toPNG();
      await fs.writeFile(filepath, buffer);

      logger.info(`Screenshot captured: ${filename}`);
      return { success: true, filepath, filename };
    } catch (error) {
      logger.error('Failed to capture screenshot', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('app:get-screenshot-count', async () => {
    try {
      if (!currentProjectRoot) return 0;
      const screenshotsDir = path.join(currentProjectRoot, '.renide', 'screenshots');
      const entries = await fs.readdir(screenshotsDir).catch(() => []);
      return entries.filter(f => f.endsWith('.png')).length;
    } catch (error) {
      logger.error('Failed to get screenshot count', error);
      return 0;
    }
  });

  ipcMain.handle('app:open-screenshots-folder', async () => {
    try {
      const screenshotsDir = await getScreenshotsDir();
      await shell.openPath(screenshotsDir);
      return { success: true };
    } catch (error) {
      logger.error('Failed to open screenshots folder', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('app:clear-screenshots', async () => {
    try {
      const screenshotsDir = await getScreenshotsDir();
      const entries = await fs.readdir(screenshotsDir);
      const screenshots = entries.filter(f => f.endsWith('.png'));
      await Promise.all(screenshots.map(f => fs.unlink(path.join(screenshotsDir, f))));
      logger.info(`Cleared ${screenshots.length} screenshots`);
      return { success: true, count: screenshots.length };
    } catch (error) {
      logger.error('Failed to clear screenshots', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('app:get-latest-screenshot-path', async () => {
    try {
      const screenshotsDir = await getScreenshotsDir();
      const entries = await fs.readdir(screenshotsDir);
      const screenshots = entries.filter(f => f.endsWith('.png')).sort().reverse();
      if (screenshots.length === 0) return null;
      return path.join(screenshotsDir, screenshots[0]);
    } catch (error) {
      logger.error('Failed to get latest screenshot', error);
      return null;
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (gameProcess) {
    gameProcess.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
