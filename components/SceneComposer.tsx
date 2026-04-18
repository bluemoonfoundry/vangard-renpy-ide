/**
 * @file SceneComposer.tsx
 * @description Visual drag-and-drop scene layout tool (~600 lines).
 * Key features: positions background and sprite images on a scaled canvas preview, supports
 * per-sprite x/y/scale editing, generates // Ren'Py code, exports as PNG.
 * Integration: opened as a tab in ; reads images from  props; generates
 * code via ; updates composition state via .
 */
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import type { ProjectImage, ImageMetadata, SceneComposition, SceneSprite } from '../types';
import CopyButton from './CopyButton';
import SceneSpriteProperties from './SceneSpriteProperties';

// Returns the hue-rotate degrees needed to tint an image from sepia baseline (~38°) to the target hex color
function hexToHueDeg(hex: string): number {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    if (d === 0) return 0;
    let h = 0;
    if (max === r) h = ((g - b) / d + 6) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    const targetHue = Math.round(h * 60);
    return (targetHue - 38 + 360) % 360;
}

// Builds a CSS filter string approximating Ren'Py matrixcolor/shader effects for live preview
function spriteVisualFilter(sprite: SceneSprite): string {
    const parts: string[] = [];
    const colorMode = sprite.colorMode ?? 'none';
    const saturation = sprite.saturation ?? 1.0;
    const brightness = sprite.brightness ?? 0;
    const contrast = sprite.contrast ?? 1.0;
    const invert = sprite.invert ?? 0;
    const activeShader = sprite.activeShader ?? '';
    const uniforms = sprite.shaderUniforms ?? {};

    // renpy.blur uses log2 scale; convert to CSS px via 2^n. Fall back to the legacy blur field.
    const blurPx = activeShader === 'renpy.blur'
        ? Math.pow(2, uniforms['u_renpy_blur_log2'] ?? 1)
        : (sprite.blur ?? 0);
    if (blurPx > 0) parts.push(`blur(${blurPx.toFixed(1)}px)`);

    if (colorMode === 'tint' && sprite.tintColor) {
        const hue = hexToHueDeg(sprite.tintColor);
        parts.push('sepia(1)', `hue-rotate(${hue}deg)`, `saturate(${(saturation * 3).toFixed(2)})`);
    } else if (colorMode === 'colorize' && sprite.colorizeWhite) {
        const hue = hexToHueDeg(sprite.colorizeWhite);
        parts.push('sepia(1)', `hue-rotate(${hue}deg)`, `saturate(${(saturation * 2).toFixed(2)})`);
    } else if (saturation !== 1.0) {
        parts.push(`saturate(${saturation})`);
    }

    if (brightness !== 0) parts.push(`brightness(${(1 + brightness).toFixed(2)})`);
    if (contrast !== 1.0) parts.push(`contrast(${contrast.toFixed(2)})`);
    if (invert !== 0) parts.push(`invert(${invert.toFixed(2)})`);

    return parts.length > 0 ? parts.join(' ') : 'none';
}

// Builds the matrixcolor + shader lines for the Ren'Py ATL code generator
function spriteEffectCode(sprite: SceneSprite, indent = '    '): string {
    let code = '';
    const colorMode = sprite.colorMode ?? 'none';
    const saturation = sprite.saturation ?? 1.0;
    const brightness = sprite.brightness ?? 0;
    const contrast = sprite.contrast ?? 1.0;
    const invert = sprite.invert ?? 0;
    const activeShader = sprite.activeShader ?? '';
    const uniforms = sprite.shaderUniforms ?? {};

    const matrixParts: string[] = [];
    if (colorMode === 'tint' && sprite.tintColor) {
        matrixParts.push(`TintMatrix("${sprite.tintColor}")`);
    } else if (colorMode === 'colorize') {
        matrixParts.push(`ColorizeMatrix("${sprite.colorizeBlack ?? '#000000'}", "${sprite.colorizeWhite ?? '#ffffff'}")`);
    }
    if (saturation !== 1.0) matrixParts.push(`SaturationMatrix(${saturation.toFixed(2)})`);
    if (brightness !== 0) matrixParts.push(`BrightnessMatrix(${brightness.toFixed(2)})`);
    if (contrast !== 1.0) matrixParts.push(`ContrastMatrix(${contrast.toFixed(2)})`);
    if (invert !== 0) matrixParts.push(`InvertMatrix(${invert.toFixed(2)})`);
    if (matrixParts.length > 0) code += `${indent}matrixcolor ${matrixParts.join(' * ')}\n`;

    if (activeShader) {
        code += `${indent}shader "${activeShader}"\n`;
        Object.entries(uniforms).forEach(([k, v]) => {
            code += `${indent}${k} ${v}\n`;
        });
    }

    return code;
}

interface SpritePreviewImageProps {
    sprite: SceneSprite;
    isBackground: boolean;
}

