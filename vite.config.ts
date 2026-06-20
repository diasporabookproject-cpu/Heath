import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// PWA minimale dès le P0 pour pouvoir tester l'installation sur le téléphone.
// Le travail offline/icônes soigné (cache fin, écran de démarrage) sera approfondi en P1.
// `base` : '/' en local, '/heath/' sur GitHub Pages (project pages) via BASE_PATH.
const base = process.env.BASE_PATH || '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Menu de la semaine',
        short_name: 'Menu',
        description: 'Composer ses menus de la semaine selon son programme nutritionnel.',
        theme_color: '#0f766e',
        background_color: '#f8fafc',
        display: 'standalone',
        orientation: 'portrait',
        // relatif : fonctionne à la racine (Vercel) comme sous /heath/ (GitHub Pages)
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
    }),
  ],
});
