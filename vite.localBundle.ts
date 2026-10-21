import type { Plugin } from 'vite'
import fs from 'node:fs'
import type { AddressInfo } from 'node:net'
import path from 'node:path'
import { trusted } from './vite.phone.ts'

// Kaynak paketi (.ydsk): telifli yerel içeriği tek dosyada toplar; yayın sürümündeki uygulama (GitHub Pages) bu dosyayı
// cihaza yükler ve bilgisayar olmadan açar (src/services/localContent.ts). Dosya yalnızca istenince üretilir, diske yazılmaz.
//   GET /local-api/kaynak-paketi/parcalar             -> [{ id, title, bytes }]
//   GET /local-api/kaynak-paketi?parcalar=sorular,…   -> .ydsk indirme
// Her kayıt, sunucunun /local-api yanıtının aynısıdır (sunucu kendine sorar), böylece iki taraf aynı biçimi görür.

const ROOT = path.resolve(import.meta.dirname, 'local-data')

interface Part {
  id: string
  title: string
  files: string[] // boyut hesabı için diskteki dosyalar
  paths: () => string[] // pakete girecek /local-api yolları
}

const ls = (dir: string) => (fs.existsSync(dir) ? fs.readdirSync(dir) : [])

function parts(): Part[] {
  const yds = path.join(ROOT, 'yds')
  const examIds = ls(yds)
    .filter((f) => f.endsWith('.json') && !f.endsWith('.tr.json'))
    .map((f) => f.replace(/\.json$/, ''))
  const examples = path.join(ROOT, 'analiz/kelime_ornekleri.json')
  const packs = path.join(ROOT, 'paketler')
  const packIds = ls(packs)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''))
  const src = path.join(ROOT, 'kaynaklar')
  const srcBooks = ls(src).filter((d) => fs.statSync(path.join(src, d)).isDirectory())
  const books = path.join(ROOT, 'kitaplar')

  const out: Part[] = [
    {
      id: 'sorular',
      title: 'Çıkmış sınavlar ve soru bankaları',
      files: [...ls(yds).filter((f) => f.endsWith('.json')).map((f) => path.join(yds, f)), examples],
      paths: () => ['yds/', ...examIds.map((id) => `yds/${id}`), 'kelime-ornekleri'],
    },
    {
      id: 'paketler',
      title: 'Yerel kelime paketleri',
      files: packIds.map((id) => path.join(packs, `${id}.json`)),
      paths: () => ['paket', ...packIds.map((id) => `paket/${id}`)],
    },
    {
      id: 'kaynaklar',
      title: 'Kaynak metinleri (Sınav Stratejileri 1-2, Taktik Kitabı)',
      files: [path.join(src, 'harita.json'), path.join(src, 'taktik-kitabi.json'), ...srcBooks.flatMap((b) => ls(path.join(src, b)).map((f) => path.join(src, b, f)))],
      paths: () => [
        'kaynak/harita',
        'kaynak/taktik',
        ...srcBooks.flatMap((b) =>
          ls(path.join(src, b))
            .map((f) => /^sayfa-(\d+)\.md$/.exec(f)?.[1])
            .filter((n): n is string => !!n)
            .map((n) => `kaynak/sayfa/${b}/${Number(n)}`),
        ),
      ],
    },
  ]
  for (const id of ls(books).filter((d) => fs.existsSync(path.join(books, d, 'kitap.json')))) {
    const dir = path.join(books, id)
    const meta = JSON.parse(fs.readFileSync(path.join(dir, 'kitap.json'), 'utf8')) as { title: string }
    const images = ls(dir).filter((f) => /^p\d{3}\.webp$/.test(f))
    out.push({
      id: `kitap:${id}`,
      title: meta.title,
      files: [path.join(dir, 'kitap.json'), path.join(dir, 'testler.json'), ...images.map((f) => path.join(dir, f))],
      paths: () => ['kitap/', `kitap/${id}`, `kitap/${id}/testler`, ...images.map((f) => `kitap/${id}/${f}`)],
    })
  }
  return out
}

const sizeOf = (files: string[]) => files.reduce((n, f) => n + (fs.existsSync(f) ? fs.statSync(f).size : 0), 0)

export function localBundle(): Plugin {
  return {
    name: 'local-bundle',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/local-api/kaynak-paketi', async (req, res) => {
        if (!trusted(req)) {
          res.statusCode = 403
          return res.end('Yalnızca yerel erişim')
        }
        const url = new URL(req.url || '/', 'http://x')
        const all = parts()
        if (url.pathname === '/parcalar') {
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.setHeader('Cache-Control', 'no-store')
          return res.end(JSON.stringify(all.map((p) => ({ id: p.id, title: p.title, bytes: sizeOf(p.files) }))))
        }
        const want = new Set((url.searchParams.get('parcalar') || '').split(',').filter(Boolean))
        const chosen = all.filter((p) => want.has(p.id))
        if (!chosen.length) {
          res.statusCode = 400
          return res.end('Parça seçilmedi')
        }

        const port = (server.httpServer?.address() as AddressInfo | null)?.port ?? server.config.server.port
        const date = new Date().toISOString().slice(0, 10)
        res.setHeader('Content-Type', 'application/octet-stream')
        res.setHeader('Content-Disposition', `attachment; filename="yds-kaynaklar-${date}.ydsk"`)
        res.setHeader('Cache-Control', 'no-store')
        const write = (chunk: string | Buffer) => new Promise<void>((ok) => (res.write(chunk) ? ok() : res.once('drain', () => ok())))
        await write('YDSK1\n')
        await write(JSON.stringify({ manifest: { parts: chosen.map(({ id, title }) => ({ id, title })), createdAt: new Date().toISOString() } }) + '\n')
        let count = 0
        try {
          for (const part of chosen) {
            const bookId = part.id.startsWith('kitap:') ? part.id.slice(6) : null
            for (const p of part.paths()) {
              const r = await fetch(`http://localhost:${port}/local-api/${p}`)
              if (!r.ok) continue
              let data = Buffer.from(await r.arrayBuffer())
              // Kitap listesi yalnızca bu pakettekileri içersin (cihazda paketler birleştirilir)
              if (p === 'kitap/' && bookId) data = Buffer.from(JSON.stringify((JSON.parse(data.toString('utf8')) as { id: string }[]).filter((b) => b.id === bookId)))
              const type = (r.headers.get('content-type') || '').split(';')[0]
              await write(JSON.stringify({ p, t: type, n: data.length }) + '\n')
              await write(data)
              count++
            }
          }
          await write(JSON.stringify({ end: true, count }) + '\n')
        } catch (e) {
          server.config.logger.error(`Kaynak paketi yarıda kaldı: ${String(e)}`)
        }
        res.end()
      })
    },
  }
}
