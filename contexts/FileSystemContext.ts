import { createContext, useContext } from 'react';
import type { FileSystemContextValue } from '../types';

export const FileSystemContext = createContext<FileSystemContextValue | null>(null);

export const useFileSystem = () => {
    const context = useContext(FileSystemContext);
    if (!context) {
        throw new Error('useFileSystem must be used within a FileSystemProvider');
    }
    return context;
};
