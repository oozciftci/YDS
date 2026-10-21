import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { phoneAccess, trusted } from './vite.phone.ts'
import { localBundle } from './vite.localBundle.ts'

// YDS soru çalışma verisi (local-data/yds) YALNIZCA geliştirme sunucusunda, localhost üzerinden (ya da
// `npm run telefon` ile şifreyle girilmiş telefondan; vite.phone.ts) sunulur. Üretim derlemesine (dist) ve
// GitHub'a asla girmez: apply:'serve' sadece geliştirme sunucusu.
function localExamData(): Plugin {
  const dir = path.resolve(import.meta.dirname, 'local-data/yds')
  return {
    name: 'local-exam-data',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/local-api/yds', (req, res, next) => {
        if (!trusted(req)) {
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
        if (!trusted(req)) {
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
        if (!trusted(req)) {
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
        if (!trusted(req)) {
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

// Kitaptan çalış (local-data/kitaplar): telifli kitapların sayfa görüntüleri, YALNIZCA geliştirme sunucusunda ve localhost'tan.
//   GET /local-api/kitap/                 -> kitap listesi (başlık, sayfa ve ünite sayısı)
//   GET /local-api/kitap/<kitap>          -> kitap.json (sayfa metinleri hariç)
//   GET /local-api/kitap/<kitap>/p001.webp -> sayfa görüntüsü
//   GET /local-api/kitap/<kitap>/testler   -> testler.json (görüntü tabanlı testler; varsa)
function localBooks(): Plugin {
  const dir = path.resolve(import.meta.dirname, 'local-data/kitaplar')
  const readBook = (id: string) => JSON.parse(fs.readFileSync(path.join(dir, id, 'kitap.json'), 'utf8'))
  return {
    name: 'local-books',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/local-api/kitap', (req, res, next) => {
        if (!trusted(req)) {
          res.statusCode = 403
          res.end('Yalnızca yerel erişim')
          return
        }
        const url = decodeURIComponent((req.url || '/').replace(/[?#].*$/, ''))
        const parts = url.split('/').filter(Boolean)
        if (parts.length === 0) {
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.setHeader('Cache-Control', 'no-store')
          const list = fs.existsSync(dir)
            ? fs
                .readdirSync(dir)
                .filter((id) => fs.existsSync(path.join(dir, id, 'kitap.json')))
                .map((id) => {
                  const b = readBook(id)
                  return { id, title: b.title, short: b.short, level: b.level, pageCount: b.pageCount, unitCount: b.units.length }
                })
            : []
          res.end(JSON.stringify(list))
          return
        }
        const id = parts[0]
        if (!/^[a-z0-9-]+$/.test(id) || !fs.existsSync(path.join(dir, id, 'kitap.json'))) return next()
        if (parts.length === 1) {
          const b = readBook(id)
          b.pages = b.pages.map(({ text, ...p }: { text?: string }) => (void text, p))
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.setHeader('Cache-Control', 'no-store')
          res.end(JSON.stringify(b))
          return
        }
        // Görüntü tabanlı testler (soru kutuları + cevap anahtarı)
        if (parts.length === 2 && parts[1] === 'testler') {
          const file = path.join(dir, id, 'testler.json')
          if (!fs.existsSync(file)) return next()
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.setHeader('Cache-Control', 'no-store')
          res.end(fs.readFileSync(file, 'utf8'))
          return
        }
        if (parts.length === 2 && /^p\d{3}\.webp$/.test(parts[1])) {
          const file = path.join(dir, id, parts[1])
          if (!fs.existsSync(file)) return next()
          res.setHeader('Content-Type', 'image/webp')
          // Görüntüler değişmez; tarayıcı önbelleğe alabilir
          res.setHeader('Cache-Control', 'private, max-age=86400')
          fs.createReadStream(file).pipe(res)
          return
        }
        next()
      })
    },
  }
}

// Okuma kitapları (local-data/okuma/kitaplar/<id>.json; scripts/okuma/kitap_yap.mjs üretir): ücretsiz ama yalnızca yerel
// tutulan kitaplar, YALNIZCA geliştirme sunucusunda ve localhost'tan (yayında kaynak paketinden).
//   GET /local-api/okuma-kitap/      -> [{ id, title, author, level, words, chapters, origin: 'yerel' … }]
//   GET /local-api/okuma-kitap/<id>  -> kitabın tamamı (src/services/readingBooks.ts)
function localReadingBooks(): Plugin {
  const dir = path.resolve(import.meta.dirname, 'local-data/okuma/kitaplar')
  return {
    name: 'local-reading-books',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/local-api/okuma-kitap', (req, res, next) => {
        if (!trusted(req)) {
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
                .map((f) => {
                  const { chapters, ...meta } = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
                  return { ...meta, chapters: chapters.length, origin: 'yerel' }
                })
            : []
          res.end(JSON.stringify(list))
          return
        }
        if (!/^[a-z0-9-]+$/.test(id) || !fs.existsSync(path.join(dir, id + '.json'))) return next()
        fs.createReadStream(path.join(dir, id + '.json')).pipe(res)
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
        if (!trusted(req)) {
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

// Sürüm etiketi (üst çubukta küçük): derleme zamanı (İstanbul) + kısa commit; güncellemenin gelip gelmediği anlaşılsın
function appVersion(command: string): string {
  let sha = (process.env.GITHUB_SHA || '').slice(0, 7)
  if (!sha) {
    try {
      sha = execSync('git rev-parse --short HEAD').toString().trim()
    } catch {
      sha = '?'
    }
  }
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date())
      .map((x) => [x.type, x.value]),
  )
  return command === 'serve' ? `yerel
${sha}` : `${p.day}.${p.month} ${p.hour}:${p.minute}
${sha}`
}

// GitHub Pages alt dizinde yayınlanır (/YDS/); yerelde '/' kalır.
const base = process.env.BASE_PATH || '/'

// https://vite.dev/config/
export default defineConfig(({ mode, command }) => ({
  base,
  define: { __APP_VERSION__: JSON.stringify(appVersion(command)) },
  plugins: [
    // İlk sırada: telefondan gelen isteklerin şifre kapısı (npm run telefon)
    phoneAccess(mode === 'telefon'),
    react(),
    localExamData(),
    localBooks(),
    localReadingBooks(),
    localSources(),
    localPacks(),
    localBundle(),
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
}))
