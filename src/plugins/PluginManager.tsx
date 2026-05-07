/**
 * @file PluginManager.tsx
 * @description Plugin lifecycle orchestration component.
 * Handles discovery, loading, initialization, and cleanup of plugins.
 */

import { useEffect, useState } from 'react';
import type { LoadedPlugin, PluginInstance } from '@/plugins/pluginTypes';
import type { Block, RenpyAnalysisResult, ProjectImage, RenpyAudio } from '@/types';
import { discoverPlugins, loadPluginModule } from './pluginLoader';

interface PluginManagerProps {
  projectRootPath: string | null;
  blocks: Block[];
  analysisResult: RenpyAnalysisResult;
  projectImages: Map<string, ProjectImage>;
  projectAudios: Map<string, RenpyAudio>;
  addToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  pluginSettings: Record<string, any>;
  onPluginsLoaded: (plugins: LoadedPlugin[]) => void;
  onSavePluginSettings: (pluginId: string, data: any) => Promise<void>;
}

/**
 * PluginManager component handles the plugin system lifecycle.
 * Mounted by App.tsx to manage all plugin operations.
 */
export function PluginManager({
  projectRootPath,
  blocks,
  analysisResult,
  projectImages,
  projectAudios,
  addToast,
  pluginSettings,
  onPluginsLoaded,
  onSavePluginSettings,
}: PluginManagerProps) {
  const [loadedPlugins, setLoadedPlugins] = useState<LoadedPlugin[]>([]);

  // Discover and load plugins on mount (when project loads)
  useEffect(() => {
    if (!projectRootPath) {
      // No project loaded, clear plugins
      setLoadedPlugins([]);
      onPluginsLoaded([]);
      return;
    }

    async function initializePlugins() {
      console.log('[PluginManager] Discovering plugins...');

      try {
        // Discover plugins
        const discovered = await discoverPlugins();
        console.log(`[PluginManager] Discovered ${discovered.length} plugin(s)`);

        if (discovered.length === 0) {
          setLoadedPlugins([]);
          onPluginsLoaded([]);
          return;
        }

        // Load and initialize each plugin
        const loaded: LoadedPlugin[] = [];

        for (const { manifest, entryPath } of discovered) {
          try {
            console.log(`[PluginManager] Loading plugin ${manifest.id}...`);

            // Load plugin module
            const factory = await loadPluginModule(entryPath);
            if (!factory) {
              console.error(`[PluginManager] Failed to load plugin ${manifest.id}`);
              continue;
            }

            // Create context value for plugin initialization
            const contextValue = {
              state: {
                blocks: blocks.map(b => ({ ...b })),
                analysisResult,
                projectImages,
                projectAudios,
                characters: analysisResult.characters,
                variables: Array.from(analysisResult.variables.values()),
                projectRootPath,
              },
              api: {
                logger: {
                  info: (message: string, ...args: any[]) => console.log(`[Plugin:${manifest.id}]`, message, ...args),
                  warn: (message: string, ...args: any[]) => console.warn(`[Plugin:${manifest.id}]`, message, ...args),
                  error: (message: string, ...args: any[]) => console.error(`[Plugin:${manifest.id}]`, message, ...args),
                },
                toast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => addToast(message, type),
                dialog: {
                  showMessage: async (title: string, message: string) => alert(`${title}\n\n${message}`),
                  showError: async (title: string, message: string) => alert(`ERROR: ${title}\n\n${message}`),
                },
              },
              settings: {
                get: (key: string, defaultValue?: any) => {
                  const pluginData = pluginSettings[manifest.id] || {};
                  return pluginData[key] !== undefined ? pluginData[key] : defaultValue;
                },
                set: async (key: string, value: any) => {
                  const pluginData = { ...(pluginSettings[manifest.id] || {}), [key]: value };
                  await onSavePluginSettings(manifest.id, pluginData);
                },
              },
              plugin: {
                id: manifest.id,
                version: manifest.version,
              },
            };

            // Initialize plugin by calling factory function
            let instance: PluginInstance | null = null;
            try {
              instance = factory(contextValue);
              console.log(`[PluginManager] Plugin ${manifest.id} initialized successfully`);
            } catch (err) {
              console.error(`[PluginManager] Plugin ${manifest.id} initialization failed:`, err);
              continue;
            }

            // Add to loaded plugins
            loaded.push({
              id: manifest.id,
              manifest,
              entryPath,
              instance,
            });
          } catch (err) {
            console.error(`[PluginManager] Error loading plugin ${manifest.id}:`, err);
          }
        }

        console.log(`[PluginManager] Successfully loaded ${loaded.length} plugin(s)`);
        setLoadedPlugins(loaded);
        onPluginsLoaded(loaded);
      } catch (err) {
        console.error('[PluginManager] Error initializing plugins:', err);
        setLoadedPlugins([]);
        onPluginsLoaded([]);
      }
    }

    initializePlugins();

    // Cleanup: call onDestroy for all loaded plugins
    return () => {
      loadedPlugins.forEach(plugin => {
        if (plugin.instance?.onDestroy) {
          try {
            plugin.instance.onDestroy();
            console.log(`[PluginManager] Plugin ${plugin.id} destroyed`);
          } catch (err) {
            console.error(`[PluginManager] Error destroying plugin ${plugin.id}:`, err);
          }
        }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectRootPath]); // Only re-run when project changes

  // PluginManager doesn't render anything - it's just for lifecycle management
  return null;
}
