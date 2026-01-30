import React from 'react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { category: 'General', items: [
        { keys: ['F5'], description: 'Run Project' },
        { keys: ['Ctrl', 'Shift', 'F'], description: 'Search in Files' },
        { keys: ['Ctrl', 'S'], description: 'Save All' },
        { keys: ['Ctrl', 'Z'], description: 'Undo' },
        { keys: ['Ctrl', 'Y'], description: 'Redo' },
    ]},
    { category: 'Canvas', items: [
        { keys: ['N'], description: 'Add New Block' },
        { keys: ['Delete'], description: 'Delete Selected Blocks/Groups' },
        { keys: ['Shift', 'Drag'], description: 'Pan Canvas' },
        { keys: ['Scroll'], description: 'Zoom In/Out' },
        { keys: ['Double Click'], description: 'Open Block in Editor' },
    ]},
    { category: 'Editor', items: [
        { keys: ['Ctrl', 'S'], description: 'Save File' },
        { keys: ['Ctrl', 'Click'], description: 'Go to Definition' },
    ]},
    { category: 'Explorer', items: [
        { keys: ['Double Click'], description: 'Open File' },
        { keys: ['Right Click'], description: 'Context Menu' },
    ]}
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[100]" onClick={onClose}>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl m-4 flex flex-col border border-gray-200 dark:border-gray-700" onClick={e => e.stopPropagation()}>
            <header className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Keyboard Shortcuts</h2>
                <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </header>
            <main className="p-6 overflow-y-auto max-h-[70vh]">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {shortcuts.map(section => (
                        <div key={section.category}>
                            <h3 className="text-lg font-semibold text-indigo-600 dark:text-indigo-400 mb-3">{section.category}</h3>
                            <ul className="space-y-2">
                                {section.items.map((item, idx) => (
                                    <li key={idx} className="flex justify-between items-center">
                                        <span className="text-sm text-gray-600 dark:text-gray-300">{item.description}</span>
                                        <div className="flex space-x-1">
                                            {item.keys.map((k, i) => (
                                                <kbd key={i} className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-md dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600 shadow-sm min-w-[1.5rem] text-center">{k}</kbd>
                                            ))}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            </main>
            <footer className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-b-lg border-t border-gray-200 dark:border-gray-700 text-right">
                <button onClick={onClose} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded transition-colors">
                    Close
                </button>
            </footer>
        </div>
    </div>
  );
};

export default KeyboardShortcutsModal;