import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 'prompt' modunda yeni SW bekler; ne zaman devreye gireceğine biz karar veririz
      // (src/pwa/registerSW.ts). Kullanıcıya hiçbir şey sorulmaz -> sessiz güncelleme,
      // ama çalışma oturumu ortasında sayfa yenilenmez.
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        id: '/',
        name: 'YDS Kelime',
        short_name: 'YDS Kelime',
        description: 'YDS kelime çalışması: aralıklı tekrar, testler ve dinleme. Çevrimdışı çalışır.',
        lang: 'tr',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0d1020',
        theme_color: '#0d1020',
        categories: ['education', 'productivity'],
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Uygulama kabuğunun tamamı önbelleğe alınır -> internet yokken açılır.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,webmanifest}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        // Backend (Supabase vb.) istekleri asla SW önbelleğine alınmaz;
        // çevrimdışı veri IndexedDB'de tutulacak.
        runtimeCaching: [],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
})
