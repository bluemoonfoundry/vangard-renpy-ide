import React, { useState, useCallback } from 'react';
import { expandHex } from '@/lib/colorPalettes';

interface ColorDropTargetProps {
    value: string;
    onChange: (hex: string) => void;
    /** Classes applied to the inner <input type="color"> */
    className?: string;
    /** Classes applied to the wrapper div. Defaults to "relative". */
    wrapperClassName?: string;
    id?: string;
}

/**
 * Wraps <input type="color"> with a drop zone that accepts color swatches
 * dragged from the Color Palette pane (MIME type: application/renpy-color).
 * Dropping a swatch sets the color immediately, exactly like picking via the
 * native color wheel.
 */
const ColorDropTarget: React.FC<ColorDropTargetProps> = ({
    value,
    onChange,
    className,
    wrapperClassName = 'relative',
    id,
}) => {
    const [dragOver, setDragOver] = useState(false);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        if (e.dataTransfer.types.includes('application/renpy-color')) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            setDragOver(true);
        }
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        // Only clear when leaving the wrapper itself, not a child element
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setDragOver(false);
        }
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const hex = e.dataTransfer.getData('application/renpy-color');
        if (hex) onChange(expandHex(hex));
    }, [onChange]);

    return (
        <div
            className={wrapperClassName}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <input
                id={id}
                type="color"
                value={value}
                onChange={e => onChange(e.target.value)}
                className={className}
            />
            {dragOver && (
                <div
                    className="absolute inset-0 rounded border-2 border-dashed border-blue-400 pointer-events-none flex items-center justify-center"
                    style={{ background: 'rgba(96,165,250,0.25)' }}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white drop-shadow" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 3a1 1 0 011 1v7h7a1 1 0 110 2h-7v7a1 1 0 11-2 0v-7H4a1 1 0 110-2h7V4a1 1 0 011-1z"/>
                    </svg>
                </div>
            )}
        </div>
    );
};

export default ColorDropTarget;
