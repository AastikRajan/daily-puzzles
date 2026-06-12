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
        name: 'Daily Word — three word puzzles a day',
        short_name: 'Daily Word',
        description:
          'Three fresh word puzzles every day — Guess, Anagrams, Word Hunt. Same puzzles for everyone, streaks, stats and shareable results.',
        theme_color: '#fdf4ff',
        background_color: '#fdf4ff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        categories: ['games', 'puzzle', 'entertainment', 'word'],
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
  base: './',
  server: {
    port: 5174,
  },
  preview: {
    port: 4174,
  },
  build: {
    target: 'es2022',
  },
});
