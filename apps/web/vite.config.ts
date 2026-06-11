import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // relative base so the build works on GitHub Pages subpaths and inside Capacitor
  base: './',
  server: {
    port: 5173,
  },
  build: {
    target: 'es2022',
  },
});
