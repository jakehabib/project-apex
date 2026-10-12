import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// `vite build --mode web` produces the browser build (dist-web/): a static site with no
// desktop shell, served from any static host. The renderer already degrades gracefully
// when the privileged desktop API is absent (no saves, no system checks).
export default defineConfig(({ mode }) => ({
  root: 'src/renderer',
  base: './',
  plugins: [react()],
  build: {
    outDir: mode === 'web' ? '../../dist-web' : '../../dist',
    emptyOutDir: true,
    target: mode === 'web' ? 'es2022' : 'chrome140',
    sourcemap: mode !== 'web',
    chunkSizeWarningLimit: 1500,
  },
  worker: { format: 'es' },
  server: { port: 5173, strictPort: true },
}));
