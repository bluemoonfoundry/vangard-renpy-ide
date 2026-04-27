import React, { useState } from 'react';
import type { SceneSprite } from '@/types';
import MatrixPresetPopover from './MatrixPresetPopover';
import ColorDropTarget from './ColorDropTarget';

interface Props {
    activeSprite: SceneSprite | null;
    selectedSpriteId: string | null;
    onUpdate: (id: string, updates: Partial<SceneSprite>) => void;
    onRangeSliderStart: () => void;
    onRangeSliderEnd: () => void;
}

const SHADER_DEFS: Record<string, Array<{ name: string; label: string; min: number; max: number; step: number; default: number }>> = {
    'renpy.blur': [
        { name: 'u_renpy_blur_log2', label: 'Blur (log2)', min: 0, max: 5, step: 0.25, default: 1.0 },
    ],
    'renpy.dissolve': [
        { name: 'u_renpy_dissolve', label: 'Dissolve', min: 0, max: 1, step: 0.05, default: 0.5 },
    ],
    'renpy.imagedissolve': [
        { name: 'u_renpy_dissolve_offset',     label: 'Offset',     min: 0,  max: 1, step: 0.05, default: 0   },
        { name: 'u_renpy_dissolve_multiplier', label: 'Multiplier', min: 0,  max: 2, step: 0.1,  default: 1.0 },
    ],
    'renpy.mask': [
        { name: 'u_renpy_mask_multiplier', label: 'Multiplier', min: 0,  max: 2,  step: 0.1,  default: 1.0 },
        { name: 'u_renpy_mask_offset',     label: 'Offset',     min: -1, max: 1,  step: 0.05, default: 0   },
    ],
    // renpy.pixelize is community-documented but not listed in official Ren'Py shader docs.
    // Included because it is widely referenced and the IDE can approximate it in preview.
    'renpy.pixelize': [
        { name: 'u_amount', label: 'Pixel Size', min: 0.001, max: 0.1, step: 0.001, default: 0.01 },
    ],
};

const PREDEFINED_SHADERS = Object.keys(SHADER_DEFS);

const ControlGroup: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div className="flex flex-col space-y-1.5 p-2 bg-gray-50 dark:bg-gray-700/50 rounded border border-gray-200 dark:border-gray-600 flex-shrink-0">
        <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</span>
        <div className="flex items-start space-x-2">
            {children}
        </div>
    </div>
);

const SliderRow: React.FC<{
    label: string;
    min: number; max: number; step: number;
    value: number;
    onChange: (v: number) => void;
    width?: string;
    onRangeSliderStart?: () => void;
    onRangeSliderEnd?: () => void;
}> = ({ label, min, max, step, value, onChange, width = 'w-28', onRangeSliderStart, onRangeSliderEnd }) => (
    <div className={`flex flex-col ${width}`}>
        <div className="flex justify-between items-center mb-1">
            <span className="text-[9px] text-gray-400">{label}</span>
            <input
                type="number" min={min} max={max} step={step} value={value}
                onChange={e => onChange(Math.min(max, Math.max(min, parseFloat(e.target.value) || min)))}
                className="w-12 text-[10px] p-0.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-right"
            />
        </div>
        <input
            type="range" min={min} max={max} step={step} value={value}
            onChange={e => onChange(parseFloat(e.target.value))}
            onPointerDown={onRangeSliderStart}
            onPointerUp={onRangeSliderEnd}
            className="h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-600 w-full"
        />
    </div>
);

