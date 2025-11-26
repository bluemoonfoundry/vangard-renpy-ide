import React from 'react';
import type { Theme, IdeSettings } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: IdeSettings;
  onSettingsChange: (key: keyof IdeSettings, value: string | boolean) => void;
  availableModels: string[];
}

const THEME_OPTIONS: { value: Theme; label: string }[] = [
    { value: 'system', label: 'System Default' },
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'solarized-light', label: 'Solarized Light' },
    { value: 'solarized-dark', label: 'Solarized Dark' },
    { value: 'colorful', label: 'Colorful (Dark)' },
    { value: 'colorful-light', label: 'Colorful (Light)' },
];

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, onSettingsChange, availableModels }) => {
  if (!isOpen) {
    return null;
  }
  
  const handleSelectRenpyPath = async () => {
    if (window.electronAPI) {
        const path = await window.electronAPI.selectRenpy();
        if (path) {
            onSettingsChange('renpyPath', path);
        }
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-lg m-4 flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <header className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold">Settings</h2>
        </header>
        <main className="p-6 space-y-6">
            <div>
                <label htmlFor="theme-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Color Theme
                </label>
                <select
                    id="theme-select"
                    value={settings.theme}
                    onChange={(e) => onSettingsChange('theme', e.target.value)}
                    className="w-full mt-1 p-2 rounded bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 focus:ring-indigo-500 focus:border-indigo-500"
                >
                    {THEME_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                </select>
            </div>
            
            {window.electronAPI && (
              <>
                <div className="border-t border-gray-200 dark:border-gray-700"></div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Ren'Py Launcher Path
                    </label>
                    <div className="flex items-center space-x-2">
                         <input
                            type="text"
                            readOnly
                            value={settings.renpyPath || 'Not set'}
                            className="w-full mt-1 p-2 rounded bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 font-mono text-xs"
                        />
                        <button 
                            onClick={handleSelectRenpyPath}
                            className="mt-1 px-4 py-2 rounded bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-sm font-bold"
                        >
                            Change...
                        </button>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Select your `renpy.exe` or `renpy.sh` file.</p>
                </div>
              </>
            )}

            <div className="border-t border-gray-200 dark:border-gray-700"></div>
            <div className="space-y-4">
                <label className="flex items-center space-x-3 cursor-pointer">
                    <input 
                        type="checkbox" 
                        checked={settings.enableAiFeatures}
                        onChange={(e) => onSettingsChange('enableAiFeatures', e.target.checked)}
                        className="h-5 w-5 rounded focus:ring-indigo-500" 
                        style={{ accentColor: 'rgb(79 70 229)' }}
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 select-none">
                        Enable AI Features (Gemini)
                    </span>
                </label>

                {settings.enableAiFeatures && (
                    <div className="space-y-4 pl-8">
                        <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                The Gemini API key should be configured via the `API_KEY` environment variable.
                            </p>
                        </div>
                        <div>
                            <label htmlFor="model-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Default Model
                            </label>
                            <select
                                id="model-select"
                                value={settings.selectedModel}
                                onChange={(e) => onSettingsChange('selectedModel', e.target.value)}
                                className="w-full mt-1 p-2 rounded bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 focus:ring-indigo-500 focus:border-indigo-500"
                            >
                                {availableModels.map(model => (
                                    <option key={model} value={model}>{model}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                )}
            </div>
             <p className="text-xs text-gray-500 dark:text-gray-400 pt-4 border-t border-gray-200 dark:border-gray-700">
                    Application settings (like theme and Ren'Py path) are saved globally. Project settings (like AI model) are saved in `project.ide.json`.
                </p>
        </main>
        <footer className="bg-gray-50 dark:bg-gray-700 p-4 rounded-b-lg flex justify-end items-center space-x-4">
          <button
            onClick={onClose}
            className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-800 dark:text-gray-200 font-bold py-2 px-4 rounded transition duration-200"
          >
            Close
          </button>
        </footer>
      </div>
    </div>
  );
};

export default SettingsModal;