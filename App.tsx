
import React, { useState, useCallback, useEffect, useRef } from 'react';
import StoryCanvas from './components/StoryCanvas';
import EditorModal from './components/EditorModal';
import ConfirmModal from './components/ConfirmModal';
import StoryElementsPanel from './components/StoryElementsPanel';
import { useRenpyAnalysis, performRenpyAnalysis } from './hooks/useRenpyAnalysis';
import { useHistory } from './hooks/useHistory';
import type { Block, Position, BlockGroup, Link, Character, Variable, RenpyImage } from './types';
import JSZip from 'jszip';

// Add all necessary FS API types to the global scope to fix compilation issues
// and make them available throughout the app, including in the types.ts file.
declare global {
  interface FileSystemHandle {
    readonly kind: 'file' | 'directory';
    readonly name: string;
  }

  interface FileSystemWritableFileStream extends WritableStream {
    write(data: any): Promise<void>;
    close(): Promise<void>;
  }

  interface FileSystemFileHandle extends FileSystemHandle {
    readonly kind: 'file';
    getFile(): Promise<File>;
    createWritable(options?: { keepExistingData?: boolean }): Promise<FileSystemWritableFileStream>;
  }

  interface FileSystemDirectoryHandle extends FileSystemHandle {
    readonly kind: 'directory';
    values(): AsyncIterableIterator<FileSystemFileHandle | FileSystemDirectoryHandle>;
    getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
    getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle>;
  }

  // Fix: Define the AIStudio interface to include the method we need.
  // This will merge with any existing AIStudio interface definition and resolve type conflicts.
  interface AIStudio {
    showDirectoryPicker(): Promise<FileSystemDirectoryHandle>;
  }

  interface Window {
    aistudio?: AIStudio;
    // Add the standard File System Access API method to the window type
    showDirectoryPicker?(): Promise<FileSystemDirectoryHandle>;
  }
}

const SAVE_KEY_BLOCKS = 'renpy-visual-editor-blocks';
const SAVE_KEY_GROUPS = 'renpy-visual-editor-groups';

function uuidv4() {
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c =>
    (Number(c) ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> Number(c) / 4).toString(16)
  );
}

type Theme = 'system' | 'light' | 'dark';
type SaveStatus = 'saving' | 'saved' | 'error';
type AppState = { blocks: Block[], groups: BlockGroup[] };


// Wrap the file system API check in a try-catch block to prevent runtime errors
// in environments where accessing the APIs might be restricted.
const isFileSystemApiSupported = (() => {
  try {
    // Check for the standard browser API or the AI Studio specific one.
    return !!(window.showDirectoryPicker || (window.aistudio && window.aistudio.showDirectoryPicker));
  } catch (e) {
    console.warn("Could not access file system APIs, features disabled.", e);
    return false;
  }
})();

const loadInitialState = (): AppState => {
  try {
    const savedBlocks = localStorage.getItem(SAVE_KEY_BLOCKS);
    const savedGroups = localStorage.getItem(SAVE_KEY_GROUPS);
    return {
      blocks: savedBlocks ? JSON.parse(savedBlocks) : [],
      groups: savedGroups ? JSON.parse(savedGroups) : [],
    };
  } catch (e) {
    console.error("Failed to load state from local storage", e);
    return { blocks: [], groups: [] };
  }
};

