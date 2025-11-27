




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
    
    const stageRef = useRef<HTMLDivElement>(null);
    const nameInputRef = useRef<HTMLInputElement>(null);

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
            onSceneChange(prev => ({
                ...prev,
                sprites: prev.sprites.filter(s => s.id !== id)
            }));
        }
        if (selectedSpriteId === id) setSelectedSpriteId(null);
    };

    const moveSpriteToFront = (id: string) => {
        if (id === 'background') return; // Background is always back
        onSceneChange(prev => {
            const sprite = prev.sprites.find(s => s.id === id);
            if (!sprite) return prev;
            // Also update Z-index to be higher than max
            const maxZ = Math.max(0, ...(prev.sprites.map(s => s.zIndex)), (prev.background?.zIndex || 0));
            const updatedSprite = { ...sprite, zIndex: maxZ + 1 };
            
            const others = prev.sprites.filter(s => s.id !== id);
            return { ...prev, sprites: [...others, updatedSprite] };
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
            return {
                ...prev,
                background: newBg,
                sprites: prev.sprites.filter(s => s.id !== id)
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
        // Sort items by zIndex for code generation order (Ren'Py renders in order of execution/zorder)
        const allSprites = [...scene.sprites];
        allSprites.sort((a, b) => a.zIndex - b.zIndex);

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
            if (bg.zIndex !== 0) transforms.push(`zorder ${bg.zIndex}`);

            if (transforms.length > 0) {
                code += `scene ${tag}:\n    ${transforms.join('\n    ')}\n`;
            } else {
                code += `scene ${tag}\n`;
            }
        } else {
            code += `# No background selected\n`;
        }

        allSprites.forEach(sprite => {
            const tag = getRenpyTag(sprite.image);
            const x = sprite.x.toFixed(2);
            const y = sprite.y.toFixed(2);
            
            const zoomStr = (sprite.zoom !== 1) ? ` zoom ${sprite.zoom}` : '';
            const xzoomStr = sprite.flipH ? ` xzoom -1.0` : '';
            const yzoomStr = sprite.flipV ? ` yzoom -1.0` : '';
            const rotateStr = sprite.rotation !== 0 ? ` rotate ${sprite.rotation}` : '';
            const alphaStr = sprite.alpha !== 1.0 ? ` alpha ${sprite.alpha}` : '';
            const blurStr = sprite.blur > 0 ? ` blur ${sprite.blur}` : '';
            const zStr = ` zorder ${sprite.zIndex}`;
            
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

    const assetOptions = useMemo(() => {
        const opts = [];
        if (scene.background) {
            opts.push({ id: 'background', label: `Background (${getRenpyTag(scene.background.image)})` });
        }
        scene.sprites.forEach((s, idx) => {
            opts.push({ id: s.id, label: `Sprite ${idx + 1} (${getRenpyTag(s.image)})` });
        });
        return opts;
    }, [scene, metadata]);

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

    return (
        <div className="flex h-full bg-gray-100 dark:bg-gray-900 overflow-hidden flex-col">
            <div className="h-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center px-4 justify-between flex-shrink-0">
                <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Scene:</span>
                    {isRenaming ? (
                        <input
                            ref={nameInputRef}
                            type="text"
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            onBlur={handleNameBlur}
                            onKeyDown={handleNameKeyDown}
                            className="text-sm font-semibold bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded border border-indigo-500 outline-none text-gray-900 dark:text-white"
                        />
                    ) : (
                        <span 
                            className="text-sm font-semibold text-gray-900 dark:text-white cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 px-2 py-1 rounded"
                            onClick={() => setIsRenaming(true)}
                            title="Click to rename"
                        >
                            {sceneName}
                        </span>
                    )}
                </div>
                <div className="text-xs text-gray-400">Drag images from the Images panel on the right</div>
            </div>

            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <div className="flex-1 p-8 flex items-center justify-center bg-gray-200/50 dark:bg-black/50 overflow-hidden relative" onPointerDown={handleStagePointerDown}>
                    {/* The Stage */}
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
                                style={{ zIndex: scene.background.zIndex }}
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
                                <span>Drag images from the Images panel on the right</span>
                            </div>
                        )}

                        {scene.sprites.map(sprite => (
                            <div
                                key={sprite.id}
                                className={`absolute transform -translate-x-1/2 -translate-y-1/2 cursor-move select-none ${selectedSpriteId === sprite.id ? 'ring-2 ring-indigo-500' : ''}`}
                                style={{
                                    left: `${sprite.x * 100}%`,
                                    top: `${sprite.y * 100}%`,
                                    height: '85%',
                                    zIndex: sprite.zIndex,
                                }}
                                onPointerDown={(e) => handlePointerDown(e, sprite.id)}
                                onWheel={(e) => handleWheel(e, sprite.id)}
                            >
                                {renderSpriteImage(sprite, false)}
                                {selectedSpriteId === sprite.id && (
                                    <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black/70 text-white text-xs px-2 py-1 rounded whitespace-nowrap pointer-events-none z-[9999]">
                                        X: {sprite.x.toFixed(2)} Y: {sprite.y.toFixed(2)} | Z: {sprite.zIndex}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Code Generation Panel */}
                <div className="h-64 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex flex-col flex-shrink-0">
                    <div className="flex-none p-2 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
                        <span className="font-bold text-sm ml-2 text-gray-700 dark:text-gray-300">Generated Scene Code</span>
                        <div className="flex space-x-2">
                            <button onClick={() => onSceneChange({ background: null, sprites: [] })} className="px-3 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 dark:text-gray-300">Clear Stage</button>
                            <button onClick={copyToClipboard} className="px-3 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 font-bold">Copy Code</button>
                        </div>
                    </div>
                    
                    {/* Controls Row */}
                    <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center space-x-4 overflow-x-auto min-h-[80px]">
                        {/* Asset Selection Dropdown */}
                        <div className="flex flex-col min-w-[150px] max-w-[200px] border-r border-gray-200 dark:border-gray-700 pr-4 mr-2">
                            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1">Selected Asset</label>
                            <select 
                                value={selectedSpriteId || ''} 
                                onChange={(e) => setSelectedSpriteId(e.target.value || null)}
                                className="w-full p-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs truncate"
                            >
                                <option value="">None</option>
                                {assetOptions.map(opt => (
                                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                                ))}
                            </select>
                        </div>

                        {activeSprite ? (
                            <>
                                <div className="flex items-center space-x-2 border-r border-gray-200 dark:border-gray-700 pr-4">
                                    <button 
                                        onClick={() => updateSprite(activeSprite.id, { flipH: !activeSprite.flipH })} 
                                        className={`p-2 rounded text-xs font-bold flex items-center space-x-1 ${activeSprite.flipH ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}
                                        title="Flip Horizontal"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                                    </button>
                                    <button 
                                        onClick={() => updateSprite(activeSprite.id, { flipV: !activeSprite.flipV })} 
                                        className={`p-2 rounded text-xs font-bold flex items-center space-x-1 ${activeSprite.flipV ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}
                                        title="Flip Vertical"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 transform rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                                    </button>
                                </div>

                                <div className="flex items-center space-x-6">
                                    {/* Z-Index Control */}
                                    <div className="flex flex-col w-16 flex-shrink-0">
                                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                                            <span>Z-Index</span>
                                        </div>
                                        <input 
                                            type="number" 
                                            value={activeSprite.zIndex} 
                                            onChange={(e) => updateSprite(activeSprite.id, { zIndex: parseInt(e.target.value) || 0 })}
                                            className="w-full text-xs p-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-center"
                                        />
                                    </div>

                                    {/* Zoom Control */}
                                    <div className="flex flex-col w-40 flex-shrink-0">
                                        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                                            <span>Zoom</span>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <input 
                                                type="range" min="0.1" max="3" step="0.05" value={activeSprite.zoom || 1} 
                                                onChange={(e) => updateSprite(activeSprite.id, { zoom: parseFloat(e.target.value) })}
                                                className="h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 flex-grow w-full"
                                            />
                                            <input 
                                                type="number" 
                                                min="0.1" 
                                                max="5" 
                                                step="0.1" 
                                                value={activeSprite.zoom || 1} 
                                                onChange={(e) => updateSprite(activeSprite.id, { zoom: Math.max(0.1, parseFloat(e.target.value)) || 1 })}
                                                className="w-14 text-xs p-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-center"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex flex-col w-40 flex-shrink-0">
                                        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                                            <span>Rotate</span>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <input 
                                                type="range" min="-180" max="180" value={activeSprite.rotation} 
                                                onChange={(e) => updateSprite(activeSprite.id, { rotation: parseInt(e.target.value) })}
                                                className="h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 flex-grow w-full"
                                            />
                                            <input 
                                                type="number" 
                                                min="-180" 
                                                max="180" 
                                                value={activeSprite.rotation} 
                                                onChange={(e) => updateSprite(activeSprite.id, { rotation: parseInt(e.target.value) || 0 })}
                                                className="w-14 text-xs p-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-center"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex flex-col w-40 flex-shrink-0">
                                        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                                            <span>Opacity</span>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <input 
                                                type="range" min="0" max="1" step="0.05" value={activeSprite.alpha ?? 1} 
                                                onChange={(e) => updateSprite(activeSprite.id, { alpha: parseFloat(e.target.value) })}
                                                className="h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 flex-grow w-full"
                                            />
                                            <input 
                                                type="number" 
                                                min="0" 
                                                max="1" 
                                                step="0.1" 
                                                value={activeSprite.alpha ?? 1} 
                                                onChange={(e) => updateSprite(activeSprite.id, { alpha: Math.min(1, Math.max(0, parseFloat(e.target.value))) || 1 })}
                                                className="w-14 text-xs p-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-center"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex flex-col w-40 flex-shrink-0">
                                        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                                            <span>Blur</span>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <input 
                                                type="range" min="0" max="20" step="1" value={activeSprite.blur ?? 0} 
                                                onChange={(e) => updateSprite(activeSprite.id, { blur: parseInt(e.target.value) })}
                                                className="h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 flex-grow w-full"
                                            />
                                            <input 
                                                type="number" 
                                                min="0" 
                                                max="50" 
                                                value={activeSprite.blur ?? 0} 
                                                onChange={(e) => updateSprite(activeSprite.id, { blur: Math.max(0, parseInt(e.target.value) || 0) })}
                                                className="w-14 text-xs p-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-center"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center space-x-2 border-l border-gray-200 dark:border-gray-700 pl-4 ml-auto">
                                    {selectedSpriteId !== 'background' && (
                                        <>
                                            <button onClick={() => setSpriteAsBackground(activeSprite.id)} className="px-3 py-1 text-xs bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 rounded hover:bg-indigo-200 dark:hover:bg-indigo-800">Set BG</button>
                                            <button onClick={() => moveSpriteToFront(activeSprite.id)} className="px-3 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 dark:text-gray-300" title="Move visually to front by increasing Z-index">Front</button>
                                        </>
                                    )}
                                    <button onClick={() => removeSprite(activeSprite.id)} className="px-3 py-1 text-xs bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400 rounded hover:bg-red-200">Remove</button>
                                </div>
                            </>
                        ) : (
                            <div className="w-full flex items-center justify-center">
                                <p className="text-sm text-gray-400 dark:text-gray-500 italic">Select a sprite or the background to edit properties.</p>
                            </div>
                        )}
                    </div>

                    <pre className="flex-1 p-4 font-mono text-sm overflow-auto text-gray-700 dark:text-gray-300 select-text">
                        {generatedCode}
                    </pre>
                </div>
            </div>
        </div>
    );
};

export default SceneComposer;