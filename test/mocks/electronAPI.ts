/**
 * @file test/mocks/electronAPI.ts
 * @description Factory for a fully-typed mock of window.electronAPI.
 * Matches the preload bridge contract defined in types.ts / preload.js.
 *
 * Usage in tests:
 *   import { createMockElectronAPI, installElectronAPI } from '../mocks/electronAPI';
 *
 *   // Option A: get the mock to configure return values
 *   const api = createMockElectronAPI();
 *   api.loadProject.mockResolvedValue({ blocks: [], settings: {} });
 *   installElectronAPI(api);
 *
 *   // Option B: install with defaults (all methods return sensible no-ops)
 *   const api = installElectronAPI();
 */

import { vi } from 'vitest';
import type { AppSettings, SearchResult } from '../../types';

/** The shape of window.electronAPI as exposed by preload.js. */
export interface MockElectronAPI {
  // Directory / project
  openDirectory: ReturnType<typeof vi.fn<[], Promise<string | null>>>;
  createProject: ReturnType<typeof vi.fn<[], Promise<string | null>>>;
  loadProject: ReturnType<typeof vi.fn<[string], Promise<any>>>;
  refreshProjectTree: ReturnType<typeof vi.fn<[string], Promise<any>>>;

  // File system
  writeFile: ReturnType<typeof vi.fn<[string, string, string?], Promise<{ success: boolean; error?: string }>>>;
  createDirectory: ReturnType<typeof vi.fn<[string], Promise<{ success: boolean; error?: string }>>>;
  removeEntry: ReturnType<typeof vi.fn<[string], Promise<{ success: boolean; error?: string }>>>;
  moveFile: ReturnType<typeof vi.fn<[string, string], Promise<{ success: boolean; error?: string }>>>;
  copyEntry: ReturnType<typeof vi.fn<[string, string], Promise<{ success: boolean; error?: string }>>>;
  scanDirectory: ReturnType<typeof vi.fn<[string], Promise<{ images: any[]; audios: any[] }>>>;

  // Menu commands
  onMenuCommand: ReturnType<typeof vi.fn<[(...args: unknown[]) => unknown], () => void>>;

  // Exit flow
  onCheckUnsavedChangesBeforeExit: ReturnType<typeof vi.fn<[(...args: unknown[]) => unknown], () => void>>;
  replyUnsavedChangesBeforeExit: ReturnType<typeof vi.fn<[boolean], void>>;
  onShowExitModal: ReturnType<typeof vi.fn<[(...args: unknown[]) => unknown], () => void>>;
  onSaveIdeStateBeforeQuit: ReturnType<typeof vi.fn<[(...args: unknown[]) => unknown], () => void>>;
  ideStateSavedForQuit: ReturnType<typeof vi.fn<[], void>>;
  forceQuit: ReturnType<typeof vi.fn<[], void>>;

  // Game execution
  selectRenpy: ReturnType<typeof vi.fn<[], Promise<string | null>>>;
  runGame: ReturnType<typeof vi.fn<[string, string], void>>;
  stopGame: ReturnType<typeof vi.fn<[], void>>;
  checkRenpyPath: ReturnType<typeof vi.fn<[string], Promise<boolean>>>;
  onGameStarted: ReturnType<typeof vi.fn<[(...args: unknown[]) => unknown], () => void>>;
  onGameStopped: ReturnType<typeof vi.fn<[(...args: unknown[]) => unknown], () => void>>;
  onGameError: ReturnType<typeof vi.fn<[(...args: unknown[]) => unknown], () => void>>;

  // Settings & API keys
  getAppSettings: ReturnType<typeof vi.fn<[], Promise<Partial<AppSettings> | null>>>;
  saveAppSettings: ReturnType<typeof vi.fn<[AppSettings], Promise<{ success: boolean; error?: string }>>>;
  loadApiKeys: ReturnType<typeof vi.fn<[], Promise<Record<string, string>>>>;
  saveApiKey: ReturnType<typeof vi.fn<[string, string], Promise<{ success: boolean; error?: string }>>>;
  getApiKey: ReturnType<typeof vi.fn<[string], Promise<string | null>>>;

  // Auto-updater
  onUpdateAvailable: ReturnType<typeof vi.fn<[(...args: unknown[]) => unknown], () => void>>;
  onUpdateNotAvailable: ReturnType<typeof vi.fn<[(...args: unknown[]) => unknown], () => void>>;
  onUpdateError: ReturnType<typeof vi.fn<[(...args: unknown[]) => unknown], () => void>>;
  onUpdateDownloaded: ReturnType<typeof vi.fn<[(...args: unknown[]) => unknown], () => void>>;
  installUpdate: ReturnType<typeof vi.fn<[], void>>;

