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
                  return { id, title: meta.title || id, kind: meta.kind || 'yds', field: meta.field, bank: meta.bank, count: (meta.questions || []).length, hasKey: (meta.questions || []).some((q: { answer?: string | null }) => q.answer) }
                })
                // Başlıktaki yıl + dönem sırasına göre (kronolojik)
                .sort((a, b) => {
                  const key = (t: string) => {
                    const year = Number(/(20\d\d)/.exec(t)?.[1] || 0)
                    const months: [RegExp, number][] = [[/mart/i, 3], [/nisan|ilkbahar/i, 4], [/yaz/i, 7], [/eylül|sonbahar/i, 9], [/ekim/i, 10], [/kasım/i, 11], [/aralık/i, 12]]
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

      // "Yeni YDS Kelimeleri" paketine eklenecek gerçek sınav cümleleri (scripts/analyzeYdsCorpus.mjs üretir)
      const examplesFile = path.resolve(import.meta.dirname, 'local-data/analiz/kelime_ornekleri.json')
      server.middlewares.use('/local-api/kelime-ornekleri', (req, res) => {
        const remote = req.socket.remoteAddress || ''
        if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote)) {
          res.statusCode = 403
          res.end('Yalnızca yerel erişim')
          return
        }
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.setHeader('Cache-Control', 'no-store')
        if (!fs.existsSync(examplesFile)) {
          res.statusCode = 404
          res.end('{}')
          return
        }
        fs.createReadStream(examplesFile).pipe(res)
      })
    },
  }
}

// Yerel kelime paketleri (local-data/paketler/<id>.json): telifli kitaplardan çıkarılan paketler, YALNIZCA geliştirme
// sunucusunda ve localhost'tan. GET /local-api/paket -> [{id, count}], GET /local-api/paket/<id> -> kelime dizisi.
function localPacks(): Plugin {
  const dir = path.resolve(import.meta.dirname, 'local-data/paketler')
  return {
    name: 'local-packs',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/local-api/paket', (req, res, next) => {
        const remote = req.socket.remoteAddress || ''
        if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote)) {
          res.statusCode = 403
          res.end('Yalnızca yerel erişim')
          return
        }
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.setHeader('Cache-Control', 'no-store')
        const id = decodeURIComponent((req.url || '/').replace(/^\//, '').replace(/[?#].*$/, ''))
        if (!id) {
          const list = fs.existsSync(dir)
            ? fs
                .readdirSync(dir)
                .filter((f) => f.endsWith('.json'))
                .map((f) => ({ id: f.replace(/\.json$/, ''), count: (JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as unknown[]).length }))
            : []
          res.end(JSON.stringify(list))
          return
        }
        if (!/^[a-z0-9-]+$/i.test(id)) return next()
        const file = path.join(dir, id + '.json')
        if (!fs.existsSync(file)) {
          res.statusCode = 404
          res.end('[]')
          return
        }
        fs.createReadStream(file).pipe(res)
      })
    },
  }
}

// Hoca kitapları ve Taktik Kitabı (local-data/kaynaklar): telifli, YALNIZCA geliştirme sunucusunda ve localhost'tan.
//   GET  /local-api/kaynak/harita              -> harita.json (kitaplar + konu -> sayfa aralıkları)
//   GET  /local-api/kaynak/taktik              -> taktik-kitabi.json (soru tipine göre kurallar)
//   PUT  /local-api/kaynak/taktik              -> taktik-kitabi.json'ı kaydeder (öncekini .bak.json olarak saklar)
//   GET  /local-api/kaynak/sayfa/<kitap>/<n>   -> <kitap>/sayfa-000n.md (OCR çıktısı)
function localSources(): Plugin {
  const dir = path.resolve(import.meta.dirname, 'local-data/kaynaklar')
  return {
    name: 'local-sources',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/local-api/kaynak', (req, res, next) => {
        const remote = req.socket.remoteAddress || ''
        if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote)) {
          res.statusCode = 403
          res.end('Yalnızca yerel erişim')
          return
        }
        res.setHeader('Cache-Control', 'no-store')
        const url = decodeURIComponent((req.url || '/').replace(/[?#].*$/, ''))
        const sendJson = (file: string, empty: unknown) => {
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          const full = path.join(dir, file)
          res.end(fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : JSON.stringify(empty))
        }

        if (req.method === 'GET' && url === '/harita') return sendJson('harita.json', { books: [], entries: [] })
        if (req.method === 'GET' && url === '/taktik') return sendJson('taktik-kitabi.json', { updatedAt: null, rules: [] })

        if (req.method === 'PUT' && url === '/taktik') {
          let body = ''
          req.on('data', (c) => (body += c))
          req.on('end', () => {
            try {
              const data = JSON.parse(body)
              if (!data || !Array.isArray(data.rules)) throw new Error('rules dizisi yok')
              fs.mkdirSync(dir, { recursive: true })
              const file = path.join(dir, 'taktik-kitabi.json')
              if (fs.existsSync(file)) fs.copyFileSync(file, path.join(dir, 'taktik-kitabi.bak.json'))
              fs.writeFileSync(file, JSON.stringify({ ...data, updatedAt: new Date().toISOString() }, null, 2))
              res.setHeader('Content-Type', 'application/json; charset=utf-8')
              res.end('{"ok":true}')
            } catch (e) {
              res.statusCode = 400
              res.end(String(e))
            }
          })
          return
        }

        const m = /^\/sayfa\/([a-z0-9-]+)\/(\d{1,4})$/i.exec(url)
        if (req.method === 'GET' && m) {
          const file = path.join(dir, m[1], `sayfa-${m[2].padStart(4, '0')}.md`)
          if (!fs.existsSync(file)) {
            res.statusCode = 404
            res.end('')
            return
          }
          res.setHeader('Content-Type', 'text/plain; charset=utf-8')
          fs.createReadStream(file).pipe(res)
          return
        }
        next()
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
    localSources(),
    localPacks(),
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
