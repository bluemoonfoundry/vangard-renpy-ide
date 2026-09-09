/**
 * @file hooks/useAssetManagement.test.ts
 * @description Tests for useAssetManagement — image/audio CRUD operations and state management.
 */

import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAssetManagement } from '@/hooks/useAssetManagement';
import type { UseAssetManagementParams } from '@/hooks/useAssetManagement';
import type { ProjectImage, RenpyAudio, ImageMetadata, AudioMetadata } from '@/types';
import { installElectronAPI, uninstallElectronAPI } from '@/test/mocks/electronAPI';

function makeParams(overrides: Partial<UseAssetManagementParams> = {}): UseAssetManagementParams {
  return {
    projectRootPath: '/project',
    perfRecorders: {
      recordScanStart: vi.fn(),
      recordScanEnd: vi.fn(),
    } as unknown as UseAssetManagementParams['perfRecorders'],
    setIsScanningAssets: vi.fn(),
    setHasUnsavedSettings: vi.fn(),
    setFileSystemTree: vi.fn(),
    addToast: vi.fn(),
    setOpenTabs: vi.fn(),
    setSecondaryOpenTabs: vi.fn(),
    setActiveTabId: vi.fn(),
    setSecondaryActiveTabId: vi.fn(),
    ...overrides,
  };
}

function makeImage(path = 'game/images/bg.png'): ProjectImage {
  return {
    filePath: path,
    fileName: path.split('/').pop() ?? path,
    isInProject: true,
    fileHandle: null,
  };
}

function makeAudio(path = 'game/audio/bgm.ogg'): RenpyAudio {
  return {
    filePath: path,
    fileName: path.split('/').pop() ?? path,
    dataUrl: '',
    isInProject: true,
    fileHandle: null,
  };
}

// ============================================================================
// Initial state
// ============================================================================

describe('useAssetManagement — initial state', () => {
  it('starts with empty images and audios Maps', () => {
    const { result } = renderHook(() => useAssetManagement(makeParams()));
    expect(result.current.images.size).toBe(0);
    expect(result.current.audios.size).toBe(0);
  });

  it('starts with empty metadata Maps', () => {
    const { result } = renderHook(() => useAssetManagement(makeParams()));
    expect(result.current.imageMetadata.size).toBe(0);
    expect(result.current.audioMetadata.size).toBe(0);
  });

  it('starts with null timestamps', () => {
    const { result } = renderHook(() => useAssetManagement(makeParams()));
    expect(result.current.imagesLastScanned).toBeNull();
    expect(result.current.audiosLastScanned).toBeNull();
  });

  it('starts with refreshing flags as false', () => {
    const { result } = renderHook(() => useAssetManagement(makeParams()));
    expect(result.current.isRefreshingImages).toBe(false);
    expect(result.current.isRefreshingAudios).toBe(false);
  });
});

// ============================================================================
// Image CRUD
// ============================================================================

describe('useAssetManagement — addImage', () => {
  it('adds an image to the collection', () => {
    const { result } = renderHook(() => useAssetManagement(makeParams()));
    const img = makeImage();
    act(() => result.current.addImage(img.filePath, img));
    expect(result.current.images.has(img.filePath)).toBe(true);
    expect(result.current.images.get(img.filePath)).toEqual(img);
  });

  it('overwrites an existing image at the same path', () => {
    const { result } = renderHook(() => useAssetManagement(makeParams()));
    const img1 = makeImage();
    const img2 = { ...makeImage(), size: 800 };
    act(() => result.current.addImage(img1.filePath, img1));
    act(() => result.current.addImage(img1.filePath, img2));
    expect(result.current.images.get(img1.filePath)?.size).toBe(800);
  });
});

describe('useAssetManagement — removeImage', () => {
  it('removes image from images and imageMetadata', () => {
    const { result } = renderHook(() => useAssetManagement(makeParams()));
    const img = makeImage();
    const meta: ImageMetadata = { tags: ['bg'], renpyName: 'Background' } as ImageMetadata;
    act(() => {
      result.current.addImage(img.filePath, img);
      result.current.updateImageMetadata(img.filePath, meta);
    });
    act(() => result.current.removeImage(img.filePath));
    expect(result.current.images.has(img.filePath)).toBe(false);
    expect(result.current.imageMetadata.has(img.filePath)).toBe(false);
  });

  it('is a no-op for unknown path', () => {
    const { result } = renderHook(() => useAssetManagement(makeParams()));
    act(() => result.current.removeImage('nonexistent.png'));
    expect(result.current.images.size).toBe(0);
  });
});

