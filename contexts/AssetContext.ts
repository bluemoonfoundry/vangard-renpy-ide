import { createContext, useContext } from 'react';
import type { AssetContextValue } from '../types';

export const AssetContext = createContext<AssetContextValue | null>(null);

export const useAssets = () => {
    const context = useContext(AssetContext);
    if (!context) {
        throw new Error('useAssets must be used within an AssetProvider');
    }
    return context;
};
