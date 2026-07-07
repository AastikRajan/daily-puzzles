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
        theme_color: '#050810',
        background_color: '#050810',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/daily-puzzles/',
        scope: '/daily-puzzles/',
        categories: ['games', 'puzzle', 'entertainment'],
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // dark-theme art must precache so the look survives offline
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}', 'art/bg.jpg', 'art/menu.jpg'],
        navigateFallback: 'index.html',
      },
    }),
  ],
  // GitHub Pages project site — served under /daily-puzzles/.
  // (For a Capacitor wrap, override with a relative base — see PORTING.md.)
  base: '/daily-puzzles/',
  server: {
    port: 5173,
  },
  build: {
    target: 'es2022',
  },
});
