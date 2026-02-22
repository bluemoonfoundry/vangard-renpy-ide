/**
 * @file test/setup.ts
 * @description Global test setup for Vitest.
 * Registers jest-dom matchers and provides global mocks
 * for browser/Electron APIs not available in jsdom.
 */

import '@testing-library/jest-dom/vitest';

// --- Global Browser API Mocks ---

// FileSystemFileHandle and FileSystemDirectoryHandle are not available in jsdom.
// Provide minimal stubs so type references don't throw at runtime.
if (typeof globalThis.FileSystemFileHandle === 'undefined') {
  (globalThis as any).FileSystemFileHandle = class FileSystemFileHandle {};
}
if (typeof globalThis.FileSystemDirectoryHandle === 'undefined') {
  (globalThis as any).FileSystemDirectoryHandle = class FileSystemDirectoryHandle {};
}

// window.electronAPI is undefined by default in tests (browser/jsdom mode).
// Individual tests that need it should import and install the mock from
// test/mocks/electronAPI.ts. We explicitly set it to undefined here to
// match the browser-fallback code path in the app.
Object.defineProperty(window, 'electronAPI', {
  value: undefined,
  writable: true,
  configurable: true,
});
