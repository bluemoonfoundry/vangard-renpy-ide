import { useCallback } from 'react';
import type { Updater } from 'use-immer';
import type { Dispatch, SetStateAction, MutableRefObject } from 'react';
import { formatErrorMessage } from '@/lib/formatErrorMessage';
import type { Block, Character, EditorTab, RenpyAnalysisResult } from '@/types';

export interface UseCharacterManagementProps {
  blocks: Block[];
  analysisResult: RenpyAnalysisResult;
  projectRootPath: string | null;
  updateBlock: (id: string, updates: Partial<Block>) => void;
  addBlock: (filePath: string, content: string) => void;
  setFileSystemTree: Dispatch<SetStateAction<import('@/types').FileSystemTreeNode | null>>;
  setCharacterProfiles: Updater<Record<string, string>>;
  setCharacterPortraits: Updater<Record<string, string>>;
  setHasUnsavedSettings: Dispatch<SetStateAction<boolean>>;
  addToast: (message: string, type: string) => void;
  pendingTagRenameRef: MutableRefObject<{ oldTag: string; newTag: string } | null>;
  // Tab state for handleOpenCharacterEditor
  openTabs: EditorTab[];
  secondaryOpenTabs: EditorTab[];
  activePaneId: 'primary' | 'secondary';
  splitLayout: 'none' | 'right' | 'bottom';
  setOpenTabs: Dispatch<SetStateAction<EditorTab[]>>;
  setActiveTabId: Dispatch<SetStateAction<string>>;
  setSecondaryOpenTabs: Dispatch<SetStateAction<EditorTab[]>>;
  setSecondaryActiveTabId: Dispatch<SetStateAction<string>>;
  setActivePaneId: Dispatch<SetStateAction<'primary' | 'secondary'>>;
}

export interface UseCharacterManagementReturn {
  handleOpenCharacterEditor: (tag: string, prefill?: { initialTag: string; initialName: string }) => void;
  handleUpdateCharacter: (char: Character, oldTag?: string) => Promise<void>;
}

