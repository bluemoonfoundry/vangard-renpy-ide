import React, { useState } from 'react';
import { logger } from '@/lib/logger';

interface CodeActionButtonsProps {
    code: string;
    size?: 'xs' | 'sm' | 'md';
    className?: string;
}

export default function CodeActionButtons({ code, size = 'sm', className = '' }: CodeActionButtonsProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        if (!code) return;
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            logger.error('Failed to copy to clipboard:', err);
        }
    };

    const sizeClasses: Record<NonNullable<typeof size>, string> = {
        xs: 'px-2 py-0.5 text-[10px] gap-1',
        sm: 'px-3 py-1.5 text-xs gap-1.5',
        md: 'px-4 py-2 text-sm gap-2',
    };

    const iconSizeClass: Record<NonNullable<typeof size>, string> = {
        xs: 'w-2.5 h-2.5',
        sm: 'w-3 h-3',
        md: 'w-4 h-4',
    };

    const iconClass = iconSizeClass[size];
    const btnClasses = sizeClasses[size];

    return (
        <div className={`inline-flex items-center ${className}`}>
            <button
                onClick={handleCopy}
                disabled={!code}
                className={`inline-flex items-center font-semibold rounded transition-colors
                    ${btnClasses}
                    ${copied
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
                    }
                    ${!code ? 'opacity-50 cursor-not-allowed' : ''}`}
                title="Copy code to clipboard"
            >
                {copied ? (
                    <>
                        <svg viewBox="0 0 12 12" className={iconClass} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M2 6l3 3 5-5" />
                        </svg>
                        Copied!
                    </>
                ) : (
                    <>
                        <svg viewBox="0 0 12 12" className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="4" y="1" width="7" height="8" rx="1" />
                            <path d="M1 4v7h7" />
                        </svg>
                        Copy
                    </>
                )}
            </button>
        </div>
    );
}
