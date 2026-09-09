/**
 * @file useAssetManagement.ts
 * @description Custom hook for managing project assets (images and audios)
 *
 * Handles all asset-related state including image/audio collections, metadata,
 * external scan directories, refresh state, and timestamps. Provides operations
 * for scanning, copying, and managing assets.
 */

import { useState, useCallback } from 'react';
import type React from 'react';
import type { ProjectImage, RenpyAudio, ImageMetadata, AudioMetadata, EditorTab } from '@/types';
import type { PerformanceRecorders } from '@/hooks/usePerformanceMetrics';
import { logger } from '@/lib/logger';

type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface UseAssetManagementParams {
  projectRootPath: string | null;
  perfRecorders: PerformanceRecorders;
  setIsScanningAssets: React.Dispatch<React.SetStateAction<boolean>>;
  setHasUnsavedSettings: React.Dispatch<React.SetStateAction<boolean>>;
  setFileSystemTree: React.Dispatch<React.SetStateAction<import('@/types').FileSystemTreeNode | null>>;
  addToast: (message: string, type?: ToastType) => void;
  setOpenTabs: React.Dispatch<React.SetStateAction<EditorTab[]>>;
  setSecondaryOpenTabs: React.Dispatch<React.SetStateAction<EditorTab[]>>;
  setActiveTabId: React.Dispatch<React.SetStateAction<string>>;
  setSecondaryActiveTabId: React.Dispatch<React.SetStateAction<string>>;
}

export interface UseAssetManagementReturn {
  // Image state
  images: Map<string, ProjectImage>;
  imageMetadata: Map<string, ImageMetadata>;
  imageScanDirectories: Map<string, FileSystemDirectoryHandle>;
  imagesLastScanned: number | null;
  isRefreshingImages: boolean;
  setImages: React.Dispatch<React.SetStateAction<Map<string, ProjectImage>>>;
  setImageMetadata: React.Dispatch<React.SetStateAction<Map<string, ImageMetadata>>>;
  setImageScanDirectories: React.Dispatch<React.SetStateAction<Map<string, FileSystemDirectoryHandle>>>;
  setImagesLastScanned: React.Dispatch<React.SetStateAction<number | null>>;
  setIsRefreshingImages: React.Dispatch<React.SetStateAction<boolean>>;

  // Audio state
  audios: Map<string, RenpyAudio>;
  audioMetadata: Map<string, AudioMetadata>;
  audioScanDirectories: Map<string, FileSystemDirectoryHandle>;
  audiosLastScanned: number | null;
  isRefreshingAudios: boolean;
  setAudios: React.Dispatch<React.SetStateAction<Map<string, RenpyAudio>>>;
  setAudioMetadata: React.Dispatch<React.SetStateAction<Map<string, AudioMetadata>>>;
  setAudioScanDirectories: React.Dispatch<React.SetStateAction<Map<string, FileSystemDirectoryHandle>>>;
  setAudiosLastScanned: React.Dispatch<React.SetStateAction<number | null>>;
  setIsRefreshingAudios: React.Dispatch<React.SetStateAction<boolean>>;

  // High-level operations
  addImage: (path: string, image: ProjectImage) => void;
  removeImage: (path: string) => void;
  updateImageMetadata: (path: string, metadata: ImageMetadata) => void;
  addAudio: (path: string, audio: RenpyAudio) => void;
  removeAudio: (path: string) => void;
  updateAudioMetadata: (path: string, metadata: AudioMetadata) => void;
  clearImages: () => void;
  clearAudios: () => void;

  // Scan-directory operations
  handleAddImageScanDirectory: () => Promise<void>;
  handleRefreshImages: () => Promise<void>;
  handleRemoveImageScanDirectory: (path: string) => void;
  handleCopyImagesToProjectBulk: (sourcePaths: string[]) => Promise<void>;
  handleAddAudioScanDirectory: () => Promise<void>;
  handleRefreshAudios: () => Promise<void>;
  handleRemoveAudioScanDirectory: (path: string) => void;
  handleCopyAudiosToProjectBulk: (sourcePaths: string[]) => Promise<void>;
  cancelAssetScan: () => void;

