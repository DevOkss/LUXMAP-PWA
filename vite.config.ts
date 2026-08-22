import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      includeAssets: ['favicon.svg', 'icons/luxmap.ico', 'icons/luxmap.png', 'bg.webp'],
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        // Precache the face-recognition models the scanner uses so attendance
        // face verification keeps working with no internet connection (the
        // runtime /models/ CacheFirst route alone only caches after the first
        // online load).
        additionalManifestEntries: [
          { url: 'models/tiny_face_detector_model-weights_manifest.json', revision: null },
          { url: 'models/tiny_face_detector_model.bin', revision: null },
          { url: 'models/face_landmark_68_model-weights_manifest.json', revision: null },
          { url: 'models/face_landmark_68_model.bin', revision: null },
          { url: 'models/face_recognition_model-weights_manifest.json', revision: null },
          { url: 'models/face_recognition_model.bin', revision: null },
        ],
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
      manifest: {
        name: 'LuxMap Student',
        short_name: 'LuxMap',
        description: 'Student Organization Management System',
        theme_color: '#20673A',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icons/luxmap.png', sizes: '1254x1254', type: 'image/png' },
          { src: '/icons/luxmap.png', sizes: '1254x1254', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/luxmap.ico', sizes: 'any', type: 'image/x-icon' },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 9000,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
      "/storage": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
})
