import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isDevelopment = mode === 'development';

  return {
    plugins: [react()],
    base: './',
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
