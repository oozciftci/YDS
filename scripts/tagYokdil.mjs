// Kelime havuzuna YÖKDİL sıklık etiketi ekler (YDS etiketlerinden AYRI): YÖKDİL-Çok-Sık / YÖKDİL-Sık / YÖKDİL-Ara.
//
//   node scripts/tagYokdil.mjs
//
// Kaynak: local-data/yds/yokdil-*.json (yerel, telifli; yayına girmez). Havuza (public/data/oxford3000_tr.json)
// yalnızca etiket yazılır. Eşikler, YDS'de kullanılan eşiklerin (70 / 25 / 10) metin hacmine oranlanmış hâlidir;
// böylece iki sınavın sıklık etiketleri karşılaştırılabilir kalır. YDS etiketlerine dokunulmaz.
import fs from 'node:fs'
import path from 'node:path'

const EXAM_DIR = 'local-data/yds'
const POOL = 'public/data/oxford3000_tr.json'
const REPORT = 'local-data/analiz/yokdil_etiket_raporu.json'
const TAGS = ['YÖKDİL-Çok-Sık', 'YÖKDİL-Sık', 'YÖKDİL-Ara']
const YDS_THRESHOLDS = [70, 25, 10]
const STOP = new Set(
  `the an and or of to in is are was were be been being it its that this these those for on with as by at from
  not have has had will would can could may might shall should do does did which who whom whose what when where why how
  their there they them he she his her him we you your our us me my but if than then so such also into out up
  about over after before more most other some any all each both no nor only own same too very just`.split(/\s+/),
)

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

const isTurkish = (s) => /[çğıöşüİ]/.test(s)

/** Bir sınavın tüm İngilizce metni (paragraflar, soru kökleri, şıklar). */
function englishText(exam) {
  const out = []
  for (const p of exam.passages) for (const s of p.sentences) out.push(s.en)
  for (const q of exam.questions) {
    for (const s of q.stem) out.push(s.en)
    for (const o of Object.values(q.options)) out.push(o.en)
  }
  return out.filter((t) => !isTurkish(t)).join(' ').toLowerCase()
}

function load(prefix, negate) {
  return fs
    .readdirSync(EXAM_DIR)
    .filter((f) => f.endsWith('.json') && !f.endsWith('.tr.json') && f.startsWith(prefix) === !negate)
    .map((f) => englishText(JSON.parse(fs.readFileSync(path.join(EXAM_DIR, f), 'utf8'))))
}

const yokdil = load('yokdil-', false)
const yds = load('yds-', false)
if (!yokdil.length) throw new Error('local-data/yds altında yokdil-*.json yok')
const tokens = (texts) => texts.reduce((n, t) => n + (t.match(/[a-z]{2,}/g) || []).length, 0)
const ratio = tokens(yokdil) / tokens(yds)
const thresholds = YDS_THRESHOLDS.map((n) => Math.max(3, Math.round(n * ratio)))

const pool = JSON.parse(fs.readFileSync(POOL, 'utf8'))
const singles = new Set(pool.map((w) => w.term.toLowerCase()).filter((t) => /^[a-z]{2,}$/.test(t)))
const freq = new Map()
const examsWith = new Map()
yokdil.forEach((text, i) => {
  for (const m of text.matchAll(/[a-z]{2,}/g)) {
    const hit = lemmas(m[0]).find((l) => singles.has(l))
    if (!hit) continue
    freq.set(hit, (freq.get(hit) || 0) + 1)
    if (!examsWith.has(hit)) examsWith.set(hit, new Set())
    examsWith.get(hit).add(i)
  }
})
function countOf(term) {
  const t = term.toLowerCase()
  if (t.includes(' ')) {
    const re = new RegExp('\\b' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g')
    return yokdil.reduce((n, x) => n + (x.match(re) || []).length, 0)
  }
  return freq.get(t) || 0
}
const tagOf = (n) => (n >= thresholds[0] ? TAGS[0] : n >= thresholds[1] ? TAGS[1] : n >= thresholds[2] ? TAGS[2] : null)

const counts = { [TAGS[0]]: 0, [TAGS[1]]: 0, [TAGS[2]]: 0 }
const report = { exams: yokdil.length, ratio, thresholds, words: {} }
for (const w of pool) {
  const n = countOf(w.term)
  const tag = STOP.has(w.term.toLowerCase()) ? null : tagOf(n)
  w.tags = w.tags.filter((t) => !TAGS.includes(t))
  if (tag) {
    // YDS sıklık etiketinin hemen arkasına; sıra: seviye etiketleri, YDS-*, YÖKDİL-*, diğerleri
    const at = Math.max(w.tags.findIndex((t) => /^YDS-(Çok-Sık|Sık|Ara)$/.test(t)) + 1, w.tags.findIndex((t) => /^(Genel-İngilizce|İleri|Temel-İngilizce)$/.test(t)) + 1)
    w.tags.splice(at, 0, tag)
    counts[tag]++
    report.words[w.term] = n
  }
}
fs.writeFileSync(POOL, JSON.stringify(pool))
fs.mkdirSync(path.dirname(REPORT), { recursive: true })
fs.writeFileSync(REPORT, JSON.stringify(report, null, 1))
console.log(`YÖKDİL: ${yokdil.length} sınav, metin oranı (YÖKDİL/YDS) ${ratio.toFixed(2)}, eşikler ${thresholds.join(' / ')}`)
console.log('Etiket dağılımı:', counts)
