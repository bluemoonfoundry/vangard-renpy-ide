/**
 * @file useModalState.ts
 * @description Custom hook for managing all modal open/close state
 *
 * Consolidates modal state management for the entire application. Includes
 * both simple boolean flags for basic modals and complex state for modals
 * that require additional context (create block position, delete confirmation, etc.).
 */

import { useState, useCallback } from 'react';
import type { BlockType, Position, MenuTemplate, UserSnippet } from '@/types';

/** Info for unsaved changes confirmation modal */
export interface UnsavedChangesModalInfo {
  title: string;
  message: string;
  confirmText: string;
  dontSaveText: string;
  onConfirm: () => Promise<void> | void;
  onDontSave: () => void;
  onCancel: () => void;
}

/** Info for delete confirmation modal */
export interface DeleteConfirmInfo {
  paths: string[];
  onConfirm: () => void;
}

/** Info for tab context menu */
export interface ContextMenuInfo {
  x: number;
  y: number;
  tabId: string;
  paneId: 'primary' | 'secondary';
}

export interface UseModalStateReturn {
  // --- Create Block Modal ---
  createBlockModalOpen: boolean;
  createBlockModalType: BlockType;
  createBlockModalPosition: Position | undefined;
  createBlockModalFolderPath: string;
  openCreateBlockModal: (type: BlockType, position?: Position, folderPath?: string) => void;
  closeCreateBlockModal: () => void;
  setCreateBlockModalType: (type: BlockType) => void;
  setCreateBlockModalFolderPath: (path: string) => void;

  // --- Confirmation Modals ---
  deleteConfirmInfo: DeleteConfirmInfo | null;
  openDeleteConfirmModal: (paths: string[], onConfirm: () => void) => void;
  closeDeleteConfirmModal: () => void;

  unsavedChangesModalInfo: UnsavedChangesModalInfo | null;
  openUnsavedChangesModal: (info: UnsavedChangesModalInfo) => void;
  closeUnsavedChangesModal: () => void;

  // --- Context Menu ---
  contextMenuInfo: ContextMenuInfo | null;
  openContextMenu: (x: number, y: number, tabId: string, paneId: 'primary' | 'secondary') => void;
  closeContextMenu: () => void;

  // --- Simple Toggle Modals ---
  settingsModalOpen: boolean;
  openSettingsModal: () => void;
  closeSettingsModal: () => void;

  shortcutsModalOpen: boolean;
  openShortcutsModal: () => void;
  closeShortcutsModal: () => void;

  aboutModalOpen: boolean;
  openAboutModal: () => void;
  closeAboutModal: () => void;

  showConfigureRenpyModal: boolean;
  openConfigureRenpyModal: () => void;
  closeConfigureRenpyModal: () => void;

  wizardModalOpen: boolean;
  openWizardModal: () => void;
  closeWizardModal: () => void;

  showTutorial: boolean;
  openTutorial: () => void;
  closeTutorial: () => void;

  // --- Go To / Warp Modals ---
  isGoToLabelOpen: boolean;
  openGoToLabelModal: () => void;
  closeGoToLabelModal: () => void;

  isWarpToLabelOpen: boolean;
  openWarpToLabelModal: () => void;
  closeWarpToLabelModal: () => void;

  isWarpVariablesOpen: boolean;
  openWarpVariablesModal: () => void;
  closeWarpVariablesModal: () => void;

  // --- User Snippet Modal ---
  userSnippetModalOpen: boolean;
  editingSnippet: UserSnippet | null;
  openUserSnippetModal: (snippet?: UserSnippet) => void;
  closeUserSnippetModal: () => void;

  // --- Menu Constructor Modal ---
  menuConstructorModalOpen: boolean;
  editingMenuTemplate: MenuTemplate | null;
  openMenuConstructorModal: (template?: MenuTemplate) => void;
  closeMenuConstructorModal: () => void;
}