  // Single-file metadata / copy operations (used by ImageEditorView / AudioEditorView tabs)
  handleSaveImageMetadata: (currentFilePath: string, newMeta: ImageMetadata) => Promise<void>;
  handleCopyImageToProject: (sourcePath: string, meta: ImageMetadata) => Promise<void>;
  handleImportPortraitImage: (sourcePath: string) => Promise<ProjectImage | null>;
  handleSaveAudioMetadata: (currentFilePath: string, newMeta: AudioMetadata) => Promise<void>;
  handleCopyAudioToProject: (sourcePath: string, meta: AudioMetadata) => Promise<void>;
}

/**
 * Hook for managing project assets (images and audios)
 *
 * @returns Object containing asset state and management functions
 *
 * @example
 * ```tsx
 * const {
 *   images,
 *   audios,
 *   addImage,
 *   addAudio,
 *   updateImageMetadata
 * } = useAssetManagement();
 *
 * // Add an image to the project
 * addImage('game/images/bg.png', {
 *   path: 'game/images/bg.png',
 *   isInProject: true,
 *   naturalWidth: 1920,
 *   naturalHeight: 1080
 * });
 *
 * // Update image metadata
 * updateImageMetadata('game/images/bg.png', {
 *   tags: ['background', 'day'],
 *   displayName: 'Day Background'
 * });
 * ```
 */
