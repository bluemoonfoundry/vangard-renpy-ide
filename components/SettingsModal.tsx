
import React from 'react';
import type { Theme, IdeSettings } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: IdeSettings;
  onSettingsChange: (key: keyof IdeSettings, value: any) => void;
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
    { value: 'neon-dark', label: 'Neon Dark' },
    { value: 'ocean-dark', label: 'Ocean Dark' },
    { value: 'candy-light', label: 'Candy Light' },
    { value: 'forest-light', label: 'Forest Light' },
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
        className="bg-secondary rounded-lg shadow-2xl w-full max-w-lg m-4 flex flex-col max-h-[90vh] overflow-hidden border border-primary text-primary"
        onClick={e => e.stopPropagation()}
      >
        <header className="p-4 border-b border-primary">
          <h2 className="text-xl font-bold">Settings</h2>
        </header>
        <main className="p-6 space-y-6 overflow-y-auto">
            <div>
                <label htmlFor="theme-select" className="block text-sm font-medium text-primary mb-1">
                    Color Theme
                </label>
                <select
                    id="theme-select"
                    value={settings.theme}
                    onChange={(e) => onSettingsChange('theme', e.target.value)}
                    className="w-full mt-1 p-2 rounded bg-tertiary border border-primary focus:ring-accent focus:border-accent text-primary"
                >
                    {THEME_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                </select>
            </div>

            <div className="border-t border-primary"></div>
            <div>
                <h3 className="text-sm font-medium text-primary mb-3">Editor Appearance</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="font-family" className="block text-xs font-medium text-secondary mb-1">
                            Font Family
                        </label>
                        <input
                            id="font-family"
                            type="text"
                            value={settings.editorFontFamily}
                            onChange={(e) => onSettingsChange('editorFontFamily', e.target.value)}
                            className="w-full p-2 rounded bg-tertiary border border-primary focus:ring-accent focus:border-accent text-sm text-primary"
                            placeholder="'Consolas', 'Courier New', monospace"
                        />
                    </div>
                    <div>
                        <label htmlFor="font-size" className="block text-xs font-medium text-secondary mb-1">
                            Font Size (px)
                        </label>
                        <input
                            id="font-size"
                            type="number"
                            value={settings.editorFontSize}
                            onChange={(e) => onSettingsChange('editorFontSize', parseInt(e.target.value) || 14)}
                            className="w-full p-2 rounded bg-tertiary border border-primary focus:ring-accent focus:border-accent text-sm text-primary"
                            min={8}
                            max={72}
                        />
                    </div>
                </div>
            </div>
            
            {window.electronAPI && (
              <>
                <div className="border-t border-primary"></div>
                <div>
                    <label className="block text-sm font-medium text-primary mb-1">
                        Ren'Py Launcher Path
                    </label>
                    <div className="flex items-center space-x-2">
                         <input
                            type="text"
                            readOnly
                            value={settings.renpyPath || 'Not set'}
                            className="w-full mt-1 p-2 rounded bg-tertiary border border-primary font-mono text-xs text-secondary"
                        />
                        <button 
                            onClick={handleSelectRenpyPath}
                            className="mt-1 px-4 py-2 rounded bg-tertiary hover:bg-tertiary-hover text-sm font-bold text-primary border border-primary"
                        >
                            Change...
                        </button>
                    </div>
                    <p className="text-xs text-secondary mt-1">Select your `renpy.exe` (Windows) or `renpy.sh` (macOS/Linux) file.</p>
                </div>
              </>
            )}

            <div className="border-t border-primary"></div>
            <div className="space-y-4">
                <label className="flex items-center space-x-3 cursor-pointer">
                    <input 
                        type="checkbox" 
                        checked={settings.enableAiFeatures}
                        onChange={(e) => onSettingsChange('enableAiFeatures', e.target.checked)}
                        className="h-5 w-5 rounded focus:ring-accent" 
                        style={{ accentColor: 'var(--accent-primary)' }}
                    />
                    <span className="text-sm font-medium text-primary select-none">
                        Enable AI Features (Gemini)
                    </span>
                </label>

                {settings.enableAiFeatures && (
                    <div className="space-y-4 pl-8">
                        <div>
                            <p className="text-xs text-secondary mt-2">
                                The Gemini API key should be configured via the `API_KEY` environment variable.
                            </p>
                        </div>
                        <div>
                            <label htmlFor="model-select" className="block text-sm font-medium text-primary mb-1">
                                Default Model
                            </label>
                            <select
                                id="model-select"
                                value={settings.selectedModel}
                                onChange={(e) => onSettingsChange('selectedModel', e.target.value)}
                                className="w-full mt-1 p-2 rounded bg-tertiary border border-primary focus:ring-accent focus:border-accent text-primary"
                            >
                                {availableModels.map(model => (
                                    <option key={model} value={model}>{model}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                )}
            </div>
             <p className="text-xs text-secondary pt-4 border-t border-primary">
                    Application settings (like theme and font) are saved globally. Project settings (like AI model) are saved in `project.ide.json`.
                </p>
        </main>
        <footer className="bg-header p-4 rounded-b-lg flex justify-end items-center space-x-4 border-t border-primary">
          <button
            onClick={onClose}
            className="bg-tertiary hover:bg-tertiary-hover text-primary font-bold py-2 px-4 rounded transition duration-200 border border-primary"
          >
            Close
          </button>
        </footer>
      </div>
    </div>
  );
};

export default SettingsModal;
