/**
 * @file ColorPickerPane.tsx
 * @description Sidebar color picker pane for the Tools tab in StoryElementsPanel.
 * Fills the full height of its bounded container: the swatch grid grows to fill
 * available space and scrolls internally; the preview/info/action area is anchored
 * at the bottom and always visible.
 *
 * Tooltips use position:fixed so they are never clipped by any overflow ancestor.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { BUILT_IN_PALETTES, expandHex } from '@/lib/colorPalettes';
import type { PaletteColor, ColorPalette } from '@/lib/colorPalettes';

interface ColorPickerPaneProps {
    /** Inserts the hex code at the active editor cursor position. */
    onInsertAtCursor: (hex: string) => void;
    /** Wraps the current editor selection in {color=hex}...{/color} tags. */
    onWrapSelection: (hex: string) => void;
    /** Copies the hex code to the clipboard. */
    onCopyHex: (hex: string) => void;
    /** Optional project-scanned colors to show as the "Project Theme" palette. */
    projectColors?: PaletteColor[];
}

interface TooltipState {
    text: string;
    /** Viewport x-centre of the swatch */
    x: number;
    /** Viewport top edge of the swatch */
    y: number;
}

const ColorPickerPane: React.FC<ColorPickerPaneProps> = ({
    onInsertAtCursor,
    onWrapSelection,
    onCopyHex,
    projectColors,
}) => {
    const palettes = useMemo<ColorPalette[]>(() => {
        const list = [...BUILT_IN_PALETTES];
        if (projectColors && projectColors.length > 0) {
            list.push({ id: 'project', label: 'Project Theme', colors: projectColors });
        }
        return list;
    }, [projectColors]);

    const [activePaletteId, setActivePaletteId] = useState<string>('renpy_standard');
    const [selectedColor, setSelectedColor] = useState<PaletteColor | null>(null);
    const [tooltip, setTooltip] = useState<TooltipState | null>(null);

    const activePalette = palettes.find(p => p.id === activePaletteId) ?? palettes[0];

    const handleSwatchDoubleClick = (color: PaletteColor) => {
        setSelectedColor(color);
        onInsertAtCursor(expandHex(color.hex));
    };

    const handleSwatchEnter = useCallback((e: React.MouseEvent<HTMLButtonElement>, text: string) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setTooltip({ text, x: rect.left + rect.width / 2, y: rect.top });
    }, []);

    const handleSwatchLeave = useCallback(() => setTooltip(null), []);

    // Perceived-luminance contrast colour for the preview label
    const previewTextColor = useMemo(() => {
        if (!selectedColor) return '#ffffff';
        const hex = expandHex(selectedColor.hex).replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55 ? '#1a1a1a' : '#ffffff';
    }, [selectedColor]);

    const hex = selectedColor ? expandHex(selectedColor.hex) : null;

    return (
        // h-full + flex-col so the grid fills the parent's bounded height
        <div className="h-full flex flex-col p-3 gap-2">

            {/* ── Palette dropdown ── flex-none */}
            <div className="flex-none">
                <label className="block text-xs font-semibold text-secondary mb-1 uppercase tracking-wide">
                    Palette
                </label>
                <select
                    value={activePaletteId}
                    onChange={e => { setActivePaletteId(e.target.value); setSelectedColor(null); }}
                    className="w-full px-2 py-1.5 rounded border border-primary bg-tertiary text-primary text-sm
                               focus:outline-none focus:ring-1 focus:ring-accent"
                >
                    {palettes.map(p => (
                        <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                </select>
            </div>

            {/* ── Swatch grid ── flex-1 so it fills all remaining space */}
            <div className="flex-1 min-h-0 flex flex-col">
                <label className="flex-none block text-xs font-semibold text-secondary mb-1 uppercase tracking-wide">
                    Colors
                </label>
                {/* Outer shell provides the border; inner div scrolls */}
                <div className="flex-1 min-h-0 rounded border border-primary bg-tertiary overflow-hidden">
                    <div className="h-full overflow-y-auto overscroll-contain p-2">
                        <div
                            className="grid gap-1"
                            style={{ gridTemplateColumns: 'repeat(6, minmax(0, 1fr))' }}
                            role="listbox"
                            aria-label={`Colors in ${activePalette.label}`}
                        >
                            {activePalette.colors.map(color => {
                                const isSelected = selectedColor?.hex === color.hex;
                                const tooltipText = color.name
                                    ? `${color.name} (${expandHex(color.hex)})`
                                    : expandHex(color.hex);
                                return (
                                    <button
                                        key={color.hex + color.name}
                                        draggable
                                        role="option"
                                        aria-selected={isSelected}
                                        aria-label={tooltipText}
                                        className={`
                                            w-full aspect-square rounded transition-transform duration-100
                                            hover:scale-110 hover:z-10 relative
                                            cursor-grab active:cursor-grabbing
                                            focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1
                                            ${isSelected
                                                ? 'ring-2 ring-white ring-offset-1 ring-offset-zinc-700 scale-110 z-10'
                                                : 'ring-1 ring-black/20'
                                            }
                                        `}
                                        style={{ backgroundColor: color.hex }}
                                        onClick={() => setSelectedColor(color)}
                                        onDoubleClick={() => handleSwatchDoubleClick(color)}
                                        onMouseEnter={e => handleSwatchEnter(e, tooltipText)}
                                        onMouseLeave={handleSwatchLeave}
                                        onDragStart={e => {
                                            e.dataTransfer.setData('application/renpy-color', expandHex(color.hex));
                                            e.dataTransfer.effectAllowed = 'copy';
                                            handleSwatchLeave(); // hide tooltip while dragging
                                        }}
                                    />
                                );
                            })}
                        </div>
                    </div>
                </div>
                <p className="flex-none text-xs text-secondary mt-1">
                    Click to select · Double-click to insert · Drag to color pickers
                </p>
            </div>

            {/* ── Fixed-position tooltip ── rendered outside any overflow context */}
            {tooltip && (
                <div
                    className="pointer-events-none fixed z-[9999]
                                bg-zinc-900 text-white text-xs rounded px-2 py-1
                                whitespace-nowrap shadow-lg border border-zinc-700"
                    style={{
                        left: tooltip.x,
                        top: tooltip.y - 6,
                        transform: 'translate(-50%, -100%)',
                    }}
                    role="tooltip"
                >
                    {tooltip.text}
                    <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-zinc-900" />
                </div>
            )}

            {/* ── Preview box ── flex-none */}
            <div className="flex-none">
                <label className="block text-xs font-semibold text-secondary mb-1 uppercase tracking-wide">
                    Preview
                </label>
                <div
                    className="rounded border border-primary overflow-hidden"
                    style={{ background: '#6b7280' }}
                >
                    <div
                        className="w-full h-12 flex items-center justify-center transition-colors duration-150"
                        style={{ backgroundColor: selectedColor?.hex ?? 'transparent' }}
                    >
                        {hex ? (
                            <span
                                className="text-xs font-mono font-bold select-none pointer-events-none"
                                style={{ color: previewTextColor }}
                            >
                                {hex}
                            </span>
                        ) : (
                            <span className="text-xs text-zinc-300 italic select-none">
                                No color selected
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Info frame ── flex-none */}
            <div className="flex-none rounded border border-primary bg-tertiary px-3 py-1.5 space-y-0.5">
                <div className="flex items-center justify-between">
                    <span className="text-xs text-secondary">Hex</span>
                    <span className="text-xs font-mono text-primary">{hex ?? '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-xs text-secondary">Name</span>
                    <span className="text-xs text-primary truncate max-w-[60%] text-right">
                        {selectedColor?.name ?? '—'}
                    </span>
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-xs text-secondary">Palette</span>
                    <span className="text-xs text-primary truncate max-w-[60%] text-right">
                        {activePalette.label}
                    </span>
                </div>
            </div>

            {/* ── Action buttons ── flex-none */}
            <div className="flex-none flex flex-col gap-1.5">
                <div className="grid grid-cols-2 gap-1.5">
                    <button
                        disabled={!hex}
                        onClick={() => hex && onInsertAtCursor(hex)}
                        className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded
                                   border border-primary bg-tertiary hover:bg-secondary
                                   text-primary text-xs font-medium
                                   disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        title="Insert hex code at the cursor position in the active editor"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m-4-4l4 4 4-4" />
                        </svg>
                        Insert
                    </button>
                    <button
                        disabled={!hex}
                        onClick={() => hex && onWrapSelection(hex)}
                        className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded
                                   border border-primary bg-tertiary hover:bg-secondary
                                   text-primary text-xs font-medium
                                   disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        title="Wrap the selected text in {color=…}{/color} tags"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l-4 3 4 3M16 9l4 3-4 3M13 5l-2 14" />
                        </svg>
                        Wrap
                    </button>
                </div>
                <button
                    disabled={!hex}
                    onClick={() => hex && onCopyHex(hex)}
                    className="flex items-center justify-center gap-1.5 w-full py-1.5 px-2 rounded
                               border border-primary bg-tertiary hover:bg-secondary
                               text-secondary hover:text-primary text-xs font-medium
                               disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    title="Copy the hex code to the clipboard"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                    Copy Hex
                    {hex && <span className="font-mono text-secondary ml-0.5">{hex}</span>}
                </button>
            </div>

        </div>
    );
};

export default ColorPickerPane;