const SpritePreviewImage: React.FC<SpritePreviewImageProps> = ({ sprite, isBackground }) => {
    const [naturalSize, setNaturalSize] = React.useState<{ w: number; h: number } | null>(null);

    const isPixelize = sprite.activeShader === 'renpy.pixelize';
    const uniforms = sprite.shaderUniforms ?? {};
    const uAmount = uniforms['u_amount'] ?? 0.01;

    const baseTransform = `rotate(${sprite.rotation}deg) scale(${sprite.zoom || 1}) scaleX(${sprite.flipH ? -1 : 1}) scaleY(${sprite.flipV ? -1 : 1})`;

    if (isPixelize && naturalSize) {
        // Downscale to (blockSize x blockSize) resolution, then CSS-scale back up with pixelated rendering.
        // u_amount maps 0.001–0.1 → blockSize 1–20 so the effect is visible at typical slider values.
        const blockSize = Math.max(1, Math.round(uAmount * 200));
        const downW = Math.max(1, Math.round(naturalSize.w / blockSize));
        const downH = Math.max(1, Math.round(naturalSize.h / blockSize));
        const upScale = naturalSize.w / downW;

        return (
            <div
                style={{
                    width: naturalSize.w,
                    height: naturalSize.h,
                    overflow: 'hidden',
                    transform: baseTransform,
                    transformOrigin: 'center center',
                    opacity: sprite.alpha ?? 1,
                    flexShrink: 0,
                }}
                className="pointer-events-none block select-none"
            >
                <img
                    src={sprite.image.dataUrl}
                    width={downW}
                    height={downH}
                    style={{
                        imageRendering: 'pixelated',
                        transform: `scale(${upScale})`,
                        transformOrigin: 'top left',
                        display: 'block',
                    }}
                    className="pointer-events-none select-none"
                />
            </div>
        );
    }

    return (
        <img
            src={sprite.image.dataUrl}
            onLoad={e => {
                const img = e.currentTarget;
                setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
            }}
            style={{
                height: isBackground ? '100%' : 'auto',
                width: isBackground ? '100%' : 'auto',
                objectFit: isBackground ? 'fill' : undefined,
                maxWidth: 'none',
                maxHeight: 'none',
                transform: baseTransform,
                transformOrigin: 'center center',
                opacity: sprite.alpha ?? 1,
                filter: spriteVisualFilter(sprite),
            }}
            className="pointer-events-none block select-none"
        />
    );
};

const PRESET_RESOLUTIONS = [
    { label: '1920×1080 (16:9)', width: 1920, height: 1080 },
    { label: '1280×720 (16:9)',  width: 1280, height: 720  },
    { label: '1024×768 (4:3)',   width: 1024, height: 768  },
    { label: '800×600 (4:3)',    width: 800,  height: 600  },
];

interface SceneComposerProps {
    images: ProjectImage[];
    metadata: Map<string, ImageMetadata>;
    scene: SceneComposition;
    onSceneChange: (newScene: React.SetStateAction<SceneComposition>) => void;
    sceneName: string;
    onRenameScene: (newName: string) => void;
    addToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

const SceneComposer: React.FC<SceneComposerProps> = ({ images, metadata, scene, onSceneChange, sceneName, onRenameScene, addToast }) => {
    const [selectedSpriteId, setSelectedSpriteId] = useState<string | null>(null);
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [isRenaming, setIsRenaming] = useState(false);
    const [editName, setEditName] = useState(sceneName);
    const [isExporting, setIsExporting] = useState(false);

    // Undo / Redo
    const [undoStack, setUndoStack] = useState<SceneComposition[]>([]);
    const [redoStack, setRedoStack] = useState<SceneComposition[]>([]);
    const saveUndo = useCallback(() => {
        setUndoStack(prev => [...prev.slice(-49), scene]);
        setRedoStack([]);
    }, [scene]);

    const handleUndo = useCallback(() => {
        if (undoStack.length === 0) return;
        const prev = undoStack[undoStack.length - 1];
        setRedoStack(r => [scene, ...r.slice(0, 49)]);
        setUndoStack(u => u.slice(0, -1));
        onSceneChange(prev);
    }, [undoStack, scene, onSceneChange]);

    const handleRedo = useCallback(() => {
        if (redoStack.length === 0) return;
        const next = redoStack[0];
        setUndoStack(u => [...u.slice(-49), scene]);
        setRedoStack(r => r.slice(1));
        onSceneChange(next);
    }, [redoStack, scene, onSceneChange]);

    // Layer List Drag State
    const [dragOverInfo, setDragOverInfo] = useState<{ id: string, position: 'top' | 'bottom' } | null>(null);
    
    const stageRef = useRef<HTMLDivElement>(null);
    const viewportRef = useRef<HTMLDivElement>(null);
    const nameInputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Reference resolution — derived from scene, defaults to 1920×1080
    const REF_WIDTH = scene.resolution?.width ?? 1920;
    const REF_HEIGHT = scene.resolution?.height ?? 1080;
    const isCustomResolution = !PRESET_RESOLUTIONS.some(p => p.width === REF_WIDTH && p.height === REF_HEIGHT);

    const [showCustomInputs, setShowCustomInputs] = useState(() => isCustomResolution);
    const [customW, setCustomW] = useState(String(REF_WIDTH));
    const [customH, setCustomH] = useState(String(REF_HEIGHT));

    // Keep custom inputs in sync when scene resolution changes externally (e.g. project load)
    useEffect(() => {
        setCustomW(String(REF_WIDTH));
        setCustomH(String(REF_HEIGHT));
    }, [REF_WIDTH, REF_HEIGHT]);

    const [viewportSize, setViewportSize] = useState({ w: 0, h: 0 });

    useEffect(() => {
        if (!viewportRef.current) return;
        const obs = new ResizeObserver(entries => {
            if(entries[0]) {
                setViewportSize({ w: entries[0].contentRect.width, h: entries[0].contentRect.height });
            }
        });
        obs.observe(viewportRef.current);
        return () => obs.disconnect();
    }, []);

    // Calculate scale to fit the 1920x1080 stage into the available viewport with some padding
    const stageScale = Math.min(viewportSize.w / REF_WIDTH, viewportSize.h / REF_HEIGHT) * 0.95 || 0.1;

    useEffect(() => {
        setEditName(sceneName);
    }, [sceneName]);

    useEffect(() => {
        if (isRenaming && nameInputRef.current) {
            nameInputRef.current.focus();
            nameInputRef.current.select();
        }
    }, [isRenaming]);

    // Helpers to get display names
    const getRenpyTag = useCallback((image: ProjectImage) => {
        const meta = metadata.get(image.projectFilePath || image.filePath);
        const name = meta?.renpyName || image.fileName.split('.').slice(0, -1).join('.');
        const tags = (meta?.tags || []).join(' ');
        return `${name}${tags ? ` ${tags}` : ''}`.trim().replace(/\s+/g, ' ');
    }, [metadata]);

    const handleDropOnStage = (e: React.DragEvent) => {
        e.preventDefault();
        const data = e.dataTransfer.getData('application/renpy-image-path');
        if (!data) return;

        const image = images.find(img => img.filePath === data);
        if (!image) return;

        const tag = getRenpyTag(image);
        const lowerPath = image.filePath.toLowerCase();
        
        // Auto-detect background based on filename, path, or existing metadata
        const isBg = tag.startsWith('bg ') || 
                     tag.startsWith('scene ') || 
                     image.fileName.toLowerCase().startsWith('bg_') ||
                     lowerPath.includes('/bg/') ||
                     lowerPath.includes('\\bg\\') ||
                     lowerPath.includes('/backgrounds/') ||
                     lowerPath.includes('\\backgrounds\\');

        if (isBg) {
            const newBg: SceneSprite = {
                id: 'background',
                image,
                x: 0.5, y: 0.5, zoom: 1.0, zIndex: 0,
                flipH: false, flipV: false, rotation: 0, alpha: 1.0, blur: 0,
                visible: true
            };
            saveUndo();
            onSceneChange(prev => ({ ...prev, background: newBg }));
            setSelectedSpriteId('background');
        } else {
            // Calculate drop position relative to stage (0.0 to 1.0)
            if (stageRef.current) {
                const rect = stageRef.current.getBoundingClientRect();
                const x = (e.clientX - rect.left) / rect.width;
                const y = (e.clientY - rect.top) / rect.height;
                
                // Add to end of array (top of stack)
                const newSprite: SceneSprite = {
                    id: `sprite-${Date.now()}`,
                    image,
                    x: Math.max(0, Math.min(1, x)),
                    y: Math.max(0, Math.min(1, y)),
                    zoom: 1.0,
                    zIndex: scene.sprites.length + 1,
                    flipH: false,
                    flipV: false,
                    rotation: 0,
                    alpha: 1.0,
                    blur: 0,
                    visible: true
                };
                saveUndo();
                onSceneChange(prev => ({ ...prev, sprites: [...prev.sprites, newSprite] }));
                setSelectedSpriteId(newSprite.id);
            }
        }
    };

    const handleStageDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    };

