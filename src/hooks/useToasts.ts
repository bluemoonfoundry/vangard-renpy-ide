/**
 * @file useToasts.ts
 * @description Custom hook for managing toast notifications
 *
 * Provides a simple toast notification system with auto-dismiss functionality.
 * Toasts are displayed in a fixed container (typically bottom-right) and can
 * be manually dismissed by the user.
 */

import { useState, useCallback } from 'react';
import type { ToastMessage } from '@/types';
import { createId } from '@/lib/createId';

export interface UseToastsReturn {
  /** Current toast notifications */
  toasts: ToastMessage[];
  /** Add a new toast notification */
  addToast: (message: string, type?: ToastMessage['type']) => void;
  /** Remove a toast notification by ID */
  removeToast: (id: string) => void;
}

/**
 * Hook for managing toast notifications
 *
 * @returns Object containing toasts array and toast management functions
 *
 * @example
 * ```tsx
 * const { toasts, addToast, removeToast } = useToasts();
 *
 * // Show success toast
 * addToast('Changes saved successfully', 'success');
 *
 * // Show error toast
 * addToast('Failed to save changes', 'error');
 *
 * // Render toasts
 * {toasts.map(toast => (
 *   <Toast key={toast.id} {...toast} onDismiss={removeToast} />
 * ))}
 * ```
 */
export function useToasts(): UseToastsReturn {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  /**
   * Add a new toast notification
   * Toast will be added to the queue and can be dismissed by user
   */
  const addToast = useCallback((message: string, type: ToastMessage['type'] = 'info') => {
    const id = createId();
    const toast: ToastMessage = {
      id,
      message,
      type,
    };
    setToasts(prev => [...prev, toast]);
  }, []);

  /**
   * Remove a toast notification by ID
   * Typically called when user clicks dismiss button or after auto-dismiss timeout
   */
  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return {
    toasts,
    addToast,
    removeToast,
  };
}
