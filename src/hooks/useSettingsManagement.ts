/**
 * @file useSettingsManagement.ts
 * @description Custom hook for managing application and project settings
 *
 * Handles both global app settings (theme, layout, Ren'Py path) and
 * project-specific settings (canvas layout modes, drafting mode). Also
 * manages character profiles and settings validation state.
 */

import { useState } from 'react';
import { useImmer } from 'use-immer';
import type { AppSettings, ProjectSettings } from '@/types';
import { getStoryLayoutVersion } from '@/lib/storyCanvasLayout';
import { getRouteCanvasLayoutVersion } from '@/lib/routeCanvasLayout';

export interface UseSettingsManagementReturn {
  // App settings (global, persisted to userData)
  appSettings: AppSettings;
  updateAppSettings: (updater: (draft: AppSettings) => void) => void;
  appSettingsLoaded: boolean;
  setAppSettingsLoaded: React.Dispatch<React.SetStateAction<boolean>>;

  // Project settings (per-project, persisted to .renide/project.json)
  projectSettings: Omit<ProjectSettings, 'openTabs' | 'activeTabId' | 'stickyNotes' | 'characterProfiles' | 'punchlistMetadata' | 'diagnosticsTasks' | 'ignoredDiagnostics' | 'sceneCompositions' | 'sceneNames' | 'scannedImagePaths' | 'scannedAudioPaths'>;
  updateProjectSettings: (updater: (draft: Omit<ProjectSettings, 'openTabs' | 'activeTabId' | 'stickyNotes' | 'characterProfiles' | 'punchlistMetadata' | 'diagnosticsTasks' | 'ignoredDiagnostics' | 'sceneCompositions' | 'sceneNames' | 'scannedImagePaths' | 'scannedAudioPaths'>) => void) => void;

  // Character profiles (per-project)
  characterProfiles: Record<string, string>;
  setCharacterProfiles: (updater: (draft: Record<string, string>) => void) => void;

  // Validation state
  isRenpyPathValid: boolean;
  setIsRenpyPathValid: React.Dispatch<React.SetStateAction<boolean>>;

  // Translation state
  isGeneratingTranslations: boolean;
  setIsGeneratingTranslations: React.Dispatch<React.SetStateAction<boolean>>;

  // High-level operations
  updateTheme: (theme: AppSettings['theme']) => void;
  updateRenpyPath: (path: string) => void;
  updateEditorFont: (family: string, size: number) => void;
  toggleSidebar: (side: 'left' | 'right') => void;
  updateSidebarWidth: (side: 'left' | 'right', width: number) => void;
  addRecentProject: (path: string) => void;
  removeRecentProject: (path: string) => void;
  clearRecentProjects: () => void;
  resetAppSettings: () => void;
  resetProjectSettings: () => void;
}

/**
 * Hook for managing application and project settings
 *
 * @returns Object containing settings state and management functions
 *
 * @example
 * ```tsx
 * const {
 *   appSettings,
 *   updateAppSettings,
 *   projectSettings,
 *   updateTheme,
 *   addRecentProject
 * } = useSettingsManagement();
 *
 * // Update theme
 * updateTheme('dark');
 *
 * // Add to recent projects
 * addRecentProject('/path/to/project');
 *
 * // Update project setting
 * updateProjectSettings(draft => {
 *   draft.draftingMode = true;
 * });
 * ```
 */