    // Sprite Manipulation
    const updateSprite = useCallback((id: string, updates: Partial<SceneSprite>) => {
        // Skip undo snapshot during pointer drag — handlePointerDown already captured it
        if (!draggingId) saveUndo();
        if (id === 'background') {
            onSceneChange(prev => prev.background ? ({ ...prev, background: { ...prev.background, ...updates } }) : prev);
        } else {
            onSceneChange(prev => ({
                ...prev,
                sprites: prev.sprites.map(s => s.id === id ? { ...s, ...updates } : s)
            }));
        }
    }, [draggingId, saveUndo, onSceneChange]);

    const toggleVisibility = (id: string) => {
        if (id === 'background') {
            if (scene.background) updateSprite('background', { visible: !(scene.background.visible ?? true) });
        } else {
            const sprite = scene.sprites.find(s => s.id === id);
            if (sprite) updateSprite(id, { visible: !(sprite.visible ?? true) });
        }
    };

    const toggleLock = (id: string) => {
        if (id === 'background') {
            if (scene.background) updateSprite('background', { locked: !(scene.background.locked ?? false) });
        } else {
            const sprite = scene.sprites.find(s => s.id === id);
            if (sprite) updateSprite(id, { locked: !(sprite.locked ?? false) });
        }
    };

    const removeSprite = useCallback((id: string) => {
        saveUndo();
        if (id === 'background') {
            onSceneChange(prev => ({ ...prev, background: null }));
        } else {
            onSceneChange(prev => {
                const newSprites = prev.sprites.filter(s => s.id !== id);
                // Re-normalize Z-indices
                newSprites.forEach((s, i) => s.zIndex = i + 1);
                return { ...prev, sprites: newSprites };
            });
        }
        if (selectedSpriteId === id) setSelectedSpriteId(null);
    }, [onSceneChange, selectedSpriteId, saveUndo]);

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if typing in an input
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            const mod = e.ctrlKey || e.metaKey;

