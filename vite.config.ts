import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png', 'icons/*.png'],
      manifest: {
        name: "Sorsi d'Acqua - Miele",
        short_name: 'Sorsi',
        description: 'Monitora la frequenza di idratazione con un tocco',
        theme_color: '#F7F7F6',
        background_color: '#F7F7F6',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: '/apple-touch-icon.png',
            sizes: '180x180',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
});