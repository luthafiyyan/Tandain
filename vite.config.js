import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      injectRegister: 'script',
      manifest: {
        name: 'Tandain - Watermark Dokumen Aman & Offline',
        short_name: 'Tandain',
        description: 'Beri watermark dan sensor dokumen penting (KTP, KK, NPWP, Ijazah) 100% offline di perangkat Anda.',
        theme_color: '#059669',
        background_color: '#064e3b',
        display: 'standalone',
        orientation: 'portrait-primary',
        icons: [
          {
            src: 'icons/Tandain_Favicon.png',
            sizes: '1024x1024',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'icons/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any'
          }
        ]
      }
    })
  ],
  build: {
    target: 'esnext',
    chunkSizeWarningLimit: 2500
  }
});
