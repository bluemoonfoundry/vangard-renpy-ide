import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isDevelopment = mode === 'development';
  
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, (process as any).cwd(), '');

  // Read package.json for version
  const packageJson = JSON.parse(readFileSync(resolve('package.json'), 'utf-8'));
  
  return {
    plugins: [react()],
    base: './',
    define: {
      // Expose API_KEY to the client-side code
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY || env.API_KEY),
      // Inject version and build info
      'process.env.APP_VERSION': JSON.stringify(packageJson.version),
      'process.env.BUILD_NUMBER': JSON.stringify(env.BUILD_NUMBER || 'dev'),
    },
    build: {
      // Always generate sourcemaps for debugging
      sourcemap: true,
      // Disable minification for debug builds to ensure line numbers match
      minify: isDevelopment ? false : 'esbuild',
      commonjsOptions: {
        transformMixedEsModules: true,
      },
    },
    optimizeDeps: {
      include: ['use-immer', 'immer'],
    }
  }
})
