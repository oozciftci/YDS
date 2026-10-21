// Okuma Kütüphanesi verisini denetler: public/data/okuma/<seviye>.json (biçim: src/services/readingLibrary.ts).
// Kullanım: node scripts/qcOkuma.mjs  — sorun varsa listeler ve 1 ile çıkar.
import fs from 'node:fs'
import path from 'node:path'

const DIR = path.join(import.meta.dirname, '..', 'public', 'data', 'okuma')
const LEVELS = { A2: [80, 220], B1: [150, 320], B2: [220, 420], C1: [280, 520] }
const WORD = /[A-Za-z]+(?:['’][A-Za-z]+)?/g
const problems = []
const ids = new Set()
const bad = (id, msg) => problems.push(`${id}: ${msg}`)

for (const file of fs.readdirSync(DIR).filter((f) => f.endsWith('.json'))) {
  const data = JSON.parse(fs.readFileSync(path.join(DIR, file), 'utf8'))
  if (!LEVELS[data.level]) bad(file, `bilinmeyen seviye ${data.level}`)
  const answers = []
  for (const t of data.texts) {
    const id = t.id || '(kimliksiz)'
    if (ids.has(id)) bad(id, 'kimlik iki kez kullanılmış')
    ids.add(id)
    for (const k of ['title', 'titleTr', 'topic', 'summary']) if (!t[k]?.trim()) bad(id, `${k} boş`)
    if (!t.sentences?.length) bad(id, 'cümle yok')
    t.sentences?.forEach((s, i) => {
      if (!s.en?.trim() || !s.tr?.trim()) bad(id, `${i + 1}. cümlenin İngilizcesi ya da Türkçesi eksik`)
    })
    const tokens = new Set(t.sentences.flatMap((s) => (s.en.match(WORD) || []).map((w) => w.toLowerCase())))
    const words = t.sentences.reduce((n, s) => n + (s.en.match(WORD) || []).length, 0)
    const [min, max] = LEVELS[data.level] ?? [0, Infinity]
    if (words < min || words > max) bad(id, `${words} kelime (${data.level} için ${min}–${max})`)
    for (const [k, v] of Object.entries(t.glosses ?? {})) {
      if (k !== k.toLowerCase()) bad(id, `anlam anahtarı küçük harf olmalı: ${k}`)
      if (!tokens.has(k)) bad(id, `anlamı verilen “${k}” metinde geçmiyor`)
      if (!v.trim()) bad(id, `“${k}” anlamı boş`)
    }
    if (!t.qs || t.qs.length < 3) bad(id, 'en az 3 soru olmalı')
    t.qs?.forEach((q, i) => {
      if (!q.q?.trim() || !q.qt?.trim() || !q.why?.trim()) bad(id, `${i + 1}. soru: q / qt / why eksik`)
      if (q.o?.length !== 4) bad(id, `${i + 1}. soru: 4 şık olmalı`)
      if (new Set(q.o).size !== q.o?.length) bad(id, `${i + 1}. soru: aynı şık iki kez`)
      if (!(q.a >= 0 && q.a < (q.o?.length ?? 0))) bad(id, `${i + 1}. soru: doğru şık sırası geçersiz`)
      answers.push(q.a)
    })
    console.log(`${data.level} ${id}: ${words} kelime, ${t.sentences.length} cümle, ${Object.keys(t.glosses ?? {}).length} anlam, ${t.qs.length} soru`)
  }
  const dist = [0, 1, 2, 3].map((a) => answers.filter((x) => x === a).length)
  console.log(`${file}: doğru şık dağılımı A-D ${dist.join('/')}`)
  if (Math.max(...dist) > answers.length / 2) bad(file, 'doğru şıklar bir harfte yığılmış')
}

if (problems.length) {
  console.log('\nSORUNLAR:\n' + problems.join('\n'))
  process.exit(1)
}
console.log('\nTemiz.')
