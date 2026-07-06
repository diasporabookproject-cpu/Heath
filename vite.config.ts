import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// PWA minimale dès le P0 pour pouvoir tester l'installation sur le téléphone.
// Le travail offline/icônes soigné (cache fin, écran de démarrage) sera approfondi en P1.
// `base` : '/' en local, '/heath/' sur GitHub Pages (project pages) via BASE_PATH.
// C0 (coquille Capacitor) : BUILD_TARGET=native ⇒ base RELATIVE './' (les assets sont
// servis localement par la WebView) + service worker & manifest DÉSACTIVÉS (le SW est
// l'affaire du web ; en natif il est inutile et nuisible).
const isNative = process.env.BUILD_TARGET === 'native';
const base = isNative ? './' : process.env.BASE_PATH || '/';

export default defineConfig({
  base,
  // Vite n'expose pas les variables d'environnement du shell à import.meta.env
  // (uniquement les fichiers .env). On injecte donc explicitement les clés
  // Supabase fournies par le workflow CI.
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(process.env.VITE_SUPABASE_URL || ''),
    'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
    ),
    // Cible de build (Q-c2) : détection natif/web à la COMPILATION, pas au runtime —
    // les deux dist diffèrent de toute façon. Consommé par src/lib/platform.ts.
    'import.meta.env.VITE_BUILD_TARGET': JSON.stringify(isNative ? 'native' : 'web'),
  },
  plugins: [
    react(),
    VitePWA({
      // Natif : ni SW, ni script d'enregistrement, ni manifest.webmanifest.
      disable: isNative,
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Manzil',
        short_name: 'Manzil',
        description: 'Organiser la maison et transmettre l’essentiel à ceux qui la font tourner.',
        theme_color: '#F6F5F1',
        background_color: '#F6F5F1',
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
        // Applique tout de suite la nouvelle version (évite de rester bloqué
        // sur un ancien cache après un déploiement).
        clientsClaim: true,
        skipWaiting: true,
      },
    }),
  ],
});