            // Undo / Redo (handled regardless of selection)
            if (mod && e.key === 'z' && !e.shiftKey) { e.preventDefault(); handleUndo(); return; }
            if (mod && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); handleRedo(); return; }

            if (!selectedSpriteId) return;

            if (e.key === 'Escape') {
                setSelectedSpriteId(null);
                return;
            }

            if (selectedSpriteId !== 'background') {
                if (e.key === 'Delete' || e.key === 'Backspace') {
                    removeSprite(selectedSpriteId);
                    return;
                }

                // Nudging
                const step = e.shiftKey ? 0.05 : 0.01;
                let dx = 0;
                let dy = 0;

                if (e.key === 'ArrowLeft') dx = -step;
                if (e.key === 'ArrowRight') dx = step;
                if (e.key === 'ArrowUp') dy = -step;
                if (e.key === 'ArrowDown') dy = step;

                if (dx !== 0 || dy !== 0) {
                    e.preventDefault();
                    saveUndo();
                    onSceneChange(prev => ({
                        ...prev,
                        sprites: prev.sprites.map(s => {
                            if (s.id === selectedSpriteId && !s.locked) {
                                return {
                                    ...s,
                                    x: Math.max(0, Math.min(1, s.x + dx)),
                                    y: Math.max(0, Math.min(1, s.y + dy))
                                };
                            }
                            return s;
                        })
                    }));
                }
            }
        };

        const container = containerRef.current;
        if (container) {
            container.addEventListener('keydown', handleKeyDown);
            container.tabIndex = 0;
        }
        return () => {
            if (container) container.removeEventListener('keydown', handleKeyDown);
        };
    }, [onSceneChange, removeSprite, selectedSpriteId, handleUndo, handleRedo, saveUndo]);

    const moveSpriteToGap = (fromIndex: number, gapIndex: number) => {
        saveUndo();
        onSceneChange(prev => {
            const newSprites = [...prev.sprites];
            const insertionIndex = fromIndex < gapIndex ? gapIndex - 1 : gapIndex;
            
            if (fromIndex === insertionIndex) return prev;

            const [moved] = newSprites.splice(fromIndex, 1);
            newSprites.splice(insertionIndex, 0, moved);
            
            newSprites.forEach((s, i) => s.zIndex = i + 1);
            return { ...prev, sprites: newSprites };
        });
    };

    const setSpriteAsBackground = (id: string) => {
        if (id === 'background') return;
        saveUndo();
        onSceneChange(prev => {
            const sprite = prev.sprites.find(s => s.id === id);
            if (!sprite) return prev;
            const newBg: SceneSprite = {
                ...sprite,
                id: 'background',
                x: 0.5, y: 0.5,
                zIndex: 0,
            };
            
            const newSprites = prev.sprites.filter(s => s.id !== id);
            newSprites.forEach((s, i) => s.zIndex = i + 1);

            return {
                ...prev,
                background: newBg,
                sprites: newSprites
            };
        });
        setSelectedSpriteId('background');
    };

    // Export Logic
    const handleExport = async () => {
        setIsExporting(true);
        try {
            // 1. Setup Canvas
            const canvas = document.createElement('canvas');
            canvas.width = REF_WIDTH;
            canvas.height = REF_HEIGHT;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error("Could not create canvas context");

            // 2. Load Images helper
            const loadImage = (src: string): Promise<HTMLImageElement> => {
                return new Promise((resolve, reject) => {
                    const img = new Image();
                    img.onload = () => resolve(img);
                    img.onerror = reject;
                    img.src = src;
                });
            };

            // 3. Draw Background
            if (scene.background && scene.background.visible !== false && scene.background.image.dataUrl) {
                const bgSprite = scene.background;
                const img = await loadImage(bgSprite.image.dataUrl);
                
                ctx.save();
                ctx.translate(REF_WIDTH / 2, REF_HEIGHT / 2);
                ctx.rotate(bgSprite.rotation * Math.PI / 180);
                ctx.scale((bgSprite.zoom || 1) * (bgSprite.flipH ? -1 : 1), (bgSprite.zoom || 1) * (bgSprite.flipV ? -1 : 1));
                ctx.globalAlpha = bgSprite.alpha ?? 1;
                ctx.filter = spriteVisualFilter(bgSprite);
                
                // Draw centered
                ctx.drawImage(img, -REF_WIDTH / 2, -REF_HEIGHT / 2, REF_WIDTH, REF_HEIGHT);
                ctx.restore();
            }

            // 4. Draw Sprites
            for (const sprite of scene.sprites) {
                if (sprite.visible !== false && sprite.image.dataUrl) {
                    const img = await loadImage(sprite.image.dataUrl);
                    
                    ctx.save();
                    ctx.translate(sprite.x * REF_WIDTH, sprite.y * REF_HEIGHT);
                    ctx.rotate(sprite.rotation * Math.PI / 180);
                    ctx.scale((sprite.zoom || 1) * (sprite.flipH ? -1 : 1), (sprite.zoom || 1) * (sprite.flipV ? -1 : 1));
                    ctx.globalAlpha = sprite.alpha ?? 1;
                    ctx.filter = spriteVisualFilter(sprite);
                    
                    // Draw centered at natural size
                    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
                    ctx.restore();
                }
            }

            // 5. Save
            if (window.electronAPI) {
                const filePath = await window.electronAPI.showSaveDialog({
                    title: 'Export Scene Composition',
                    defaultPath: `${sceneName}.png`,
                    filters: [
                        { name: 'PNG Image', extensions: ['png'] },
                        { name: 'JPEG Image', extensions: ['jpg', 'jpeg'] }
                    ]
                });

                if (filePath) {
                    const isJpeg = filePath.toLowerCase().endsWith('.jpg') || filePath.toLowerCase().endsWith('.jpeg');
                    const mimeType = isJpeg ? 'image/jpeg' : 'image/png';
                    const dataUrl = canvas.toDataURL(mimeType, 0.9);
                    const base64Data = dataUrl.split(',')[1];
                    
                    const res = await window.electronAPI.writeFile(filePath, base64Data, 'base64');
                    if (!res.success) {
                        addToast(`Failed to save image: ${res.error}`, 'error');
                    } else {
                        addToast('Scene exported successfully.', 'success');
                    }
                }
            } else {
                // Browser mode download
                const dataUrl = canvas.toDataURL('image/png');
                const link = document.createElement('a');
                link.download = `${sceneName}.png`;
                link.href = dataUrl;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                addToast('Scene exported successfully.', 'success');
            }

        } catch (error) {
            console.error("Export failed:", error);
            addToast('Failed to export image.', 'error');
        } finally {
            setIsExporting(false);
        }
    };

    // Canvas Interaction
    const handlePointerDown = (e: React.PointerEvent, id: string) => {
        e.stopPropagation();
        setSelectedSpriteId(id);
        if (id !== 'background') {
            const sprite = scene.sprites.find(s => s.id === id);
            if (!(sprite?.locked ?? false)) {
                saveUndo();
                setDraggingId(id);
                (e.target as HTMLElement).setPointerCapture(e.pointerId);
            }
        }
    };

    const handleStagePointerDown = () => {
        // Only deselect if we aren't clicking a sprite (handled by propagation stop above)
        // AND if we aren't dragging the stage itself (future feature?)
        if (!scene.background) {
            setSelectedSpriteId(null);
        }
        // If focusing background, do nothing special, let it bubble
        if (selectedSpriteId && selectedSpriteId !== 'background') {
            setSelectedSpriteId(null);
        }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (draggingId && draggingId !== 'background' && stageRef.current) {
            const rect = stageRef.current.getBoundingClientRect();
            const dx = e.movementX / rect.width;
            const dy = e.movementY / rect.height;
            
            onSceneChange(prev => ({
                ...prev,
                sprites: prev.sprites.map(s => {
                    if (s.id === draggingId) {
                        return {
                            ...s,
                            x: Math.max(0, Math.min(1, s.x + dx)),
                            y: Math.max(0, Math.min(1, s.y + dy))
                        };
                    }
                    return s;
                })
            }));
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        if (draggingId) {
            const target = e.target as HTMLElement;
            if(target.hasPointerCapture(e.pointerId)) {
                target.releasePointerCapture(e.pointerId);
            }
            setDraggingId(null);
        }
    };

    const handleWheel = (e: React.WheelEvent, id: string) => {
        e.stopPropagation();
        const delta = -e.deltaY * 0.001;
        updateSprite(id, { zoom: Number(Math.max(0.1, Math.min(3.0, (activeSprite?.zoom || 1.0) + delta)).toFixed(2)) });
    };

    const handleNameBlur = () => {
        if (editName.trim()) {
            onRenameScene(editName.trim());
        } else {
            setEditName(sceneName);
        }
        setIsRenaming(false);
    };

    const handleNameKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleNameBlur();
        if (e.key === 'Escape') {
            setEditName(sceneName);
            setIsRenaming(false);
        }
    };

    // Code Generation
    const generatedCode = useMemo(() => {
        let code = '';
        if (scene.background) {
            const bg = scene.background;
            const tag = getRenpyTag(bg.image);
            const transforms = [];
            if (bg.zoom !== 1) transforms.push(`zoom ${bg.zoom}`);
            if (bg.flipH) transforms.push(`xzoom -1.0`);
            if (bg.flipV) transforms.push(`yzoom -1.0`);
            if (bg.rotation !== 0) transforms.push(`rotate ${bg.rotation}`);
            if (bg.alpha !== 1.0) transforms.push(`alpha ${bg.alpha}`);
            if (bg.blur > 0) transforms.push(`blur ${bg.blur}`);

            const bgEffects = spriteEffectCode(bg);
            let bgCode: string;
            if (transforms.length > 0 || bgEffects) {
                bgCode = `scene ${tag}:\n    ${transforms.join('\n    ')}${transforms.length > 0 ? '\n' : ''}${bgEffects}`;
                if (!bgCode.endsWith('\n')) bgCode += '\n';
            } else {
                bgCode = `scene ${tag}\n`;
            }

            if (bg.visible === false) {
                bgCode = bgCode.split('\n').map(l => l.trim() ? `# ${l}` : l).join('\n');
            }
            code += bgCode;
        } else {
            code += `# No background selected\n`;
        }

        scene.sprites.forEach((sprite, index) => {
            const tag = getRenpyTag(sprite.image);
            const x = sprite.x.toFixed(2);
            const y = sprite.y.toFixed(2);
            
            const zoomStr = (sprite.zoom !== 1) ? ` zoom ${sprite.zoom}` : '';
            const xzoomStr = sprite.flipH ? ` xzoom -1.0` : '';
            const yzoomStr = sprite.flipV ? ` yzoom -1.0` : '';
            const rotateStr = sprite.rotation !== 0 ? ` rotate ${sprite.rotation}` : '';
            const alphaStr = sprite.alpha !== 1.0 ? ` alpha ${sprite.alpha}` : '';
            const blurStr = sprite.blur > 0 ? ` blur ${sprite.blur}` : '';
            
            const zStr = ` zorder ${index + 1}`;
            
            // Ren'Py xcenter/ycenter aligns with the visual editor's center point logic
            const effectCode = spriteEffectCode(sprite);
            let spriteCode = `show ${tag}${zStr}:\n    xcenter ${x} ycenter ${y}${zoomStr}${xzoomStr}${yzoomStr}${rotateStr}${alphaStr}${blurStr}\n${effectCode}`;
            
            if (sprite.visible === false) {
                spriteCode = spriteCode.split('\n').map(l => l.trim() ? `# ${l}` : l).join('\n');
            }
            code += spriteCode;
        });
        return code;
    }, [getRenpyTag, scene]);

    const activeSprite = useMemo(() => {
        if (selectedSpriteId === 'background') return scene.background;
        return scene.sprites.find(s => s.id === selectedSpriteId) || null;
    }, [scene, selectedSpriteId]);

    const layersReversed = useMemo(() => {
        return scene.sprites.map((s, index) => ({ sprite: s, originalIndex: index })).reverse();
    }, [scene.sprites]);


    const handleLayerListDragOver = (e: React.DragEvent, id: string, _originalIndex: number) => {
        e.preventDefault();
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const isTopHalf = e.clientY < midY;
        setDragOverInfo({ id, position: isTopHalf ? 'top' : 'bottom' });
    };

    const handleLayerListDrop = (e: React.DragEvent, targetOriginalIndex: number) => {
        e.preventDefault();
        setDragOverInfo(null);
        
        const fromIdxStr = e.dataTransfer.getData('application/renpy-layer-index');
        if (fromIdxStr) {
            const fromIdx = parseInt(fromIdxStr);
            if (!isNaN(fromIdx) && dragOverInfo) {
                const gapIndex = dragOverInfo.position === 'top' ? targetOriginalIndex + 1 : targetOriginalIndex;
                moveSpriteToGap(fromIdx, gapIndex);
            }
        }
    };

    const handleResolutionDropdownChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        if (val === 'custom') {
            setShowCustomInputs(true);
        } else {
            const [w, h] = val.split('x').map(Number);
            setShowCustomInputs(false);
            saveUndo();
            onSceneChange(prev => ({ ...prev, resolution: { width: w, height: h } }));
        }
    }, [onSceneChange, saveUndo]);

    const applyCustomResolution = useCallback(() => {
        const w = parseInt(customW);
        const h = parseInt(customH);
        if (w > 0 && h > 0) {
            saveUndo();
            onSceneChange(prev => ({ ...prev, resolution: { width: w, height: h } }));
        }
    }, [customW, customH, onSceneChange, saveUndo]);

    const resolutionDropdownValue = (showCustomInputs || isCustomResolution) ? 'custom' : `${REF_WIDTH}x${REF_HEIGHT}`;
    const showResolutionInputs = showCustomInputs || isCustomResolution;

    return (
        <div ref={containerRef} className="flex h-full bg-gray-100 dark:bg-gray-900 overflow-hidden flex-col outline-none">
            {/* Toolbar */}
            <div className="h-12 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center px-4 justify-between flex-shrink-0">
                <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Scene Name:</span>
                        {isRenaming ? (
                            <input
                                ref={nameInputRef}
                                type="text"
                                value={editName}
                                onChange={e => setEditName(e.target.value)}
                                onBlur={handleNameBlur}
                                onKeyDown={handleNameKeyDown}
                                className="text-sm font-semibold bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded border border-indigo-500 outline-none text-gray-900 dark:text-white w-48"
                            />
                        ) : (
                            <span 
                                className="text-sm font-semibold text-gray-900 dark:text-white cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 px-2 py-1 rounded border border-transparent hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                                onClick={() => setIsRenaming(true)}
                                title="Click to rename"
                            >
                                {sceneName}
                            </span>
                        )}
                    </div>
                    <button
                        onClick={handleExport}
                        disabled={isExporting}
                        className="flex items-center space-x-2 px-3 py-1 rounded text-xs font-bold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Export current composition as an image"
                    >
                        {isExporting ? (
                            <svg className="animate-spin h-4 w-4 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                        )}
                        <span>{isExporting ? 'Exporting...' : 'Export Image'}</span>
                    </button>
                    <div className="h-6 w-px bg-gray-300 dark:bg-gray-600"></div>
                    <div className="flex items-center space-x-1">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wide hidden md:inline">Res:</span>
                        <select
                            value={resolutionDropdownValue}
                            onChange={handleResolutionDropdownChange}
                            className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded border border-gray-300 dark:border-gray-600 px-2 py-1"
                            aria-label="Canvas resolution"
                        >
                            {PRESET_RESOLUTIONS.map(p => (
                                <option key={`${p.width}x${p.height}`} value={`${p.width}x${p.height}`}>{p.label}</option>
                            ))}
                            <option value="custom">Custom...</option>
                        </select>
                        {showResolutionInputs && (
                            <>
                                <input
                                    type="number"
                                    value={customW}
                                    onChange={e => setCustomW(e.target.value)}
                                    onBlur={applyCustomResolution}
                                    onKeyDown={e => e.key === 'Enter' && applyCustomResolution()}
                                    className="text-xs w-14 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded border border-gray-300 dark:border-gray-600 px-1 py-1 text-center"
                                    min={1}
                                    placeholder="W"
                                    aria-label="Custom width"
                                />
                                <span className="text-xs text-gray-400">×</span>
                                <input
                                    type="number"
                                    value={customH}
                                    onChange={e => setCustomH(e.target.value)}
                                    onBlur={applyCustomResolution}
                                    onKeyDown={e => e.key === 'Enter' && applyCustomResolution()}
                                    className="text-xs w-14 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded border border-gray-300 dark:border-gray-600 px-1 py-1 text-center"
                                    min={1}
                                    placeholder="H"
                                    aria-label="Custom height"
                                />
                            </>
                        )}
                    </div>
                </div>
                <div className="flex items-center space-x-2 text-xs text-gray-400">
                    <span className="hidden md:inline">Ref: {REF_WIDTH}×{REF_HEIGHT} • Shift + Arrow to Nudge</span>
                    <span className="w-px h-3 bg-gray-300 dark:bg-gray-600 mx-2"></span>
                    <span>Drag images from right panel</span>
                </div>
            </div>

            {/* Stage Area */}
            <div ref={viewportRef} className="flex-1 flex items-center justify-center bg-gray-200/50 dark:bg-black/50 overflow-hidden relative" onPointerDown={handleStagePointerDown}>
                <div 
                    ref={stageRef}
                    className="relative bg-white dark:bg-gray-800 shadow-2xl overflow-hidden group"
                    style={{ 
                        width: REF_WIDTH,
                        height: REF_HEIGHT,
                        transform: `scale(${stageScale})`,
                        transformOrigin: 'center center',
                        backgroundImage: 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)',
                        backgroundSize: '20px 20px',
                        backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px' 
                    }}
                    onDrop={handleDropOnStage}
                    onDragOver={handleStageDragOver}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                >
                    {scene.background && scene.background.visible !== false && (
                        <div
                            className={`absolute inset-0 w-full h-full ${selectedSpriteId === 'background' ? `ring-4 ring-inset ${scene.background.locked ? 'ring-amber-500' : 'ring-indigo-500'}` : ''}`}
                            style={{ zIndex: 0, pointerEvents: scene.background.locked ? 'none' : 'auto' }}
                            onPointerDown={(e) => handlePointerDown(e, 'background')}
                        >
                            <SpritePreviewImage sprite={scene.background} isBackground={true} />
                        </div>
                    )}
                    
                    {!scene.background && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 font-bold pointer-events-none space-y-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span>Drop Background Image Here</span>
                        </div>
                    )}

                    {scene.sprites.map((sprite, index) => {
                        if (sprite.visible === false) return null;

                        const isSelected = selectedSpriteId === sprite.id;

                        return (
                            <div
                                key={sprite.id}
                                className={`absolute transform -translate-x-1/2 -translate-y-1/2 select-none ${sprite.locked ? 'cursor-not-allowed' : 'cursor-move'} ${isSelected ? `ring-2 ${sprite.locked ? 'ring-amber-500' : 'ring-indigo-500'}` : ''}`}
                                style={{
                                    left: `${sprite.x * 100}%`,
                                    top: `${sprite.y * 100}%`,
                                    zIndex: index + 1,
                                    pointerEvents: sprite.locked ? 'none' : 'auto',
                                }}
                                onPointerDown={(e) => handlePointerDown(e, sprite.id)}
                                onWheel={(e) => handleWheel(e, sprite.id)}
                            >
                                <SpritePreviewImage sprite={sprite} isBackground={false} />
                                {isSelected && (
                                    <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black/70 text-white text-xs px-2 py-1 rounded whitespace-nowrap pointer-events-none z-[9999]">
                                        X: {sprite.x.toFixed(2)} Y: {sprite.y.toFixed(2)}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Bottom Panel */}
            <div className="h-80 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex flex-row flex-shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-10">

                {/* Properties Pane (Left) */}
                <div className="flex-1 flex flex-col min-w-0">
                    <div className="flex-none p-2 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
                        <span className="font-bold text-xs ml-2 text-gray-700 dark:text-gray-300 uppercase tracking-wider">Properties</span>
                        <span className="text-[9px] text-gray-400 dark:text-gray-500 ml-2" title="Undo/redo scene changes with Ctrl+Z / Ctrl+Y">Ctrl+Z to undo</span>
                        <div className="flex space-x-2">
                            <button onClick={() => { saveUndo(); onSceneChange({ background: null, sprites: [] }); }} className="px-3 py-1 text-xs bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300 rounded hover:bg-red-200 font-medium">Clear All</button>
                        </div>
                    </div>

                    {/* Properties Controls */}
                    <div className="px-4 py-3 overflow-y-auto flex-1">
                        <SceneSpriteProperties
                            activeSprite={activeSprite}
                            selectedSpriteId={selectedSpriteId}
                            onUpdate={updateSprite}
                            onRemove={removeSprite}
                            onSetBackground={setSpriteAsBackground}
                        />
                    </div>
                </div>

                {/* Right Column — Layers + Code Preview */}
                <div className="flex-1 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col min-w-0">

                {/* Layers Pane */}
                <div className="flex-1 flex flex-col min-h-0">
                    <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Layers (Foreground Top)</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {/* Draggable Layer List */}
                        {layersReversed.map(({ sprite, originalIndex }, _i) => {
                            // Check if this item is being hovered during drag
                            const isDragOverTop = dragOverInfo?.id === sprite.id && dragOverInfo.position === 'top';
                            const isDragOverBottom = dragOverInfo?.id === sprite.id && dragOverInfo.position === 'bottom';
                            const isHidden = sprite.visible === false;
                            
                            return (
                                <div key={sprite.id} className="relative">
                                    {/* Top Drop Indicator Line */}
                                    {isDragOverTop && (
                                        <div className="absolute -top-1 left-0 right-0 h-1 bg-indigo-500 rounded z-20 pointer-events-none" />
                                    )}
                                    
                                    <div
                                        draggable
                                        onDragStart={(e) => {
                                            e.dataTransfer.setData('application/renpy-layer-index', originalIndex.toString());
                                            e.dataTransfer.effectAllowed = 'move';
                                        }}
                                        onDragOver={(e) => handleLayerListDragOver(e, sprite.id, originalIndex)}
                                        onDragLeave={() => setDragOverInfo(null)}
                                        onDrop={(e) => handleLayerListDrop(e, originalIndex)}
                                        onClick={() => setSelectedSpriteId(sprite.id)}
                                        className={`flex items-center p-2 rounded cursor-pointer group border ${selectedSpriteId === sprite.id ? 'bg-indigo-100 dark:bg-indigo-900/50 border-indigo-200 dark:border-indigo-700' : 'hover:bg-gray-100 dark:hover:bg-gray-700 border-transparent'}`}
                                    >
                                        <button
                                            onClick={(e) => { e.stopPropagation(); toggleVisibility(sprite.id); }}
                                            className="p-1 text-gray-400 hover:text-gray-900 dark:hover:text-white mr-1"
                                            title={isHidden ? "Show Layer" : "Hide Layer"}
                                        >
                                            {isHidden ? (
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                                                    <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.064 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                                                </svg>
                                            ) : (
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                                    <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                                                </svg>
                                            )}
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); toggleLock(sprite.id); }}
                                            className={`p-1 mr-1 ${sprite.locked ? 'text-amber-500 hover:text-amber-600' : 'text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400'}`}
                                            title={sprite.locked ? "Unlock Layer" : "Lock Layer"}
                                        >
                                            {sprite.locked ? (
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                                </svg>
                                            ) : (
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                                                </svg>
                                            )}
                                        </button>
                                        <div className="text-gray-400 mr-2 cursor-grab active:cursor-grabbing hover:text-gray-600 dark:hover:text-gray-300">
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                                        </div>
                                        <div className={`w-8 h-8 rounded bg-gray-200 dark:bg-gray-600 overflow-hidden flex-shrink-0 mr-2 border border-gray-300 dark:border-gray-500 ${isHidden ? 'opacity-50' : ''}`}>
                                            <img src={sprite.image.dataUrl} className="w-full h-full object-cover" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-xs font-semibold truncate ${selectedSpriteId === sprite.id ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-700 dark:text-gray-300'} ${isHidden ? 'opacity-50 line-through decoration-gray-400' : ''}`}>
                                                {getRenpyTag(sprite.image)}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Bottom Drop Indicator Line */}
                                    {isDragOverBottom && (
                                        <div className="absolute -bottom-1 left-0 right-0 h-1 bg-indigo-500 rounded z-20 pointer-events-none" />
                                    )}
                                </div>
                            );
                        })}
                        
                        {/* Background Entry (Pinned to Bottom) */}
                        {scene.background ? (
                            <div 
                                onClick={() => setSelectedSpriteId('background')}
                                className={`flex items-center p-2 rounded cursor-pointer mt-2 border-t-2 border-dashed border-gray-200 dark:border-gray-700 pt-2 ${selectedSpriteId === 'background' ? 'bg-indigo-100 dark:bg-indigo-900/50' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                            >
                                <button 
                                    onClick={(e) => { e.stopPropagation(); toggleVisibility('background'); }}
                                    className="p-1 text-gray-400 hover:text-gray-900 dark:hover:text-white mr-1"
                                    title={scene.background.visible === false ? "Show Layer" : "Hide Layer"}
                                >
                                    {scene.background.visible === false ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                                            <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.064 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                                        </svg>
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                            <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                                        </svg>
                                    )}
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); toggleLock('background'); }}
                                    className={`p-1 mr-1 ${scene.background.locked ? 'text-amber-500 hover:text-amber-600' : 'text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400'}`}
                                    title={scene.background.locked ? "Unlock Layer" : "Lock Layer"}
                                >
                                    {scene.background.locked ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                        </svg>
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                                        </svg>
                                    )}
                                </button>
                                <div className="w-3 h-3 mr-2"></div>
                                <div className={`w-8 h-8 rounded bg-gray-200 dark:bg-gray-600 overflow-hidden flex-shrink-0 mr-2 border border-gray-300 dark:border-gray-500 ${scene.background.visible === false ? 'opacity-50' : ''}`}>
                                    <img src={scene.background.image.dataUrl} className="w-full h-full object-cover" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-0.5">Background</p>
                                    <p className={`text-xs truncate ${selectedSpriteId === 'background' ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-700 dark:text-gray-300'} ${scene.background.visible === false ? 'opacity-50 line-through decoration-gray-400' : ''}`}>
                                        {getRenpyTag(scene.background.image)}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="p-4 text-center text-xs text-gray-400 italic border-t-2 border-dashed border-gray-200 dark:border-gray-700 mt-2">
                                No background
                            </div>
                        )}
                    </div>
                </div>

                    {/* Code Preview */}
                    <div className="flex-1 flex flex-col min-h-0 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex-none flex justify-between items-center px-2 py-1 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                            <span className="text-[10px] font-bold text-gray-400 uppercase">Code Preview</span>
                            <CopyButton text={generatedCode} size="xs" />
                        </div>
                        <pre className="flex-1 p-3 font-mono text-xs overflow-auto text-gray-600 dark:text-gray-400 select-text bg-white dark:bg-gray-800 min-h-0">
                            {generatedCode}
                        </pre>
                    </div>

                </div>{/* end Right Column */}

            </div>
        </div>
    );
};

export default SceneComposer;