export function useCharacterManagement({
  blocks,
  analysisResult,
  projectRootPath,
  updateBlock,
  addBlock,
  setFileSystemTree,
  setCharacterProfiles,
  setCharacterPortraits,
  setHasUnsavedSettings,
  addToast,
  pendingTagRenameRef,
  openTabs,
  secondaryOpenTabs,
  activePaneId,
  splitLayout,
  setOpenTabs,
  setActiveTabId,
  setSecondaryOpenTabs,
  setSecondaryActiveTabId,
  setActivePaneId,
}: UseCharacterManagementProps): UseCharacterManagementReturn {

  const handleOpenCharacterEditor = useCallback((tag: string, prefill?: { initialTag: string; initialName: string }) => {
    const tabId = `char-${tag}`;
    if (openTabs.find(t => t.id === tabId)) { setActiveTabId(tabId); setActivePaneId('primary'); return; }
    if (secondaryOpenTabs.find(t => t.id === tabId)) { setSecondaryActiveTabId(tabId); setActivePaneId('secondary'); return; }
    const newTab: EditorTab = {
      id: tabId,
      type: 'character',
      characterTag: tag,
      ...(prefill && { initialCharacterTag: prefill.initialTag, initialCharacterName: prefill.initialName }),
    };
    if (activePaneId === 'secondary' && splitLayout !== 'none') {
      setSecondaryOpenTabs(prev => [...prev, newTab]);
      setSecondaryActiveTabId(tabId);
    } else {
      setOpenTabs(prev => [...prev, newTab]);
      setActiveTabId(tabId);
    }
  }, [openTabs, secondaryOpenTabs, activePaneId, splitLayout, setActivePaneId, setActiveTabId, setOpenTabs, setSecondaryActiveTabId, setSecondaryOpenTabs]);

  const handleUpdateCharacter = useCallback(async (char: Character, oldTag?: string) => {
    const buildCharacterString = (c: Character): string => {
      const args: string[] = [];
      if (c.name && c.name !== c.tag) {
        args.push(`"${c.name}"`);
      }

      const kwargs: Record<string, string> = {};
      if (c.color) kwargs.color = `"${c.color}"`;
      if (c.image) kwargs.image = `"${c.image}"`;
      if (c.who_prefix) kwargs.who_prefix = `"${c.who_prefix}"`;
      if (c.who_suffix) kwargs.who_suffix = `"${c.who_suffix}"`;
      if (c.what_prefix) kwargs.what_prefix = `"${c.what_prefix}"`;
      if (c.what_suffix) kwargs.what_suffix = `"${c.what_suffix}"`;
      if (c.what_color) kwargs.what_color = `"${c.what_color}"`;
      if (c.slow) kwargs.slow = 'True';
      if (c.ctc) kwargs.ctc = `"${c.ctc}"`;
      if (c.ctc_position && c.ctc_position !== 'nestled') kwargs.ctc_position = `"${c.ctc_position}"`;

      const kwargStrings = Object.entries(kwargs).map(([key, value]) => `${key}=${value}`);
      const allArgs = [...args, ...kwargStrings].join(', ');

      return `define ${c.tag} = Character(${allArgs})`;
    };

    const newCharString = buildCharacterString(char);

    setCharacterProfiles(draft => {
      if (oldTag && oldTag !== char.tag) {
        delete draft[oldTag];
      }
      if (char.profile) {
        draft[char.tag] = char.profile;
      } else {
        delete draft[char.tag];
      }
    });
    setCharacterPortraits(draft => {
      if (oldTag && oldTag !== char.tag) {
        delete draft[oldTag];
      }
      if (char.portraitPath) {
        draft[char.tag] = char.portraitPath;
      } else {
        delete draft[char.tag];
      }
    });
    setHasUnsavedSettings(true);

    if (oldTag) {
      const originalCharDef = analysisResult.characters.get(oldTag);
      if (!originalCharDef) {
        addToast(`Error: Cannot find original definition for character '${oldTag}'.`, 'error');
        return;
      }

      const blockToUpdate = blocks.find(b => b.id === originalCharDef.definedInBlockId);
      if (!blockToUpdate) {
        addToast(`Error: Cannot find file for character '${oldTag}'.`, 'error');
        return;
      }

      const regex = new RegExp(`^(\\s*define\\s+${oldTag}\\s*=\\s*Character\\s*\\([\\s\\S]*?\\))`, 'm');
      if (!regex.test(blockToUpdate.content)) {
        addToast(`Error: Could not find the Character definition for '${oldTag}' to update.`, 'error');
        return;
      }

      const newDefineContent = blockToUpdate.content.replace(regex, newCharString);

      if (oldTag !== char.tag) {
        const dialogueReplaceRegex = new RegExp(`^([ \\t]*)${oldTag}(\\s+")`, 'gm');
        let renamedFileCount = 0;

        blocks.forEach(block => {
          const base = block.id === blockToUpdate.id ? newDefineContent : block.content;
          const updated = base.replace(dialogueReplaceRegex, `$1${char.tag}$2`);

          if (block.id === blockToUpdate.id) {
            updateBlock(block.id, { content: updated });
            renamedFileCount++;
          } else if (updated !== base) {
            updateBlock(block.id, { content: updated });
            renamedFileCount++;
          }
        });

        pendingTagRenameRef.current = { oldTag, newTag: char.tag };
        addToast(`Renamed "${oldTag}" to "${char.tag}" in ${renamedFileCount} file(s).`, 'success');
        return;
      }

      updateBlock(blockToUpdate.id, { content: newDefineContent });
    } else {
      const charFilePath = 'game/characters.rpy';
      const existingFileBlock = blocks.find(b => b.filePath === charFilePath);

      if (existingFileBlock) {
        const newContent = `${existingFileBlock.content.trim()}\n\n${newCharString}\n`;
        updateBlock(existingFileBlock.id, { content: newContent });
      } else {
        const newContent = `# This file stores character definitions.\n\n${newCharString}\n`;
        if (window.electronAPI && projectRootPath) {
          try {
            const fullPath = await window.electronAPI.path.join(projectRootPath, charFilePath) as string;
            const res = await window.electronAPI.writeFile(fullPath, newContent);
            if (res.success) {
              addBlock(charFilePath, newContent);
              const projData = await window.electronAPI.loadProject(projectRootPath);
              setFileSystemTree(projData.tree);
            } else { throw new Error((res.error as string) || 'Unknown file creation error'); }
          } catch (e) {
            addToast(`Failed to create characters.rpy: ${formatErrorMessage(e)}`, 'error');
            return;
          }
        } else {
          addBlock(charFilePath, newContent);
        }
      }
    }

    addToast(`Character '${char.name}' saved.`, 'success');
  }, [addToast, analysisResult.characters, blocks, projectRootPath, setCharacterProfiles, setCharacterPortraits, setHasUnsavedSettings, updateBlock, addBlock, setFileSystemTree, pendingTagRenameRef]);

  return { handleOpenCharacterEditor, handleUpdateCharacter };
}
