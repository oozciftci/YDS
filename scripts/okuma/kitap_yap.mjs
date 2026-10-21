// İndirilen kitapların düz metninden (scripts/okuma/metin_cikar.py → local-data/okuma/indirilen/<dizin>/metin.txt) okuma
// kitabı üretir: local-data/okuma/kitaplar/<id>.json (biçim: src/services/readingBooks.ts). Yalnızca yerel; yayına girmez.
// Kullanım: node scripts/okuma/kitap_yap.mjs
import fs from 'node:fs'
import path from 'node:path'
import { splitDialogue, splitSentences } from '../../src/services/sentenceSplit.ts'

const ROOT = path.resolve(import.meta.dirname, '..', '..')
const IN = path.join(ROOT, 'local-data', 'okuma', 'indirilen')
const OUT = path.join(ROOT, 'local-data', 'okuma', 'kitaplar')
const cfg = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'kaynaklar.json'), 'utf8'))
fs.mkdirSync(OUT, { recursive: true })

const read = (dir) =>
  fs
    .readFileSync(path.join(IN, dir, 'metin.txt'), 'utf8')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)

const clean = (p) =>
  p
    .replace(/\s+--\s+|--/g, ' — ')
    .replace(/\s+-\s+(?=[a-z])/g, '-') // "red - headed" → "red-headed"
    .replace(/\s+/g, ' ')
    .trim()

/** Paragraf → cümleler (uzun konuşma blokları önce ayrılır) */
const toParas = (p) => splitDialogue(clean(p)).map((x) => splitSentences(x))

const countWords = (chapters) =>
  chapters.reduce((n, c) => n + c.paras.reduce((m, p) => m + (Array.isArray(p) ? p.join(' ').split(/\s+/).length : 0), 0), 0)

function save(book) {
  book.chapters = book.chapters.filter((c) => c.paras.some(Array.isArray))
  book.words = countWords(book.chapters)
  fs.writeFileSync(path.join(OUT, `${book.id}.json`), JSON.stringify(book))
  const sentences = book.chapters.reduce((n, c) => n + c.paras.filter(Array.isArray).reduce((m, p) => m + p.length, 0), 0)
  console.log(`${book.id}: ${book.chapters.length} bölüm, ${book.words} kelime, ${sentences} cümle — ${book.chapters.map((c) => c.title).slice(0, 4).join(' | ')}${book.chapters.length > 4 ? ' …' : ''}`)
}

const meta = (b) => ({ id: b.id, title: b.title, author: b.author, level: b.level, levelNote: b.levelNote, source: b.source, license: b.license })

// 1) Tek dosyalık kitaplar
for (const b of cfg.kitaplar) {
  if (!fs.existsSync(path.join(IN, b.dir, 'metin.txt'))) {
    console.log(`${b.id}: metin yok, atlandı`)
    continue
  }
  let paras = read(b.dir).map((p) => p.replace(/^# /, ''))
  const chapters = []
  if (b.markRe) {
    // OCR metni: "Chapter N <başlık>" paragrafın içinde; içindekiler ve sondaki alıştırmalar atlanır
    let text = paras.join('\n\n')
    if (b.endMark) text = text.slice(0, text.lastIndexOf(b.endMark))
    const parts = text.split(new RegExp(b.markRe)).slice(1)
    parts.forEach((body, i) => {
      const title = b.titles[i] ?? `Chapter ${i + 1}`
      body = body.startsWith(title) ? body.slice(title.length) : body
      chapters.push({ title, paras: body.split(/\n\n/).map((p) => p.trim()).filter(Boolean).flatMap(toParas) })
    })
  } else if (b.single) {
    chapters.push({ title: b.single, paras: paras.flatMap(toParas) })
  } else if (b.marks) {
    // Başlıklar paragrafın içine yapışık (PDF): işaretlerden bölünür
    let text = paras.join('\n\n')
    const first = text.indexOf(b.marks[0], text.indexOf(b.marks[0]) + 1) > 0 && text.indexOf(b.marks[0]) < 400 ? text.indexOf(b.marks[0], text.indexOf(b.marks[0]) + 1) : text.indexOf(b.marks[0])
    text = text.slice(first)
    b.marks.forEach((mark, i) => {
      const s = text.indexOf(mark)
      const e = i + 1 < b.marks.length ? text.indexOf(b.marks[i + 1]) : text.length
      if (s < 0) return console.log(`  ! bulunamadı: ${mark}`)
      const body = text.slice(s + mark.length, e).replace(/^\s*[IVX]+\.\s+/, '')
      const title = mark.replace(/^ADVENTURE [IVX]+\. |^[IVX]+\. /, '').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()).replace(/ - /g, '-').replace(/'S\b/g, "'s")
      chapters.push({ title, paras: body.split(/\n\n/).flatMap((p) => p.trim()).filter(Boolean).map((p) => p.replace(/^[IVX]+\.\s+(?=[A-Z"“])/, '')).flatMap(toParas) })
    })
  } else {
    const start = new RegExp(b.startRe)
    const chap = new RegExp(b.chapterRe)
    let i = paras.findIndex((p) => start.test(p))
    for (const p of paras.slice(i)) {
      if (chap.test(p)) chapters.push({ title: p.replace(/^[IVX]+\.\s*/, '').toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase()), paras: [] })
      else chapters.at(-1)?.paras.push(...toParas(p))
    }
  }
  save({ ...meta(b), chapters })
}

// 2) Sherlock Holmes'un dönüşü: A2 ve B1 (her biri 12 öykü, öykü = bölüm; "Part" başlıkları ara başlık)
const sh = cfg.sherlockA2B1
const DROP = /People in This Story|Helpful Words|Before You Read|Background|A Note on|Simplified|Retelling|Version \d|CEFR|^The Adventure of/i
const END = /Check Your Understanding|Questions|Glossary|Discussion|Vocabulary|Word List/i
for (const level of ['A2', 'B1']) {
  const chapters = []
  for (const [key, title] of Object.entries(sh.stories)) {
    const dir = `${key}-${level.toLowerCase()}`
    if (!fs.existsSync(path.join(IN, dir, 'metin.txt'))) continue
    const raw = read(dir)
    const paras = []
    let started = false
    for (let p of raw) {
      const isHead = p.startsWith('# ') || /^(Part|PART) \d+[:.]/.test(p)
      p = p.replace(/^# /, '')
      if (isHead && /^Part \d+/i.test(p)) {
        started = true
        paras.push({ h: p.replace(/^Part (\d+)[:.]\s*/i, 'Bölüm $1 · ') })
        continue
      }
      if (isHead && END.test(p)) break
      if (!started || (isHead && DROP.test(p))) continue
      if (isHead) continue // "The End" vb.: metin sürer
      paras.push(...toParas(p))
    }
    chapters.push({ title, paras })
  }
  save({
    id: `sherlock-return-${level.toLowerCase()}`,
    title: `The Return of Sherlock Holmes (${level})`,
    author: sh.author,
    level,
    levelNote: `12 kısa öykü · CEFR ${level}`,
    source: sh.source,
    license: sh.license,
    chapters,
  })
}
