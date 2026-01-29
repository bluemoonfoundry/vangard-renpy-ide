/**
 * @file AssetContext.ts
 * @description React Context for managing image and audio assets.
 * Provides centralized access to project images, audio files, metadata,
 * and operations for managing assets (scanning, copying, organizing).
 */

import { createContext, useContext } from 'react';
import type { AssetContextValue } from '../types';

/**
 * React Context for asset management.
 * @type {React.Context<AssetContextValue | null>}
 */
export const AssetContext = createContext<AssetContextValue | null>(null);

/**
 * Hook to access asset context.
 * @function useAssets
 * @returns {AssetContextValue} Asset context value
 * @throws {Error} If used outside AssetProvider
 */
export const useAssets = () => {
    const context = useContext(AssetContext);
    if (!context) {
        throw new Error('useAssets must be used within an AssetProvider');
    }
    return context;
};
