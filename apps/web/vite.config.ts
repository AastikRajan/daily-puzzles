import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Daily Logic — five puzzles a day',
        short_name: 'Daily Logic',
        description:
          'Five fresh logic puzzles every day — Sudoku, Killer Sudoku, Nonogram, Kakuro and Binairo. Same puzzles for everyone, streaks, stats and shareable results.',
        theme_color: '#eef2ff',
        background_color: '#eef2ff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        categories: ['games', 'puzzle', 'entertainment'],
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: 'index.html',
      },
    }),
  ],
  // relative base so the build works on GitHub Pages subpaths and inside Capacitor
  base: './',
  server: {
    port: 5173,
  },
  build: {
    target: 'es2022',
  },
});
