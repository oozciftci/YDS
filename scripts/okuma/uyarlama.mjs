// Özgün uyarlamalar (kamu malı öykülerden bu projede yazılmış seviyeli kitaplar): scripts/okuma/uyarlamalar/<id>.md →
// public/data/okuma/kitap/<id>.json + dizin public/data/okuma/kitaplar.json (biçim: src/services/readingBooks.ts).
// Kullanım: node scripts/okuma/uyarlama.mjs   — sorun varsa listeler ve 1 ile çıkar.
//
// Yazım biçimi:
//   @id: a2-canterville            (üst bilgi: id, title, titleTr, author, level, levelNote, source, license, summary)
//   @gloss: ghost = hayalet        (metne özgü kelime anlamı; anahtar metinde geçtiği biçimiyle)
//   ## Chapter title | Bölüm başlığı
//   ### Ara başlık
//   English sentence. || Türkçesi.  (paragraf = art arda satırlar; boş satır yeni paragraf)
//   ? Question? || Sorunun Türkçesi
//   - yanlış şık / + doğru şık (4 şık)
//   = Neden doğru (Türkçe)
import fs from 'node:fs'
import path from 'node:path'

const SRC = path.join(import.meta.dirname, 'uyarlamalar')
const OUT = path.resolve(import.meta.dirname, '..', '..', 'public', 'data', 'okuma')
const WORD = /[A-Za-z]+(?:['’][A-Za-z]+)?/g
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1']
const problems = []
const index = []
fs.mkdirSync(path.join(OUT, 'kitap'), { recursive: true })

for (const file of fs.readdirSync(SRC).filter((f) => f.endsWith('.md')).sort()) {
  const book = { glosses: {}, chapters: [] }
  const bad = (msg) => problems.push(`${file}: ${msg}`)
  let para = null
  let q = null
  const lines = fs.readFileSync(path.join(SRC, file), 'utf8').split(/\r?\n/)
  lines.forEach((raw, ln) => {
    const line = raw.trim()
    const ch = book.chapters.at(-1)
    if (!line) return (para = null)
    let m
    if ((m = /^@gloss:\s*(.+?)\s*=\s*(.+)$/.exec(line))) book.glosses[m[1].toLowerCase()] = m[2]
    else if ((m = /^@(\w+):\s*(.*)$/.exec(line))) book[m[1]] = m[2]
    else if ((m = /^## (.+?)(?:\s*\|\s*(.+))?$/.exec(line))) {
      book.chapters.push({ title: m[1], ...(m[2] ? { titleTr: m[2] } : {}), paras: [] })
      para = null
    } else if ((m = /^### (.+)$/.exec(line))) {
      ch.paras.push({ h: m[1] })
      para = null
    } else if ((m = /^\? (.+?)\s*\|\|\s*(.+)$/.exec(line))) {
      q = { q: m[1], qt: m[2], o: [], a: -1, why: '' }
      ;(ch.qs ??= []).push(q)
    } else if ((m = /^([+-]) (.+)$/.exec(line)) && q) {
      if (m[1] === '+') q.a = q.o.length
      q.o.push(m[2])
    } else if ((m = /^= (.+)$/.exec(line)) && q) q.why = m[1]
    else if ((m = /^(.+?)\s*\|\|\s*(.+)$/.exec(line))) {
      if (!ch) return bad(`${ln + 1}. satır: bölüm başlığından önce metin`)
      if (!para) ch.paras.push((para = []))
      para.push({ en: m[1], tr: m[2] })
    } else bad(`${ln + 1}. satır anlaşılamadı: ${line.slice(0, 60)}`)
  })

  for (const k of ['id', 'title', 'titleTr', 'author', 'level', 'summary']) if (!book[k]) bad(`@${k} eksik`)
  if (!LEVELS.includes(book.level)) bad(`seviye ${book.level}`)
  const tokens = new Set()
  let words = 0
  for (const c of book.chapters)
    for (const p of c.paras)
      if (Array.isArray(p))
        for (const s of p) {
          const w = s.en.match(WORD) || []
          words += w.length
          w.forEach((x) => tokens.add(x.toLowerCase()))
        }
  for (const k of Object.keys(book.glosses)) if (!tokens.has(k)) bad(`anlamı verilen “${k}” metinde geçmiyor`)
  book.chapters.forEach((c, i) =>
    (c.qs ?? []).forEach((x, j) => {
      if (x.o.length !== 4 || x.a < 0 || !x.why) bad(`${i + 1}. bölüm ${j + 1}. soru: 4 şık, bir doğru (+) ve açıklama (=) olmalı`)
    }),
  )
  book.words = words
  book.origin = 'ozgun'
  fs.writeFileSync(path.join(OUT, 'kitap', `${book.id}.json`), JSON.stringify(book))
  const { chapters, glosses, ...meta } = book
  void glosses
  index.push({ ...meta, chapters: chapters.length })
  console.log(`${book.level} ${book.id}: ${chapters.length} bölüm, ${words} kelime, ${Object.keys(book.glosses).length} anlam, ${chapters.reduce((n, c) => n + (c.qs?.length ?? 0), 0)} soru`)
}

index.sort((a, b) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level))
fs.writeFileSync(path.join(OUT, 'kitaplar.json'), JSON.stringify(index))
if (problems.length) {
  console.log('\nSORUNLAR:\n' + problems.join('\n'))
  process.exit(1)
}
console.log(`\n${index.length} kitap → public/data/okuma/kitaplar.json. Temiz.`)
