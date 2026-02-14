/**
 * @file ToastContext.tsx
 * @description React Context for managing toast notifications.
 * Provides a centralized system for displaying temporary notification messages
 * throughout the application (success, error, warning, info types).
 */

import React, { createContext, useState, useCallback, useContext } from 'react';
import { createPortal } from 'react-dom';
import Toast from '../components/Toast';
import { ToastMessage } from '../types';

function uuidv4() {
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c =>
    (Number(c) ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> Number(c) / 4).toString(16)
  );
}

/**
 * Type definition for Toast Context value.
 * @interface ToastContextType
 * @property {Function} addToast - Add a new toast message to display
 */
interface ToastContextType {
  /**
   * Add a new toast notification.
   * @function addToast
   * @param {string} message - Message text to display
   * @param {ToastMessage['type']} [type='info'] - Toast type: 'success' | 'error' | 'warning' | 'info'
   * @returns {void}
   */
  addToast: (message: string, type?: ToastMessage['type']) => void;
}

/**
 * React Context for toast notifications.
 * @type {React.Context<ToastContextType>}
 */
const ToastContext = createContext<ToastContextType>({
  addToast: () => {},
});

/**
 * Hook to access toast context.
 * @function useToasts
 * @returns {ToastContextType} Toast context with addToast method
 */
export const useToasts = () => useContext(ToastContext);

/**
 * Toast Provider component that manages toast state and rendering.
 * Renders toasts in a portal at the bottom-right of the screen.
 * @component
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components
 * @returns {React.ReactElement} ToastContext.Provider wrapping children and toast display
 */
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  /**
   * Add a new toast message.
   * @param {string} message - Message text
   * @param {ToastMessage['type']} [type='info'] - Message type/severity
   */
  const addToast = useCallback((message: string, type: ToastMessage['type'] = 'info') => {
    const id = uuidv4();
    setToasts(currentToasts => [...currentToasts, { id, message, type }]);
  }, []);

  /**
   * Remove a toast message by ID.
   * @param {string} id - Toast ID to remove
   */
  const dismissToast = useCallback((id: string) => {
    setToasts(currentToasts => currentToasts.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      {createPortal(
        <div aria-live="assertive" className="fixed bottom-4 right-4 z-[60] w-full max-w-sm flex flex-col space-y-2 items-end">
          {toasts.map(toast => (
            <Toast key={toast.id} toast={toast} onDismiss={dismissToast} />
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
};
