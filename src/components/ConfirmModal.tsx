/**
 * @file ConfirmModal.tsx
 * @description Generic confirmation dialog with Cancel, optional secondary action, and Confirm buttons (~70 lines).
 * Key features: customisable button labels, styles, and body content via `children`; optional
 * secondary action slot (e.g. "Don't Save").
 * Integration: uses `useModalAccessibility` for focus trapping; consumed throughout the app
 * wherever a destructive action requires user confirmation.
 */
import React from 'react';
import { useModalAccessibility } from '@/hooks/useModalAccessibility';

interface ConfirmModalProps {
  title: string;
  children: React.ReactNode;
  onConfirm: () => void;
  onClose: () => void;
  confirmText?: string;
  confirmClassName?: string;
  /**
   * Optional secondary action to render between Cancel and Confirm.
   * Useful for dialogs that need an extra choice (e.g. "Don't Save").
   */
  secondaryAction?: {
    onClick: () => void;
    label: string;
    className?: string;
  };
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({ 
  title, 
  children, 
  onConfirm, 
  onClose, 
  confirmText = 'Confirm',
  confirmClassName = 'bg-red-600 hover:bg-red-700',
  secondaryAction
}) => {
  const { modalProps, contentRef } = useModalAccessibility({ isOpen: true, onClose, titleId: 'confirm-modal-title' });

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"
      onClick={onClose}
      {...modalProps}
    >
      <div
        ref={contentRef}
        className="bg-secondary rounded-lg shadow-2xl w-full max-w-md m-4 flex flex-col border border-primary text-primary"
        onClick={e => e.stopPropagation()}
      >
        <header className="px-6 py-5 border-b border-primary">
          <h2 id="confirm-modal-title" className="text-xl font-bold">{title}</h2>
        </header>
        <main className="px-6 py-6">
          <p className="text-secondary leading-relaxed">
            {children}
          </p>
        </main>
        <footer className="bg-header px-6 py-4 rounded-b-lg flex justify-end items-center space-x-4 border-t border-primary">
          <button
            onClick={onClose}
            className="bg-tertiary hover:bg-tertiary-hover text-primary font-bold py-2 px-4 rounded transition duration-200 border border-primary"
          >
            Cancel
          </button>
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className={`${secondaryAction.className || 'bg-tertiary hover:bg-tertiary-hover border border-primary'} text-primary font-bold py-2 px-4 rounded transition duration-200`}
            >
              {secondaryAction.label}
            </button>
          )}
          <button
            onClick={onConfirm}
            className={`${confirmClassName} text-white font-bold py-2 px-4 rounded transition duration-200`}
          >
            {confirmText}
          </button>
        </footer>
      </div>
    </div>
  );
};

export default ConfirmModal;