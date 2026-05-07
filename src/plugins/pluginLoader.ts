/**
 * @file pluginLoader.ts
 * @description Plugin discovery, validation, and loading system.
 * Scans the plugins directory, validates manifests, checks version compatibility,
 * and dynamically imports plugin modules.
 */

import type { PluginManifest, PluginFactory } from '@/plugins/pluginTypes';

const CURRENT_IDE_VERSION = '0.8.2';

/**
 * Parse semantic version string into comparable parts.
 */
function parseVersion(version: string): { major: number; minor: number; patch: number } | null {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  };
}

/**
 * Check if plugin's minIdeVersion is compatible with current IDE version.
 * Uses semantic versioning: plugin requires IDE >= minIdeVersion.
 */
export function checkVersionCompatibility(minIdeVersion: string): boolean {
  const current = parseVersion(CURRENT_IDE_VERSION);
  const required = parseVersion(minIdeVersion);

  if (!current || !required) {
    console.warn('[Plugin Loader] Invalid version format');
    return false;
  }

  // Major version must match
  if (current.major !== required.major) {
    return false;
  }

  // If major matches, check minor
  if (current.minor < required.minor) {
    return false;
  }

  // If major and minor match, check patch
  if (current.minor === required.minor && current.patch < required.patch) {
    return false;
  }

  return true;
}

/**
 * Validate plugin manifest structure.
 * Returns { valid: true } or { valid: false, errors: string[] }.
 */
export function validateManifest(manifest: any): { valid: boolean; errors?: string[] } {
  const errors: string[] = [];

  const requiredFields = ['id', 'name', 'version', 'description', 'author', 'entry', 'minIdeVersion'];
  for (const field of requiredFields) {
    if (!manifest[field] || typeof manifest[field] !== 'string') {
      errors.push(`Missing or invalid required field: ${field}`);
    }
  }

  // Validate ID format (kebab-case)
  if (manifest.id && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(manifest.id)) {
    errors.push('Plugin ID must be kebab-case (lowercase alphanumeric with hyphens)');
  }

  // Validate version format
  if (manifest.version && !parseVersion(manifest.version)) {
    errors.push('Plugin version must be semantic version (e.g., "1.0.0")');
  }

  // Validate minIdeVersion format
  if (manifest.minIdeVersion && !parseVersion(manifest.minIdeVersion)) {
    errors.push('minIdeVersion must be semantic version (e.g., "0.8.0")');
  }

  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}

/**
 * Discover plugins in the plugins directory.
 * Returns array of plugin manifests with their entry paths.
 */
export async function discoverPlugins(): Promise<Array<{ manifest: PluginManifest; entryPath: string }>> {
  if (!window.electronAPI?.getUserDataPath || !window.electronAPI?.path?.join || !window.electronAPI?.readFile || !window.electronAPI?.fileExists || !window.electronAPI?.listDirectories) {
    console.warn('[Plugin Loader] Electron API not available - plugin system disabled in web mode');
    return [];
  }

  try {
    // Get user data directory
    const userDataPath = await window.electronAPI.getUserDataPath();
    if (!userDataPath) {
      console.warn('[Plugin Loader] Could not get user data path');
      return [];
    }

    // Construct plugins directory path
    const pluginsDir = await window.electronAPI.path.join(userDataPath, 'plugins');

    // Check if plugins directory exists
    const pluginsDirExists = await window.electronAPI.fileExists(pluginsDir);
    if (!pluginsDirExists) {
      console.info('[Plugin Loader] Plugins directory does not exist, no plugins loaded');
      return [];
    }

    // Scan for plugin directories
    const pluginDirs = await window.electronAPI.listDirectories(pluginsDir);
    if (pluginDirs.length === 0) {
      console.info('[Plugin Loader] No plugin directories found');
      return [];
    }

    const discovered: Array<{ manifest: PluginManifest; entryPath: string }> = [];

    for (const dirName of pluginDirs) {
      try {
        const manifestPath = await window.electronAPI.path.join(pluginsDir, dirName, 'manifest.json');
        const manifestExists = await window.electronAPI.fileExists(manifestPath);

        if (!manifestExists) {
          console.warn(`[Plugin Loader] No manifest.json found in ${dirName}`);
          continue;
        }

        const manifestContent = await window.electronAPI.readFile(manifestPath);
        const manifest = JSON.parse(manifestContent);

        // Validate manifest
        const validation = validateManifest(manifest);
        if (!validation.valid) {
          console.error(`[Plugin Loader] Invalid manifest in ${dirName}:`, validation.errors);
          continue;
        }

        // Check version compatibility
        if (!checkVersionCompatibility(manifest.minIdeVersion)) {
          console.warn(`[Plugin Loader] Plugin ${manifest.id} requires IDE >= ${manifest.minIdeVersion}, current version is ${CURRENT_IDE_VERSION}`);
          continue;
        }

        // Construct entry path
        const entryPath = await window.electronAPI.path.join(pluginsDir, dirName, manifest.entry);

        discovered.push({ manifest, entryPath });
        console.log(`[Plugin Loader] Discovered plugin: ${manifest.name} v${manifest.version}`);
      } catch (err) {
        console.error(`[Plugin Loader] Error processing plugin ${dirName}:`, err);
      }
    }

    return discovered;
  } catch (err) {
    console.error('[Plugin Loader] Error discovering plugins:', err);
    return [];
  }
}

/**
 * Dynamically load a plugin module and extract the factory function.
 * Returns the plugin factory function or null on error.
 */
export async function loadPluginModule(entryPath: string): Promise<PluginFactory | null> {
  try {
    // Dynamic import with @vite-ignore to bypass Vite's static analysis
    const module = await import(/* @vite-ignore */ entryPath);

    // Extract default export
    const factory = module.default;

    // Validate that default export is a function
    if (typeof factory !== 'function') {
      console.error(`[Plugin Loader] Plugin entry ${entryPath} does not export a function as default export`);
      return null;
    }

    return factory as PluginFactory;
  } catch (err) {
    console.error(`[Plugin Loader] Failed to load plugin module ${entryPath}:`, err);
    return null;
  }
}