export function useSettingsManagement(): UseSettingsManagementReturn {
  // --- App settings ---
  const [appSettings, updateAppSettings] = useImmer<AppSettings>({
    theme: 'system',
    isLeftSidebarOpen: true,
    leftSidebarWidth: 250,
    isRightSidebarOpen: true,
    rightSidebarWidth: 300,
    renpyPath: '',
    recentProjects: [],
    editorFontFamily: "'Consolas', 'Courier New', monospace",
    editorFontSize: 14,
    mouseGestures: {
      canvasPanGesture: 'shift-drag',
      middleMouseAlwaysPans: false,
      zoomScrollDirection: 'normal',
      zoomScrollSensitivity: 1.0,
    },
    lastProjectDir: '',
  });
  const [appSettingsLoaded, setAppSettingsLoaded] = useState(false);

  // --- Project settings ---
  const [projectSettings, updateProjectSettings] = useImmer<Omit<ProjectSettings, 'openTabs' | 'activeTabId' | 'stickyNotes' | 'characterProfiles' | 'punchlistMetadata' | 'diagnosticsTasks' | 'ignoredDiagnostics' | 'sceneCompositions' | 'sceneNames' | 'scannedImagePaths' | 'scannedAudioPaths'>>({
    draftingMode: false,
    storyCanvasLayoutMode: 'flow-lr',
    storyCanvasGroupingMode: 'none',
    storyCanvasLayoutVersion: getStoryLayoutVersion(),
    storyCanvasLayoutWasUserAdjusted: false,
    routeCanvasLayoutMode: 'flow-lr',
    routeCanvasGroupingMode: 'none',
    routeCanvasLayoutVersion: getRouteCanvasLayoutVersion(),
    routeCanvasLayoutWasUserAdjusted: false,
  });

  // --- Character profiles ---
  const [characterProfiles, setCharacterProfiles] = useImmer<Record<string, string>>({});

  // --- Validation state ---
  const [isRenpyPathValid, setIsRenpyPathValid] = useState(false);

  // --- Translation state ---
  const [isGeneratingTranslations, setIsGeneratingTranslations] = useState(false);

  /**
   * Update theme setting
   */
  const updateTheme = (theme: AppSettings['theme']) => {
    updateAppSettings(draft => {
      draft.theme = theme;
    });
  };

  /**
   * Update Ren'Py executable path
   */
  const updateRenpyPath = (path: string) => {
    updateAppSettings(draft => {
      draft.renpyPath = path;
    });
  };

  /**
   * Update editor font settings
   */
  const updateEditorFont = (family: string, size: number) => {
    updateAppSettings(draft => {
      draft.editorFontFamily = family;
      draft.editorFontSize = size;
    });
  };

  /**
   * Toggle sidebar open/close
   */
  const toggleSidebar = (side: 'left' | 'right') => {
    updateAppSettings(draft => {
      if (side === 'left') {
        draft.isLeftSidebarOpen = !draft.isLeftSidebarOpen;
      } else {
        draft.isRightSidebarOpen = !draft.isRightSidebarOpen;
      }
    });
  };

  /**
   * Update sidebar width
   */
  const updateSidebarWidth = (side: 'left' | 'right', width: number) => {
    updateAppSettings(draft => {
      if (side === 'left') {
        draft.leftSidebarWidth = width;
      } else {
        draft.rightSidebarWidth = width;
      }
    });
  };

  /**
   * Add a project to recent projects list
   */
  const addRecentProject = (path: string) => {
    updateAppSettings(draft => {
      // Remove if already exists
      draft.recentProjects = draft.recentProjects.filter(p => p !== path);
      // Add to front
      draft.recentProjects.unshift(path);
      // Limit to 10
      if (draft.recentProjects.length > 10) {
        draft.recentProjects = draft.recentProjects.slice(0, 10);
      }
    });
  };

  /**
   * Remove a project from recent projects list
   */
  const removeRecentProject = (path: string) => {
    updateAppSettings(draft => {
      draft.recentProjects = draft.recentProjects.filter(p => p !== path);
    });
  };

  /**
   * Clear all recent projects
   */
  const clearRecentProjects = () => {
    updateAppSettings(draft => {
      draft.recentProjects = [];
    });
  };

  /**
   * Reset app settings to defaults
   */
  const resetAppSettings = () => {
    updateAppSettings(draft => {
      draft.theme = 'system';
      draft.isLeftSidebarOpen = true;
      draft.leftSidebarWidth = 250;
      draft.isRightSidebarOpen = true;
      draft.rightSidebarWidth = 300;
      draft.editorFontFamily = "'Consolas', 'Courier New', monospace";
      draft.editorFontSize = 14;
      draft.mouseGestures = {
        canvasPanGesture: 'shift-drag',
        middleMouseAlwaysPans: false,
        zoomScrollDirection: 'normal',
        zoomScrollSensitivity: 1.0,
      };
      // Keep renpyPath, recentProjects, lastProjectDir
    });
  };

  /**
   * Reset project settings to defaults
   */
  const resetProjectSettings = () => {
    updateProjectSettings(draft => {
      draft.draftingMode = false;
      draft.storyCanvasLayoutMode = 'flow-lr';
      draft.storyCanvasGroupingMode = 'none';
      draft.storyCanvasLayoutVersion = getStoryLayoutVersion();
      draft.storyCanvasLayoutWasUserAdjusted = false;
      draft.routeCanvasLayoutMode = 'flow-lr';
      draft.routeCanvasGroupingMode = 'none';
      draft.routeCanvasLayoutVersion = getRouteCanvasLayoutVersion();
      draft.routeCanvasLayoutWasUserAdjusted = false;
    });
  };

  return {
    // App settings
    appSettings,
    updateAppSettings,
    appSettingsLoaded,
    setAppSettingsLoaded,

    // Project settings
    projectSettings,
    updateProjectSettings,

    // Character profiles
    characterProfiles,
    setCharacterProfiles,

    // Validation state
    isRenpyPathValid,
    setIsRenpyPathValid,

    // Translation state
    isGeneratingTranslations,
    setIsGeneratingTranslations,

    // High-level operations
    updateTheme,
    updateRenpyPath,
    updateEditorFont,
    toggleSidebar,
    updateSidebarWidth,
    addRecentProject,
    removeRecentProject,
    clearRecentProjects,
    resetAppSettings,
    resetProjectSettings,
  };
}
