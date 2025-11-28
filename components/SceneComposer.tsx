
import React, { useState, useRef, useEffect, useMemo } from 'react';
import type { ProjectImage, ImageMetadata, SceneComposition, SceneSprite } from '../types';

interface SceneComposerProps {
    images: ProjectImage[];
    metadata: Map<string, ImageMetadata>;
    scene: SceneComposition;
    onSceneChange: (newScene: React.SetStateAction<SceneComposition>) => void;
    sceneName: string;
    onRenameScene: (newName: string) => void;
}

const SceneComposer: React.FC<SceneComposerProps> = ({ images, metadata, scene, onSceneChange, sceneName, onRenameScene }) => {
    const [selectedSpriteId, setSelectedSpriteId] = useState<string | null>(null);
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [isRenaming, setIsRenaming] = useState(false);
    const [editName, setEditName] = useState(sceneName);
    
    // Layer List Drag State
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
    
    const stageRef = useRef<HTMLDivElement>(null);
    const nameInputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setEditName(sceneName);
    }, [sceneName]);

    useEffect(() => {
        if (isRenaming && nameInputRef.current) {
            nameInputRef.current.focus();
            nameInputRef.current.select();
        }
    }, [isRenaming]);

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if typing in an input
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            
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
                    onSceneChange(prev => ({
                        ...prev,
                        sprites: prev.sprites.map(s => {
                            if (s.id === selectedSpriteId) {
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
            // Ensure container can receive focus
            container.tabIndex = 0;
        }
        return () => {
            if (container) container.removeEventListener('keydown', handleKeyDown);
        };
    }, [selectedSpriteId, onSceneChange]);


    // Helpers to get display names
    const getRenpyTag = (image: ProjectImage) => {
        const meta = metadata.get(image.projectFilePath || image.filePath);
        const name = meta?.renpyName || image.fileName.split('.').slice(0, -1).join('.');
        const tags = (meta?.tags || []).join(' ');
        return `${name}${tags ? ` ${tags}` : ''}`.trim().replace(/\s+/g, ' ');
    };

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
                flipH: false, flipV: false, rotation: 0, alpha: 1.0, blur: 0
            };
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
                    blur: 0
                };
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
    const updateSprite = (id: string, updates: Partial<SceneSprite>) => {
        if (id === 'background') {
            onSceneChange(prev => prev.background ? ({ ...prev, background: { ...prev.background, ...updates } }) : prev);
        } else {
            onSceneChange(prev => ({
                ...prev,
                sprites: prev.sprites.map(s => s.id === id ? { ...s, ...updates } : s)
            }));
        }
    };

    const removeSprite = (id: string) => {
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
    };

    const moveSpriteToIndex = (fromIndex: number, toIndex: number) => {
        if (fromIndex === toIndex) return;
        onSceneChange(prev => {
            const newSprites = [...prev.sprites];
            const [moved] = newSprites.splice(fromIndex, 1);
            newSprites.splice(toIndex, 0, moved);
            // Re-normalize Z-indices to match array order
            newSprites.forEach((s, i) => s.zIndex = i + 1);
            return { ...prev, sprites: newSprites };
        });
    };

    const setSpriteAsBackground = (id: string) => {
        if (id === 'background') return;
        onSceneChange(prev => {
            const sprite = prev.sprites.find(s => s.id === id);
            if (!sprite) return prev;
            const newBg: SceneSprite = {
                ...sprite,
                id: 'background',
                x: 0.5, y: 0.5, // Reset position for BG
                zIndex: 0, // Reset Z for BG
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

    // Canvas Interaction
    const handlePointerDown = (e: React.PointerEvent, id: string) => {
        e.stopPropagation();
        setSelectedSpriteId(id);
        // Do not allow dragging the background
        if (id !== 'background') {
            setDraggingId(id);
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
        }
    };

    const handleStagePointerDown = () => {
        // If clicking on empty stage (where no sprite is), deselect
        if (!scene.background) {
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
            setEditName(sceneName); // Revert if empty
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
        // Sprites are stored in array order which implies Z-order (0 is back, N is front)
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
            // Background is usually implicitly zorder 0, but explicit doesn't hurt if we want to layer it
            
            if (transforms.length > 0) {
                code += `scene ${tag}:\n    ${transforms.join('\n    ')}\n`;
            } else {
                code += `scene ${tag}\n`;
            }
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
            // Assign zorder explicitly based on array position to guarantee consistency
            const zStr = ` zorder ${index + 1}`;
            
            code += `show ${tag}:\n    xalign ${x} yalign ${y}${zoomStr}${xzoomStr}${yzoomStr}${rotateStr}${alphaStr}${blurStr}${zStr}\n`;
        });
        return code;
    }, [scene, metadata]);

    const copyToClipboard = () => {
        navigator.clipboard.writeText(generatedCode);
    };

    const activeSprite = useMemo(() => {
        if (selectedSpriteId === 'background') return scene.background;
        return scene.sprites.find(s => s.id === selectedSpriteId) || null;
    }, [scene, selectedSpriteId]);

    // Layer List Preparation
    // We reverse the sprite array so the highest index (foreground) appears at the top of the UI list
    const layersReversed = useMemo(() => {
        return scene.sprites.map((s, index) => ({ sprite: s, originalIndex: index })).reverse();
    }, [scene.sprites]);

    // Render Helpers
    const renderSpriteImage = (sprite: SceneSprite, isBackground: boolean) => (
        <img 
            src={sprite.image.dataUrl} 
            style={{ 
                height: isBackground ? '100%' : '100%',
                width: isBackground ? '100%' : 'auto',
                objectFit: isBackground ? 'cover' : undefined,
                maxWidth: 'none',
                transform: `rotate(${sprite.rotation}deg) scale(${sprite.zoom || 1}) scaleX(${sprite.flipH ? -1 : 1}) scaleY(${sprite.flipV ? -1 : 1})`,
                transformOrigin: 'center center',
                opacity: sprite.alpha ?? 1,
                filter: sprite.blur ? `blur(${sprite.blur}px)` : 'none',
            }}
            className="pointer-events-none block select-none"
        />
    );

    const ControlGroup: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
        <div className="flex flex-col space-y-1.5 p-2 bg-gray-50 dark:bg-gray-700/50 rounded border border-gray-200 dark:border-gray-600">
            <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</span>
            <div className="flex items-center space-x-2">
                {children}
            </div>
        </div>
    );

    return (
        <div ref={containerRef} className="flex h-full bg-gray-100 dark:bg-gray-900 overflow-hidden flex-col outline-none">
            {/* Toolbar */}
            <div className="h-12 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center px-4 justify-between flex-shrink-0">
                <div className="flex items-center space-x-3">
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
                <div className="flex items-center space-x-2 text-xs text-gray-400">
                    <span className="hidden md:inline">Shift + Arrow to Nudge</span>
                    <span className="w-px h-3 bg-gray-300 dark:bg-gray-600 mx-2"></span>
                    <span>Drag images from right panel</span>
                </div>
            </div>

            {/* Stage Area */}
            <div className="flex-1 p-8 flex items-center justify-center bg-gray-200/50 dark:bg-black/50 overflow-hidden relative" onPointerDown={handleStagePointerDown}>
                <div 
                    ref={stageRef}
                    className="relative bg-white dark:bg-gray-800 shadow-2xl overflow-hidden group"
                    style={{ 
                        aspectRatio: '16/9', 
                        width: '100%', 
                        maxHeight: '100%',
                        backgroundImage: 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)',
                        backgroundSize: '20px 20px',
                        backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px' 
                    }}
                    onDrop={handleDropOnStage}
                    onDragOver={handleStageDragOver}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                >
                    {scene.background && (
                        <div 
                            className={`absolute inset-0 w-full h-full ${selectedSpriteId === 'background' ? 'ring-4 ring-indigo-500 ring-inset' : ''}`}
                            style={{ zIndex: 0 }}
                            onPointerDown={(e) => handlePointerDown(e, 'background')}
                        >
                            {renderSpriteImage(scene.background, true)}
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

                    {scene.sprites.map((sprite, index) => (
                        <div
                            key={sprite.id}
                            className={`absolute transform -translate-x-1/2 -translate-y-1/2 cursor-move select-none ${selectedSpriteId === sprite.id ? 'ring-2 ring-indigo-500' : ''}`}
                            style={{
                                left: `${sprite.x * 100}%`,
                                top: `${sprite.y * 100}%`,
                                height: '85%',
                                zIndex: index + 1, // Visual stacking matches array order
                            }}
                            onPointerDown={(e) => handlePointerDown(e, sprite.id)}
                            onWheel={(e) => handleWheel(e, sprite.id)}
                        >
                            {renderSpriteImage(sprite, false)}
                            {selectedSpriteId === sprite.id && (
                                <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black/70 text-white text-xs px-2 py-1 rounded whitespace-nowrap pointer-events-none z-[9999]">
                                    X: {sprite.x.toFixed(2)} Y: {sprite.y.toFixed(2)}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Bottom Panel */}
            <div className="h-72 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex flex-row flex-shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-10">
                
                {/* Properties Pane (Left) */}
                <div className="flex-1 flex flex-col min-w-0">
                    <div className="flex-none p-2 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
                        <span className="font-bold text-xs ml-2 text-gray-700 dark:text-gray-300 uppercase tracking-wider">Properties</span>
                        <div className="flex space-x-2">
                            <button onClick={() => onSceneChange({ background: null, sprites: [] })} className="px-3 py-1 text-xs bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300 rounded hover:bg-red-200 font-medium">Clear All</button>
                        </div>
                    </div>
                    
                    {/* Properties Controls */}
                    <div className="p-4 overflow-x-auto flex-1 flex items-start">
                        {activeSprite ? (
                            <div className="flex items-start space-x-4">
                                <ControlGroup label="Transform">
                                    <div className="flex space-x-1">
                                        <button 
                                            onClick={() => updateSprite(activeSprite.id, { flipH: !activeSprite.flipH })} 
                                            className={`p-1.5 rounded ${activeSprite.flipH ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'}`}
                                            title="Flip Horizontal"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                                        </button>
                                        <button 
                                            onClick={() => updateSprite(activeSprite.id, { flipV: !activeSprite.flipV })} 
                                            className={`p-1.5 rounded ${activeSprite.flipV ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'}`}
                                            title="Flip Vertical"
                                        >
                                            <svg className="w-4 h-4 transform rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                                        </button>
                                    </div>
                                </ControlGroup>

                                <ControlGroup label="Scale & Rotation">
                                    <div className="flex items-center space-x-3">
                                        <div className="flex flex-col w-20">
                                            <span className="text-[9px] text-gray-400 mb-0.5">Zoom</span>
                                            <input 
                                                type="number" step="0.1" value={activeSprite.zoom || 1} 
                                                onChange={(e) => updateSprite(activeSprite.id, { zoom: Math.max(0.1, parseFloat(e.target.value)) })}
                                                className="w-full text-xs p-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                                            />
                                        </div>
                                        <div className="flex flex-col w-20">
                                            <span className="text-[9px] text-gray-400 mb-0.5">Angle</span>
                                            <input 
                                                type="number" value={activeSprite.rotation} 
                                                onChange={(e) => updateSprite(activeSprite.id, { rotation: parseInt(e.target.value) })}
                                                className="w-full text-xs p-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                                            />
                                        </div>
                                    </div>
                                </ControlGroup>

                                <ControlGroup label="Appearance">
                                    <div className="flex items-center space-x-3">
                                        <div className="flex flex-col w-28">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-[9px] text-gray-400">Opacity</span>
                                                <input 
                                                    type="number" 
                                                    min="0" max="1" step="0.05" 
                                                    value={activeSprite.alpha ?? 1} 
                                                    onChange={(e) => updateSprite(activeSprite.id, { alpha: Math.min(1, Math.max(0, parseFloat(e.target.value))) })}
                                                    className="w-12 text-[10px] p-0.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-right"
                                                />
                                            </div>
                                            <input 
                                                type="range" min="0" max="1" step="0.05" value={activeSprite.alpha ?? 1} 
                                                onChange={(e) => updateSprite(activeSprite.id, { alpha: parseFloat(e.target.value) })}
                                                className="h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-600 w-full"
                                            />
                                        </div>
                                        <div className="flex flex-col w-28">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-[9px] text-gray-400">Blur (px)</span>
                                                <input 
                                                    type="number" 
                                                    min="0" max="50" step="1" 
                                                    value={activeSprite.blur ?? 0} 
                                                    onChange={(e) => updateSprite(activeSprite.id, { blur: Math.max(0, parseInt(e.target.value) || 0) })}
                                                    className="w-12 text-[10px] p-0.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-right"
                                                />
                                            </div>
                                            <input 
                                                type="range" min="0" max="50" step="1" value={activeSprite.blur ?? 0} 
                                                onChange={(e) => updateSprite(activeSprite.id, { blur: parseInt(e.target.value) })}
                                                className="h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-600 w-full"
                                            />
                                        </div>
                                    </div>
                                </ControlGroup>

                                <div className="flex items-center space-x-2 border-l border-gray-200 dark:border-gray-700 pl-4 ml-auto">
                                    {selectedSpriteId !== 'background' && (
                                        <>
                                            <button onClick={() => setSpriteAsBackground(activeSprite.id)} className="px-3 py-1.5 text-xs bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 font-medium whitespace-nowrap">Make BG</button>
                                            <button onClick={() => removeSprite(activeSprite.id)} className="px-3 py-1.5 text-xs bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded hover:bg-red-100 dark:hover:bg-red-900/50 font-medium">Delete</button>
                                        </>
                                    )}
                                    {selectedSpriteId === 'background' && (
                                        <button onClick={() => removeSprite('background')} className="px-3 py-1.5 text-xs bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded hover:bg-red-100 dark:hover:bg-red-900/50 font-medium">Clear BG</button>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="w-full h-16 flex items-center justify-center border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                                <p className="text-sm text-gray-400 dark:text-gray-500 font-medium">Select a layer to edit properties</p>
                            </div>
                        )}
                    </div>

                    {/* Code Preview */}
                    <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex-shrink-0">
                        <div className="flex justify-between items-center px-2 py-1">
                            <span className="text-[10px] font-bold text-gray-400 uppercase">Code Preview</span>
                            <button onClick={copyToClipboard} className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline font-medium">Copy to Clipboard</button>
                        </div>
                        <pre className="p-3 font-mono text-xs overflow-auto text-gray-600 dark:text-gray-400 select-text max-h-24 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                            {generatedCode}
                        </pre>
                    </div>
                </div>

                {/* Layers Pane (Right) */}
                <div className="w-64 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col flex-shrink-0">
                    <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Layers (Foreground Top)</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {/* Draggable Layer List */}
                        {layersReversed.map(({ sprite, originalIndex }, i) => (
                            <div 
                                key={sprite.id}
                                draggable
                                onDragStart={(e) => {
                                    e.dataTransfer.setData('application/renpy-layer-index', originalIndex.toString());
                                    e.dataTransfer.effectAllowed = 'move';
                                }}
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    setDragOverIndex(originalIndex);
                                }}
                                onDragLeave={() => setDragOverIndex(null)}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    setDragOverIndex(null);
                                    const fromIdxStr = e.dataTransfer.getData('application/renpy-layer-index');
                                    if (fromIdxStr) {
                                        const fromIdx = parseInt(fromIdxStr);
                                        if (!isNaN(fromIdx)) {
                                            moveSpriteToIndex(fromIdx, originalIndex);
                                        }
                                    }
                                }}
                                onClick={() => setSelectedSpriteId(sprite.id)}
                                className={`flex items-center p-2 rounded cursor-pointer group border ${selectedSpriteId === sprite.id ? 'bg-indigo-100 dark:bg-indigo-900/50 border-indigo-200 dark:border-indigo-700' : 'hover:bg-gray-100 dark:hover:bg-gray-700 border-transparent'} ${dragOverIndex === originalIndex ? 'border-t-2 border-t-indigo-500' : ''}`}
                            >
                                <div className="text-gray-400 mr-2 cursor-grab active:cursor-grabbing hover:text-gray-600 dark:hover:text-gray-300">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                                </div>
                                <div className="w-8 h-8 rounded bg-gray-200 dark:bg-gray-600 overflow-hidden flex-shrink-0 mr-2 border border-gray-300 dark:border-gray-500">
                                    <img src={sprite.image.dataUrl} className="w-full h-full object-cover" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className={`text-xs font-semibold truncate ${selectedSpriteId === sprite.id ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-700 dark:text-gray-300'}`}>
                                        {getRenpyTag(sprite.image)}
                                    </p>
                                </div>
                            </div>
                        ))}
                        
                        {/* Background Entry (Pinned to Bottom) */}
                        {scene.background ? (
                            <div 
                                onClick={() => setSelectedSpriteId('background')}
                                className={`flex items-center p-2 rounded cursor-pointer mt-2 border-t-2 border-dashed border-gray-200 dark:border-gray-700 pt-2 ${selectedSpriteId === 'background' ? 'bg-indigo-100 dark:bg-indigo-900/50' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                            >
                                <div className="w-3 h-3 mr-2"></div> 
                                <div className="w-8 h-8 rounded bg-gray-200 dark:bg-gray-600 overflow-hidden flex-shrink-0 mr-2 border border-gray-300 dark:border-gray-500">
                                    <img src={scene.background.image.dataUrl} className="w-full h-full object-cover" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-0.5">Background</p>
                                    <p className={`text-xs truncate ${selectedSpriteId === 'background' ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-700 dark:text-gray-300'}`}>
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

            </div>
        </div>
    );
};

export default SceneComposer;
