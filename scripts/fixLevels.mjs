// Kelime havuzunun CEFR seviyelerini düzeltir ve YDS sıklığı etiketi ekler.
//
// Kullanım:
//   node scripts/fixLevels.mjs <yds-metin.txt> [rapor.json]
// <yds-metin.txt>: çıkmış YDS PDF'inden `pdftotext -layout` ile çıkarılmış düz metin.
//
// Seviye kuralı: Oxford 5000'de bir kelimenin birden çok anlamı farklı seviyede olabilir
// (örn. "arm": A1 = kol, C1 = silahlandırmak). Öğrencinin ilk karşılaşacağı en düşük
// seviye alınır. Listede olmayan türemiş kelimeler (alarmed, cookie, eighth ...) kök
// kelimenin seviyesinden türetilir ve 'Seviye-Tahmini' etiketi alır.
import fs from 'node:fs'

const POOL = 'public/data/oxford3000_tr.json'
const META = 'public/data/packs_meta.json'
const ORDER = ['A1', 'A2', 'B1', 'B2', 'C1']
const DIFFICULTY = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5 }
const LEVEL_TAGS = new Set([
  'A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'Başlangıç', 'Temel-İngilizce', 'Orta', 'Genel-İngilizce',
  'İleri', 'YDS-Akademik', 'Seviye-Tahmini', 'YDS-Çok-Sık', 'YDS-Sık', 'YDS-Ara',
])
const STOP = new Set(
  `the an and or of to in is are was were be been being it its that this these those for on with as by at from
  not have has had will would can could may might shall should do does did which who whom whose what when where why how
  their there they them he she his her him we you your our us me my but if than then so such also into out up
  about over after before more most other some any all each both no nor only own same too very just`.split(/\s+/),
)

const corpusPath = process.argv[2]
if (!corpusPath) throw new Error('Kullanım: node scripts/fixLevels.mjs <yds-metin.txt> [rapor.json]')

const pool = JSON.parse(fs.readFileSync(POOL, 'utf8'))
const ox = await (
  await fetch('https://raw.githubusercontent.com/tyypgzl/Oxford-5000-words/master/full-word.json')
).json()

// ---- 1. Seviye haritası: en düşük anlam seviyesi ----
const levelMap = new Map()
for (const { value } of ox) {
  const lvl = value?.level
  if (!ORDER.includes(lvl)) continue
  const w = value.word.toLowerCase().trim()
  if (!levelMap.has(w) || ORDER.indexOf(lvl) < ORDER.indexOf(levelMap.get(w))) levelMap.set(w, lvl)
}

const higher = (a, b) => (ORDER.indexOf(a) >= ORDER.indexOf(b) ? a : b)

function spellingVariants(t) {
  const v = [t]
  v.push(t.replace(/or\b/, 'our'), t.replace(/our\b/, 'or'), t.replace(/er\b/, 're'), t.replace(/re\b/, 'er'))
  v.push(t.replace(/ize\b/, 'ise'), t.replace(/ise\b/, 'ize'), t.replace(/ization\b/, 'isation'))
  v.push(t.replace(/ll(ed|ing)\b/, 'l$1'), t.replace(/ck\b/, 'k'))
  return [...new Set(v)]
}
const US_UK = { elevator: 'lift', drugstore: 'chemist', cookie: 'biscuit', favorite: 'favourite', gray: 'grey' }

function baseCandidates(t) {
  const c = []
  const strip = (suf, rep = '') => {
    if (t.endsWith(suf) && t.length > suf.length + 2) c.push(t.slice(0, -suf.length) + rep)
  }
  strip('ily', 'y'); strip('ly'); strip('ally'); strip('ically', 'ic')
  strip('ied', 'y'); strip('ed'); strip('ed', 'e'); strip('ing'); strip('ing', 'e')
  strip('ies', 'y'); strip('es'); strip('s'); strip('est')
  if (/(.)\1(ed|ing|est)$/.test(t)) c.push(t.replace(/(.)\1(ed|ing|est)$/, '$1'))
  return c
}

// Sözcük türetme (drawer, movement, unhappy ...): anlam kökten farklı ve genelde daha zordur
function derivationCandidates(t) {
  const c = []
  const strip = (suf, rep = '') => {
    if (t.endsWith(suf) && t.length > suf.length + 2) c.push(t.slice(0, -suf.length) + rep)
  }
  strip('er'); strip('er', 'e'); strip('ation', 'e'); strip('ation'); strip('ment'); strip('ness'); strip('ful')
  strip('less'); strip('ive'); strip('al'); strip('ous'); strip('able'); strip('ity'); strip('ism'); strip('ist')
  if (/(.)\1er$/.test(t)) c.push(t.replace(/(.)\1er$/, '$1'))
  for (const p of ['un', 'dis', 'in', 'im', 'ir', 'non', 'over', 'under', 'out', 're', 'mis']) {
    if (t.startsWith(p) && t.length > p.length + 2) c.push(t.slice(p.length))
  }
  return c
}