const fileToDataUrl = (file: File | Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const parseImageFileName = (fileName: string, filePath: string): { tag: string; attributes: string[] } => {
    const nameWithoutExt = fileName.replace(/\.[^/.]+$/, "");
    const parts = nameWithoutExt.split('_');
    const tag = parts.join(' ');
    const attributes = parts.slice(1);
    return { tag, attributes };
};

const App: React.FC = () => {
  const { 
    state: historyState, 
    setState: setHistory, 
    undo, 
    redo, 
    canUndo, 
    canRedo 
  } = useHistory<AppState>(loadInitialState());

  const [liveBlocks, setLiveBlocks] = useState<Block[]>(historyState.blocks);
  const [liveGroups, setLiveGroups] = useState<BlockGroup[]>(historyState.groups);
  
  useEffect(() => {
    setLiveBlocks(historyState.blocks);
    setLiveGroups(historyState.groups);
  }, [historyState]);

  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [selectedBlockIds, setSelectedBlockIds] = useState<string[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [initialScrollLine, setInitialScrollLine] = useState<number | undefined>(undefined);
  const [theme, setTheme] = useState<Theme>('system');
  const [isClearConfirmVisible, setIsClearConfirmVisible] = useState(false);
  const [analysisTrigger, setAnalysisTrigger] = useState(0);
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const saveTimeoutRef = useRef<number | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [findUsagesHighlightIds, setFindUsagesHighlightIds] = useState<Set<string> | null>(null);
  const [directoryHandle, setDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [dirtyBlockIds, setDirtyBlockIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadConfirm, setUploadConfirm] = useState<{ visible: boolean, file: File | null }>({ visible: false, file: null });
  const [images, setImages] = useState<RenpyImage[]>([]);
  const imageImportInputRef = useRef<HTMLInputElement>(null);

  const analysisResult = useRenpyAnalysis(liveBlocks, analysisTrigger);

  const commitChange = useCallback((newState: AppState, dirtyIds: string[] = []) => {
    setLiveBlocks(newState.blocks);
    setLiveGroups(newState.groups);
    setHistory(newState);
    if (dirtyIds.length > 0) {
      setDirtyBlockIds(prev => new Set([...prev, ...dirtyIds]));
    }
  }, [setHistory]);

  useEffect(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    if (!directoryHandle) { // Only auto-save to localStorage if not using File System API
      setSaveStatus('saving');
      saveTimeoutRef.current = window.setTimeout(() => {
        try {
          const blocksToSave = historyState.blocks.map(({ fileHandle, ...rest }) => rest);
          localStorage.setItem(SAVE_KEY_BLOCKS, JSON.stringify(blocksToSave));
          localStorage.setItem(SAVE_KEY_GROUPS, JSON.stringify(historyState.groups));
          setSaveStatus('saved');
        } catch (e) { console.error("Failed to save state to local storage", e); }
      }, 1000);
    }
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [historyState, directoryHandle]);


  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => setSystemTheme(mediaQuery.matches ? 'dark' : 'light');
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const effectiveTheme = theme === 'system' ? systemTheme : theme;

  useEffect(() => {
    const root = window.document.documentElement;
    if (effectiveTheme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
  }, [effectiveTheme]);
  
  const deleteBlocks = useCallback((ids: string[]) => {
    const newBlocks = liveBlocks.filter(block => !ids.includes(block.id));
    const newGroups = liveGroups
      .map(group => ({ ...group, blockIds: group.blockIds.filter(id => !ids.includes(id))}))
      .filter(group => group.blockIds.length > 0);
    
    commitChange({ blocks: newBlocks, groups: newGroups });
    setDirtyBlockIds(prev => {
        const newDirty = new Set(prev);
        ids.forEach(id => newDirty.delete(id));
        return newDirty;
    });
    setSelectedBlockIds([]);
  }, [liveBlocks, liveGroups, commitChange]);
  
  const handleOpenEditor = useCallback((id: string, line?: number) => {
    setEditingBlockId(id);
    setInitialScrollLine(line);
  }, []);

  const addBlock = useCallback(() => {
    const newBlock: Block = {
      id: uuidv4(),
      content: 'label new_label:\n    "New block content..."',
      position: { x: 20, y: 20 },
      width: 300,
      height: 120,
    };
    commitChange({ blocks: [...liveBlocks, newBlock], groups: liveGroups }, [newBlock.id]);
    setSelectedBlockIds([newBlock.id]);
    setSelectedGroupIds([]);
  }, [liveBlocks, liveGroups, commitChange]);

  const handleAddCharacter = useCallback((char: Omit<Character, 'definedInBlockId'>) => {
    const definitionString = `define ${char.tag} = Character('${char.name}', color="${char.color}")`;
    let definitionsBlock = liveBlocks.find(b => b.title?.toLowerCase().includes('definitions'));
    let newBlocks = [...liveBlocks];
    let dirtyId: string;

    if (definitionsBlock) {
      dirtyId = definitionsBlock.id;
      newBlocks = newBlocks.map(b => 
        b.id === definitionsBlock!.id
          ? { ...b, content: b.content + '\n' + definitionString }
          : b
      );
    } else {
      const newBlock: Block = {
        id: uuidv4(), title: "Character Definitions", content: definitionString,
        position: { x: 20, y: 20 }, width: 350, height: 100,
      };
      dirtyId = newBlock.id;
      newBlocks.push(newBlock);
    }
    commitChange({ blocks: newBlocks, groups: liveGroups }, [dirtyId]);
  }, [liveBlocks, liveGroups, commitChange]);

  const handleUpdateCharacter = useCallback((oldTag: string, newChar: Character) => {
    const oldChar = analysisResult.characters.get(oldTag);
    if (!oldChar) return;
    let newBlocks = [...liveBlocks];
    const dirtyIds = new Set<string>();

    const definitionBlock = newBlocks.find(b => b.id === oldChar.definedInBlockId);
    if (definitionBlock) {
      dirtyIds.add(definitionBlock.id);
      const oldDefRegex = new RegExp(`^\\s*define\\s+${oldTag}\\s*=\\s*Character\\s*\\(.*?\\)$`, "m");
      const newDefString = `define ${newChar.tag} = Character('${newChar.name}', color="${newChar.color}")`;
      const newContent = definitionBlock.content.replace(oldDefRegex, newDefString);
      newBlocks = newBlocks.map(b => b.id === definitionBlock.id ? { ...b, content: newContent } : b);
    }

    if (oldTag !== newChar.tag) {
      const dialogueLineRegex = new RegExp(`^(\\s*)(${oldTag})(\\s+((?:".*?")|(?:'.*?')))$`, "gm");
      newBlocks = newBlocks.map(b => {
        // FIX: Corrected typo from `dialogdialogueLineRegex` to `dialogueLineRegex`.
        if (b.content.match(dialogueLineRegex)) {
          dirtyIds.add(b.id);
          return { ...b, content: b.content.replace(dialogueLineRegex, `$1${newChar.tag}$3`) };
        }
        return b;
      });
    }
    commitChange({ blocks: newBlocks, groups: liveGroups }, Array.from(dirtyIds));
  }, [liveBlocks, liveGroups, commitChange, analysisResult.characters]);

  const handleFindCharacterUsages = useCallback((tag: string) => {
    const blockIds = new Set<string>();
    for (const [blockId, lines] of analysisResult.dialogueLines.entries()) {
      if (lines.some(line => line.tag === tag)) blockIds.add(blockId);
    }
    setFindUsagesHighlightIds(blockIds);
  }, [analysisResult.dialogueLines]);
  
  const handleAddVariable = useCallback((variable: Omit<Variable, 'definedInBlockId' | 'line'>) => {
    const definitionString = `${variable.type} ${variable.name} = ${variable.initialValue}`;
    let definitionsBlock = liveBlocks.find(b => b.title?.toLowerCase().includes('definitions'));
    let newBlocks = [...liveBlocks];
    let dirtyId: string;

    if (definitionsBlock) {
      dirtyId = definitionsBlock.id;
      newBlocks = newBlocks.map(b => b.id === definitionsBlock!.id ? { ...b, content: b.content + '\n' + definitionString } : b);
    } else {
      const newBlock: Block = {
        id: uuidv4(), title: "Variable Definitions", content: definitionString,
        position: { x: 20, y: 150 }, width: 350, height: 100,
      };
      dirtyId = newBlock.id;
      newBlocks.push(newBlock);
    }
    commitChange({ blocks: newBlocks, groups: liveGroups }, [dirtyId]);
  }, [liveBlocks, liveGroups, commitChange]);

  const handleFindVariableUsages = useCallback((variableName: string) => {
    const blockIds = new Set<string>();
    const definition = analysisResult.variables.get(variableName);
    if (definition) blockIds.add(definition.definedInBlockId);
    const usages = analysisResult.variableUsages.get(variableName) || [];
    usages.forEach(usage => blockIds.add(usage.blockId));
    setFindUsagesHighlightIds(blockIds);
  }, [analysisResult.variables, analysisResult.variableUsages]);

    const updateBlock = useCallback((id: string, newBlockData: Partial<Block>) => {
    const newBlocks = liveBlocks.map((block) =>
        block.id === id ? { ...block, ...newBlockData } : block
    );
    setLiveBlocks(newBlocks);
    setDirtyBlockIds(prev => new Set(prev).add(id));
  }, [liveBlocks]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.getAttribute('role') === 'textbox')) return;

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const isCtrlOrCmd = isMac ? e.metaKey : e.ctrlKey;

      if (isCtrlOrCmd && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); } 
      else if (isCtrlOrCmd && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); } 
      else if ((selectedBlockIds.length > 0 || selectedGroupIds.length > 0) && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault();
        if (selectedBlockIds.length > 0) deleteBlocks(selectedBlockIds);
        if (selectedGroupIds.length > 0) {
            const newGroups = liveGroups.filter(g => !selectedGroupIds.includes(g.id));
            commitChange({ blocks: liveBlocks, groups: newGroups });
            setSelectedGroupIds([]);
        }
      } else if (selectedBlockIds.length === 1 && e.key === 'f') { e.preventDefault(); handleOpenEditor(selectedBlockIds[0]); } 
      else if (e.key === 'n') { e.preventDefault(); addBlock(); } 
      else if (e.key === 'g' && !e.shiftKey) {
          e.preventDefault();
          if (selectedGroupIds.length > 0) {
            const blockIdsFromUngrouped = liveGroups.filter(g => selectedGroupIds.includes(g.id)).flatMap(g => g.blockIds);
            const newGroups = liveGroups.filter(g => !selectedGroupIds.includes(g.id));
            commitChange({ blocks: liveBlocks, groups: newGroups });
            setSelectedGroupIds([]);
            setSelectedBlockIds(Array.from(new Set(blockIdsFromUngrouped)));
          } else if (selectedBlockIds.length >= 2) {
            const selected = liveBlocks.filter(b => selectedBlockIds.includes(b.id));
            const PADDING = 40;
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            selected.forEach(b => {
                minX = Math.min(minX, b.position.x); minY = Math.min(minY, b.position.y);
                maxX = Math.max(maxX, b.position.x + b.width); maxY = Math.max(maxY, b.position.y + b.height);
            });
            const newGroup: BlockGroup = {
                id: uuidv4(), title: "New Group", position: { x: minX - PADDING, y: minY - PADDING },
                width: (maxX - minX) + PADDING * 2, height: (maxY - minY) + PADDING * 2, blockIds: selectedBlockIds
            };
            commitChange({ blocks: liveBlocks, groups: [...liveGroups, newGroup] });
            setSelectedBlockIds([]);
            setSelectedGroupIds([newGroup.id]);
          }
      } else if (e.key === 'G' && e.shiftKey) {
          if (selectedGroupIds.length === 0) return;
          e.preventDefault();
          const blockIdsFromUngrouped = liveGroups.filter(g => selectedGroupIds.includes(g.id)).flatMap(g => g.blockIds);
          const newGroups = liveGroups.filter(g => !selectedGroupIds.includes(g.id));
          commitChange({ blocks: liveBlocks, groups: newGroups });
          setSelectedGroupIds([]);
          setSelectedBlockIds(Array.from(new Set(blockIdsFromUngrouped)));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedBlockIds, selectedGroupIds, deleteBlocks, handleOpenEditor, addBlock, liveBlocks, liveGroups, commitChange, undo, redo]);

  const toggleTheme = () => {
    const themes: Theme[] = ['system', 'light', 'dark'];
    setTheme(themes[(themes.indexOf(theme) + 1) % themes.length]);
  };
  
  const tidyUpLayout = (blocksToLayout: Block[], links: Link[]): Block[] => {
      if (blocksToLayout.length === 0) return [];
      const blockMap = new Map(blocksToLayout.map(b => [b.id, b]));
      const adj = new Map<string, string[]>();
      const inDegree = new Map<string, number>();
      blocksToLayout.forEach(b => { adj.set(b.id, []); inDegree.set(b.id, 0); });
      links.forEach(link => {
          if (adj.has(link.sourceId) && inDegree.has(link.targetId)) {
              adj.get(link.sourceId)!.push(link.targetId);
              inDegree.set(link.targetId, (inDegree.get(link.targetId) || 0) + 1);
          }
      });
      const queue: string[] = [];
      inDegree.forEach((degree, id) => { if (degree === 0) queue.push(id); });
      if (queue.length === 0 && blocksToLayout.length > 0) {
          const nonZero = Array.from(inDegree.entries()).sort(([,a],[,b]) => a - b);
          if (nonZero.length > 0) queue.push(nonZero[0][0]);
      }
      const layers: string[][] = [];
      const visited = new Set<string>();
      while(queue.length > 0){
          const layerSize = queue.length;
          const currentLayer: string[] = [];
          for(let i=0; i<layerSize; i++){
              const u = queue.shift()!;
              if(visited.has(u)) continue;
              visited.add(u);
              currentLayer.push(u);
              for(const v of adj.get(u) || []){
                  inDegree.set(v, inDegree.get(v)! - 1);
                  if(inDegree.get(v)! === 0) queue.push(v);
              }
          }
          if (currentLayer.length > 0) layers.push(currentLayer);
      }
      if (blocksToLayout.length > visited.size) layers.push(blocksToLayout.filter(b => !visited.has(b.id)).map(b => b.id));

      const PADDING_X = 150, PADDING_Y = 50;
      let currentX = 0;
      const newBlocks = [...blocksToLayout];
      for (const layer of layers) {
          let maxLayerWidth = 0, currentLayerHeight = 0;
          layer.forEach(id => {
              const block = blockMap.get(id);
              if (block) { maxLayerWidth = Math.max(maxLayerWidth, block.width); currentLayerHeight += block.height; }
          });
          currentLayerHeight += Math.max(0, layer.length - 1) * PADDING_Y;
          let currentY = -currentLayerHeight / 2;
          for (const id of layer) {
              const block = blockMap.get(id);
              const blockIndex = newBlocks.findIndex(b => b.id === id);
              if (block && blockIndex !== -1) {
                  const xPos = currentX + (maxLayerWidth - block.width) / 2;
                  newBlocks[blockIndex] = { ...block, position: { x: xPos, y: currentY } };
                  currentY += block.height + PADDING_Y;
              }
          }
          currentX += maxLayerWidth + PADDING_X;
      }
      return newBlocks;
  };
  
  const handleTidyUp = () => {
    const newBlocks = tidyUpLayout(liveBlocks, analysisResult.links);
    commitChange({ blocks: newBlocks, groups: liveGroups });
  };

  const processImageDirectory = async (imageDirHandle: FileSystemDirectoryHandle, currentPath: string): Promise<RenpyImage[]> => {
    const loadedImages: RenpyImage[] = [];
    for await (const entry of imageDirHandle.values()) {
        const newPath = `${currentPath}/${entry.name}`;
        if (entry.kind === 'file' && /\.(png|jpe?g|webp)$/i.test(entry.name)) {
            const fileHandle = entry as FileSystemFileHandle;
            const file = await fileHandle.getFile();
            const dataUrl = await fileToDataUrl(file);
            const { tag, attributes } = parseImageFileName(entry.name, newPath);
            loadedImages.push({ tag, attributes, fileName: entry.name, filePath: newPath, dataUrl });
        } else if (entry.kind === 'directory') {
            const subImages = await processImageDirectory(entry as FileSystemDirectoryHandle, newPath);
            loadedImages.push(...subImages);
        }
    }
    return loadedImages;
  };

  const handleOpenFolder = async () => {
    if (!isFileSystemApiSupported) {
        alert("Your browser does not support the File System Access API. Please use a modern browser like Chrome or Edge.");
        return;
    }
    try {
        let rootHandle: FileSystemDirectoryHandle;
        if (window.showDirectoryPicker) {
            rootHandle = await window.showDirectoryPicker();
        } else if (window.aistudio?.showDirectoryPicker) {
            rootHandle = await window.aistudio.showDirectoryPicker();
        } else {
            alert("File System Access API could not be initialized.");
            return;
        }
        setDirectoryHandle(rootHandle);
        setImages([]); // Clear previous images

        const newBlocks: Block[] = [];
        const findRpyFilesRecursively = async (dirHandle: FileSystemDirectoryHandle, currentPath: string) => {
            for await (const entry of dirHandle.values()) {
                const newPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
                if (entry.kind === 'file' && entry.name.endsWith('.rpy')) {
                    const fileHandle = entry as FileSystemFileHandle;
                    const file = await fileHandle.getFile();
                    const content = await file.text();
                    newBlocks.push({
                        id: uuidv4(), content, position: { x: 0, y: 0 }, width: 300, height: 200, filePath: newPath, fileHandle,
                    });
                } else if (entry.kind === 'directory') {
                    if (entry.name.toLowerCase() === 'images') {
                        const loadedImages = await processImageDirectory(entry, 'images');
                        setImages(loadedImages);
                    } else {
                        await findRpyFilesRecursively(entry as FileSystemDirectoryHandle, newPath);
                    }
                }
            }
        };
        
        await findRpyFilesRecursively(rootHandle, '');
        
        const preliminaryAnalysis = performRenpyAnalysis(newBlocks);
        const laidOutBlocks = tidyUpLayout(newBlocks, preliminaryAnalysis.links);

        commitChange({ blocks: laidOutBlocks, groups: [] });
        setSelectedBlockIds([]);
        setSelectedGroupIds([]);
        setDirtyBlockIds(new Set());
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') console.log('User cancelled directory picker.');
      else console.error("Error opening directory:", err);
    }
  };
  
  const handleSave = async () => {
    if (!directoryHandle || dirtyBlockIds.size === 0) return;
    setSaveStatus('saving');
    
    const updatedBlocks = [...liveBlocks];
    const successfullySavedIds = new Set<string>();

    for (const blockId of dirtyBlockIds) {
        const blockIndex = updatedBlocks.findIndex(b => b.id === blockId);
        if (blockIndex === -1) continue;
        const block = updatedBlocks[blockIndex];

        try {
            if (block.fileHandle) {
                const writable = await block.fileHandle.createWritable();
                await writable.write(block.content);
                await writable.close();
                successfullySavedIds.add(blockId);
            } else {
                const title = block.title || analysisResult.firstLabels[block.id] || `RenPy_Block_${block.id.slice(0, 8)}`;
                const filename = `${title.replace(/[^a-z0-9_-]/gi, '_')}.rpy`;
                const newFileHandle = await directoryHandle.getFileHandle(filename, { create: true });
                const writable = await newFileHandle.createWritable();
                await writable.write(block.content);
                await writable.close();
                updatedBlocks[blockIndex] = { ...block, fileHandle: newFileHandle };
                successfullySavedIds.add(blockId);
            }
        } catch (err) {
            console.error(`Failed to save block ${block.title || block.id}`, err);
            alert(`Could not save file for block: ${block.title || block.id}. You may need to grant permission again.`);
        }
    }
    commitChange({ blocks: updatedBlocks, groups: liveGroups });
    setDirtyBlockIds(prev => {
        const newDirty = new Set(prev);
        successfullySavedIds.forEach(id => newDirty.delete(id));
        return newDirty;
    });
    setSaveStatus('saved');
  };

  const handleDownloadFiles = async () => {
    if (liveBlocks.length === 0) { alert("There are no blocks to download."); return; }
    try {
      const zip = new JSZip();
      const usedFilenames = new Map<string, number>();
      for (const block of liveBlocks) {
        const title = block.title || analysisResult.firstLabels[block.id] || `RenPy_Block_${block.id.slice(0, 8)}`;
        let baseFilename = title.replace(/[^a-z0-9_-]/gi, '_').replace(/_{2,}/g, '_');
        let finalFilename = `${baseFilename}.rpy`;
        const lowerBase = baseFilename.toLowerCase();
        const count = usedFilenames.get(lowerBase) || 0;
        if (count > 0) finalFilename = `${baseFilename} (${count}).rpy`;
        usedFilenames.set(lowerBase, count + 1);
        zip.file(finalFilename, block.content);
      }
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipBlob);
      link.download = 'renpy_project.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (error) { console.error("Error creating zip file:", error); alert("Could not create the zip file."); }
  };
  
  const handleUploadFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.zip')) {
        alert('Please upload a .zip file containing your Ren\'Py project.');
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
    }
    setUploadConfirm({ visible: true, file: file });
  };

  const processUploadedFile = async (file: File) => {
    try {
      const zip = await JSZip.loadAsync(file);
      const newBlocks: Block[] = [];
      const newImages: RenpyImage[] = [];
      
      for (const relativePath in zip.files) {
        const zipEntry = zip.files[relativePath];
        if (zipEntry.dir) continue;

        if (relativePath.endsWith('.rpy')) {
            const content = await zipEntry.async('string');
            newBlocks.push({ id: uuidv4(), content, position: { x: 0, y: 0 }, width: 300, height: 200, filePath: relativePath });
        } else if (/\.(png|jpe?g|webp)$/i.test(relativePath) && relativePath.toLowerCase().startsWith('images/')) {
            const blob = await zipEntry.async('blob');
            const dataUrl = await fileToDataUrl(blob);
            const fileName = relativePath.split('/').pop() || '';
            const { tag, attributes } = parseImageFileName(fileName, relativePath);
            newImages.push({ tag, attributes, fileName, filePath: relativePath, dataUrl });
        }
      }
      
      setDirectoryHandle(null);
      setDirtyBlockIds(new Set());
      setImages(newImages);
      
      const preliminaryAnalysis = performRenpyAnalysis(newBlocks);
      const laidOutBlocks = tidyUpLayout(newBlocks, preliminaryAnalysis.links);

      commitChange({ blocks: laidOutBlocks, groups: [] });
      setSelectedBlockIds([]);
      setSelectedGroupIds([]);

    } catch (error) {
      console.error("Error processing zip file:", error);
      alert("Could not process the zip file. It might be corrupted or in an invalid format.");
    } finally {
      if(fileInputRef.current) fileInputRef.current.value = "";
      setUploadConfirm({ visible: false, file: null });
    }
  };


  const updateBlockPositions = useCallback((updates: { id: string, position: Position }[]) => {
    const updatesMap = new Map(updates.map(u => [u.id, u.position]));
    setLiveBlocks(prevBlocks => prevBlocks.map(block => updatesMap.has(block.id) ? { ...block, position: updatesMap.get(block.id)! } : block));
  }, []);

  const updateGroup = useCallback((id: string, newGroupData: Partial<BlockGroup>) => {
    const newGroups = liveGroups.map((group) => group.id === id ? { ...group, ...newGroupData } : group);
    commitChange({ blocks: liveBlocks, groups: newGroups });
  }, [liveBlocks, liveGroups, commitChange]);

  const updateGroupPositions = useCallback((updates: { id: string, position: Position }[]) => {
    const updatesMap = new Map(updates.map(u => [u.id, u.position]));
    setLiveGroups(prev => prev.map(group => updatesMap.has(group.id) ? { ...group, position: updatesMap.get(group.id)! } : group));
  }, []);

  const onInteractionEnd = useCallback(() => {
    setHistory({ blocks: liveBlocks, groups: liveGroups });
    const draggedBlockIds = liveBlocks.filter(b => b.position !== historyState.blocks.find(hb => hb.id === b.id)?.position).map(b => b.id);
    if(draggedBlockIds.length > 0) {
      setDirtyBlockIds(prev => new Set([...prev, ...draggedBlockIds]));
    }
  }, [liveBlocks, liveGroups, setHistory, historyState.blocks]);

  const handleCloseEditor = useCallback(() => {
    setEditingBlockId(null);
    setInitialScrollLine(undefined);
  }, []);

  const handleSaveAndCloseEditor = useCallback((content: string) => {
    if (editingBlockId) {
       const newBlocks = liveBlocks.map((block) => block.id === editingBlockId ? { ...block, content } : block );
      commitChange({ blocks: newBlocks, groups: liveGroups }, [editingBlockId]);
    }
    handleCloseEditor();
  }, [editingBlockId, liveBlocks, liveGroups, commitChange, handleCloseEditor]);

  const handleSwitchFocusBlock = useCallback((blockId: string, line: number) => {
    setEditingBlockId(blockId);
    setInitialScrollLine(line);
  }, []);
  
  const handleRefreshAnalysis = () => setAnalysisTrigger(c => c + 1);
  
  const handleImportImages = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    if (!directoryHandle) {
        alert("Please open a project folder first to import images directly into it.");
        return;
    }

    try {
        const imagesDir = await directoryHandle.getDirectoryHandle('images', { create: true });
        const newImages: RenpyImage[] = [...images];

        for (const file of files) {
            const newFileHandle = await imagesDir.getFileHandle(file.name, { create: true });
            const writable = await newFileHandle.createWritable();
            await writable.write(file);
            await writable.close();
            
            const dataUrl = await fileToDataUrl(file);
            const filePath = `images/${file.name}`;
            const { tag, attributes } = parseImageFileName(file.name, filePath);
            
            // Avoid duplicates
            const existingIndex = newImages.findIndex(img => img.filePath === filePath);
            if (existingIndex > -1) newImages[existingIndex] = { tag, attributes, fileName: file.name, filePath, dataUrl };
            else newImages.push({ tag, attributes, fileName: file.name, filePath, dataUrl });
        }
        setImages(newImages);
    } catch (err) {
        console.error("Error importing images:", err);
        alert("Could not import images. You may need to grant file system permissions again.");
    } finally {
        if(imageImportInputRef.current) imageImportInputRef.current.value = "";
    }
  };


  const editingBlock = liveBlocks.find(b => b.id === editingBlockId);
  
  const ThemeIcon = () => {
    if (theme === 'light') return <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>;
    if (theme === 'dark') return <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>;
    return <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>;
  };
  
  const SaveStatusIndicator = () => {
    if (directoryHandle) {
      if (dirtyBlockIds.size > 0) {
        return <div className="flex items-center text-blue-600 dark:text-blue-400"><span>{dirtyBlockIds.size} unsaved changes</span></div>;
      }
      return <div className="flex items-center text-green-600 dark:text-green-400"><span>Project saved</span></div>;
    }
    if (saveStatus === 'saving') return <div className="flex items-center text-gray-500 dark:text-gray-400"><svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span>Saving...</span></div>;
    if (saveStatus === 'saved') return <div className="flex items-center text-green-600 dark:text-green-400"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg><span>Saved to browser</span></div>;
    return <div className="flex items-center text-red-500 dark:text-red-400"><span>Error</span></div>;
  };

  return (
    <div className={`h-screen w-screen flex flex-col font-sans antialiased text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 ${effectiveTheme}`}>
      <header className="flex-shrink-0 h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4 z-20">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-bold">Ren'Py Visual Novel Accelerator</h1>
        </div>
        <div className="flex-grow flex items-center justify-center">
            <SaveStatusIndicator />
        </div>
        <div className="flex items-center space-x-2">
           <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept=".zip"
            onChange={handleUploadFileSelect}
           />
           <button onClick={undo} disabled={!canUndo} className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed" title="Undo (Ctrl+Z)"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z" /></svg></button>
           <button onClick={redo} disabled={!canRedo} className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed" title="Redo (Ctrl+Y)"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 15l3-3m0 0l-3-3m3 3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></button>
           <div className="w-px h-6 bg-gray-200 dark:bg-gray-600"></div>
           <button onClick={addBlock} className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700" title="New Block (N)"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg></button>
           <button onClick={handleTidyUp} className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700" title="Tidy Up Layout"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg></button>
           <button onClick={handleRefreshAnalysis} className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700" title="Refresh Links & Analysis"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M20 20v-5h-5M4 4l5 5M20 20l-5-5M4 20h5v-5M20 4h-5v5" /></svg></button>
           <button onClick={() => setIsClearConfirmVisible(true)} className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700" title="Clear Canvas"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
           <div className="w-px h-6 bg-gray-200 dark:bg-gray-600"></div>
           <button 
             onClick={handleOpenFolder} 
             disabled={!isFileSystemApiSupported}
             className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed" 
             title={isFileSystemApiSupported ? "Open Project Folder" : "File System Access is not available in this environment"}
           >
             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" /></svg>
           </button>
           <button 
             onClick={handleSave} 
             disabled={!isFileSystemApiSupported || !directoryHandle || dirtyBlockIds.size === 0} 
             className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed" 
             title={isFileSystemApiSupported ? "Save All Changes" : "File System Access is not available in this environment"}
           >
             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M7.707 10.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V6h5a2 2 0 012 2v7a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2h5v5.586l-1.293-1.293zM9 4a1 1 0 012 0v2H9V4z" /></svg>
           </button>
           <div className="w-px h-6 bg-gray-200 dark:bg-gray-600"></div>
           <button onClick={() => fileInputRef.current?.click()} className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700" title="Upload .zip Project"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M4 16h12v2H4v-2zm4-12v8H4l6-6 6 6h-4V4H8z"/></svg></button>
           <button onClick={handleDownloadFiles} className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700" title="Download as .zip"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg></button>
           <button onClick={toggleTheme} className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700" title={`Switch to ${theme === 'light' ? 'Dark' : theme === 'dark' ? 'System' : 'Light'} Mode`}><ThemeIcon /></button>
           <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700" title="Toggle Story Elements Panel"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isSidebarOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} /></svg></button>
        </div>
      </header>

      <main className="flex-grow flex relative">
        <div className="flex-grow relative">
          <StoryCanvas
            blocks={liveBlocks}
            groups={liveGroups}
            analysisResult={analysisResult}
            updateBlock={updateBlock}
            updateGroup={updateGroup}
            updateBlockPositions={updateBlockPositions}
            updateGroupPositions={updateGroupPositions}
            onInteractionEnd={onInteractionEnd}
            deleteBlock={(id) => deleteBlocks([id])}
            onOpenEditor={handleOpenEditor}
            selectedBlockIds={selectedBlockIds}
            setSelectedBlockIds={setSelectedBlockIds}
            selectedGroupIds={selectedGroupIds}
            setSelectedGroupIds={setSelectedGroupIds}
            findUsagesHighlightIds={findUsagesHighlightIds}
            clearFindUsages={() => setFindUsagesHighlightIds(null)}
            dirtyBlockIds={dirtyBlockIds}
          />
        </div>
        <StoryElementsPanel 
            isOpen={isSidebarOpen}
            characters={analysisResult.characters}
            characterUsage={analysisResult.characterUsage}
            onAddCharacter={handleAddCharacter}
            onUpdateCharacter={handleUpdateCharacter}
            onFindCharacterUsages={handleFindCharacterUsages}
            variables={analysisResult.variables}
            onAddVariable={handleAddVariable}
            onFindVariableUsages={handleFindVariableUsages}
            images={images}
            onImportImages={() => imageImportInputRef.current?.click()}
            isFileSystemApiSupported={isFileSystemApiSupported && !!directoryHandle}
        />
        <input
            type="file"
            ref={imageImportInputRef}
            style={{ display: 'none' }}
            accept="image/png, image/jpeg, image/webp"
            multiple
            onChange={handleImportImages}
        />
      </main>

       {editingBlock && (
        <EditorModal
          block={editingBlock}
          analysisResult={analysisResult}
          initialScrollLine={initialScrollLine}
          onSwitchFocusBlock={handleSwitchFocusBlock}
          onSave={handleSaveAndCloseEditor}
          onClose={handleCloseEditor}
          editorTheme={effectiveTheme}
        />
      )}
      {isClearConfirmVisible && (
        <ConfirmModal
          title="Clear Canvas"
          confirmText="Clear Canvas"
          onConfirm={() => {
            commitChange({ blocks: [], groups: [] });
            setImages([]);
            setIsClearConfirmVisible(false);
            setDirectoryHandle(null);
            setDirtyBlockIds(new Set());
            // Clear local storage as well
            localStorage.removeItem(SAVE_KEY_BLOCKS);
            localStorage.removeItem(SAVE_KEY_GROUPS);
          }}
          onClose={() => setIsClearConfirmVisible(false)}
        >
          Are you sure you want to delete all blocks and groups? This action cannot be undone.
        </ConfirmModal>
      )}
      {uploadConfirm.visible && (
        <ConfirmModal
          title="Upload Project from .zip"
          confirmText="Upload & Replace"
          confirmClassName="bg-indigo-600 hover:bg-indigo-700"
          onConfirm={() => {
            if (uploadConfirm.file) {
              processUploadedFile(uploadConfirm.file);
            }
          }}
          onClose={() => {
            if (fileInputRef.current) fileInputRef.current.value = "";
            setUploadConfirm({ visible: false, file: null });
          }}
        >
          Are you sure you want to upload this project? Your current canvas will be cleared. This action cannot be undone.
        </ConfirmModal>
      )}
    </div>
  );
};

export default App;