/**
 * Hook for managing all modal open/close state in the application
 *
 * @returns Object containing all modal state and open/close handlers
 *
 * @example
 * ```tsx
 * const {
 *   settingsModalOpen,
 *   openSettingsModal,
 *   closeSettingsModal,
 *   openDeleteConfirmModal,
 *   deleteConfirmInfo,
 * } = useModalState();
 *
 * // Open settings modal
 * openSettingsModal();
 *
 * // Open delete confirmation
 * openDeleteConfirmModal(['file.rpy'], () => {
 *   // Delete logic
 * });
 * ```
 */
export function useModalState(): UseModalStateReturn {
  // --- Create Block Modal ---
  const [createBlockModalOpen, setCreateBlockModalOpen] = useState(false);
  const [createBlockModalType, setCreateBlockModalType] = useState<BlockType>('story');
  const [createBlockModalPosition, setCreateBlockModalPosition] = useState<Position | undefined>(undefined);
  const [createBlockModalFolderPath, setCreateBlockModalFolderPath] = useState('');

  const openCreateBlockModal = useCallback((type: BlockType, position?: Position, folderPath?: string) => {
    setCreateBlockModalType(type);
    setCreateBlockModalPosition(position);
    setCreateBlockModalFolderPath(folderPath || '');
    setCreateBlockModalOpen(true);
  }, []);

  const closeCreateBlockModal = useCallback(() => {
    setCreateBlockModalOpen(false);
    setCreateBlockModalPosition(undefined);
    setCreateBlockModalFolderPath('');
  }, []);

  // --- Confirmation Modals ---
  const [deleteConfirmInfo, setDeleteConfirmInfo] = useState<DeleteConfirmInfo | null>(null);

  const openDeleteConfirmModal = useCallback((paths: string[], onConfirm: () => void) => {
    setDeleteConfirmInfo({ paths, onConfirm });
  }, []);

  const closeDeleteConfirmModal = useCallback(() => {
    setDeleteConfirmInfo(null);
  }, []);

  const [unsavedChangesModalInfo, setUnsavedChangesModalInfo] = useState<UnsavedChangesModalInfo | null>(null);

  const openUnsavedChangesModal = useCallback((info: UnsavedChangesModalInfo) => {
    setUnsavedChangesModalInfo(info);
  }, []);

  const closeUnsavedChangesModal = useCallback(() => {
    setUnsavedChangesModalInfo(null);
  }, []);

  // --- Context Menu ---
  const [contextMenuInfo, setContextMenuInfo] = useState<ContextMenuInfo | null>(null);

  const openContextMenu = useCallback((x: number, y: number, tabId: string, paneId: 'primary' | 'secondary') => {
    setContextMenuInfo({ x, y, tabId, paneId });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenuInfo(null);
  }, []);

  // --- Simple Toggle Modals ---
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const openSettingsModal = useCallback(() => setSettingsModalOpen(true), []);
  const closeSettingsModal = useCallback(() => setSettingsModalOpen(false), []);

  const [shortcutsModalOpen, setShortcutsModalOpen] = useState(false);
  const openShortcutsModal = useCallback(() => setShortcutsModalOpen(true), []);
  const closeShortcutsModal = useCallback(() => setShortcutsModalOpen(false), []);

  const [aboutModalOpen, setAboutModalOpen] = useState(false);
  const openAboutModal = useCallback(() => setAboutModalOpen(true), []);
  const closeAboutModal = useCallback(() => setAboutModalOpen(false), []);

  const [showConfigureRenpyModal, setShowConfigureRenpyModal] = useState(false);
  const openConfigureRenpyModal = useCallback(() => setShowConfigureRenpyModal(true), []);
  const closeConfigureRenpyModal = useCallback(() => setShowConfigureRenpyModal(false), []);

  const [wizardModalOpen, setWizardModalOpen] = useState(false);
  const openWizardModal = useCallback(() => setWizardModalOpen(true), []);
  const closeWizardModal = useCallback(() => setWizardModalOpen(false), []);

  const [showTutorial, setShowTutorial] = useState(false);
  const openTutorial = useCallback(() => setShowTutorial(true), []);
  const closeTutorial = useCallback(() => setShowTutorial(false), []);

  // --- Go To / Warp Modals ---
  const [isGoToLabelOpen, setIsGoToLabelOpen] = useState(false);
  const openGoToLabelModal = useCallback(() => setIsGoToLabelOpen(true), []);
  const closeGoToLabelModal = useCallback(() => setIsGoToLabelOpen(false), []);

  const [isWarpToLabelOpen, setIsWarpToLabelOpen] = useState(false);
  const openWarpToLabelModal = useCallback(() => setIsWarpToLabelOpen(true), []);
  const closeWarpToLabelModal = useCallback(() => setIsWarpToLabelOpen(false), []);

  const [isWarpVariablesOpen, setIsWarpVariablesOpen] = useState(false);
  const openWarpVariablesModal = useCallback(() => setIsWarpVariablesOpen(true), []);
  const closeWarpVariablesModal = useCallback(() => setIsWarpVariablesOpen(false), []);

  // --- User Snippet Modal ---
  const [userSnippetModalOpen, setUserSnippetModalOpen] = useState(false);
  const [editingSnippet, setEditingSnippet] = useState<UserSnippet | null>(null);

  const openUserSnippetModal = useCallback((snippet?: UserSnippet) => {
    setEditingSnippet(snippet || null);
    setUserSnippetModalOpen(true);
  }, []);

  const closeUserSnippetModal = useCallback(() => {
    setUserSnippetModalOpen(false);
    setEditingSnippet(null);
  }, []);

  // --- Menu Constructor Modal ---
  const [menuConstructorModalOpen, setMenuConstructorModalOpen] = useState(false);
  const [editingMenuTemplate, setEditingMenuTemplate] = useState<MenuTemplate | null>(null);

  const openMenuConstructorModal = useCallback((template?: MenuTemplate) => {
    setEditingMenuTemplate(template || null);
    setMenuConstructorModalOpen(true);
  }, []);

  const closeMenuConstructorModal = useCallback(() => {
    setMenuConstructorModalOpen(false);
    setEditingMenuTemplate(null);
  }, []);

  return {
    // Create Block Modal
    createBlockModalOpen,
    createBlockModalType,
    createBlockModalPosition,
    createBlockModalFolderPath,
    openCreateBlockModal,
    closeCreateBlockModal,
    setCreateBlockModalType,
    setCreateBlockModalFolderPath,

    // Confirmation Modals
    deleteConfirmInfo,
    openDeleteConfirmModal,
    closeDeleteConfirmModal,
    unsavedChangesModalInfo,
    openUnsavedChangesModal,
    closeUnsavedChangesModal,

    // Context Menu
    contextMenuInfo,
    openContextMenu,
    closeContextMenu,

    // Simple Toggle Modals
    settingsModalOpen,
    openSettingsModal,
    closeSettingsModal,
    shortcutsModalOpen,
    openShortcutsModal,
    closeShortcutsModal,
    aboutModalOpen,
    openAboutModal,
    closeAboutModal,
    showConfigureRenpyModal,
    openConfigureRenpyModal,
    closeConfigureRenpyModal,
    wizardModalOpen,
    openWizardModal,
    closeWizardModal,
    showTutorial,
    openTutorial,
    closeTutorial,

    // Go To / Warp Modals
    isGoToLabelOpen,
    openGoToLabelModal,
    closeGoToLabelModal,
    isWarpToLabelOpen,
    openWarpToLabelModal,
    closeWarpToLabelModal,
    isWarpVariablesOpen,
    openWarpVariablesModal,
    closeWarpVariablesModal,

    // User Snippet Modal
    userSnippetModalOpen,
    editingSnippet,
    openUserSnippetModal,
    closeUserSnippetModal,

    // Menu Constructor Modal
    menuConstructorModalOpen,
    editingMenuTemplate,
    openMenuConstructorModal,
    closeMenuConstructorModal,
  };
}