export function useAssetManagement({
  projectRootPath, perfRecorders, setIsScanningAssets, setHasUnsavedSettings, setFileSystemTree, addToast,
  setOpenTabs, setSecondaryOpenTabs, setActiveTabId, setSecondaryActiveTabId,
}: UseAssetManagementParams): UseAssetManagementReturn {
  // --- Image state ---
  const [images, setImages] = useState<Map<string, ProjectImage>>(new Map());
  const [imageMetadata, setImageMetadata] = useState<Map<string, ImageMetadata>>(new Map());
  const [imageScanDirectories, setImageScanDirectories] = useState<Map<string, FileSystemDirectoryHandle>>(new Map());
  const [imagesLastScanned, setImagesLastScanned] = useState<number | null>(null);
  const [isRefreshingImages, setIsRefreshingImages] = useState(false);

  // --- Audio state ---
  const [audios, setAudios] = useState<Map<string, RenpyAudio>>(new Map());
  const [audioMetadata, setAudioMetadata] = useState<Map<string, AudioMetadata>>(new Map());
  const [audioScanDirectories, setAudioScanDirectories] = useState<Map<string, FileSystemDirectoryHandle>>(new Map());
  const [audiosLastScanned, setAudiosLastScanned] = useState<number | null>(null);
  const [isRefreshingAudios, setIsRefreshingAudios] = useState(false);

  /**
   * Add an image to the collection
   */
  const addImage = useCallback((path: string, image: ProjectImage) => {
    setImages(prev => {
      const next = new Map(prev);
      next.set(path, image);
      return next;
    });
  }, []);

  /**
   * Remove an image from the collection
   */
  const removeImage = useCallback((path: string) => {
    setImages(prev => {
      const next = new Map(prev);
      next.delete(path);
      return next;
    });
    setImageMetadata(prev => {
      const next = new Map(prev);
      next.delete(path);
      return next;
    });
  }, []);

  /**
   * Update image metadata
   */
  const updateImageMetadata = useCallback((path: string, metadata: ImageMetadata) => {
    setImageMetadata(prev => {
      const next = new Map(prev);
      next.set(path, metadata);
      return next;
    });
  }, []);

  /**
   * Add an audio to the collection
   */
  const addAudio = useCallback((path: string, audio: RenpyAudio) => {
    setAudios(prev => {
      const next = new Map(prev);
      next.set(path, audio);
      return next;
    });
  }, []);

  /**
   * Remove an audio from the collection
   */
  const removeAudio = useCallback((path: string) => {
    setAudios(prev => {
      const next = new Map(prev);
      next.delete(path);
      return next;
    });
    setAudioMetadata(prev => {
      const next = new Map(prev);
      next.delete(path);
      return next;
    });
  }, []);

  /**
   * Update audio metadata
   */
  const updateAudioMetadata = useCallback((path: string, metadata: AudioMetadata) => {
    setAudioMetadata(prev => {
      const next = new Map(prev);
      next.set(path, metadata);
      return next;
    });
  }, []);

  /**
   * Clear all images (typically on project close)
   */
  const clearImages = useCallback(() => {
    setImages(new Map());
    setImageMetadata(new Map());
    setImageScanDirectories(new Map());
    setImagesLastScanned(null);
  }, []);

  /**
   * Clear all audios (typically on project close)
   */
  const clearAudios = useCallback(() => {
    setAudios(new Map());
    setAudioMetadata(new Map());
    setAudioScanDirectories(new Map());
    setAudiosLastScanned(null);
  }, []);

  /**
   * Prompt for a directory, scan it for images, and merge newly found images into the collection.
   */
  const handleAddImageScanDirectory = useCallback(async () => {
    if (window.electronAPI) {
      try {
        const path = await window.electronAPI.openDirectory();
        if (path) {
          setImageScanDirectories(prev => new Map(prev).set(path, null as unknown as FileSystemDirectoryHandle));
          perfRecorders.recordScanStart();
          setIsScanningAssets(true);
          setIsRefreshingImages(true);
          try {
            const { images: scanned, truncated, cancelled, errors } = await window.electronAPI.scanDirectory(path);
            setImages(prev => {
              const next = new Map(prev);
              scanned.forEach((img) => {
                if (!next.has(img.path)) next.set(img.path, { ...img, filePath: img.path, isInProject: false, fileHandle: null });
              });
              return next;
            });
            if (cancelled) {
              addToast('Scan cancelled — showing partial results.', 'warning');
            } else if (truncated) {
              addToast('Scan stopped early: too many files in that directory. Showing partial results.', 'warning');
            } else if (errors && errors.length > 0) {
              addToast(`Skipped ${errors.length} file${errors.length === 1 ? '' : 's'} that could not be read.`, 'warning');
            }
          } finally {
            perfRecorders.recordScanEnd();
            setIsScanningAssets(false);
            setIsRefreshingImages(false);
            setImagesLastScanned(Date.now());
          }
          setHasUnsavedSettings(true);
        }
      } catch (err) {
        logger.error('Failed to scan image directory:', err);
        addToast('Failed to scan image directory', 'error');
      }
    }
  }, [addToast, perfRecorders, setHasUnsavedSettings, setIsScanningAssets]);

  /**
   * Re-scan all registered image directories and merge newly found images.
   */
  const handleRefreshImages = useCallback(async () => {
    if (!window.electronAPI) return;
    const paths = Array.from(imageScanDirectories.keys());
    if (paths.length === 0) return;
    setIsRefreshingImages(true);
    perfRecorders.recordScanStart();
    setIsScanningAssets(true);
    try {
      await Promise.all(paths.map((dirPath) =>
        window.electronAPI!.scanDirectory(dirPath).then(({ images: scanned }) => {
          setImages(prev => {
            const next = new Map(prev);
            scanned.forEach((img) => {
              if (!next.has(img.path)) next.set(img.path, { ...img, filePath: img.path, isInProject: false, fileHandle: null });
            });
            return next;
          });
        })
      ));
    } finally {
      perfRecorders.recordScanEnd();
      setIsScanningAssets(false);
      setIsRefreshingImages(false);
      setImagesLastScanned(Date.now());
    }
  }, [imageScanDirectories, perfRecorders, setIsScanningAssets]);

  const handleRemoveImageScanDirectory = useCallback((path: string) => {
    setImageScanDirectories(prev => {
      const next = new Map(prev);
      next.delete(path);
      return next;
    });
    setHasUnsavedSettings(true);
  }, [setHasUnsavedSettings]);

  const handleCopyImagesToProjectBulk = useCallback(async (sourcePaths: string[]) => {
    if (window.electronAPI && projectRootPath) {
      try {
        const copied: { src: string; dest: string }[] = [];
        for (const src of sourcePaths) {
          const fileName = src.split('/').pop() || 'image.png';
          const destDir = await window.electronAPI.path.join(projectRootPath, 'game', 'images');
          const destPath = await window.electronAPI.path.join(destDir, fileName);
          await window.electronAPI.copyEntry(src, destPath);
          copied.push({ src, dest: destPath });
        }
        setImages(prev => {
          const next = new Map(prev);
          copied.forEach(({ src, dest }) => {
            const existing = next.get(src);
            if (existing) {
              next.set(src, { ...existing, isInProject: true, projectFilePath: dest });
            }
          });
          return next;
        });
        const freshTree = await window.electronAPI.refreshProjectTree(projectRootPath);
        setFileSystemTree(freshTree);
      } catch (err) {
        logger.error('Failed to copy images to project:', err);
        addToast('Failed to copy images to project', 'error');
      }
    }
  }, [projectRootPath, addToast, setFileSystemTree]);

  /**
   * Prompt for a directory, scan it for audio files, and merge newly found audios into the collection.
   */
  const handleAddAudioScanDirectory = useCallback(async () => {
    if (window.electronAPI) {
      try {
        const path = await window.electronAPI.openDirectory();
        if (path) {
          setAudioScanDirectories(prev => new Map(prev).set(path, null as unknown as FileSystemDirectoryHandle));
          perfRecorders.recordScanStart();
          setIsScanningAssets(true);
          setIsRefreshingAudios(true);
          try {
            const { audios: scanned, truncated, cancelled, errors } = await window.electronAPI.scanDirectory(path);
            setAudios(prev => {
              const next = new Map(prev);
              scanned.forEach((aud) => {
                if (!next.has(aud.path)) next.set(aud.path, { ...aud, filePath: aud.path, isInProject: false, fileHandle: null });
              });
              return next;
            });
            if (cancelled) {
              addToast('Scan cancelled — showing partial results.', 'warning');
            } else if (truncated) {
              addToast('Scan stopped early: too many files in that directory. Showing partial results.', 'warning');
            } else if (errors && errors.length > 0) {
              addToast(`Skipped ${errors.length} file${errors.length === 1 ? '' : 's'} that could not be read.`, 'warning');
            }
          } finally {
            perfRecorders.recordScanEnd();
            setIsScanningAssets(false);
            setIsRefreshingAudios(false);
            setAudiosLastScanned(Date.now());
          }
          setHasUnsavedSettings(true);
        }
      } catch (err) {
        logger.error('Failed to scan audio directory:', err);
        addToast('Failed to scan audio directory', 'error');
      }
    }
  }, [addToast, perfRecorders, setHasUnsavedSettings, setIsScanningAssets]);

  /**
   * Re-scan all registered audio directories and merge newly found audios.
   */
  const handleRefreshAudios = useCallback(async () => {
    if (!window.electronAPI) return;
    const paths = Array.from(audioScanDirectories.keys());
    if (paths.length === 0) return;
    setIsRefreshingAudios(true);
    perfRecorders.recordScanStart();
    setIsScanningAssets(true);
    try {
      await Promise.all(paths.map((dirPath) =>
        window.electronAPI!.scanDirectory(dirPath).then(({ audios: scanned }) => {
          setAudios(prev => {
            const next = new Map(prev);
            scanned.forEach((aud) => {
              if (!next.has(aud.path)) next.set(aud.path, { ...aud, filePath: aud.path, isInProject: false, fileHandle: null });
            });
            return next;
          });
        })
      ));
    } finally {
      perfRecorders.recordScanEnd();
      setIsScanningAssets(false);
      setIsRefreshingAudios(false);
      setAudiosLastScanned(Date.now());
    }
  }, [audioScanDirectories, perfRecorders, setIsScanningAssets]);

  const handleRemoveAudioScanDirectory = useCallback((path: string) => {
    setAudioScanDirectories(prev => {
      const next = new Map(prev);
      next.delete(path);
      return next;
    });
    setHasUnsavedSettings(true);
  }, [setHasUnsavedSettings]);

  const handleCopyAudiosToProjectBulk = useCallback(async (sourcePaths: string[]) => {
    if (window.electronAPI && projectRootPath) {
      try {
        const copied: { src: string; dest: string }[] = [];
        for (const src of sourcePaths) {
          const fileName = src.split('/').pop() || 'audio.ogg';
          const destDir = await window.electronAPI.path.join(projectRootPath, 'game', 'audio');
          const destPath = await window.electronAPI.path.join(destDir, fileName);
          await window.electronAPI.copyEntry(src, destPath);
          copied.push({ src, dest: destPath });
        }
        setAudios(prev => {
          const next = new Map(prev);
          copied.forEach(({ src, dest }) => {
            const existing = next.get(src);
            if (existing) {
              next.set(src, { ...existing, isInProject: true, projectFilePath: dest });
            }
          });
          return next;
        });
        const freshTree = await window.electronAPI.refreshProjectTree(projectRootPath);
        setFileSystemTree(freshTree);
      } catch (err) {
        logger.error('Failed to copy audio to project:', err);
        addToast('Failed to copy audio to project', 'error');
      }
    }
  }, [projectRootPath, addToast, setFileSystemTree]);

  const handleSaveImageMetadata = useCallback(async (currentFilePath: string, newMeta: ImageMetadata) => {
    if (!projectRootPath || !window.electronAPI) return;

    const isRelative = currentFilePath.startsWith('game/images');
    const fileName = currentFilePath.split(/[/\\]/).pop()!;
    const newSubfolder = newMeta.projectSubfolder?.trim() || '';
    const newRelPath = newSubfolder ? `game/images/${newSubfolder}/${fileName}` : `game/images/${fileName}`;

    const absCurrentPath = isRelative
      ? await window.electronAPI.path.join(projectRootPath, currentFilePath) as string
      : currentFilePath;
    const absNewPath = await window.electronAPI.path.join(projectRootPath, newRelPath) as string;
    const needsMove = absCurrentPath.replace(/\\/g, '/') !== absNewPath.replace(/\\/g, '/');

    if (needsMove) {
      const absNewDir = await window.electronAPI.path.join(projectRootPath, newSubfolder ? `game/images/${newSubfolder}` : 'game/images') as string;
      await window.electronAPI.createDirectory(absNewDir);
      const res = await window.electronAPI.moveFile(absCurrentPath, absNewPath);
      if (!res.success) throw new Error(res.error || 'Move failed');

      const mapKey = isRelative ? currentFilePath
        : ([...images.keys()].find(k => {
            const v = images.get(k)!;
            return (v.projectFilePath || v.filePath) === currentFilePath;
          }) ?? currentFilePath);

      setImages(prev => {
        const next = new Map(prev);
        const existing = next.get(mapKey);
        next.delete(mapKey);
        if (existing) next.set(newRelPath, { ...existing, filePath: newRelPath, projectFilePath: undefined });
        return next;
      });
      setImageMetadata(prev => {
        const next = new Map(prev);
        next.delete(currentFilePath);
        next.set(newRelPath, newMeta);
        return next;
      });
      const oldTabId = `img-${mapKey}`;
      const newTabId = `img-${newRelPath}`;
      setOpenTabs(prev => prev.map(t => t.id === oldTabId ? { ...t, id: newTabId, filePath: newRelPath } : t));
      setSecondaryOpenTabs(prev => prev.map(t => t.id === oldTabId ? { ...t, id: newTabId, filePath: newRelPath } : t));
      setActiveTabId(prev => prev === oldTabId ? newTabId : prev);
      setSecondaryActiveTabId(prev => prev === oldTabId ? newTabId : prev);
    } else {
      setImageMetadata(prev => { const next = new Map(prev); next.set(currentFilePath, newMeta); return next; });
    }

    setHasUnsavedSettings(true);
    const freshTree = await window.electronAPI.refreshProjectTree(projectRootPath);
    setFileSystemTree(freshTree);
  }, [projectRootPath, images, setActiveTabId, setFileSystemTree, setImageMetadata, setImages, setOpenTabs, setSecondaryActiveTabId, setSecondaryOpenTabs, setHasUnsavedSettings]);

  const handleCopyImageToProject = useCallback(async (sourcePath: string, meta: ImageMetadata) => {
    try {
      if (window.electronAPI && projectRootPath) {
        const fileName = sourcePath.split('/').pop() || 'image.png';
        const subfolder = meta.projectSubfolder || '';
        const destDir = await window.electronAPI.path.join(projectRootPath, 'game', 'images', subfolder);
        const destPath = await window.electronAPI.path.join(destDir, fileName);
        await window.electronAPI.copyEntry(sourcePath, destPath);
        setImages(prev => {
          const next = new Map(prev);
          const existing = next.get(sourcePath);
          if (existing) {
            next.set(sourcePath, { ...existing, isInProject: true, projectFilePath: destPath });
          }
          return next;
        });
        addToast('Image copied to project', 'success');
        const freshTree = await window.electronAPI.refreshProjectTree(projectRootPath);
        setFileSystemTree(freshTree);
      }
    } catch (err) {
      logger.error('Failed to copy image to project:', err);
      addToast('Failed to copy image to project', 'error');
    }
  }, [projectRootPath, addToast, setFileSystemTree, setImages]);

  /**
   * Imports an arbitrary image file (from an OS file-browser drag or a file-selection
   * dialog) into `game/images/portraits/`, registering it as a new `ProjectImage` entry.
   * Unlike `handleCopyImagesToProjectBulk`, the source doesn't need to already be a
   * known scanned image -- this covers files the app has never seen before.
   */
  const handleImportPortraitImage = useCallback(async (sourcePath: string): Promise<ProjectImage | null> => {
    if (!window.electronAPI || !projectRootPath) return null;
    try {
      // Uses a dedicated main-process handler rather than copyEntry: sourcePath is
      // expected to live outside the project (an OS drag or a file-dialog pick), and
      // copyEntry rejects any source outside the current project root.
      const result = await window.electronAPI.importPortraitImage(sourcePath);
      if (!result.success || !result.relPath || !result.absPath || !result.mediaUrl) {
        throw new Error(result.error || 'Unknown error importing portrait image');
      }
      const newImage: ProjectImage = {
        filePath: result.relPath,
        fileName: result.relPath.split('/').pop() || result.relPath,
        dataUrl: result.mediaUrl,
        fileHandle: null,
        isInProject: true,
        projectFilePath: result.absPath,
      };
      setImages(prev => {
        const next = new Map(prev);
        next.set(result.relPath as string, newImage);
        return next;
      });
      const freshTree = await window.electronAPI.refreshProjectTree(projectRootPath);
      setFileSystemTree(freshTree);
      return newImage;
    } catch (err) {
      logger.error('Failed to import portrait image:', err);
      addToast('Failed to import portrait image', 'error');
      return null;
    }
  }, [projectRootPath, addToast, setFileSystemTree, setImages]);

  const handleSaveAudioMetadata = useCallback(async (currentFilePath: string, newMeta: AudioMetadata) => {
    if (!projectRootPath || !window.electronAPI) return;

    const isRelative = currentFilePath.startsWith('game/audio');
    const fileName = currentFilePath.split(/[/\\]/).pop()!;
    const newSubfolder = newMeta.projectSubfolder?.trim() || '';
    const newRelPath = newSubfolder ? `game/audio/${newSubfolder}/${fileName}` : `game/audio/${fileName}`;

    const absCurrentPath = isRelative
      ? await window.electronAPI.path.join(projectRootPath, currentFilePath) as string
      : currentFilePath;
    const absNewPath = await window.electronAPI.path.join(projectRootPath, newRelPath) as string;
    const needsMove = absCurrentPath.replace(/\\/g, '/') !== absNewPath.replace(/\\/g, '/');

    if (needsMove) {
      const absNewDir = await window.electronAPI.path.join(projectRootPath, newSubfolder ? `game/audio/${newSubfolder}` : 'game/audio') as string;
      await window.electronAPI.createDirectory(absNewDir);
      const res = await window.electronAPI.moveFile(absCurrentPath, absNewPath);
      if (!res.success) throw new Error(res.error || 'Move failed');

      const mapKey = isRelative ? currentFilePath
        : ([...audios.keys()].find(k => {
            const v = audios.get(k)!;
            return (v.projectFilePath || v.filePath) === currentFilePath;
          }) ?? currentFilePath);

      setAudios(prev => {
        const next = new Map(prev);
        const existing = next.get(mapKey);
        next.delete(mapKey);
        if (existing) next.set(newRelPath, { ...existing, filePath: newRelPath, projectFilePath: undefined });
        return next;
      });
      setAudioMetadata(prev => {
        const next = new Map(prev);
        next.delete(currentFilePath);
        next.set(newRelPath, newMeta);
        return next;
      });
      const oldTabId = `aud-${mapKey}`;
      const newTabId = `aud-${newRelPath}`;
      setOpenTabs(prev => prev.map(t => t.id === oldTabId ? { ...t, id: newTabId, filePath: newRelPath } : t));
      setSecondaryOpenTabs(prev => prev.map(t => t.id === oldTabId ? { ...t, id: newTabId, filePath: newRelPath } : t));
      setActiveTabId(prev => prev === oldTabId ? newTabId : prev);
      setSecondaryActiveTabId(prev => prev === oldTabId ? newTabId : prev);
    } else {
      setAudioMetadata(prev => { const next = new Map(prev); next.set(currentFilePath, newMeta); return next; });
    }

    setHasUnsavedSettings(true);
    const freshTree = await window.electronAPI.refreshProjectTree(projectRootPath);
    setFileSystemTree(freshTree);
  }, [projectRootPath, audios, setActiveTabId, setAudioMetadata, setAudios, setFileSystemTree, setOpenTabs, setSecondaryActiveTabId, setSecondaryOpenTabs, setHasUnsavedSettings]);

  const handleCopyAudioToProject = useCallback(async (sourcePath: string, meta: AudioMetadata) => {
    try {
      if (window.electronAPI && projectRootPath) {
        const fileName = sourcePath.split('/').pop() || 'audio.ogg';
        const subfolder = meta.projectSubfolder || '';
        const destDir = await window.electronAPI.path.join(projectRootPath, 'game', 'audio', subfolder);
        const destPath = await window.electronAPI.path.join(destDir, fileName);
        await window.electronAPI.copyEntry(sourcePath, destPath);
        setAudios(prev => {
          const next = new Map(prev);
          const existing = next.get(sourcePath);
          if (existing) {
            next.set(sourcePath, { ...existing, isInProject: true, projectFilePath: destPath });
          }
          return next;
        });
        addToast('Audio copied to project', 'success');
        const freshTree = await window.electronAPI.refreshProjectTree(projectRootPath);
        setFileSystemTree(freshTree);
      }
    } catch (err) {
      logger.error('Failed to copy audio to project:', err);
      addToast('Failed to copy audio to project', 'error');
    }
  }, [projectRootPath, addToast, setFileSystemTree, setAudios]);

  /**
   * Requests cancellation of the in-flight asset scan (fire-and-forget IPC).
   * The scanner is cooperative — it stops at its next check and the awaiting
   * handleAdd*ScanDirectory call resolves with `cancelled: true`.
   */
  const cancelAssetScan = useCallback(() => {
    window.electronAPI?.cancelScanDirectory?.();
  }, []);

  return {
    // Image state
    images,
    imageMetadata,
    imageScanDirectories,
    imagesLastScanned,
    isRefreshingImages,
    setImages,
    setImageMetadata,
    setImageScanDirectories,
    setImagesLastScanned,
    setIsRefreshingImages,

    // Audio state
    audios,
    audioMetadata,
    audioScanDirectories,
    audiosLastScanned,
    isRefreshingAudios,
    setAudios,
    setAudioMetadata,
    setAudioScanDirectories,
    setAudiosLastScanned,
    setIsRefreshingAudios,

    // High-level operations
    addImage,
    removeImage,
    updateImageMetadata,
    addAudio,
    removeAudio,
    updateAudioMetadata,
    clearImages,
    clearAudios,

    // Scan-directory operations
    handleAddImageScanDirectory,
    handleRefreshImages,
    handleRemoveImageScanDirectory,
    handleCopyImagesToProjectBulk,
    handleAddAudioScanDirectory,
    handleRefreshAudios,
    handleRemoveAudioScanDirectory,
    handleCopyAudiosToProjectBulk,
    cancelAssetScan,

    // Single-file metadata / copy operations
    handleSaveImageMetadata,
    handleCopyImageToProject,
    handleImportPortraitImage,
    handleSaveAudioMetadata,
    handleCopyAudioToProject,
  };
}
