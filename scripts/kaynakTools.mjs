// Kaynak kitaplar (hoca PDF'leri) ve Taktik Kitabı için yardımcı araçlar. Veri: local-data/kaynaklar/ (yalnızca yerel).
//
//   node scripts/kaynakTools.mjs ekle <kitap-id> --baslik "Kitap adı" [--yazar "Ad"] [--pdf dosya.pdf]
//       Kitabı harita.json'a kaydeder (varsa günceller); sayfa sayısını <kitap-id>/ klasöründen sayar.
//   node scripts/kaynakTools.mjs ocr-al <kitap-id> <ocr-klasörü> [--offset N]
//       OCR çıktısındaki sayfa dosyalarını (adı sayıyla biten .md'ler) <kitap-id>/sayfa-0001.md ... olarak kopyalar.
//   node scripts/kaynakTools.mjs sayfa <kitap-id> <a>[-b]
//       Sayfa metinlerini yazdırır (kural çıkarırken okumak için).
//   node scripts/kaynakTools.mjs ara <ifade> [kitap-id]
//       Sayfalarda arar; eşleşen sayfa numaralarını ve kısa bağlamı gösterir (haritalama için).
//   node scripts/kaynakTools.mjs kontrol
//       harita.json ve taktik-kitabi.json'ı denetler (geçersiz soru tipi / konu / sayfa / kaynak, tekrar eden id).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { YDS_SECTIONS } from '../src/services/ydsSections.ts'
import { GRAMMAR_TOPICS } from '../src/data/grammar.ts'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIR = path.join(ROOT, 'local-data', 'kaynaklar')
const MAP_FILE = path.join(DIR, 'harita.json')
const BOOK_FILE = path.join(DIR, 'taktik-kitabi.json')

const readJson = (f, empty) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : empty)
const writeJson = (f, data) => {
  fs.mkdirSync(path.dirname(f), { recursive: true })
  fs.writeFileSync(f, JSON.stringify(data, null, 2) + '\n')
}
const pageFile = (book, n) => path.join(DIR, book, `sayfa-${String(n).padStart(4, '0')}.md`)
const countPages = (book) =>
  fs.existsSync(path.join(DIR, book)) ? fs.readdirSync(path.join(DIR, book)).filter((f) => /^sayfa-\d{4}\.md$/.test(f)).length : 0

function opt(args, name) {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}

function fail(msg) {
  console.error('Hata: ' + msg)
  process.exit(1)
}

const [cmd, ...args] = process.argv.slice(2)

