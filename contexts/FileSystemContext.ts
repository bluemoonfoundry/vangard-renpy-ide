/**
 * @file FileSystemContext.ts
 * @description React Context for managing file system access and operations.
 * Provides centralized access to project directory, file tree, and file operations
 * (create, delete, rename, move, cut/copy/paste) across the application.
 */

import { createContext, useContext } from 'react';
import type { FileSystemContextValue } from '../types';

/**
 * React Context for file system operations.
 * @type {React.Context<FileSystemContextValue | null>}
 */
export const FileSystemContext = createContext<FileSystemContextValue | null>(null);

/**
 * Hook to access file system context.
 * @function useFileSystem
 * @returns {FileSystemContextValue} File system context value
 * @throws {Error} If used outside FileSystemProvider
 */
export const useFileSystem = () => {
    const context = useContext(FileSystemContext);
    if (!context) {
        throw new Error('useFileSystem must be used within a FileSystemProvider');
    }
    return context;
};
