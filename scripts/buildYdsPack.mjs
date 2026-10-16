// "YDS Sınav Kelimeleri" paketini üretir: çıkmış YDS metinlerinde sık geçen ama
// Oxford 3000 havuzunda olmayan kelimeler (scripts/data/yds_sinav_kelimeleri.txt).
//
// Kullanım:
//   node scripts/buildYdsPack.mjs <yds-metin.txt> [<yds-metin2.txt> ...]
// Metinler, çıkmış YDS PDF'lerinden pdftotext/OCR ile çıkarılmış düz metinlerdir; sıklık
// etiketleri bunlardan sayılır. Seviye Oxford 5000'den alınır; listede yoksa C1 kabul edilip
// 'Seviye-Tahmini' etiketi eklenir.
import fs from 'node:fs'

const SOURCE = 'scripts/data/yds_sinav_kelimeleri.txt'
const OUT = 'public/data/yds_sinav_paketi.json'
const ORDER = ['A1', 'A2', 'B1', 'B2', 'C1']
const DIFFICULTY = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5 }
const GROUP_TAGS = { A: ['Başlangıç', 'Temel-İngilizce'], B: ['Orta', 'Genel-İngilizce'], C: ['İleri'] }
const POS = { n: 'noun', v: 'verb', adj: 'adjective', adv: 'adverb', prep: 'preposition' }

const corpora = process.argv.slice(2)
if (corpora.length === 0) throw new Error('Kullanım: node scripts/buildYdsPack.mjs <yds-metin.txt> [...]')

const ox = await (
  await fetch('https://raw.githubusercontent.com/tyypgzl/Oxford-5000-words/master/full-word.json')
).json()
const levelMap = new Map()
for (const { value } of ox) {
  if (!ORDER.includes(value?.level)) continue
  const w = value.word.toLowerCase().trim()
  if (!levelMap.has(w) || ORDER.indexOf(value.level) < ORDER.indexOf(levelMap.get(w))) levelMap.set(w, value.level)
}

const text = corpora.map((p) => fs.readFileSync(p, 'utf8')).join(' ').toLowerCase().replace(/\s+/g, ' ')

// Kelimenin kendisi + çekimli halleri (s, es, ies, ed, ing, ...) sayılır
function countOf(term) {
  const t = term.toLowerCase()
  if (t.includes(' ')) return (text.match(new RegExp('\\b' + t + '\\b', 'g')) || []).length
  const stem = t.replace(/e$/, '')
  const forms = new Set([t, t + 's', t + 'es', stem + 'ed', stem + 'ing', t + 'd'])
  if (t.endsWith('y')) forms.add(t.slice(0, -1) + 'ies').add(t.slice(0, -1) + 'ied')
  let n = 0
  for (const f of forms) n += (text.match(new RegExp('\\b' + f + '\\b', 'g')) || []).length
  return n
}
const freqTag = (n) => (n >= 70 ? 'YDS-Çok-Sık' : n >= 25 ? 'YDS-Sık' : n >= 10 ? 'YDS-Ara' : null)

const words = []
for (const line of fs.readFileSync(SOURCE, 'utf8').split(/\r?\n/)) {
  if (!line.trim() || line.startsWith('#')) continue
  const [term, pos, definition, syn, sentence] = line.split('|').map((s) => s.trim())
  const known = levelMap.get(term.toLowerCase())
  const level = known || 'C1'
  const n = countOf(term)
  const tag = freqTag(n)
  words.push({
    term,
    definition,
    partOfSpeech: POS[pos] || 'noun',
    synonyms: syn ? syn.split(',').map((s) => s.trim()).filter(Boolean) : [],
    antonyms: [],
    collocations: [],
    sentences: sentence ? [{ en: sentence }] : [],
    tags: [level, ...GROUP_TAGS[level[0]], 'YDS-Sınav-Paketi', ...(known ? [] : ['Seviye-Tahmini']), ...(tag ? [tag] : [])],
    difficulty: DIFFICULTY[level],
    notes: `Çıkmış YDS metinlerinde ${n} kez geçti.`,
  })
}
words.sort((a, b) => countOf(b.term) - countOf(a.term))
fs.writeFileSync(OUT, JSON.stringify(words))
const byLevel = Object.fromEntries(ORDER.map((l) => [l, words.filter((w) => w.tags[0] === l).length]))
console.log(`${words.length} kelime yazıldı -> ${OUT}`, byLevel)
