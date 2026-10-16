import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import fs from 'node:fs'
import path from 'node:path'

// YDS soru çalışma verisi (local-data/yds) YALNIZCA geliştirme sunucusunda, localhost üzerinden
// sunulur. Üretim derlemesine (dist) ve GitHub'a asla girmez: apply:'serve' sadece `npm run dev`.
function localExamData(): Plugin {
  const dir = path.resolve(import.meta.dirname, 'local-data/yds')
  return {
    name: 'local-exam-data',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/local-api/yds', (req, res, next) => {
        const remote = req.socket.remoteAddress || ''
        if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote)) {
          res.statusCode = 403
          res.end('Yalnızca yerel erişim')
          return
        }
        const id = decodeURIComponent((req.url || '/').replace(/^\//, '').replace(/\?.*$/, ''))
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.setHeader('Cache-Control', 'no-store')
        if (!id) {
          const list = fs.existsSync(dir)
            ? fs
                .readdirSync(dir)
                .filter((f) => f.endsWith('.json') && !f.endsWith('.tr.json'))
                .map((f) => {
                  const id = f.replace(/\.json$/, '')
                  const meta = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
                  return { id, title: meta.title || id }
                })
                // Başlıktaki yıl + dönem sırasına göre (kronolojik)
                .sort((a, b) => {
                  const key = (t: string) => {
                    const year = Number(/(20\d\d)/.exec(t)?.[1] || 0)
                    const months: [RegExp, number][] = [[/mart/i, 3], [/nisan|ilkbahar/i, 4], [/eylül|sonbahar/i, 9], [/ekim/i, 10], [/kasım/i, 11], [/aralık/i, 12]]
                    const month = months.find(([re]) => re.test(t))?.[1] ?? 6
                    return year * 100 + month
                  }
                  return key(a.title) - key(b.title) || a.id.localeCompare(b.id)
                })
            : []
          res.end(JSON.stringify(list))
          return
        }
        if (!/^[a-z0-9-]+$/i.test(id)) return next()
        const file = path.join(dir, id + '.json')
        if (!fs.existsSync(file)) {
          res.statusCode = 404
          res.end('{}')
          return
        }
        const trFile = path.join(dir, id + '.tr.json')
        const tr = fs.existsSync(trFile) ? JSON.parse(fs.readFileSync(trFile, 'utf8')) : {}
        res.end(JSON.stringify({ exam: JSON.parse(fs.readFileSync(file, 'utf8')), tr }))
      })

      // Orijinal PDF'ler (cikmis_sorular): doğrulama için tarayıcının PDF görüntüleyicisinde açılır
      const pdfDir = path.resolve(import.meta.dirname, 'cikmis_sorular')
      server.middlewares.use('/local-api/pdf', (req, res, next) => {
        const remote = req.socket.remoteAddress || ''
        if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote)) {
          res.statusCode = 403
          res.end('Yalnızca yerel erişim')
          return
        }
        const file = decodeURIComponent((req.url || '/').replace(/^\//, '').replace(/[?#].*$/, ''))
        if (!/^[a-z0-9-]+\.pdf$/i.test(file)) return next()
        const full = path.join(pdfDir, file)
        if (!fs.existsSync(full)) {
          res.statusCode = 404
          res.end('PDF bulunamadı')
          return
        }
        const { size } = fs.statSync(full)
        res.setHeader('Content-Type', 'application/pdf')
        res.setHeader('Cache-Control', 'no-store')
        res.setHeader('Accept-Ranges', 'bytes')
        // PDF görüntüleyici büyük dosyalarda aralık isteği yapar
        const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '')
        if (range) {
          const start = range[1] ? Number(range[1]) : 0
          const end = range[2] ? Math.min(Number(range[2]), size - 1) : size - 1
          res.statusCode = 206
          res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`)
          res.setHeader('Content-Length', end - start + 1)
          fs.createReadStream(full, { start, end }).pipe(res)
        } else {
          res.setHeader('Content-Length', size)
          fs.createReadStream(full).pipe(res)
        }
      })
    },
  }
}

// GitHub Pages alt dizinde yayınlanır (/YDS/); yerelde '/' kalır.
const base = process.env.BASE_PATH || '/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [
    react(),
    localExamData(),
    VitePWA({
      // 'prompt' modunda yeni SW bekler; ne zaman devreye gireceğine biz karar veririz
      // (src/pwa/registerSW.ts). Kullanıcıya hiçbir şey sorulmaz -> sessiz güncelleme,
      // ama çalışma oturumu ortasında sayfa yenilenmez.
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        id: base,
        name: 'YDS Kelime',
        short_name: 'YDS Kelime',
        description: 'YDS kelime çalışması: aralıklı tekrar, testler ve dinleme. Çevrimdışı çalışır.',
        lang: 'tr',
        dir: 'ltr',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#131416',
        theme_color: '#131416',
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
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,webmanifest,json}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: `${base}index.html`,
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
