
import React, { useState, useMemo } from 'react';
import type { Block, StickyNote, PunchlistMetadata, RenpyAnalysisResult, ProjectImage, RenpyAudio, ImageMetadata, AudioMetadata } from '../types';

interface PunchlistManagerProps {
    blocks: Block[];
    stickyNotes: StickyNote[];
    analysisResult: RenpyAnalysisResult;
    projectImages: Map<string, ProjectImage>;
    imageMetadata: Map<string, ImageMetadata>;
    projectAudios: Map<string, RenpyAudio>;
    audioMetadata: Map<string, AudioMetadata>;
    punchlistMetadata: Record<string, PunchlistMetadata>;
    onUpdateMetadata: (id: string, meta: PunchlistMetadata | undefined) => void;
    onOpenBlock: (blockId: string, line: number) => void;
    onHighlightBlock: (blockId: string) => void;
}

type TaskType = 'image' | 'audio' | 'note';
type ScannerStatus = 'missing' | 'present'; 
type UserStatus = 'open' | 'completed' | 'ignored';

interface PunchlistTask {
    id: string;
    type: TaskType;
    name: string;
    description?: string;
    blockRefs: Set<string>;
    notes: string;
    tags: string[];
    assignee: string;
    scannerStatus: ScannerStatus;
    userStatus: UserStatus;
    stickyNoteId?: string;
    line?: number;
}

