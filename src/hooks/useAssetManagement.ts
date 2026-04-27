/**
 * @file useAssetManagement.ts
 * @description Custom hook for managing project assets (images and audios)
 *
 * Handles all asset-related state including image/audio collections, metadata,
 * external scan directories, refresh state, and timestamps. Provides operations
 * for scanning, copying, and managing assets.
 */

import { useState, useCallback } from 'react';
import type { ProjectImage, RenpyAudio, ImageMetadata, AudioMetadata } from '@/types';

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
export function useAssetManagement(): UseAssetManagementReturn {
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
  };
}
