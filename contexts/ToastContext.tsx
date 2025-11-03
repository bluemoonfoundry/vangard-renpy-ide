import React, { createContext, useState, useCallback, useContext } from 'react';
import { createPortal } from 'react-dom';
import Toast from '../components/Toast';
import { ToastMessage } from '../types';

function uuidv4() {
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c =>
    (Number(c) ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> Number(c) / 4).toString(16)
  );
}

interface ToastContextType {
  addToast: (message: string, type?: ToastMessage['type']) => void;
}

const ToastContext = createContext<ToastContextType>({
  addToast: () => {},
});

export const useToasts = () => useContext(ToastContext);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((message: string, type: ToastMessage['type'] = 'info') => {
    const id = uuidv4();
    setToasts(currentToasts => [...currentToasts, { id, message, type }]);
  }, []);

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
