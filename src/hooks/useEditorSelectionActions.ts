import { useCallback, useState } from 'react';
import type { RefObject } from 'react';
import type { AppSettings, Block, RenpyAnalysisResult } from '@/types';
import { sanitizeFileName, sanitizeIdentifier } from '@/lib/editorSelectionActions';

export interface QuickCreateFileModalState {
  directoryPath: string;
  extension: string;
  initialFileName: string;
  collidingWithExisting: boolean;
}

export interface PendingVariablePrefill {
  name: string;
  initialValue: string;
}

export interface UseEditorSelectionActionsParams {
  blocksRef: RefObject<Block[]>;
  analysisResult: RenpyAnalysisResult;
  addToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  handleCreateNode: (parentPath: string, name: string, type: 'file' | 'folder') => Promise<{ blockId: string | null; relativePath: string } | null>;
  handleOpenEditor: (blockId: string, line?: number) => void;
  handleAddVariable: (v: { name: string; type: 'define' | 'default'; initialValue: string }) => void | Promise<void>;
  handleOpenCharacterEditor: (tag: string, prefill?: { initialTag: string; initialName: string }) => void;
  updateAppSettings: (updater: (draft: AppSettings) => void) => void;
}

export interface UseEditorSelectionActionsReturn {
  quickCreateFileModal: QuickCreateFileModalState | null;
  pendingVariablePrefill: PendingVariablePrefill | null;
  handleCreateFileFromSelection: (blockId: string, selectedText: string) => Promise<void>;
  handleCreateVariableFromSelection: (selectedText: string) => void;
  handleCreateCharacterFromSelection: (selectedText: string) => void;
  handleConfirmQuickCreateFile: (fileName: string) => Promise<void>;
  closeQuickCreateFileModal: () => void;
  clearPendingVariablePrefill: () => void;
}

/**
 * The three Monaco "create from selection" context-menu actions
 * (file/variable/character), plus the state and confirm/close handlers
 * for the QuickCreateFileModal and StoryElementsPanel variable-prefill
 * flow they can trigger. Kept together since they share the sanitize
 * -> collision-check -> (direct create | prompt) shape.
 */
export function useEditorSelectionActions({
  blocksRef, analysisResult, addToast, handleCreateNode, handleOpenEditor,
  handleAddVariable, handleOpenCharacterEditor, updateAppSettings,
}: UseEditorSelectionActionsParams): UseEditorSelectionActionsReturn {
  const [quickCreateFileModal, setQuickCreateFileModal] = useState<QuickCreateFileModalState | null>(null);
  const [pendingVariablePrefill, setPendingVariablePrefill] = useState<PendingVariablePrefill | null>(null);

  const handleCreateFileFromSelection = useCallback(async (blockId: string, selectedText: string) => {
    const sourceBlock = blocksRef.current.find(b => b.id === blockId);
    if (!sourceBlock?.filePath) return;

    const lastSlash = sourceBlock.filePath.lastIndexOf('/');
    const directoryPath = lastSlash === -1 ? '' : sourceBlock.filePath.slice(0, lastSlash);
    const extensionMatch = sourceBlock.filePath.match(/\.[^./]+$/);
    const extension = extensionMatch ? extensionMatch[0] : '.rpy';

    const sanitizedBase = sanitizeFileName(selectedText);
    if (!sanitizedBase) {
      addToast('Selected text has no usable characters for a file name.', 'error');
      return;
    }

    const fileName = `${sanitizedBase}${extension}`;
    const relativePath = directoryPath ? `${directoryPath}/${fileName}` : fileName;
    const nameWasSanitized = sanitizedBase !== selectedText.trim();
    // Case-insensitive: on Windows (and macOS default) the real filesystem is
    // case-insensitive, so a case-only difference (e.g. 'Start.rpy' vs 'start.rpy')
    // is still a real collision — treating it as distinct would silently truncate
    // the existing file on direct-create.
    const collides = blocksRef.current.some(b => b.filePath?.toLowerCase() === relativePath.toLowerCase());

    if (!nameWasSanitized && !collides) {
      const result = await handleCreateNode(directoryPath, fileName, 'file');
      if (result?.blockId) {
        handleOpenEditor(result.blockId);
      }
      return;
    }

    setQuickCreateFileModal({ directoryPath, extension, initialFileName: sanitizedBase, collidingWithExisting: collides });
  }, [addToast, blocksRef, handleCreateNode, handleOpenEditor]);

  const handleCreateVariableFromSelection = useCallback((selectedText: string) => {
    const sanitized = sanitizeIdentifier(selectedText, true);
    if (!sanitized) {
      addToast('Selected text has no usable characters for a variable name.', 'error');
      return;
    }
    const nameWasSanitized = sanitized !== selectedText.trim();
    const collides = analysisResult.variables.has(sanitized);

    if (!nameWasSanitized && !collides) {
      handleAddVariable({ name: sanitized, type: 'default', initialValue: '0' });
      return;
    }

    updateAppSettings(draft => { draft.isRightSidebarOpen = true; });
    setPendingVariablePrefill({ name: sanitized, initialValue: '0' });
  }, [addToast, analysisResult.variables, handleAddVariable, updateAppSettings]);

  const handleCreateCharacterFromSelection = useCallback((selectedText: string) => {
    const rawName = selectedText.trim();
    if (!rawName) return;
    const sanitizedTag = sanitizeIdentifier(rawName);
    // sanitizedTag can be '' for fully-symbolic/non-Latin selections (e.g. "エレン", "---").
    // The tab id/characterTag must stay non-empty so useTabContentRenderer's
    // `tab.type === 'character' && tab.characterTag` guard still renders the tab; the
    // *prefill* initialTag is kept as the real (possibly empty) sanitized value so the
    // form field itself opens empty and the existing "tag required" validation catches it.
    const tabTag = sanitizedTag || 'new';
    if (sanitizedTag && analysisResult.characters.has(sanitizedTag)) {
      addToast(`Character '${rawName}' already exists — opening it.`, 'info');
    }
    handleOpenCharacterEditor(tabTag, { initialTag: sanitizedTag, initialName: rawName });
  }, [addToast, analysisResult.characters, handleOpenCharacterEditor]);

  const handleConfirmQuickCreateFile = useCallback(async (fileName: string) => {
    if (!quickCreateFileModal) return;
    const result = await handleCreateNode(quickCreateFileModal.directoryPath, fileName, 'file');
    if (result?.blockId) {
      handleOpenEditor(result.blockId);
    }
    setQuickCreateFileModal(null);
  }, [quickCreateFileModal, handleCreateNode, handleOpenEditor]);

  const closeQuickCreateFileModal = useCallback(() => setQuickCreateFileModal(null), []);
  const clearPendingVariablePrefill = useCallback(() => setPendingVariablePrefill(null), []);

  return {
    quickCreateFileModal,
    pendingVariablePrefill,
    handleCreateFileFromSelection,
    handleCreateVariableFromSelection,
    handleCreateCharacterFromSelection,
    handleConfirmQuickCreateFile,
    closeQuickCreateFileModal,
    clearPendingVariablePrefill,
  };
}
