import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src/renderer',
  base: './',
  plugins: [react()],
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
    target: 'chrome140',
    sourcemap: true,
    chunkSizeWarningLimit: 1500,
  },
  worker: { format: 'es' },
  server: { port: 5173, strictPort: true },
});