const PunchlistManager: React.FC<PunchlistManagerProps> = ({
    blocks,
    stickyNotes,
    analysisResult,
    projectImages,
    imageMetadata,
    projectAudios,
    audioMetadata,
    punchlistMetadata,
    onUpdateMetadata,
    onOpenBlock,
    onHighlightBlock
}) => {
    const [activeTab, setActiveTab] = useState<'active' | 'completed' | 'ignored'>('active');
    const [filterText, setFilterText] = useState('');

    // 1. Helper to generate standard tags for images/audio to compare with code
    const existingImageTags = useMemo(() => {
        const tags = new Set<string>();
        // Add defined images from code (e.g. image eileen = "...")
        analysisResult.definedImages.forEach(t => tags.add(t));
        
        // Add images from project folder
        projectImages.forEach(img => {
            const meta = imageMetadata.get(img.projectFilePath || img.filePath);
            const name = meta?.renpyName || img.fileName.split('.').slice(0, -1).join('.');
            const t = (meta?.tags || []).join(' ');
            const fullTag = `${name} ${t}`.trim().replace(/\s+/g, ' ');
            tags.add(fullTag);
            // Also add just the base name as a fallback tag
            tags.add(name); 
        });
        return tags;
    }, [analysisResult.definedImages, projectImages, imageMetadata]);

    const existingAudioPaths = useMemo(() => {
        const paths = new Set<string>();
        projectAudios.forEach(aud => {
            // Add filename
            paths.add(aud.fileName);
            // Add relative paths
            if (aud.projectFilePath) paths.add(aud.projectFilePath.replace(/\\/g, '/'));
            if (aud.filePath) paths.add(aud.filePath.replace(/\\/g, '/'));
            // Add just the name without extension for variable usage
            paths.add(aud.fileName.split('.').slice(0, -1).join('.'));
        });
        return paths;
    }, [projectAudios]);

    // 2. Scan & Merge Logic
    const tasks = useMemo(() => {
        const generatedTasks = new Map<string, PunchlistTask>();
        const currentScanIds = new Set<string>();

        // Scan Blocks for Missing Assets
        blocks.forEach(block => {
            const lines = block.content.split('\n');
            lines.forEach((line, index) => {
                // Images: show/scene
                const showMatch = line.match(/^\s*(?:show|scene)\s+([a-zA-Z0-9_ ]+)/);
                if (showMatch) {
                    const rawTag = showMatch[1].trim();
                    // Exclude keywords like 'expression', 'layer', etc if matched accidentally
                    if (!['expression', 'layer'].includes(rawTag.split(' ')[0])) {
                        // Check if tag starts with any known tag (to handle attributes)
                        let isDefined = false;
                        if (existingImageTags.has(rawTag)) isDefined = true;
                        else {
                            const parts = rawTag.split(' ');
                            for(let i=1; i<=parts.length; i++) {
                                const subTag = parts.slice(0, i).join(' ');
                                if(existingImageTags.has(subTag)) {
                                    isDefined = true;
                                    break;
                                }
                            }
                        }

                        if (!isDefined) {
                            const id = `image:${rawTag}`;
                            currentScanIds.add(id);
                            if (!generatedTasks.has(id)) {
                                const meta = punchlistMetadata[id] || {};
                                generatedTasks.set(id, {
                                    id,
                                    type: 'image',
                                    name: rawTag,
                                    description: `Missing image asset: ${rawTag}`,
                                    blockRefs: new Set([block.id]),
                                    line: index + 1,
                                    notes: meta.notes || '',
                                    tags: meta.tags || ['image'],
                                    assignee: meta.assignee || '',
                                    scannerStatus: 'missing',
                                    userStatus: meta.status || 'open'
                                });
                            } else {
                                generatedTasks.get(id)!.blockRefs.add(block.id);
                            }
                        }
                    }
                }

                // Audio: play/queue
                const audioMatch = line.match(/^\s*(?:play|queue)\s+\w+\s+(.+)/);
                if (audioMatch) {
                    const content = audioMatch[1].trim();
                    const quotedMatch = content.match(/^["']([^"']+)["']/);
                    let targetName = '';
                    let isDefined = false;

                    if (quotedMatch) {
                        targetName = quotedMatch[1];
                        for(const path of existingAudioPaths) {
                            if (path.endsWith(targetName) || targetName.endsWith(path)) {
                                isDefined = true; 
                                break;
                            }
                        }
                    } else {
                        const firstToken = content.split(/\s+/)[0];
                        if (firstToken !== 'expression') {
                            targetName = firstToken;
                            if (existingAudioPaths.has(targetName) || analysisResult.variables.has(targetName)) {
                                isDefined = true;
                            }
                        }
                    }

                    if (targetName && !isDefined) {
                        const id = `audio:${targetName}`;
                        currentScanIds.add(id);
                        if (!generatedTasks.has(id)) {
                            const meta = punchlistMetadata[id] || {};
                            generatedTasks.set(id, {
                                id,
                                type: 'audio',
                                name: targetName,
                                description: `Missing audio: ${targetName}`,
                                blockRefs: new Set([block.id]),
                                line: index + 1,
                                notes: meta.notes || '',
                                tags: meta.tags || ['audio'],
                                assignee: meta.assignee || '',
                                scannerStatus: 'missing',
                                userStatus: meta.status || 'open'
                            });
                        } else {
                            generatedTasks.get(id)!.blockRefs.add(block.id);
                        }
                    }
                }
            });
        });

        // Scan Sticky Notes
        stickyNotes.forEach(note => {
            const id = `note:${note.id}`;
            currentScanIds.add(id);
            const meta = punchlistMetadata[id] || {};
            generatedTasks.set(id, {
                id,
                type: 'note',
                name: note.content || '(Empty Note)',
                description: 'Sticky Note on Canvas',
                blockRefs: new Set(),
                stickyNoteId: note.id,
                notes: meta.notes || '',
                tags: meta.tags || ['note'],
                assignee: meta.assignee || '',
                scannerStatus: 'missing', 
                userStatus: meta.status || 'open'
            });
        });

        // Merge History (Items in metadata but not in current scan)
        Object.entries(punchlistMetadata).forEach(([id, metaData]) => {
            if (!currentScanIds.has(id)) {
                const meta = metaData as PunchlistMetadata;
                let type: TaskType = 'image';
                let name = id;
                if (id.startsWith('image:')) { name = id.substring(6); type = 'image'; }
                else if (id.startsWith('audio:')) { name = id.substring(6); type = 'audio'; }
                else if (id.startsWith('note:')) { name = '(Deleted Note)'; type = 'note'; }

                generatedTasks.set(id, {
                    id,
                    type,
                    name,
                    description: type === 'note' ? 'Original note deleted' : 'Asset found or reference removed',
                    blockRefs: new Set(),
                    notes: meta.notes || '',
                    tags: meta.tags || [type],
                    assignee: meta.assignee || '',
                    scannerStatus: 'present', 
                    userStatus: meta.status || 'open'
                });
            }
        });

        return Array.from(generatedTasks.values());
    }, [blocks, stickyNotes, existingImageTags, existingAudioPaths, punchlistMetadata, analysisResult.variables]);

    // 3. Filtering
    const filteredTasks = useMemo(() => {
        let list = tasks;
        
        if (filterText) {
            const lower = filterText.toLowerCase();
            list = list.filter(t => 
                t.name.toLowerCase().includes(lower) || 
                t.notes.toLowerCase().includes(lower) || 
                t.assignee.toLowerCase().includes(lower)
            );
        }

        switch (activeTab) {
            case 'active':
                return list.filter(t => t.userStatus === 'open');
            case 'completed':
                return list.filter(t => t.userStatus === 'completed');
            case 'ignored':
                return list.filter(t => t.userStatus === 'ignored');
        }
    }, [tasks, activeTab, filterText]);

    // 4. Counts
    const counts = useMemo(() => {
        return {
            active: tasks.filter(t => t.userStatus === 'open').length,
            completed: tasks.filter(t => t.userStatus === 'completed').length,
            ignored: tasks.filter(t => t.userStatus === 'ignored').length
        };
    }, [tasks]);

    // 5. Actions
    const handleStatusChange = (id: string, newStatus: UserStatus) => {
        const task = tasks.find(t => t.id === id);
        const currentMeta = punchlistMetadata[id] || {};
        
        onUpdateMetadata(id, {
            ...currentMeta,
            status: newStatus,
            notes: task?.notes || currentMeta.notes,
            tags: task?.tags || currentMeta.tags,
            assignee: task?.assignee || currentMeta.assignee
        });
    };

    const handleArchiveResolved = () => {
        const toArchive = tasks.filter(t => t.userStatus === 'open' && t.scannerStatus === 'present');
        toArchive.forEach(t => {
            onUpdateMetadata(t.id, undefined); 
        });
    };

    const handleClearTask = (id: string) => {
        onUpdateMetadata(id, undefined);
    };

    const StatusIcon = ({ task }: { task: PunchlistTask }) => {
        if (task.userStatus === 'completed') {
            if (task.scannerStatus === 'missing') {
                return (
                    <div title="Marked done, but still missing in code" className="text-yellow-500">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM10 13a1 1 0 110-2 1 1 0 010 2zm-1-8a1 1 0 00-1 1v3a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                    </div>
                );
            }
            return (
                <div title="Completed and Verified" className="text-green-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                </div>
            );
        }
        if (task.userStatus === 'ignored') {
            return (
                <div title="Ignored" className="text-gray-400">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                </div>
            );
        }
        
        // Active
        if (task.scannerStatus === 'present') {
            return (
                <div title="Resolved (Found in code/assets)" className="text-green-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                </div>
            );
        }
        return (
            <div title="Missing / Issue Detected" className="text-red-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
            {/* Header / Tabs */}
            <div className="flex-none border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                <div className="p-4 pb-2">
                    <h2 className="text-xl font-bold mb-2">Punchlist</h2>
                    <input 
                        type="text" 
                        placeholder="Filter tasks..." 
                        value={filterText}
                        onChange={e => setFilterText(e.target.value)}
                        className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                </div>
                <div className="flex px-2 space-x-1">
                    <button 
                        onClick={() => setActiveTab('active')}
                        className={`flex-1 py-2 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'active' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                    >
                        Active ({counts.active})
                    </button>
                    <button 
                        onClick={() => setActiveTab('completed')}
                        className={`flex-1 py-2 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'completed' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                    >
                        Done ({counts.completed})
                    </button>
                    <button 
                        onClick={() => setActiveTab('ignored')}
                        className={`flex-1 py-2 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'ignored' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                    >
                        Ignored ({counts.ignored})
                    </button>
                </div>
            </div>

            {/* Actions Bar (Active Tab Only) */}
            {activeTab === 'active' && tasks.some(t => t.userStatus === 'open' && t.scannerStatus === 'present') && (
                <div className="flex-none p-2 bg-green-50 dark:bg-green-900/20 border-b border-green-100 dark:border-green-800 flex justify-between items-center animate-pulse">
                    <span className="text-xs text-green-700 dark:text-green-300 px-2 font-medium">
                        {tasks.filter(t => t.userStatus === 'open' && t.scannerStatus === 'present').length} items resolved!
                    </span>
                    <button 
                        onClick={handleArchiveResolved}
                        className="px-3 py-1 bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-200 text-xs font-bold rounded hover:bg-green-200 dark:hover:bg-green-700 transition-colors shadow-sm"
                    >
                        Archive Resolved
                    </button>
                </div>
            )}

            {/* Task List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2 overscroll-contain">
                {filteredTasks.map(task => (
                    <div 
                        key={task.id} 
                        className={`p-3 rounded-lg border flex items-start space-x-3 transition-colors ${
                            task.scannerStatus === 'present' && task.userStatus === 'open' 
                                ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800' 
                                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                        } ${task.userStatus === 'completed' ? 'opacity-70' : ''}`}
                    >
                        {/* Checkbox / Status Toggle */}
                        <div className="pt-1 flex-shrink-0">
                            {task.userStatus === 'completed' ? (
                                <button onClick={() => handleStatusChange(task.id, 'open')} className="text-green-600 dark:text-green-400 hover:text-green-700" title="Reopen Task">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                                </button>
                            ) : (
                                <button onClick={() => handleStatusChange(task.id, 'completed')} className="text-gray-300 hover:text-green-500" title="Mark as Completed">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                </button>
                            )}
                        </div>

                        <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center space-x-1.5 overflow-hidden">
                                    <StatusIcon task={task} />
                                    <h4 className={`text-sm font-semibold truncate ${task.userStatus === 'completed' ? 'line-through text-gray-500' : ''}`}>
                                        {task.name}
                                    </h4>
                                </div>
                                <span className={`text-[10px] font-mono uppercase border px-1.5 rounded flex-shrink-0 ml-2 ${task.type === 'image' ? 'bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-300' : task.type === 'audio' ? 'bg-pink-50 text-pink-600 border-pink-200 dark:bg-pink-900/30 dark:border-pink-800 dark:text-pink-300' : 'bg-yellow-50 text-yellow-600 border-yellow-200 dark:bg-yellow-900/30 dark:border-yellow-800 dark:text-yellow-300'}`}>
                                    {task.type}
                                </span>
                            </div>
                            
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{task.description}</p>
                            
                            {/* References / Navigation */}
                            {task.blockRefs.size > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                    {Array.from(task.blockRefs).map(blockId => (
                                        <button 
                                            key={blockId}
                                            onClick={() => {
                                                if (task.stickyNoteId) onHighlightBlock(task.stickyNoteId); 
                                                else onOpenBlock(blockId, task.line || 1);
                                            }}
                                            className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors border border-gray-200 dark:border-gray-600"
                                        >
                                            Go to Ref
                                        </button>
                                    ))}
                                </div>
                            )}
                            
                            {/* Warnings */}
                            {task.userStatus === 'completed' && task.scannerStatus === 'missing' && (
                                <div className="mt-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded p-1.5 flex items-start">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-yellow-500 mr-1.5 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM10 13a1 1 0 110-2 1 1 0 010 2zm-1-8a1 1 0 00-1 1v3a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                    <p className="text-xs text-yellow-700 dark:text-yellow-300">
                                        This item is marked as completed, but the scanner still detects it as missing in the code or assets folder.
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Actions Menu */}
                        <div className="flex flex-col space-y-1">
                            {task.scannerStatus === 'present' && task.userStatus === 'open' && (
                                <button onClick={() => handleClearTask(task.id)} className="p-1 text-gray-400 hover:text-green-600 dark:hover:text-green-400" title="Archive (Clear from list)">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                </button>
                            )}
                            
                            {task.userStatus !== 'ignored' && (
                                <button onClick={() => handleStatusChange(task.id, 'ignored')} className="p-1 text-gray-400 hover:text-red-500" title="Ignore Task">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" /></svg>
                                </button>
                            )}
                            
                            {task.userStatus === 'ignored' && (
                                <button onClick={() => handleStatusChange(task.id, 'open')} className="p-1 text-gray-400 hover:text-indigo-500" title="Restore to Active">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 110 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.885-.666A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566z" clipRule="evenodd" /></svg>
                                </button>
                            )}
                        </div>
                    </div>
                ))}
                
                {filteredTasks.length === 0 && (
                    <div className="text-center py-12 text-gray-400 dark:text-gray-500">
                        <div className="flex justify-center mb-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                            </svg>
                        </div>
                        <p>No tasks found.</p>
                        {activeTab === 'active' && <p className="text-xs mt-1">Great job keeping your project clean!</p>}
                    </div>
                )}
            </div>
        </div>
    );
};

export default PunchlistManager;