describe('useAssetManagement — updateImageMetadata', () => {
  it('stores metadata keyed by path', () => {
    const { result } = renderHook(() => useAssetManagement(makeParams()));
    const img = makeImage();
    const meta: ImageMetadata = { tags: ['background', 'day'], renpyName: 'Day BG' } as ImageMetadata;
    act(() => result.current.updateImageMetadata(img.filePath, meta));
    expect(result.current.imageMetadata.get(img.filePath)).toEqual(meta);
  });

  it('overwrites existing metadata', () => {
    const { result } = renderHook(() => useAssetManagement(makeParams()));
    const img = makeImage();
    const meta1: ImageMetadata = { tags: ['bg'], renpyName: 'Old' } as ImageMetadata;
    const meta2: ImageMetadata = { tags: ['background'], renpyName: 'New' } as ImageMetadata;
    act(() => result.current.updateImageMetadata(img.filePath, meta1));
    act(() => result.current.updateImageMetadata(img.filePath, meta2));
    expect(result.current.imageMetadata.get(img.filePath)?.renpyName).toBe('New');
  });
});

// ============================================================================
// Audio CRUD
// ============================================================================

describe('useAssetManagement — addAudio', () => {
  it('adds an audio to the collection', () => {
    const { result } = renderHook(() => useAssetManagement(makeParams()));
    const audio = makeAudio();
    act(() => result.current.addAudio(audio.filePath, audio));
    expect(result.current.audios.has(audio.filePath)).toBe(true);
  });

  it('overwrites an existing audio at the same path', () => {
    const { result } = renderHook(() => useAssetManagement(makeParams()));
    const audio1 = makeAudio();
    const audio2 = { ...makeAudio(), isInProject: false };
    act(() => result.current.addAudio(audio1.filePath, audio1));
    act(() => result.current.addAudio(audio1.filePath, audio2));
    expect(result.current.audios.get(audio1.filePath)?.isInProject).toBe(false);
  });
});

describe('useAssetManagement — removeAudio', () => {
  it('removes audio from audios and audioMetadata', () => {
    const { result } = renderHook(() => useAssetManagement(makeParams()));
    const audio = makeAudio();
    const meta: AudioMetadata = { renpyName: 'BGM', tags: [] } as AudioMetadata;
    act(() => {
      result.current.addAudio(audio.filePath, audio);
      result.current.updateAudioMetadata(audio.filePath, meta);
    });
    act(() => result.current.removeAudio(audio.filePath));
    expect(result.current.audios.has(audio.filePath)).toBe(false);
    expect(result.current.audioMetadata.has(audio.filePath)).toBe(false);
  });
});

describe('useAssetManagement — updateAudioMetadata', () => {
  it('stores audio metadata keyed by path', () => {
    const { result } = renderHook(() => useAssetManagement(makeParams()));
    const audio = makeAudio();
    const meta: AudioMetadata = { renpyName: 'Main Theme', tags: ['bgm'] } as AudioMetadata;
    act(() => result.current.updateAudioMetadata(audio.filePath, meta));
    expect(result.current.audioMetadata.get(audio.filePath)).toEqual(meta);
  });
});

// ============================================================================
// clearImages / clearAudios
// ============================================================================

describe('useAssetManagement — clearImages', () => {
  it('clears images, imageMetadata, scanDirectories, and timestamp', () => {
    const { result } = renderHook(() => useAssetManagement(makeParams()));
    const img = makeImage();
    act(() => {
      result.current.addImage(img.filePath, img);
      result.current.updateImageMetadata(img.filePath, { tags: [], renpyName: 'x' } as ImageMetadata);
      result.current.setImagesLastScanned(Date.now());
    });
    act(() => result.current.clearImages());
    expect(result.current.images.size).toBe(0);
    expect(result.current.imageMetadata.size).toBe(0);
    expect(result.current.imagesLastScanned).toBeNull();
  });
});

describe('useAssetManagement — clearAudios', () => {
  it('clears audios, audioMetadata, scanDirectories, and timestamp', () => {
    const { result } = renderHook(() => useAssetManagement(makeParams()));
    const audio = makeAudio();
    act(() => {
      result.current.addAudio(audio.filePath, audio);
      result.current.updateAudioMetadata(audio.filePath, { tags: [], renpyName: 'y' } as AudioMetadata);
      result.current.setAudiosLastScanned(Date.now());
    });
    act(() => result.current.clearAudios());
    expect(result.current.audios.size).toBe(0);
    expect(result.current.audioMetadata.size).toBe(0);
    expect(result.current.audiosLastScanned).toBeNull();
  });
});

// ============================================================================
// Scan cancellation
// ============================================================================

