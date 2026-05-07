/**
 * @file builtInApis.ts
 * @description Factory functions for creating plugin API instances.
 * Provides logger, toast, dialog, and settings APIs with proper scoping.
 */

/**
 * Create a logger API instance for a plugin.
 * All log messages are prefixed with the plugin ID.
 */
export function createLoggerApi(pluginId: string) {
  return {
    info: (message: string, ...args: any[]) => {
      console.log(`[Plugin:${pluginId}]`, message, ...args);
    },
    warn: (message: string, ...args: any[]) => {
      console.warn(`[Plugin:${pluginId}]`, message, ...args);
    },
    error: (message: string, ...args: any[]) => {
      console.error(`[Plugin:${pluginId}]`, message, ...args);
    },
  };
}

/**
 * Create a toast API instance that wraps the app's addToast function.
 */
export function createToastApi(addToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void) {
  return (message: string, type?: 'success' | 'error' | 'warning' | 'info') => {
    addToast(message, type);
  };
}

/**
 * Create a dialog API instance for showing messages to the user.
 * Uses native alert dialogs for Phase 1 (can be enhanced with custom modals later).
 */
export function createDialogApi() {
  return {
    showMessage: async (title: string, message: string) => {
      alert(`${title}\n\n${message}`);
    },
    showError: async (title: string, message: string) => {
      alert(`ERROR: ${title}\n\n${message}`);
    },
  };
}

/**
 * Create a settings API instance for a plugin.
 * Provides namespaced get/set access to plugin-specific persistent data.
 */
export function createSettingsApi(
  pluginId: string,
  pluginSettings: Record<string, any>,
  onSave: (pluginId: string, data: any) => Promise<void>
) {
  return {
    get: (key: string, defaultValue?: any) => {
      const pluginData = pluginSettings[pluginId] || {};
      return pluginData[key] !== undefined ? pluginData[key] : defaultValue;
    },
    set: async (key: string, value: any) => {
      const pluginData = { ...(pluginSettings[pluginId] || {}), [key]: value };
      await onSave(pluginId, pluginData);
    },
  };
}
