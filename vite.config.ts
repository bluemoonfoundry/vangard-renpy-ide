import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isDevelopment = mode === 'development';
  
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    plugins: [react()],
    base: './',
    define: {
      // Expose API_KEY to the client-side code
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
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