describe('useAssetManagement — scan cancellation', () => {
  beforeEach(() => {
    installElectronAPI();
  });

  afterAll(() => {
    uninstallElectronAPI();
  });

  it('toasts a distinct cancelled message when an image scan is cancelled', async () => {
    const api = window.electronAPI!;
    (api.openDirectory as ReturnType<typeof vi.fn>).mockResolvedValue('/scan/dir');
    (api.scanDirectory as ReturnType<typeof vi.fn>).mockResolvedValue({
      images: [], audios: [], truncated: false, cancelled: true, errors: [],
    });
    const params = makeParams();
    const { result } = renderHook(() => useAssetManagement(params));

    await act(async () => {
      await result.current.handleAddImageScanDirectory();
    });

    expect(params.addToast).toHaveBeenCalledWith(
      expect.stringContaining('Scan cancelled'),
      'warning',
    );
  });

  it('toasts a distinct cancelled message when an audio scan is cancelled', async () => {
    const api = window.electronAPI!;
    (api.openDirectory as ReturnType<typeof vi.fn>).mockResolvedValue('/scan/dir');
    (api.scanDirectory as ReturnType<typeof vi.fn>).mockResolvedValue({
      images: [], audios: [], truncated: false, cancelled: true, errors: [],
    });
    const params = makeParams();
    const { result } = renderHook(() => useAssetManagement(params));

    await act(async () => {
      await result.current.handleAddAudioScanDirectory();
    });

    expect(params.addToast).toHaveBeenCalledWith(
      expect.stringContaining('Scan cancelled'),
      'warning',
    );
  });

  it('cancelAssetScan calls electronAPI.cancelScanDirectory', () => {
    const { result } = renderHook(() => useAssetManagement(makeParams()));
    act(() => result.current.cancelAssetScan());
    expect(window.electronAPI!.cancelScanDirectory).toHaveBeenCalledTimes(1);
  });
});

// ============================================================================
// State setters exposed from the hook
// ============================================================================

describe('useAssetManagement — setImages / setAudios direct setters', () => {
  it('setImages replaces the images map', () => {
    const { result } = renderHook(() => useAssetManagement(makeParams()));
    const img = makeImage('game/images/test.png');
    const newMap = new Map([[img.filePath, img]]);
    act(() => result.current.setImages(newMap));
    expect(result.current.images.size).toBe(1);
    expect(result.current.images.has(img.filePath)).toBe(true);
  });

  it('setAudios replaces the audios map', () => {
    const { result } = renderHook(() => useAssetManagement(makeParams()));
    const audio = makeAudio('game/audio/sfx.ogg');
    const newMap = new Map([[audio.filePath, audio]]);
    act(() => result.current.setAudios(newMap));
    expect(result.current.audios.size).toBe(1);
  });
});

// ============================================================================
// handleImportPortraitImage
// ============================================================================

describe('useAssetManagement — handleImportPortraitImage', () => {
  beforeEach(() => {
    installElectronAPI();
  });

  afterAll(() => {
    uninstallElectronAPI();
  });

  it('imports the source file via the dedicated main-process handler and registers a new ProjectImage', async () => {
    const api = window.electronAPI!;
    (api.importPortraitImage as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      relPath: 'game/images/portraits/eileen.png',
      absPath: '/project/game/images/portraits/eileen.png',
      mediaUrl: 'media:///project/game/images/portraits/eileen.png',
    });
    (api.refreshProjectTree as ReturnType<typeof vi.fn>).mockResolvedValue({ name: 'game', path: '/project/game', children: [] });

    const { result } = renderHook(() => useAssetManagement(makeParams()));

    let imported: ProjectImage | null = null;
    await act(async () => {
      imported = await result.current.handleImportPortraitImage('/external/eileen.png');
    });

    expect(api.importPortraitImage).toHaveBeenCalledWith('/external/eileen.png');
    expect(imported).toEqual({
      filePath: 'game/images/portraits/eileen.png',
      fileName: 'eileen.png',
      dataUrl: 'media:///project/game/images/portraits/eileen.png',
      fileHandle: null,
      isInProject: true,
      projectFilePath: '/project/game/images/portraits/eileen.png',
    });
    expect(result.current.images.get('game/images/portraits/eileen.png')).toEqual(imported);
  });

  it('returns null and toasts an error when the import fails', async () => {
    const api = window.electronAPI!;
    (api.importPortraitImage as ReturnType<typeof vi.fn>).mockResolvedValue({ success: false, error: 'disk full' });

    const params = makeParams();
    const { result } = renderHook(() => useAssetManagement(params));

    let imported: ProjectImage | null = null;
    await act(async () => {
      imported = await result.current.handleImportPortraitImage('/external/eileen.png');
    });

    expect(imported).toBeNull();
    expect(params.addToast).toHaveBeenCalledWith('Failed to import portrait image', 'error');
  });

  it('returns null when there is no project root', async () => {
    installElectronAPI();
    const { result } = renderHook(() => useAssetManagement(makeParams({ projectRootPath: null })));

    let imported: ProjectImage | null = null;
    await act(async () => {
      imported = await result.current.handleImportPortraitImage('/external/eileen.png');
    });

    expect(imported).toBeNull();
  });
});
