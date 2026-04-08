import React, { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { CreateProjectOptions } from '../types';
import { useModalAccessibility } from '../hooks/useModalAccessibility';

interface NewProjectWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (projectPath: string) => void;
  sdkPath: string;
}

// SDK color swatches (10 dark + 10 light)
const DARK_COLORS = [
  '#0099cc', '#99ccff', '#66cc00', '#cccc00', '#cc6600',
  '#0066cc', '#9933ff', '#00cc99', '#cc0066', '#cc0000'
];

const LIGHT_COLORS = [
  '#003366', '#0099ff', '#336600', '#000000', '#cc6600',
  '#000066', '#660066', '#006666', '#cc0066', '#990000'
];

const RESOLUTION_PRESETS = [
  { label: '1280×720 (HD)', width: 1280, height: 720 },
  { label: '1920×1080 (Full HD)', width: 1920, height: 1080 },
  { label: '2560×1440 (2K)', width: 2560, height: 1440 },
  { label: '3840×2160 (4K)', width: 3840, height: 2160 },
  { label: 'Custom', width: 0, height: 0 }
];

const NewProjectWizardModal: React.FC<NewProjectWizardModalProps> = ({
  isOpen,
  onClose,
  onComplete,
  sdkPath
}) => {
  const [step, setStep] = useState(1);
  const [projectName, setProjectName] = useState('');
  const [projectDir, setProjectDir] = useState('');
  const [selectedResolution, setSelectedResolution] = useState(1); // Default: 1920×1080
  const [customWidth, setCustomWidth] = useState(1920);
  const [customHeight, setCustomHeight] = useState(1080);
  const [isLight, setIsLight] = useState(false);
  const [accentColor, setAccentColor] = useState('#0099cc'); // Default: first dark swatch
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { modalProps, contentRef } = useModalAccessibility({
    isOpen,
    onClose,
    titleId: 'wizard-title'
  });

  const handleBrowseDirectory = useCallback(async () => {
    if (!window.electronAPI?.showSaveDialog) return;

    const selectedPath = await window.electronAPI.showSaveDialog({
      title: 'Select Project Location',
      buttonLabel: 'Select',
      defaultPath: projectName || 'NewRenPyProject'
    });

    if (selectedPath) {
      setProjectDir(selectedPath);
    }
  }, [projectName]);

  const handleNext = useCallback(() => {
    setError(null);

    if (step === 1) {
      // Validate step 1
      if (!projectName.trim()) {
        setError('Please enter a project name');
        return;
      }
      if (!projectDir.trim()) {
        setError('Please select a project location');
        return;
      }
    }

    setStep(prev => prev + 1);
  }, [step, projectName, projectDir]);

  const handleBack = useCallback(() => {
    setError(null);
    setStep(prev => prev - 1);
  }, []);

  const handleCreate = useCallback(async () => {
    setIsCreating(true);
    setError(null);

    try {
      const width = selectedResolution === 4 ? customWidth : RESOLUTION_PRESETS[selectedResolution].width;
      const height = selectedResolution === 4 ? customHeight : RESOLUTION_PRESETS[selectedResolution].height;

      if (width <= 0 || height <= 0) {
        setError('Invalid resolution dimensions');
        setIsCreating(false);
        return;
      }

      const options: CreateProjectOptions = {
        projectDir,
        projectName,
        width,
        height,
        accentColor,
        isLight,
        sdkPath: sdkPath || undefined
      };

      if (window.electronAPI?.createProjectFromTemplate) {
        const result = await window.electronAPI.createProjectFromTemplate(options);

        if (result.success && result.path) {
          onComplete(result.path);
        } else {
          setError(result.error || 'Failed to create project');
          setIsCreating(false);
        }
      } else {
        setError('Project creation is only supported in the Electron app');
        setIsCreating(false);
      }
    } catch (err) {
      console.error('Project creation error:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      setIsCreating(false);
    }
  }, [projectDir, projectName, selectedResolution, customWidth, customHeight, accentColor, isLight, sdkPath, onComplete]);

  const handleSwatchClick = useCallback((color: string, light: boolean) => {
    setAccentColor(color);
    setIsLight(light);
  }, []);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div
        ref={contentRef}
        {...modalProps}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 id="wizard-title" className="text-2xl font-bold text-gray-900 dark:text-white">
            Create New Ren'Py Project
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            aria-label="Close dialog"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center justify-center p-4 space-x-2">
          {[1, 2, 3].map(s => (
            <div
              key={s}
              className={`h-2 w-12 rounded-full transition-colors ${
                s === step
                  ? 'bg-indigo-600'
                  : s < step
                  ? 'bg-indigo-400'
                  : 'bg-gray-300 dark:bg-gray-600'
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Step 1: Name & Location */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Project Details
                </h3>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="project-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Project Name
                    </label>
                    <input
                      id="project-name"
                      type="text"
                      value={projectName}
                      onChange={e => setProjectName(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="My Visual Novel"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label htmlFor="project-dir" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Project Location
                    </label>
                    <div className="flex space-x-2">
                      <input
                        id="project-dir"
                        type="text"
                        value={projectDir}
                        readOnly
                        className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="Select project location..."
                      />
                      <button
                        onClick={handleBrowseDirectory}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                      >
                        Browse...
                      </button>
                    </div>
                  </div>

                  {!sdkPath && (
                    <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                      <p className="text-sm text-yellow-800 dark:text-yellow-200">
                        Ren'Py SDK path not configured. Using bundled template. For the latest template, configure the SDK path in Settings.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Resolution */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Game Resolution
                </h3>
                <div className="space-y-3">
                  {RESOLUTION_PRESETS.map((preset, index) => (
                    <label
                      key={index}
                      className={`flex items-center p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedResolution === index
                          ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
                          : 'border-gray-300 dark:border-gray-600 hover:border-indigo-400'
                      }`}
                    >
                      <input
                        type="radio"
                        name="resolution"
                        checked={selectedResolution === index}
                        onChange={() => setSelectedResolution(index)}
                        className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="ml-3 text-gray-900 dark:text-white font-medium">
                        {preset.label}
                      </span>
                    </label>
                  ))}

                  {selectedResolution === 4 && (
                    <div className="ml-7 mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg space-y-3">
                      <div className="flex space-x-4">
                        <div className="flex-1">
                          <label htmlFor="custom-width" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Width
                          </label>
                          <input
                            id="custom-width"
                            type="number"
                            min="640"
                            max="7680"
                            value={customWidth}
                            onChange={e => setCustomWidth(parseInt(e.target.value) || 1920)}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                          />
                        </div>
                        <div className="flex-1">
                          <label htmlFor="custom-height" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Height
                          </label>
                          <input
                            id="custom-height"
                            type="number"
                            min="480"
                            max="4320"
                            value={customHeight}
                            onChange={e => setCustomHeight(parseInt(e.target.value) || 1080)}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Theme & Color */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Theme & Accent Color
                </h3>

                {/* Theme toggle */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Theme
                  </label>
                  <div className="flex space-x-3">
                    <button
                      onClick={() => setIsLight(false)}
                      className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${
                        !isLight
                          ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300'
                          : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      Dark Theme
                    </button>
                    <button
                      onClick={() => setIsLight(true)}
                      className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${
                        isLight
                          ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300'
                          : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      Light Theme
                    </button>
                  </div>
                </div>

                {/* Color swatches */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Quick Pick Accent Colors
                  </label>
                  <div className="space-y-4">
                    {/* Dark theme swatches */}
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Dark Theme Colors</p>
                      <div className="grid grid-cols-10 gap-2">
                        {DARK_COLORS.map(color => (
                          <button
                            key={color}
                            onClick={() => handleSwatchClick(color, false)}
                            className={`w-full aspect-square rounded-lg transition-transform hover:scale-110 ${
                              accentColor === color && !isLight ? 'ring-2 ring-indigo-600 ring-offset-2 dark:ring-offset-gray-800' : ''
                            }`}
                            style={{ backgroundColor: color }}
                            aria-label={`Select ${color} dark theme`}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Light theme swatches */}
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Light Theme Colors</p>
                      <div className="grid grid-cols-10 gap-2">
                        {LIGHT_COLORS.map(color => (
                          <button
                            key={color}
                            onClick={() => handleSwatchClick(color, true)}
                            className={`w-full aspect-square rounded-lg transition-transform hover:scale-110 ${
                              accentColor === color && isLight ? 'ring-2 ring-indigo-600 ring-offset-2 dark:ring-offset-gray-800' : ''
                            }`}
                            style={{ backgroundColor: color }}
                            aria-label={`Select ${color} light theme`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Custom color picker */}
                <div>
                  <label htmlFor="custom-color" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Or Choose Custom Color
                  </label>
                  <div className="flex items-center space-x-3">
                    <input
                      id="custom-color"
                      type="color"
                      value={accentColor}
                      onChange={e => setAccentColor(e.target.value)}
                      className="w-20 h-12 rounded-lg border border-gray-300 dark:border-gray-600 cursor-pointer"
                    />
                    <div className="flex-1">
                      <input
                        type="text"
                        value={accentColor}
                        onChange={e => setAccentColor(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono"
                        placeholder="#0099cc"
                      />
                    </div>
                  </div>
                </div>

                {/* Preview */}
                <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Preview</p>
                  <div className="flex items-center space-x-3">
                    <div
                      className="w-24 h-12 rounded-lg border border-gray-300 dark:border-gray-600"
                      style={{ backgroundColor: accentColor }}
                    />
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      <p><strong>Theme:</strong> {isLight ? 'Light' : 'Dark'}</p>
                      <p><strong>Accent:</strong> {accentColor}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={step === 1 ? onClose : handleBack}
            disabled={isCreating}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors disabled:opacity-50"
          >
            {step === 1 ? 'Cancel' : 'Back'}
          </button>

          <div className="text-sm text-gray-500 dark:text-gray-400">
            Step {step} of 3
          </div>

          {step < 3 ? (
            <button
              onClick={handleNext}
              disabled={isCreating}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleCreate}
              disabled={isCreating}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center"
            >
              {isCreating ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating...
                </>
              ) : (
                'Create Project'
              )}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default NewProjectWizardModal;
