/**
 * @file PluginContext.tsx
 * @description React Context provider for plugin state and API access.
 * Provides read-only state snapshots and utility APIs to plugin components.
 */

import React, { createContext, useContext, useMemo } from 'react';
import type { PluginContextValue } from '@/plugins/pluginTypes';
import type { Block, RenpyAnalysisResult, ProjectImage, RenpyAudio } from '@/types';
import { createLoggerApi, createToastApi, createDialogApi, createSettingsApi } from './builtInApis';

const PluginContext = createContext<PluginContextValue | null>(null);

interface PluginContextProviderProps {
  pluginId: string;
  pluginVersion: string;
  blocks: Block[];
  analysisResult: RenpyAnalysisResult;
  projectImages: Map<string, ProjectImage>;
  projectAudios: Map<string, RenpyAudio>;
  projectRootPath: string | null;
  addToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  pluginSettings: Record<string, any>;
  onSavePluginSettings: (pluginId: string, data: any) => Promise<void>;
  children: React.ReactNode;
}

/**
 * PluginContextProvider wraps plugin UI components and provides access to IDE state and APIs.
 * All state is provided as immutable snapshots to prevent plugins from mutating IDE state.
 */
export function PluginContextProvider({
  pluginId,
  pluginVersion,
  blocks,
  analysisResult,
  projectImages,
  projectAudios,
  projectRootPath,
  addToast,
  pluginSettings,
  onSavePluginSettings,
  children,
}: PluginContextProviderProps) {
  const contextValue = useMemo<PluginContextValue>(() => {
    // Extract characters and variables from analysis result
    const characters = analysisResult.characters;
    const variables = Array.from(analysisResult.variables.values());

    return {
      state: {
        // Shallow copy blocks for immutability
        blocks: blocks.map(b => ({ ...b })),
        analysisResult,
        projectImages,
        projectAudios,
        characters,
        variables,
        projectRootPath,
      },
      api: {
        logger: createLoggerApi(pluginId),
        toast: createToastApi(addToast),
        dialog: createDialogApi(),
      },
      settings: createSettingsApi(pluginId, pluginSettings, onSavePluginSettings),
      plugin: {
        id: pluginId,
        version: pluginVersion,
      },
    };
  }, [
    pluginId,
    pluginVersion,
    blocks,
    analysisResult,
    projectImages,
    projectAudios,
    projectRootPath,
    addToast,
    pluginSettings,
    onSavePluginSettings,
  ]);

  return (
    <PluginContext.Provider value={contextValue}>
      {children}
    </PluginContext.Provider>
  );
}

/**
 * Hook to access plugin context from within plugin components.
 * Must be used within a PluginContextProvider.
 */
export function usePluginContext(): PluginContextValue {
  const context = useContext(PluginContext);
  if (!context) {
    throw new Error('usePluginContext must be used within PluginContextProvider');
  }
  return context;
}
