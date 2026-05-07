/**
 * @file types.d.ts
 * @description Type definitions for external plugin authors.
 * This file provides a simplified, stable API surface for third-party plugins.
 */

// Simplified types for plugin authors (hiding internal implementation details)

/**
 * Basic block information available to plugins.
 */
export interface PluginBlock {
  id: string;
  content: string;
  title?: string;
  filePath?: string;
  color?: string;
}

/**
 * Character information available to plugins.
 */
export interface PluginCharacter {
  name: string;
  tag: string;
  color: string;
  profile?: string;
}

/**
 * Variable information available to plugins.
 */
export interface PluginVariable {
  name: string;
  type: 'define' | 'default' | 'implicit';
  initialValue: string;
}

/**
 * Label information available to plugins.
 */
export interface PluginLabel {
  label: string;
  blockId: string;
  line: number;
  type: 'label' | 'menu';
}

/**
 * Image asset information available to plugins.
 */
export interface PluginImage {
  filePath: string;
  fileName: string;
  isInProject: boolean;
}

/**
 * Audio asset information available to plugins.
 */
export interface PluginAudio {
  filePath: string;
  fileName: string;
  isInProject: boolean;
}

/**
 * Context value provided to plugins via React Context.
 * Gives read-only access to IDE state and utility APIs.
 */
export interface PluginContextValue {
  /** Read-only IDE state */
  state: {
    /** All story blocks in the project */
    blocks: PluginBlock[];
    /** Character definitions */
    characters: Map<string, PluginCharacter>;
    /** Variable definitions */
    variables: PluginVariable[];
    /** Label definitions */
    labels: Record<string, PluginLabel>;
    /** Project images */
    projectImages: Map<string, PluginImage>;
    /** Project audio files */
    projectAudios: Map<string, PluginAudio>;
    /** Project root directory path */
    projectRootPath: string | null;
  };

  /** Utility APIs */
  api: {
    /** Logging API with plugin ID prefix */
    logger: {
      info: (message: string, ...args: any[]) => void;
      warn: (message: string, ...args: any[]) => void;
      error: (message: string, ...args: any[]) => void;
    };
    /** Toast notification API */
    toast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
    /** Dialog API */
    dialog: {
      showMessage: (title: string, message: string) => Promise<void>;
      showError: (title: string, message: string) => Promise<void>;
    };
  };

  /** Settings persistence API */
  settings: {
    /** Get a plugin setting value */
    get: (key: string, defaultValue?: any) => any;
    /** Set a plugin setting value */
    set: (key: string, value: any) => Promise<void>;
  };

  /** Plugin metadata */
  plugin: {
    /** Plugin ID from manifest */
    id: string;
    /** Plugin version from manifest */
    version: string;
  };
}

/**
 * Plugin instance returned by plugin factory function.
 * Provides lifecycle hooks and UI components.
 */
export interface PluginInstance {
  /** Optional cleanup function called when plugin is unloaded */
  onDestroy?: () => void;
  /** Tab components keyed by tab ID from manifest */
  tabs?: Record<string, React.ComponentType>;
}

/**
 * Plugin factory function signature.
 * This is the default export from your plugin entry file.
 *
 * @example
 * ```typescript
 * import type { PluginContextValue, PluginInstance } from '@vangard-ide/plugin-api';
 *
 * export default function initPlugin(context: PluginContextValue): PluginInstance {
 *   context.api.logger.info('Plugin loaded!');
 *
 *   return {
 *     tabs: {
 *       'my-tab': () => <div>Hello from plugin!</div>,
 *     },
 *     onDestroy: () => {
 *       context.api.logger.info('Plugin unloading');
 *     },
 *   };
 * }
 * ```
 */
export type PluginFactory = (context: PluginContextValue) => PluginInstance;
