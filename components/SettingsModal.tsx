import React from 'react';
import type { Theme } from '../types';

interface Settings {
  theme: Theme;
  apiKey?: string;
  enableAiFeatures: boolean;
  selectedModel: string;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: Settings;
  onSettingsChange: (key: keyof Settings, value: string | boolean) => void;
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
                            <label htmlFor="api-key-input" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Gemini API Key
                            </label>
                            <input
                                id="api-key-input"
                                type="password"
                                value={settings.apiKey || ''}
                                onChange={(e) => onSettingsChange('apiKey', e.target.value)}
                                placeholder="Enter your API key"
                                className="w-full mt-1 p-2 rounded bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 focus:ring-indigo-500 focus:border-indigo-500"
                            />
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                Your API key is stored locally in your browser or in `project.ide.json` and is never sent to any other servers.
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
                    Settings are saved automatically between sessions.
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