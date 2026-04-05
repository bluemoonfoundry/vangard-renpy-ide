/**
 * @file useAssetManager.ts
 * @description Manages image and audio assets for Ren'Py projects.
 * Handles scanning directories for assets, copying to project, managing metadata,
 * and persisting IDE settings. Coordinates with file system to organize asset files.
 * Supports external scan directories and internal project asset storage.
 */

import { useState, useCallback, useEffect } from 'react';
import type { ProjectImage, ImageMetadata, RenpyAudio, AudioMetadata, FileSystemTreeNode } from '../types';
import { useToasts } from '../contexts/ToastContext';

interface AssetManagerProps {
    directoryHandle: FileSystemDirectoryHandle | null;
    onPathsUpdated: (updates: Map<string, { newPath: string; type: 'file' | 'folder' }>) => void;
    onFileTreeUpdate: (updater: (tree: FileSystemTreeNode) => FileSystemTreeNode) => void;
}

/**
 * @deprecated Legacy placeholder hook retained for reference only.
 * Asset management is currently implemented in App.tsx; avoid new usages here.
 */
export const useAssetManager = ({ directoryHandle, onPathsUpdated: _onPathsUpdated, onFileTreeUpdate: _onFileTreeUpdate }: AssetManagerProps) => {
    const [projectImages, setProjectImages] = useState<Map<string, ProjectImage>>(new Map());
    const [imageMetadata, setImageMetadata] = useState<Map<string, ImageMetadata>>(new Map());
    const [imageScanDirectories, _setImageScanDirectories] = useState<Map<string, FileSystemDirectoryHandle>>(new Map());
    const [projectAudios, setProjectAudios] = useState<Map<string, RenpyAudio>>(new Map());
    const [audioMetadata, setAudioMetadata] = useState<Map<string, AudioMetadata>>(new Map());
    const [audioScanDirectories, _setAudioScanDirectories] = useState<Map<string, FileSystemDirectoryHandle>>(new Map());
    const { addToast: _addToast } = useToasts();

    const _scanDirectoryForImages = useCallback(async (_dirHandle: FileSystemDirectoryHandle, _baseName: string, _isProjectScan: boolean) => {
        // ... (scanDirectoryForImages logic)
    }, []);

    const _scanDirectoryForAudios = useCallback(async (_dirHandle: FileSystemDirectoryHandle, _baseName: string, _isProjectScan: boolean) => {
        // ... (scanDirectoryForAudios logic)
    }, []);

    const loadProjectAssets = useCallback(async (_rootHandle: FileSystemDirectoryHandle) => {
        // ... (loadProjectImages and loadProjectAudios logic combined)
    }, []);

    const loadIdeSettings = useCallback(async (_rootHandle: FileSystemDirectoryHandle) => {
        // ... (loadIdeSettings logic)
    }, []);

    const handleSaveIdeSettings = useCallback(async () => {
        // ... (handleSaveIdeSettings logic)
    }, []);

    useEffect(() => {
        if (directoryHandle) {
            handleSaveIdeSettings();
        }
    }, [imageMetadata, audioMetadata, imageScanDirectories, audioScanDirectories, directoryHandle, handleSaveIdeSettings]);

    const handleAddImageScanDirectory = useCallback(async () => {
        // ... (handleAddImageScanDirectory logic)
    }, []);

    const handleCopyImagesToProject = useCallback(async (_sourceFilePaths: string[], _metadataOverride?: ImageMetadata) => {
        // ... (handleCopyImagesToProject logic)
    }, []);
    
    const handleUpdateImageMetadata = useCallback(async (_projectFilePath: string, _newMetadata: ImageMetadata) => {
        // ... (handleUpdateImageMetadata logic)
    }, []);

    const handleAddAudioScanDirectory = useCallback(async () => {
        // ... (handleAddAudioScanDirectory logic)
    }, []);

    const handleCopyAudiosToProject = useCallback(async (_sourceFilePaths: string[], _metadataOverride?: AudioMetadata) => {
        // ... (handleCopyAudiosToProject logic)
    }, []);

    const handleUpdateAudioMetadata = useCallback(async (_projectFilePath: string, _newMetadata: AudioMetadata) => {
        // ... (handleUpdateAudioMetadata logic)
    }, []);
    
    // Public method to be called when project is loaded from folder or zip
    const setAllAssets = useCallback((data: { images: Map<string, ProjectImage>, audios: Map<string, RenpyAudio>, imageMeta: Map<string, ImageMetadata>, audioMeta: Map<string, AudioMetadata> }) => {
        setProjectImages(data.images);
        setProjectAudios(data.audios);
        setImageMetadata(data.imageMeta);
        setAudioMetadata(data.audioMeta);
    }, []);

    return {
        projectImages, imageMetadata, imageScanDirectories,
        projectAudios, audioMetadata, audioScanDirectories,
        loadProjectAssets, loadIdeSettings, setAllAssets,
        handleAddImageScanDirectory, handleCopyImagesToProject, handleUpdateImageMetadata,
        handleAddAudioScanDirectory, handleCopyAudiosToProject, handleUpdateAudioMetadata,
    };
};
