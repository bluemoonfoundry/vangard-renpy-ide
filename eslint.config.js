import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  // Base JS recommended rules
  js.configs.recommended,

  // TypeScript recommended rules
  ...tseslint.configs.recommended,

  // Renderer / React source (TypeScript)
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      // React hooks correctness (stable rules only; v7 compiler rules omitted
      // as this project does not use the React Compiler)
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // TypeScript: relax rules that are too noisy for an existing codebase
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/ban-ts-comment': 'warn',

      // Allow empty catch blocks (common in Electron IPC handlers)
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },

  // Electron main process & Node.js scripts — provide Node globals
  {
    files: ['electron.js', 'preload.js', 'version.js', 'vite.config.ts'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        Buffer: 'readonly',
      },
    },
    rules: {
      // Node scripts use require/process freely
      'no-undef': 'off',
      // preload.js uses CommonJS require() — that's intentional
      '@typescript-eslint/no-require-imports': 'off',
    },
  },

  // Ignore generated/third-party directories
  {
    ignores: [
      'dist/**',
      'release/**',
      'coverage/**',
      'node_modules/**',
      'DemoProject/**',
    ],
  },
);
