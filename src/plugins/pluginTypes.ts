/**
 * @file pluginTypes.ts
 * @description Core plugin system type definitions.
 * Re-exports types from types.ts for internal plugin system use.
 */

export type {
  PluginManifest,
  LoadedPlugin,
  PluginInstance,
  PluginFactory,
  PluginContextValue,
} from '@/types';
