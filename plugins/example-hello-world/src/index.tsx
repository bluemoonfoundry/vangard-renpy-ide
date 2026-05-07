/**
 * Example Hello World Plugin
 * Demonstrates basic plugin API usage including:
 * - Accessing IDE state (blocks, characters, labels, variables)
 * - Using logger API
 * - Using toast notifications
 * - Persisting settings (counter example)
 * - Rendering React UI
 */

import React, { useState } from 'react';

// Plugin factory function - this is the default export
export default function initPlugin(context: any) {
  // Log plugin initialization
  context.api.logger.info('Hello World plugin loaded!');

  // Access IDE state
  const { blocks, characters, variables, projectRootPath } = context.state;
  context.api.logger.info(`Project has ${blocks.length} blocks, ${characters.size} characters, ${variables.length} variables`);

  // Return plugin instance
  return {
    // Lifecycle hook - called when plugin is unloaded
    onDestroy: () => {
      context.api.logger.info('Hello World plugin unloading');
    },

    // UI components for each tab defined in manifest
    tabs: {
      'hello-tab': () => <HelloTab context={context} />,
    },
  };
}

// Main plugin tab component
function HelloTab({ context }: { context: any }) {
  // Access IDE state
  const { blocks, characters, variables, projectRootPath } = context.state;
  const { analysisResult } = context.state;

  // Get saved counter from settings
  const initialCounter = context.settings.get('counter', 0);
  const [counter, setCounter] = useState(initialCounter);

  // Handle counter increment
  const handleIncrement = async () => {
    const newCounter = counter + 1;
    setCounter(newCounter);
    await context.settings.set('counter', newCounter);
    context.api.toast(`Counter incremented to ${newCounter}!`, 'success');
  };

  // Handle reset
  const handleReset = async () => {
    setCounter(0);
    await context.settings.set('counter', 0);
    context.api.toast('Counter reset!', 'info');
  };

  // Test logger
  const handleTestLogger = () => {
    context.api.logger.info('This is an info message');
    context.api.logger.warn('This is a warning message');
    context.api.logger.error('This is an error message');
    context.api.toast('Check the browser console for log messages', 'info');
  };

  // Test dialog
  const handleTestDialog = async () => {
    await context.api.dialog.showMessage(
      'Hello from Plugin',
      'This is a test dialog from the Hello World plugin!'
    );
  };

  // Extract label count
  const labelCount = Object.keys(analysisResult.labels || {}).length;

  return (
    <div className="p-8 h-full overflow-auto">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2 text-gray-900 dark:text-gray-100">
          Hello World Plugin 🌍
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Example plugin demonstrating the Ren'IDE Plugin API
        </p>

        {/* Project Statistics */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
            Project Statistics
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <StatCard label="Blocks" value={blocks.length} />
            <StatCard label="Characters" value={characters.size} />
            <StatCard label="Variables" value={variables.length} />
            <StatCard label="Labels" value={labelCount} />
          </div>
          <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
            <strong>Project Path:</strong> {projectRootPath || 'No project loaded'}
          </div>
        </div>

        {/* Settings Persistence Demo */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
            Settings Persistence Demo
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            This counter value is persisted across IDE sessions:
          </p>
          <div className="flex items-center space-x-4">
            <div className="text-4xl font-bold text-indigo-600 dark:text-indigo-400">
              {counter}
            </div>
            <button
              onClick={handleIncrement}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded transition-colors"
            >
              Increment
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-gray-300 hover:bg-gray-400 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 rounded transition-colors"
            >
              Reset
            </button>
          </div>
        </div>

        {/* API Testing */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
            API Testing
          </h2>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => context.api.toast('Hello from plugin!', 'success')}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
            >
              Test Toast (Success)
            </button>
            <button
              onClick={() => context.api.toast('This is a warning', 'warning')}
              className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded transition-colors"
            >
              Test Toast (Warning)
            </button>
            <button
              onClick={() => context.api.toast('This is an error', 'error')}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
            >
              Test Toast (Error)
            </button>
            <button
              onClick={handleTestLogger}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
            >
              Test Logger
            </button>
            <button
              onClick={handleTestDialog}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors"
            >
              Test Dialog
            </button>
          </div>
        </div>

        {/* Plugin Info */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
            Plugin Information
          </h2>
          <div className="text-gray-600 dark:text-gray-400 space-y-2">
            <p><strong>Plugin ID:</strong> {context.plugin.id}</p>
            <p><strong>Version:</strong> {context.plugin.version}</p>
            <p><strong>State Access:</strong> Read-only access to all IDE state</p>
            <p><strong>APIs Available:</strong> logger, toast, dialog, settings</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper component for stat cards
function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
      <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{value}</div>
      <div className="text-sm text-gray-600 dark:text-gray-400">{label}</div>
    </div>
  );
}
