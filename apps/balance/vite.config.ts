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
        name: 'Balance! — daily stacking puzzle',
        short_name: 'Balance!',
        description:
          "Stack today's eight wobbly shapes on the seesaw without toppling. Same shapes for everyone, five tries, Wordle-style sharing.",
        theme_color: '#fdf3e3',
        background_color: '#fdf3e3',
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
  base: './',
  server: { port: 5179 },
  build: { target: 'es2022' },
});