const ColorSwatch: React.FC<{ label: string; value: string; onChange: (hex: string) => void }> = ({ label, value, onChange }) => (
    <div className="flex flex-col items-start space-y-1">
        <span className="text-[9px] text-gray-400">{label}</span>
        <div className="flex items-center space-x-1.5">
            <ColorDropTarget
                value={value || '#ffffff'}
                onChange={onChange}
                className="w-7 h-7 rounded cursor-pointer border border-gray-300 dark:border-gray-600 p-0.5 bg-white dark:bg-gray-800"
            />
            <input
                type="text"
                value={value || '#ffffff'}
                onChange={e => /^#[0-9a-fA-F]{0,6}$/.test(e.target.value) && onChange(e.target.value)}
                className="w-16 text-[10px] p-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 font-mono"
            />
        </div>
    </div>
);

const SceneSpriteProperties: React.FC<Props> = ({ activeSprite, selectedSpriteId: _selectedSpriteId, onUpdate, onRangeSliderStart, onRangeSliderEnd }) => {
    const [customShaderName, setCustomShaderName] = useState('');
    const [customUniforms, setCustomUnforms] = useState<Array<{ key: string; value: number }>>([]);

    if (!activeSprite) {
        return (
            <div className="w-full h-16 flex items-center justify-center border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                <p className="text-sm text-gray-400 dark:text-gray-500 font-medium">Select a layer to edit properties</p>
            </div>
        );
    }

    const u = (updates: Partial<SceneSprite>) => onUpdate(activeSprite.id, updates);

    const colorMode = activeSprite.colorMode ?? 'none';
    const saturation = activeSprite.saturation ?? 1.0;
    const brightness = activeSprite.brightness ?? 0;
    const contrast = activeSprite.contrast ?? 1.0;
    const invert = activeSprite.invert ?? 0;
    const activeShader = activeSprite.activeShader ?? '';
    const shaderUniforms = activeSprite.shaderUniforms ?? {};
    const isCustomShader = activeShader !== '' && !PREDEFINED_SHADERS.includes(activeShader);

    const handleShaderChange = (shader: string) => {
        if (shader === '') {
            u({ activeShader: '', shaderUniforms: {} });
            return;
        }
        if (shader === '__custom__') {
            u({ activeShader: customShaderName || '', shaderUniforms: {} });
            return;
        }
        const defaults: Record<string, number> = {};
        (SHADER_DEFS[shader] ?? []).forEach(d => { defaults[d.name] = d.default; });
        u({ activeShader: shader, shaderUniforms: defaults });
    };

    const handleUniformChange = (name: string, value: number) => {
        u({ shaderUniforms: { ...shaderUniforms, [name]: value } });
    };

    const addCustomUniform = () => {
        setCustomUnforms(prev => [...prev, { key: `u_param${prev.length + 1}`, value: 1.0 }]);
    };

    const updateCustomUniformKey = (index: number, key: string) => {
        setCustomUnforms(prev => {
            const next = [...prev];
            const oldKey = next[index].key;
            next[index] = { ...next[index], key };
            const newUniforms = { ...shaderUniforms };
            delete newUniforms[oldKey];
            newUniforms[key] = next[index].value;
            u({ shaderUniforms: newUniforms });
            return next;
        });
    };

    const updateCustomUniformValue = (index: number, value: number) => {
        setCustomUnforms(prev => {
            const next = [...prev];
            next[index] = { ...next[index], value };
            u({ shaderUniforms: { ...shaderUniforms, [next[index].key]: value } });
            return next;
        });
    };

    const removeCustomUniform = (index: number) => {
        setCustomUnforms(prev => {
            const next = [...prev];
            const key = next[index].key;
            next.splice(index, 1);
            const newUniforms = { ...shaderUniforms };
            delete newUniforms[key];
            u({ shaderUniforms: newUniforms });
            return next;
        });
    };

    return (
        <div className="flex flex-col gap-3 w-full">

        {/* Row 1 — geometric controls */}
        <div className="flex flex-wrap items-start gap-3">

            {/* Transform */}
            <ControlGroup label="Transform">
                <div className="flex space-x-1">
                    <button
                        onClick={() => u({ flipH: !activeSprite.flipH })}
                        className={`p-1.5 rounded ${activeSprite.flipH ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'}`}
                        title="Flip Horizontal"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                    </button>
                    <button
                        onClick={() => u({ flipV: !activeSprite.flipV })}
                        className={`p-1.5 rounded ${activeSprite.flipV ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'}`}
                        title="Flip Vertical"
                    >
                        <svg className="w-4 h-4 transform rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                    </button>
                </div>
            </ControlGroup>

            {/* Scale & Rotation */}
            <ControlGroup label="Scale & Rotation">
                <div className="flex items-center space-x-3">
                    <div className="flex flex-col w-20">
                        <span className="text-[9px] text-gray-400 mb-0.5">Zoom</span>
                        <input
                            type="number" step="0.1" value={activeSprite.zoom || 1}
                            onChange={e => u({ zoom: Math.max(0.1, parseFloat(e.target.value)) })}
                            className="w-full text-xs p-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                        />
                    </div>
                    <div className="flex flex-col w-20">
                        <span className="text-[9px] text-gray-400 mb-0.5">Angle</span>
                        <input
                            type="number" value={activeSprite.rotation}
                            onChange={e => u({ rotation: parseInt(e.target.value) })}
                            className="w-full text-xs p-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                        />
                    </div>
                </div>
            </ControlGroup>

            {/* Appearance */}
            <ControlGroup label="Appearance">
                <div className="flex items-center space-x-3">
                    <SliderRow
                        label="Opacity" min={0} max={1} step={0.05}
                        value={activeSprite.alpha ?? 1}
                        onChange={v => u({ alpha: v })}
                        onRangeSliderStart={onRangeSliderStart} onRangeSliderEnd={onRangeSliderEnd}
                    />
                    <SliderRow
                        label="Blur (px)" min={0} max={50} step={1}
                        value={activeSprite.blur ?? 0}
                        onChange={v => u({ blur: v })}
                        onRangeSliderStart={onRangeSliderStart} onRangeSliderEnd={onRangeSliderEnd}
                    />
                </div>
            </ControlGroup>

        </div>{/* end Row 1 */}

        {/* Row 2 — color & shader effects */}
        <div className="flex flex-wrap items-start gap-3">

            {/* Color Effects */}
            <ControlGroup label="Color Effects">
                <div className="flex flex-col space-y-2">

                    {/* Preset picker + mode selector */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <MatrixPresetPopover onApply={u} />
                        <div className="flex items-center gap-1.5">
                            <span className="text-[9px] text-gray-400 flex-shrink-0">Mode</span>
                            <select
                                value={colorMode}
                                onChange={e => u({ colorMode: e.target.value as 'none' | 'tint' | 'colorize' })}
                                className="text-xs p-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                            >
                                <option value="none">None</option>
                                <option value="tint">Tint</option>
                                <option value="colorize">Colorize</option>
                            </select>
                        </div>
                    </div>

                    {colorMode === 'tint' && (
                        <ColorSwatch
                            label="Tint Color"
                            value={activeSprite.tintColor ?? '#ffffff'}
                            onChange={hex => u({ tintColor: hex })}
                        />
                    )}

                    {colorMode === 'colorize' && (
                        <div className="flex space-x-3">
                            <ColorSwatch
                                label="Shadows"
                                value={activeSprite.colorizeBlack ?? '#000000'}
                                onChange={hex => u({ colorizeBlack: hex })}
                            />
                            <ColorSwatch
                                label="Highlights"
                                value={activeSprite.colorizeWhite ?? '#ffffff'}
                                onChange={hex => u({ colorizeWhite: hex })}
                            />
                        </div>
                    )}

                    {colorMode !== 'none' && (
                        <SliderRow
                            label="Saturation" min={0} max={2} step={0.05}
                            value={saturation}
                            onChange={v => u({ saturation: v })}
                            width="w-40"
                            onRangeSliderStart={onRangeSliderStart} onRangeSliderEnd={onRangeSliderEnd}
                        />
                    )}

                    {/* Brightness / Contrast / Invert — always visible */}
                    <div className="flex items-start gap-3 pt-1.5 border-t border-gray-200 dark:border-gray-600 flex-wrap">
                        <SliderRow
                            label="Brightness" min={-1} max={1} step={0.05}
                            value={brightness}
                            onChange={v => u({ brightness: v })}
                            onRangeSliderStart={onRangeSliderStart} onRangeSliderEnd={onRangeSliderEnd}
                        />
                        <SliderRow
                            label="Contrast" min={0.1} max={3} step={0.05}
                            value={contrast}
                            onChange={v => u({ contrast: v })}
                            onRangeSliderStart={onRangeSliderStart} onRangeSliderEnd={onRangeSliderEnd}
                        />
                        <SliderRow
                            label="Invert" min={0} max={1} step={0.1}
                            value={invert}
                            onChange={v => u({ invert: v })}
                            width="w-20"
                            onRangeSliderStart={onRangeSliderStart} onRangeSliderEnd={onRangeSliderEnd}
                        />
                    </div>

                </div>
            </ControlGroup>

            {/* Shaders */}
            <ControlGroup label="Shaders">
                <div className="flex flex-col space-y-2">
                    <div className="flex items-center space-x-2">
                        <span className="text-[9px] text-gray-400 w-12 flex-shrink-0">Shader</span>
                        <select
                            value={isCustomShader ? '__custom__' : activeShader}
                            onChange={e => handleShaderChange(e.target.value)}
                            className="text-xs p-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                        >
                            <option value="">None</option>
                            {PREDEFINED_SHADERS.map(s => <option key={s} value={s}>{s}</option>)}
                            <option value="__custom__">Custom…</option>
                        </select>
                    </div>

                    {/* No-preview badge for shaders with no CSS approximation */}
                    {(activeShader === 'renpy.dissolve' || activeShader === 'renpy.imagedissolve' || activeShader === 'renpy.mask') && (
                        <div className="flex items-center space-x-1.5 px-2 py-1 rounded bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700">
                            <svg className="w-3 h-3 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z" />
                            </svg>
                            <span className="text-[9px] text-amber-600 dark:text-amber-400">No IDE preview — effect appears in Ren'Py</span>
                        </div>
                    )}

                    {/* Unofficial shader note */}
                    {activeShader === 'renpy.pixelize' && (
                        <div className="flex items-center space-x-1.5 px-2 py-1 rounded bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700">
                            <svg className="w-3 h-3 text-blue-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z" />
                            </svg>
                            <span className="text-[9px] text-blue-500 dark:text-blue-400">Community shader — not in official Ren'Py docs</span>
                        </div>
                    )}

                    {/* Predefined shader uniforms */}
                    {activeShader && !isCustomShader && (SHADER_DEFS[activeShader] ?? []).map(def => (
                        <SliderRow
                            key={def.name}
                            label={def.label}
                            min={def.min} max={def.max} step={def.step}
                            value={shaderUniforms[def.name] ?? def.default}
                            onChange={v => handleUniformChange(def.name, v)}
                            width="w-40"
                            onRangeSliderStart={onRangeSliderStart} onRangeSliderEnd={onRangeSliderEnd}
                        />
                    ))}

                    {/* Custom shader name + uniforms */}
                    {isCustomShader && (
                        <div className="flex flex-col space-y-1.5">
                            <div className="flex items-center space-x-1.5">
                                <span className="text-[9px] text-gray-400 w-12 flex-shrink-0">Name</span>
                                <input
                                    type="text"
                                    value={customShaderName || activeShader}
                                    placeholder="my.shader"
                                    onChange={e => {
                                        setCustomShaderName(e.target.value);
                                        u({ activeShader: e.target.value });
                                    }}
                                    className="text-xs p-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 w-32"
                                />
                            </div>
                            {customUniforms.map((cu, i) => (
                                <div key={i} className="flex items-center space-x-1.5">
                                    <input
                                        type="text"
                                        value={cu.key}
                                        onChange={e => updateCustomUniformKey(i, e.target.value)}
                                        className="text-[10px] p-0.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 w-24 font-mono"
                                    />
                                    <input
                                        type="number" step="0.1" value={cu.value}
                                        onChange={e => updateCustomUniformValue(i, parseFloat(e.target.value) || 0)}
                                        className="text-[10px] p-0.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 w-14 text-right"
                                    />
                                    <button
                                        onClick={() => removeCustomUniform(i)}
                                        className="text-red-400 hover:text-red-600 text-xs px-1"
                                        title="Remove uniform"
                                    >✕</button>
                                </div>
                            ))}
                            <button
                                onClick={addCustomUniform}
                                className="text-[10px] text-indigo-500 hover:text-indigo-700 text-left"
                            >+ Add uniform</button>
                        </div>
                    )}
                </div>
            </ControlGroup>

        </div>{/* end Row 2 */}

        </div>
    );
};

export default SceneSpriteProperties;
