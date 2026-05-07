/**
 * @file PluginErrorBoundary.tsx
 * @description React Error Boundary to isolate plugin errors from crashing the IDE.
 * Catches and displays errors with plugin context and provides retry functionality.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  pluginId: string;
  tabId: string;
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * PluginErrorBoundary catches React errors in plugin UI and displays a fallback UI.
 * Prevents plugin errors from crashing the entire IDE.
 */
export class PluginErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(
      `[Plugin Error] Plugin "${this.props.pluginId}" tab "${this.props.tabId}" crashed:`,
      error,
      errorInfo
    );
    this.setState({ error, errorInfo });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-full p-8 bg-red-50 dark:bg-red-950">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">
              Plugin Error
            </h2>
            <p className="text-gray-700 dark:text-gray-300 mb-2">
              Plugin <strong>{this.props.pluginId}</strong> (tab: {this.props.tabId}) encountered an error:
            </p>
            <div className="bg-white dark:bg-gray-900 p-4 rounded border border-red-300 dark:border-red-700 mb-4">
              <pre className="text-sm text-red-800 dark:text-red-200 overflow-auto">
                {this.state.error?.toString()}
              </pre>
              {this.state.errorInfo && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
                    Stack trace
                  </summary>
                  <pre className="text-xs text-gray-600 dark:text-gray-400 mt-2 overflow-auto max-h-96">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}
            </div>
            <button
              onClick={this.handleRetry}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