if (cmd === 'ekle') {
  const id = args[0]
  if (!id || !/^[a-z0-9-]+$/.test(id)) fail('kitap-id küçük harf, rakam ve tire olmalı')
  const title = opt(args, '--baslik') ?? fail('--baslik gerekli')
  const map = readJson(MAP_FILE, { books: [], entries: [] })
  const book = { id, title, author: opt(args, '--yazar'), pdf: opt(args, '--pdf'), pages: countPages(id) }
  map.books = [...map.books.filter((b) => b.id !== id), book]
  writeJson(MAP_FILE, map)
  console.log(`Kaydedildi: ${title} (${book.pages} sayfa)`)
} else if (cmd === 'ocr-al') {
  const [id, src] = args
  if (!id || !src) fail('kullanım: ocr-al <kitap-id> <ocr-klasörü> [--offset N]')
  const offset = Number(opt(args, '--offset') ?? 0)
  const files = fs
    .readdirSync(src)
    .map((f) => ({ f, n: Number(/(\d+)\.md$/i.exec(f)?.[1]) }))
    .filter((x) => Number.isFinite(x.n))
    .sort((a, b) => a.n - b.n)
  if (!files.length) fail('klasörde adı sayıyla biten .md dosyası yok')
  fs.mkdirSync(path.join(DIR, id), { recursive: true })
  for (const { f, n } of files) fs.copyFileSync(path.join(src, f), pageFile(id, n + offset))
  const map = readJson(MAP_FILE, { books: [], entries: [] })
  const b = map.books.find((x) => x.id === id)
  if (b) {
    b.pages = countPages(id)
    writeJson(MAP_FILE, map)
  }
  console.log(`${files.length} sayfa alındı → local-data/kaynaklar/${id}/ (toplam ${countPages(id)})`)
} else if (cmd === 'sayfa') {
  const [id, range] = args
  const [a, b] = (range ?? '').split('-').map(Number)
  if (!id || !a) fail('kullanım: sayfa <kitap-id> <a>[-b]')
  for (let n = a; n <= (b || a); n++) {
    const f = pageFile(id, n)
    console.log(`\n===== ${id} s. ${n} =====`)
    console.log(fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '(yok)')
  }
} else if (cmd === 'ara') {
  const [q, only] = args
  if (!q) fail('kullanım: ara <ifade> [kitap-id]')
  const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
  const map = readJson(MAP_FILE, { books: [], entries: [] })
  for (const book of map.books.filter((x) => !only || x.id === only)) {
    for (let n = 1; n <= book.pages; n++) {
      const f = pageFile(book.id, n)
      if (!fs.existsSync(f)) continue
      const text = fs.readFileSync(f, 'utf8')
      const m = re.exec(text)
      if (m) console.log(`${book.id} s.${n}: …${text.slice(Math.max(0, m.index - 60), m.index + 80).replace(/\s+/g, ' ')}…`)
    }
  }
} else if (cmd === 'kontrol') {
  const sections = new Set(YDS_SECTIONS.map((s) => s.key))
  const grammar = new Set(GRAMMAR_TOPICS.map((t) => t.id))
  const map = readJson(MAP_FILE, { books: [], entries: [] })
  const book = readJson(BOOK_FILE, { rules: [] })
  const books = new Map(map.books.map((b) => [b.id, b]))
  const problems = []
  for (const e of map.entries) {
    const b = books.get(e.book)
    if (!b) problems.push(`harita: bilinmeyen kitap "${e.book}" (${e.title})`)
    else if (e.from < 1 || e.to < e.from || e.to > b.pages) problems.push(`harita: sayfa aralığı geçersiz ${e.book} ${e.from}-${e.to} (${e.title})`)
    for (const s of e.sections ?? []) if (!sections.has(s)) problems.push(`harita: bilinmeyen soru tipi "${s}" (${e.title})`)
    for (const g of e.grammar ?? []) if (!grammar.has(g)) problems.push(`harita: bilinmeyen dilbilgisi konusu "${g}" (${e.title})`)
  }
  const ids = new Set()
  for (const r of book.rules) {
    if (ids.has(r.id)) problems.push(`kural: tekrar eden id ${r.id}`)
    ids.add(r.id)
    if (!r.text?.trim()) problems.push(`kural ${r.id}: metin boş`)
    if (!r.section && !r.grammar) problems.push(`kural ${r.id}: soru tipi ya da dilbilgisi konusu yok`)
    if (r.section && !sections.has(r.section)) problems.push(`kural ${r.id}: bilinmeyen soru tipi "${r.section}"`)
    if (r.grammar && !grammar.has(r.grammar)) problems.push(`kural ${r.id}: bilinmeyen dilbilgisi konusu "${r.grammar}"`)
    if (r.source) {
      const b = books.get(r.source.book)
      if (!b) problems.push(`kural ${r.id}: bilinmeyen kaynak kitap "${r.source.book}"`)
      else if (r.source.page < 1 || r.source.page > b.pages) problems.push(`kural ${r.id}: sayfa ${r.source.page} kitapta yok`)
    }
  }
  const perSection = YDS_SECTIONS.map((s) => `${s.label}: ${book.rules.filter((r) => r.section === s.key).length}`).join(', ')
  console.log(`Kitap: ${map.books.length} · harita girdisi: ${map.entries.length} · kural: ${book.rules.length}`)
  console.log(`Soru tipine göre kural: ${perSection}`)
  if (problems.length) {
    console.log(`\n${problems.length} sorun:`)
    for (const p of problems) console.log(' - ' + p)
    process.exit(1)
  }
  console.log('Sorun yok.')
} else {
  console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').filter((l) => l.startsWith('//')).join('\n'))
}
