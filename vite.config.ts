/**
 * @file vite.config.ts
 * @description Vite build configuration for the Vangard Ren'Py IDE.
 * Configures React plugin, environment variables, build optimization,
 * sourcemap generation, and Vitest test runner.
 */

/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'
import { resolve } from 'path'

/**
 * Vite configuration exported as a function.
 * Supports different configurations for development and production modes.
 * @param {Object} config - Vite config object
 * @param {string} config.mode - Build mode ('development' or 'production')
 * @returns {Object} Vite configuration object
 */
export default defineConfig(({ mode }) => {
  const isDevelopment = mode === 'development';
  const processWithCwd = process as NodeJS.Process;
  
  // Load environment variables from .env files
  // Third parameter '' loads all variables regardless of VITE_ prefix
  const env = loadEnv(mode, processWithCwd.cwd(), '');

  // Read package.json to inject application version
  const packageJson = JSON.parse(readFileSync(resolve('package.json'), 'utf-8'));
  
  return {
    // React plugin for JSX transformation
    plugins: [react()],
    // Use relative paths for assets (supports Electron/standalone builds)
    base: './',
    // Path alias resolution for imports
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
      },
    },
    // Global variable definitions for client-side code
    define: {
      /**
       * API key for external services (Gemini/Google GenAI)
       * Loaded from environment variables: GEMINI_API_KEY or API_KEY
       */
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY || env.API_KEY),
      /**
       * Application version from package.json
       */
      'process.env.APP_VERSION': JSON.stringify(packageJson.version),
      /**
       * Build number for tracking builds
       * Defaults to 'dev' if not specified
       */
      'process.env.BUILD_NUMBER': JSON.stringify(env.BUILD_NUMBER || 'dev'),
    },
    // Strip console.log and console.warn from production builds.
    // console.error is kept — those indicate real problems.
    ...(!isDevelopment && {
       
      oxc: {
        minify: {
          // Treat these as side-effect-free so they can be tree-shaken
          pureFunctions: ['console.log', 'console.warn'],
        },
      } as Record<string, unknown>,
    }),
    // Build optimization settings
    // TODO(bmf-vangard-renpy-ide-51mb): no manualChunks / code-splitting
    // strategy is configured here, and chunkSizeWarningLimit is left at
    // Vite's default (500kB) -- the build warns because the app's own
    // index-*.js is ~2.4MB (all tab/modal components are static imports,
    // see App.tsx and useTabContentRenderer.tsx). The other >500kB chunk,
    // editor.api-*.js, is Monaco's own core bundle and isn't something this
    // config can shrink. Once the app-side splitting lands, revisit whether
    // chunkSizeWarningLimit should be set explicitly (e.g. to just above
    // Monaco's chunk size) so the warning stays meaningful.
    build: {
      // Always generate sourcemaps for debugging (even in production)
      sourcemap: true,
      // Disable minification in development to preserve line numbers for debugging
      minify: isDevelopment ? false : 'esbuild',
      // Support for CommonJS modules in ES modules build
      commonjsOptions: {
        transformMixedEsModules: true,
      },
      // Externalize dynamic imports for optional dependencies
      rollupOptions: {
        external: ['openai', '@anthropic-ai/sdk'],
      },
    },
    // Pre-bundle optimization for frequently used dependencies
    optimizeDeps: {
      include: ['use-immer', 'immer'],
    },
    // Vitest test runner configuration
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['**/*.test.{ts,tsx}'],
      exclude: ['**/node_modules/**', '**/dist/**', '**/release/**', '**/.worktrees/**', '**/worktrees/**'],
      alias: [
        // Monaco cannot run in jsdom — redirect to a minimal stub for all tests.
        // IMPORTANT: more-specific paths must come first so they aren't swallowed
        // by the shorter `monaco-editor` prefix alias.
        { find: 'monaco-editor/esm/vs/editor/editor.api', replacement: resolve(__dirname, './src/test/mocks/monaco.ts') },
        { find: 'monaco-editor', replacement: resolve(__dirname, './src/test/mocks/monaco.ts') },
      ],
      coverage: {
        provider: 'v8',
        include: ['src/**'],
        exclude: ['**/*.test.{ts,tsx}', 'src/test/**'],
        thresholds: {
          // Global floor — prevents silent coverage regression across new files
          statements: 20,
          // Per-file minimums for risky modules
          'src/lib/ipcSecurity.js': { statements: 90 },
          'src/components/MarkdownPreviewView.tsx': { statements: 70 },
          'src/lib/storyCanvasLayout.ts': { statements: 40 },
          'src/hooks/useRenpyAnalysis.ts': { statements: 75 },
          // Canvas interaction logic — tests exist; gate against regressions
          'src/components/StoryCanvas.tsx': { statements: 22 },
          'src/components/RouteCanvas.tsx': { statements: 30 },
          'src/components/ChoiceCanvas.tsx': { statements: 39 },
          // Filesystem manager
          'src/hooks/useFileSystemManager.ts': { statements: 28 },
          // Menu constructor modal (tests added in 0yy)
          'src/components/MenuConstructorModal.tsx': { statements: 60 },
        },
      },
    },
  }
})
