import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { SceneSprite } from '../types';

interface MatrixPreset {
    name: string;
    swatch: string; // CSS background value (color or gradient)
    apply: Partial<SceneSprite>;
}

interface PresetCategory {
    label: string;
    presets: MatrixPreset[];
}

const RESET: Partial<SceneSprite> = {
    colorMode: 'none',
    tintColor: '#ffffff',
    colorizeBlack: '#000000',
    colorizeWhite: '#ffffff',
    saturation: 1.0,
    brightness: 0,
    contrast: 1.0,
    invert: 0,
};

const PRESET_CATEGORIES: PresetCategory[] = [
    {
        label: 'Environmental & Time of Day',
        presets: [
            { name: 'Night',             swatch: '#444466',                                            apply: { ...RESET, colorMode: 'tint', tintColor: '#444466', brightness: -0.1 } },
            { name: 'Sunset',            swatch: '#ffcc99',                                            apply: { ...RESET, colorMode: 'tint', tintColor: '#ffcc99', brightness: 0.05 } },
            { name: 'Evening / Dusk',    swatch: '#8866aa',                                            apply: { ...RESET, colorMode: 'tint', tintColor: '#8866aa' } },
            { name: 'Early Morning',     swatch: '#b2cce6',                                            apply: { ...RESET, colorMode: 'tint', tintColor: '#b2cce6' } },
            { name: 'Midday / Harsh Sun', swatch: 'linear-gradient(135deg, #ffffcc, #ffffff)',         apply: { ...RESET, brightness: 0.1, contrast: 1.2 } },
        ],
    },
    {
        label: 'Flashbacks & Memory',
        presets: [
            { name: 'Classic Sepia',   swatch: 'linear-gradient(135deg, #704214, #f5e4c3)',            apply: { ...RESET, colorMode: 'colorize', colorizeBlack: '#704214', colorizeWhite: '#f5e4c3' } },
            { name: 'Greyscale',       swatch: 'linear-gradient(135deg, #222, #ddd)',                  apply: { ...RESET, saturation: 0 } },
            { name: 'Noir',            swatch: 'linear-gradient(135deg, #000, #fff)',                  apply: { ...RESET, saturation: 0, contrast: 1.5 } },
            { name: 'Faded Memory',    swatch: '#d4d4d4',                                              apply: { ...RESET, saturation: 0.5, brightness: 0.1 } },
        ],
    },
    {
        label: 'Character State',
        presets: [
            { name: 'Silhouette',       swatch: '#000000',                                            apply: { ...RESET, brightness: -1.0 } },
            { name: 'Dimmed (Inactive)', swatch: '#555566',                                           apply: { ...RESET, brightness: -0.2, saturation: 0.8 } },
            { name: 'Ghost / Spirit',   swatch: '#aaffff',                                            apply: { ...RESET, colorMode: 'tint', tintColor: '#aaffff' } },
            { name: 'Blushing',         swatch: '#ffcccc',                                            apply: { ...RESET, colorMode: 'tint', tintColor: '#ffcccc' } },
            { name: 'Cold / Sick',      swatch: '#e6ffff',                                            apply: { ...RESET, colorMode: 'tint', tintColor: '#e6ffff', saturation: 0.6 } },
        ],
    },
    {
        label: 'Horror & Special Effects',
        presets: [
            { name: 'Invert',         swatch: 'linear-gradient(135deg, #ff0066, #00ffcc, #ffcc00)',   apply: { ...RESET, invert: 1.0 } },
            { name: 'Blood Red',      swatch: 'linear-gradient(135deg, #220000, #ff0000)',            apply: { ...RESET, colorMode: 'colorize', colorizeBlack: '#220000', colorizeWhite: '#ff0000' } },
            { name: 'Toxic / Poison', swatch: 'linear-gradient(135deg, #002200, #55ff55)',            apply: { ...RESET, colorMode: 'colorize', colorizeBlack: '#002200', colorizeWhite: '#55ff55' } },
            { name: 'Night Vision',   swatch: '#00ff00',                                              apply: { ...RESET, colorMode: 'tint', tintColor: '#00ff00', brightness: 0.1, contrast: 1.5 } },
        ],
    },
    {
        label: 'UI & Technical',
        presets: [
            { name: 'Disabled',          swatch: '#888888',                                           apply: { ...RESET, saturation: 0, brightness: -0.1 } },
            { name: 'Highlighted / Glow', swatch: 'linear-gradient(135deg, #ffffaa, #ffffff)',        apply: { ...RESET, brightness: 0.2, contrast: 1.1 } },
        ],
    },
];

interface Props {
    onApply: (updates: Partial<SceneSprite>) => void;
}

const MatrixPresetPopover: React.FC<Props> = ({ onApply }) => {
    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState({ top: 0, left: 0, maxWidth: 256 });
    const buttonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (!open) return;
        const handleMouseDown = () => setOpen(false);
        document.addEventListener('mousedown', handleMouseDown);
        return () => document.removeEventListener('mousedown', handleMouseDown);
    }, [open]);

    const handleToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!open && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const spaceAbove = rect.top;
            const popoverHeight = Math.min(400, window.innerHeight * 0.6);
            const top = spaceBelow >= popoverHeight || spaceBelow >= spaceAbove
                ? rect.bottom + 4
                : rect.top - popoverHeight - 4;
            setPos({ top, left: Math.min(rect.left, window.innerWidth - 264), maxWidth: 256 });
        }
        setOpen(v => !v);
    };

    const handlePreset = (preset: MatrixPreset, e: React.MouseEvent) => {
        e.stopPropagation();
        onApply(preset.apply);
        setOpen(false);
    };

    return (
        <>
            <button
                ref={buttonRef}
                onClick={handleToggle}
                className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded border border-indigo-300 dark:border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 whitespace-nowrap"
            >
                <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <span>Presets</span>
                <svg className="w-2.5 h-2.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {open && createPortal(
                <div
                    style={{ top: pos.top, left: pos.left, maxHeight: 400, width: pos.maxWidth }}
                    className="fixed z-[9999] overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-2xl"
                    onMouseDown={e => e.stopPropagation()}
                >
                    {PRESET_CATEGORIES.map(cat => (
                        <div key={cat.label}>
                            <div className="px-3 py-1.5 bg-gray-50 dark:bg-gray-700/80 border-b border-gray-100 dark:border-gray-700 sticky top-0">
                                <span className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                                    {cat.label}
                                </span>
                            </div>
                            {cat.presets.map(preset => (
                                <button
                                    key={preset.name}
                                    onMouseDown={e => handlePreset(preset, e)}
                                    className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                                >
                                    <span
                                        className="w-5 h-5 rounded-sm flex-shrink-0 border border-black/10 dark:border-white/10"
                                        style={{ background: preset.swatch }}
                                    />
                                    <span className="text-[11px] text-gray-700 dark:text-gray-300">{preset.name}</span>
                                </button>
                            ))}
                        </div>
                    ))}
                </div>,
                document.body
            )}
        </>
    );
};

export default MatrixPresetPopover;
