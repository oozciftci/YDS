// YÖKDİL alan terimi paketlerini üretir: node scripts/buildYokdilTerms.mjs
// Girdi : scripts/data/yokdil_alan_terimleri.txt  (özgün derleme: kelime|tür|anlam|eş anlamlılar, [Alan] başlıkları)
//         local-data/yds/yokdil-*.json            (varsa; YEREL, telifli — yalnızca SAYI hesaplamak için okunur)
// Çıktı : public/data/yokdil_<alan>.json (fen | saglik | sosyal) — yayına girebilir: kelime + anlam + sayısal sıklık.
//         Sınav cümlesi YOK.
import fs from 'node:fs'
import path from 'node:path'

const SRC = 'scripts/data/yokdil_alan_terimleri.txt'
const EXAM_DIR = 'local-data/yds'
const FIELDS = { Fen: 'fen', Sağlık: 'saglik', Sosyal: 'sosyal' }
const POS = { noun: 'noun', verb: 'verb', adjective: 'adjective', adverb: 'adverb' }

// Alan -> sınav metni (küçük harf); sayı hesabı için
const corpus = Object.fromEntries(Object.keys(FIELDS).map((f) => [f, { text: '', exams: 0 }]))
if (fs.existsSync(EXAM_DIR)) {
  for (const f of fs.readdirSync(EXAM_DIR).filter((x) => x.startsWith('yokdil-') && x.endsWith('.json') && !x.endsWith('.tr.json'))) {
    const e = JSON.parse(fs.readFileSync(path.join(EXAM_DIR, f), 'utf8'))
    if (!corpus[e.field]) continue
    const parts = []
    for (const p of e.passages) for (const s of p.sentences) parts.push(s.en)
    for (const q of e.questions) {
      for (const s of q.stem) parts.push(s.en)
      for (const o of Object.values(q.options)) parts.push(o.en)
    }
    corpus[e.field].text += ' ' + parts.join(' ').toLowerCase()
    corpus[e.field].exams++
  }
}

function countIn(text, term) {
  // kök + çekim ekleri (s, es, ed, ing, ly, al)
  // Terimler yalnızca harf ve boşluk içerir; kaçış gerekmez
  const re = new RegExp(String.raw`\b${term}(s|es|ed|d|ing|ly|al)?\b`, 'g')
  return (text.match(re) ?? []).length
}

const lines = fs.readFileSync(SRC, 'utf8').split(/\r?\n/)
const out = Object.fromEntries(Object.keys(FIELDS).map((f) => [f, []]))
let field = null
for (const raw of lines) {
  const l = raw.trim()
  if (!l || l.startsWith('#')) continue
  const m = l.match(/^\[(.+)\]$/)
  if (m) {
    field = m[1]
    continue
  }
  if (!field || !out[field]) continue
  const [term, pos, meaning, syn = ''] = l.split('|').map((x) => x.trim())
  if (!term || !meaning) continue
  const c = corpus[field]
  const n = c.exams ? countIn(c.text, term) : 0
  out[field].push({
    term,
    definition: meaning,
    partOfSpeech: POS[pos] ?? 'noun',
    synonyms: syn ? syn.split(',').map((x) => x.trim()).filter(Boolean) : [],
    antonyms: [],
    collocations: [],
    sentences: [],
    tags: ['YÖKDİL-Alan-Terimi', `YÖKDİL-${field}`, 'C1', 'İleri'],
    difficulty: 4,
    notes: c.exams ? `YÖKDİL ${field} sınavlarında (${c.exams} sınav) ${n} kez geçti.` : '',
  })
}

for (const [f, words] of Object.entries(out)) {
  const file = `public/data/yokdil_${FIELDS[f]}.json`
  fs.writeFileSync(file, JSON.stringify(words) + '\n')
  console.log(`${f}: ${words.length} terim -> ${file}`)
}
