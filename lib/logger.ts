/**
 * @file logger.ts
 * @description Centralized logging utility using electron-log
 *
 * Log destinations:
 * 1. Console (development only) - Visible in terminal/DevTools
 * 2. File (always) - Persists to disk for bug reports
 * 3. Toast (critical errors) - User-facing notifications
 *
 * Log file locations:
 * - macOS: ~/Library/Logs/renide/main.log
 * - Windows: %USERPROFILE%\AppData\Roaming\renide\logs\main.log
 * - Linux: ~/.config/renide/logs/main.log
 *
 * Usage:
 *   logger.error('Failed to save', err, { showToast: true });
 *   logger.warn('Deprecated feature used');
 *   logger.info('Project loaded successfully');
 *   logger.debug('Detailed debugging info');
 */

// Import electron-log
// Note: This file is imported by both main and renderer processes
let electronLog: any;

// Dynamically import based on environment
if (typeof window === 'undefined') {
  // Main process
  electronLog = require('electron-log');

  // Configure log file
  electronLog.transports.file.level = 'info';
  electronLog.transports.file.maxSize = 5 * 1024 * 1024; // 5MB rotation
  electronLog.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}] [{level}] {text}';

  // Console only in development
  electronLog.transports.console.level = process.env.NODE_ENV === 'development' ? 'debug' : false;
} else {
  // Renderer process - use remote logging via IPC
  electronLog = {
    error: (...args: any[]) => {
      if (import.meta.env.DEV) console.error(...args);
      // Send to main process for file logging
      window.electronAPI?.log?.('error', ...args);
    },
    warn: (...args: any[]) => {
      if (import.meta.env.DEV) console.warn(...args);
      window.electronAPI?.log?.('warn', ...args);
    },
    info: (...args: any[]) => {
      if (import.meta.env.DEV) console.info(...args);
      window.electronAPI?.log?.('info', ...args);
    },
    debug: (...args: any[]) => {
      if (import.meta.env.DEV) console.debug(...args);
      window.electronAPI?.log?.('debug', ...args);
    },
  };
}

interface LogOptions {
  /** Show a user-facing toast notification */
  showToast?: boolean;
}

/**
 * Centralized logger with multiple destinations
 */
export const logger = {
  /**
   * Log an error (always visible in file, optionally shows toast)
   * @param message - Error description
   * @param error - Optional error object or data
   * @param options - Logging options
   */
  error(message: string, error?: unknown, options?: LogOptions) {
    if (error instanceof Error) {
      electronLog.error(message, error.message, error.stack);
    } else {
      electronLog.error(message, error);
    }

    // Show user-facing toast for critical errors
    if (options?.showToast && typeof window !== 'undefined') {
      window.electronAPI?.addToast?.(message, 'error');
    }
  },

  /**
   * Log a warning (visible in dev console and file)
   * @param message - Warning description
   * @param data - Optional additional data
   */
  warn(message: string, data?: unknown) {
    electronLog.warn(message, data);
  },

  /**
   * Log informational message (visible in dev console and file)
   * @param message - Info message
   * @param data - Optional additional data
   */
  info(message: string, data?: unknown) {
    electronLog.info(message, data);
  },

  /**
   * Log debug information (visible in dev console and file)
   * @param message - Debug message
   * @param data - Optional additional data
   */
  debug(message: string, data?: unknown) {
    electronLog.debug(message, data);
  },

  /**
   * Get the path to the log file (main process only)
   */
  getLogPath(): string | null {
    if (typeof window === 'undefined' && electronLog.transports?.file) {
      return electronLog.transports.file.getFile()?.path || null;
    }
    return null;
  }
};

// Export for main process to access log path
export { electronLog };
