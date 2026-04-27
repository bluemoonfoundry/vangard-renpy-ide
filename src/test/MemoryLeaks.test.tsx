/**
 * @file MemoryLeaks.test.tsx
 * @description Tests to verify event listener cleanup and prevent memory leaks
 */
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';
import CanvasNodeContextMenu from '@/components/CanvasNodeContextMenu';
import { installElectronAPI, uninstallElectronAPI } from './mocks/electronAPI';

describe('Memory Leak Prevention', () => {
  beforeEach(() => {
    installElectronAPI();
  });

  afterEach(() => {
    uninstallElectronAPI();
    cleanup();
    vi.clearAllMocks();
  });

  describe('CanvasNodeContextMenu', () => {
    it('should add and remove mousedown event listener', () => {
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

      const onClose = vi.fn();
      const onOpenEditor = vi.fn();
      const onWarpToHere = vi.fn();

      const { unmount } = render(
        <CanvasNodeContextMenu
          x={100}
          y={100}
          label="test_label"
          onClose={onClose}
          onOpenEditor={onOpenEditor}
          onWarpToHere={onWarpToHere}
        />
      );

      // Verify event listener was added
      expect(addEventListenerSpy).toHaveBeenCalledWith('mousedown', expect.any(Function));

      // Unmount component
      unmount();

      // Verify event listener was removed
      expect(removeEventListenerSpy).toHaveBeenCalledWith('mousedown', expect.any(Function));

      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    });

    it('should not re-register listener when onClose prop changes', async () => {
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

      const onClose1 = vi.fn();
      const onOpenEditor = vi.fn();
      const onWarpToHere = vi.fn();

      const { rerender } = render(
        <CanvasNodeContextMenu
          x={100}
          y={100}
          label="test_label"
          onClose={onClose1}
          onOpenEditor={onOpenEditor}
          onWarpToHere={onWarpToHere}
        />
      );

      // Initial listener registered
      expect(addEventListenerSpy).toHaveBeenCalledTimes(1);
      addEventListenerSpy.mockClear();
      removeEventListenerSpy.mockClear();

      // Change onClose prop
      const onClose2 = vi.fn();
      rerender(
        <CanvasNodeContextMenu
          x={100}
          y={100}
          label="test_label"
          onClose={onClose2}
          onOpenEditor={onOpenEditor}
          onWarpToHere={onWarpToHere}
        />
      );

      // Wait a bit to ensure no re-registration
      await waitFor(() => {
        // Listener should NOT be re-registered (no new addEventListener calls)
        expect(addEventListenerSpy).not.toHaveBeenCalled();
        // Listener should NOT be removed and re-added
        expect(removeEventListenerSpy).not.toHaveBeenCalled();
      });

      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    });

    it('should use latest onClose callback via ref', async () => {
      const onClose1 = vi.fn();
      const onOpenEditor = vi.fn();
      const onWarpToHere = vi.fn();

      const { rerender } = render(
        <CanvasNodeContextMenu
          x={100}
          y={100}
          label="test_label"
          onClose={onClose1}
          onOpenEditor={onOpenEditor}
          onWarpToHere={onWarpToHere}
        />
      );

      // Change onClose prop
      const onClose2 = vi.fn();
      rerender(
        <CanvasNodeContextMenu
          x={100}
          y={100}
          label="test_label"
          onClose={onClose2}
          onOpenEditor={onOpenEditor}
          onWarpToHere={onWarpToHere}
        />
      );

      // Click outside the menu
      const outsideElement = document.body;
      const mouseEvent = new MouseEvent('mousedown', { bubbles: true });
      outsideElement.dispatchEvent(mouseEvent);

      // The new onClose callback should be called, not the old one
      await waitFor(() => {
        expect(onClose2).toHaveBeenCalled();
        expect(onClose1).not.toHaveBeenCalled();
      });
    });
  });

  describe('Event Listener Cleanup Pattern', () => {
    it('should demonstrate proper cleanup pattern', () => {
      let cleanupCalled = false;

      const TestComponent = () => {
        const [count, setCount] = React.useState(0);

        React.useEffect(() => {
          const handler = () => setCount(c => c + 1);
          window.addEventListener('click', handler);

          return () => {
            cleanupCalled = true;
            window.removeEventListener('click', handler);
          };
        }, []); // Empty deps - stable listener

        return <div>{count}</div>;
      };

      const { unmount } = render(<TestComponent />);

      unmount();

      expect(cleanupCalled).toBe(true);
    });
  });
});
