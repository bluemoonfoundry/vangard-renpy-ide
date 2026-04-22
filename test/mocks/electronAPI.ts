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

import { vi, type Mock } from 'vitest';
import type { AppSettings, SearchResult } from '../../types';

interface MockLoadedProject {
  blocks: unknown[];
  settings: Record<string, unknown>;
}

interface MockRefreshProjectTree {
  name: string;
  path: string;
  children: unknown[];
}

interface MockScannedDirectory {
  images: unknown[];
  audios: unknown[];
}

interface SearchInProjectArgs {
  projectPath: string;
  query: string;
  isCaseSensitive?: boolean;
  isWholeWord?: boolean;
  isRegex?: boolean;
}

interface SaveDialogOptions {
  title?: string;
  defaultPath?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
}

type Unsubscribe = () => void;

/** The shape of window.electronAPI as exposed by preload.js. */
export interface MockElectronAPI {
  // Directory / project
  openDirectory: Mock<() => Promise<string | null>>;
  createProject: Mock<() => Promise<string | null>>;
  loadProject: Mock<(path: string) => Promise<MockLoadedProject>>;
  refreshProjectTree: Mock<(path: string) => Promise<MockRefreshProjectTree>>;

  // File system
  readFile: Mock<(path: string) => Promise<string>>;
  fileExists: Mock<(path: string) => Promise<boolean>>;
  writeFile: Mock<(path: string, content: string, encoding?: string) => Promise<{ success: boolean; error?: string }>>;
  createDirectory: Mock<(path: string) => Promise<{ success: boolean; error?: string }>>;
  removeEntry: Mock<(path: string) => Promise<{ success: boolean; error?: string }>>;
  moveFile: Mock<(oldPath: string, newPath: string) => Promise<{ success: boolean; error?: string }>>;
  copyEntry: Mock<(sourcePath: string, destPath: string) => Promise<{ success: boolean; error?: string }>>;
  scanDirectory: Mock<(path: string) => Promise<MockScannedDirectory>>;

  // Menu commands
  onMenuCommand: Mock<(callback: (...args: unknown[]) => unknown) => Unsubscribe>;

  // Exit flow
  onCheckUnsavedChangesBeforeExit: Mock<(callback: (...args: unknown[]) => unknown) => Unsubscribe>;
  replyUnsavedChangesBeforeExit: Mock<(hasUnsaved: boolean) => void>;
  onShowExitModal: Mock<(callback: (...args: unknown[]) => unknown) => Unsubscribe>;
  onSaveIdeStateBeforeQuit: Mock<(callback: (...args: unknown[]) => unknown) => Unsubscribe>;
  ideStateSavedForQuit: Mock<() => void>;
  forceQuit: Mock<() => void>;

  // Game execution
  selectRenpy: Mock<() => Promise<string | null>>;
  runGame: Mock<(renpyPath: string, projectPath: string, warpTarget?: string) => void>;
  stopGame: Mock<() => void>;
  checkRenpyPath: Mock<(path: string) => Promise<boolean>>;
  generateTranslations: Mock<(sdkDir: string, projectPath: string, language: string) => Promise<{ success: boolean; output: string; error?: string }>>;
  onGameStarted: Mock<(callback: (...args: unknown[]) => unknown) => Unsubscribe>;
  onGameStopped: Mock<(callback: (...args: unknown[]) => unknown) => Unsubscribe>;
  onGameError: Mock<(callback: (...args: unknown[]) => unknown) => Unsubscribe>;

  // Settings
  getAppSettings: Mock<() => Promise<Partial<AppSettings> | null>>;
  saveAppSettings: Mock<(settings: AppSettings) => Promise<{ success: boolean; error?: string }>>;
  getUserDataPath: Mock<() => Promise<string>>;

  // Auto-updater
  onUpdateAvailable: Mock<(callback: (...args: unknown[]) => unknown) => Unsubscribe>;
  onUpdateNotAvailable: Mock<(callback: (...args: unknown[]) => unknown) => Unsubscribe>;
  onUpdateError: Mock<(callback: (...args: unknown[]) => unknown) => Unsubscribe>;
  onUpdateDownloaded: Mock<(callback: (...args: unknown[]) => unknown) => Unsubscribe>;
  installUpdate: Mock<() => void>;

  // Shell
  openExternal: Mock<(url: string) => Promise<void>>;

  // Search & dialogs
  searchInProject: Mock<(args: SearchInProjectArgs) => Promise<SearchResult[]>>;
  showSaveDialog: Mock<(options: SaveDialogOptions) => Promise<string | null>>;
  path: {
    join: Mock<(...paths: string[]) => Promise<string>>;
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
    readFile: vi.fn().mockResolvedValue(''),
    fileExists: vi.fn().mockResolvedValue(false),
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
    generateTranslations: vi.fn().mockResolvedValue({ success: true, output: '' }),
    onGameStarted: vi.fn().mockReturnValue(noopUnsubscribe),
    onGameStopped: vi.fn().mockReturnValue(noopUnsubscribe),
    onGameError: vi.fn().mockReturnValue(noopUnsubscribe),

    // Settings
    getAppSettings: vi.fn().mockResolvedValue(null),
    saveAppSettings: vi.fn().mockResolvedValue({ success: true }),
    getUserDataPath: vi.fn().mockResolvedValue('/mock/userdata'),

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
  // Cast through unknown so simplified mock types don't conflict with the
  // full window.electronAPI interface (which requires the real ProjectLoadResult, etc.)
  (window as { electronAPI?: unknown }).electronAPI = mock;
  return mock;
}

/**
 * Removes the electronAPI mock from window, restoring the default state.
 */
export function uninstallElectronAPI(): void {
  (window as { electronAPI?: unknown }).electronAPI = undefined;
}