function resolve(term) {
  const t = term.toLowerCase().trim()
  if (levelMap.has(t)) return { level: levelMap.get(t), estimated: false }
  if (US_UK[t] && levelMap.has(US_UK[t])) return { level: levelMap.get(US_UK[t]), estimated: false }
  for (const v of spellingVariants(t)) if (levelMap.has(v)) return { level: levelMap.get(v), estimated: false }
  if (/^(first|second|third|\w+th|\w+ieth)$/.test(t)) return { level: 'A2', estimated: true }
  if (t.includes(' ')) {
    const words = t.split(/\s+/)
    const head = words.find((w) => levelMap.has(w) && !['a', 'an', 'the', 'to', 'be'].includes(w))
    return { level: head ? higher('B1', levelMap.get(head)) : 'B1', estimated: true }
  }
  for (const b of baseCandidates(t)) {
    for (const v of spellingVariants(b)) if (levelMap.has(v)) return { level: levelMap.get(v), estimated: true }
  }
  for (const b of derivationCandidates(t)) {
    for (const v of spellingVariants(b)) if (levelMap.has(v)) return { level: higher('B1', levelMap.get(v)), estimated: true }
  }
  return { level: 'B1', estimated: true, unresolved: true }
}

// ---- 2. YDS sıklığı ----
const text = fs.readFileSync(corpusPath, 'utf8').toLowerCase().replace(/\s+/g, ' ')
const tokenCount = new Map()
for (const m of text.matchAll(/[a-z]{2,}/g)) tokenCount.set(m[0], (tokenCount.get(m[0]) || 0) + 1)
const singles = new Set(pool.map((w) => w.term.toLowerCase()).filter((t) => /^[a-z]{2,}$/.test(t)))
function lemmas(tok) {
  const c = [tok]
  if (tok.endsWith('ies')) c.push(tok.slice(0, -3) + 'y')
  if (tok.endsWith('ied')) c.push(tok.slice(0, -3) + 'y')
  if (tok.endsWith('es')) c.push(tok.slice(0, -2))
  if (tok.endsWith('s')) c.push(tok.slice(0, -1))
  if (tok.endsWith('ed')) c.push(tok.slice(0, -2), tok.slice(0, -1))
  if (tok.endsWith('ing')) c.push(tok.slice(0, -3), tok.slice(0, -3) + 'e')
  if (/(.)\1(ed|ing)$/.test(tok)) c.push(tok.replace(/(.)\1(ed|ing)$/, '$1'))
  return c
}
const freq = new Map()
for (const [tok, n] of tokenCount) {
  const hit = lemmas(tok).find((l) => singles.has(l))
  if (hit) freq.set(hit, (freq.get(hit) || 0) + n)
}
function countOf(term) {
  const t = term.toLowerCase()
  if (t.includes(' ')) {
    const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return (text.match(new RegExp('\\b' + escaped + '\\b', 'g')) || []).length
  }
  return freq.get(t) || 0
}
const freqTag = (n) => (n >= 70 ? 'YDS-Çok-Sık' : n >= 25 ? 'YDS-Sık' : n >= 10 ? 'YDS-Ara' : null)

// ---- 3. Uygula ----
const GROUP_TAGS = { A: ['Başlangıç', 'Temel-İngilizce'], B: ['Orta', 'Genel-İngilizce'], C: ['İleri'] }
const report = { changed: [], estimated: [], unresolved: [], counts: {} }
const levels = { a1_a2: 0, b1_b2: 0, c1_c2: 0 }
for (const w of pool) {
  const oldLevel = w.tags.find((t) => ORDER.includes(t))
  const { level, estimated, unresolved } = resolve(w.term)
  const n = countOf(w.term)
  const tag = STOP.has(w.term.toLowerCase()) ? null : freqTag(n)
  const kept = w.tags.filter((t) => !LEVEL_TAGS.has(t))
  w.tags = [level, ...GROUP_TAGS[level[0]], ...(estimated ? ['Seviye-Tahmini'] : []), ...(tag ? [tag] : []), ...kept]
  w.difficulty = DIFFICULTY[level]
  report.counts[w.term] = n
  if (oldLevel !== level) report.changed.push([w.term, oldLevel, level])
  if (estimated) report.estimated.push([w.term, level])
  if (unresolved) report.unresolved.push(w.term)
  levels[level[0] === 'A' ? 'a1_a2' : level[0] === 'B' ? 'b1_b2' : 'c1_c2']++
}
fs.writeFileSync(POOL, JSON.stringify(pool))
const meta = JSON.parse(fs.readFileSync(META, 'utf8'))
meta.levels = levels
meta.generatedAt = new Date().toISOString()
fs.writeFileSync(META, JSON.stringify(meta))
fs.writeFileSync(process.argv[3] || 'levels-report.json', JSON.stringify(report, null, 1))
console.log('Seviye dağılımı:', levels)
console.log('Değişen:', report.changed.length, '| Tahmini:', report.estimated.length, '| Çözülemeyen:', report.unresolved.length)