  // Shell
  openExternal: ReturnType<typeof vi.fn<[string], Promise<void>>>;

  // Search & dialogs
  searchInProject: ReturnType<typeof vi.fn<[any], Promise<SearchResult[]>>>;
  showSaveDialog: ReturnType<typeof vi.fn<[any], Promise<string | null>>>;
  path: {
    join: ReturnType<typeof vi.fn<[...string[]], Promise<string>>>;
  };
}

/**
 * Creates a fresh mock of the complete electronAPI with sensible defaults.
 * All methods are vi.fn() instances — configure return values as needed.
 */
export function createMockElectronAPI(): MockElectronAPI {
  const noopUnsubscribe = vi.fn();

  return {
    // Directory / project
    openDirectory: vi.fn().mockResolvedValue(null),
    createProject: vi.fn().mockResolvedValue(null),
    loadProject: vi.fn().mockResolvedValue({ blocks: [], settings: {} }),
    refreshProjectTree: vi.fn().mockResolvedValue({ name: 'game', path: '/project', children: [] }),

    // File system
    writeFile: vi.fn().mockResolvedValue({ success: true }),
    createDirectory: vi.fn().mockResolvedValue({ success: true }),
    removeEntry: vi.fn().mockResolvedValue({ success: true }),
    moveFile: vi.fn().mockResolvedValue({ success: true }),
    copyEntry: vi.fn().mockResolvedValue({ success: true }),
    scanDirectory: vi.fn().mockResolvedValue({ images: [], audios: [] }),

    // Menu commands — returns an unsubscribe function
    onMenuCommand: vi.fn().mockReturnValue(noopUnsubscribe),

    // Exit flow
    onCheckUnsavedChangesBeforeExit: vi.fn().mockReturnValue(noopUnsubscribe),
    replyUnsavedChangesBeforeExit: vi.fn(),
    onShowExitModal: vi.fn().mockReturnValue(noopUnsubscribe),
    onSaveIdeStateBeforeQuit: vi.fn().mockReturnValue(noopUnsubscribe),
    ideStateSavedForQuit: vi.fn(),
    forceQuit: vi.fn(),

    // Game execution
    selectRenpy: vi.fn().mockResolvedValue(null),
    runGame: vi.fn(),
    stopGame: vi.fn(),
    checkRenpyPath: vi.fn().mockResolvedValue(false),
    onGameStarted: vi.fn().mockReturnValue(noopUnsubscribe),
    onGameStopped: vi.fn().mockReturnValue(noopUnsubscribe),
    onGameError: vi.fn().mockReturnValue(noopUnsubscribe),

    // Settings & API keys
    getAppSettings: vi.fn().mockResolvedValue(null),
    saveAppSettings: vi.fn().mockResolvedValue({ success: true }),
    loadApiKeys: vi.fn().mockResolvedValue({}),
    saveApiKey: vi.fn().mockResolvedValue({ success: true }),
    getApiKey: vi.fn().mockResolvedValue(null),

    // Auto-updater
    onUpdateAvailable: vi.fn().mockReturnValue(noopUnsubscribe),
    onUpdateNotAvailable: vi.fn().mockReturnValue(noopUnsubscribe),
    onUpdateError: vi.fn().mockReturnValue(noopUnsubscribe),
    onUpdateDownloaded: vi.fn().mockReturnValue(noopUnsubscribe),
    installUpdate: vi.fn(),

    // Shell
    openExternal: vi.fn().mockResolvedValue(undefined),

    // Search & dialogs
    searchInProject: vi.fn().mockResolvedValue([]),
    showSaveDialog: vi.fn().mockResolvedValue(null),
    path: {
      join: vi.fn().mockImplementation((...paths: string[]) => Promise.resolve(paths.join('/'))),
    },
  };
}

/**
 * Creates a mock electronAPI and installs it on window.electronAPI.
 * Returns the mock for further configuration.
 * Call this in beforeEach; cleanup is automatic since window.electronAPI
 * is reset to undefined in the global setup.
 */
export function installElectronAPI(api?: MockElectronAPI): MockElectronAPI {
  const mock = api ?? createMockElectronAPI();
  (window as any).electronAPI = mock;
  return mock;
}

/**
 * Removes the electronAPI mock from window, restoring the default state.
 */
export function uninstallElectronAPI(): void {
  (window as any).electronAPI = undefined;
}
