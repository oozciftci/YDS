// Kelime–soru eşleme (YEREL): node scripts/mapWordsToQuestions.mjs
// Havuzdaki kelimelerin (Oxford 3000 + Yeni YDS + YÖKDİL alan paketleri) hangi çıkmış sorularda geçtiğini bulur.
// Soru metnine kelime, şıkta ya da soru kökünde ya da sorunun paragrafında geçmesi yeterlidir.
//
// Girdi : local-data/yds/*.json (telifli), public/data/{oxford3000_tr,yeni_yds_kelimeleri,yokdil_fen,yokdil_saglik,yokdil_sosyal}.json
// Çıktı : local-data/analiz/kelime_soru_eslesme.json (YEREL; yayına girmez)
//           { words: { <kelime>: { n: toplam soru sayısı, yokdil: YÖKDİL'de kaç soru, ids: ["<sınav>#<no>", ... en çok 12] } } }
//         local-data/analiz/kelime_soru_ozet.txt
// Kullanım: kelime kartında "bu kelime şu sorularda geçti" bağlantısı ve soruya özel kelime listesi için hazırlıktır.
import fs from 'node:fs'
import path from 'node:path'

const EXAM_DIR = 'local-data/yds'
const OUT_DIR = 'local-data/analiz'
const POOLS = ['oxford3000_tr', 'yeni_yds_kelimeleri', 'yokdil_fen', 'yokdil_saglik', 'yokdil_sosyal']
const MAX_IDS = 12
const STOP = new Set('the and for with that this from have has had was were are not but you your they them his her its into out over than then also very just such been being would could should about after before more most other some any all each both only own same too'.split(' '))

const tokenize = (s) => s.toLowerCase().replace(/[^a-z' -]+/g, ' ').split(/\s+/).filter(Boolean)
const stems = (t) => {
  const c = new Set([t])
  if (t.endsWith('ies')) c.add(t.slice(0, -3) + 'y')
  if (t.endsWith('ied')) c.add(t.slice(0, -3) + 'y')
  if (t.endsWith('es')) c.add(t.slice(0, -2))
  if (t.endsWith('s')) c.add(t.slice(0, -1))
  if (t.endsWith('ed')) {
    c.add(t.slice(0, -2))
    c.add(t.slice(0, -1))
  }
  if (t.endsWith('ing')) {
    c.add(t.slice(0, -3))
    c.add(t.slice(0, -3) + 'e')
  }
  if (t.endsWith('ly')) c.add(t.slice(0, -2))
  return c
}

// token(kök) -> Set(soru kimliği)
const index = new Map()
const yokdilQ = new Set()
let nQ = 0
for (const f of fs.readdirSync(EXAM_DIR).filter((x) => x.endsWith('.json') && !x.endsWith('.tr.json') && !x.startsWith('_')).sort()) {
  const exam = JSON.parse(fs.readFileSync(path.join(EXAM_DIR, f), 'utf8'))
  const passages = new Map(exam.passages.map((p) => [p.id, p.sentences.map((s) => s.en).join(' ')]))
  for (const q of exam.questions) {
    const id = `${exam.id}#${q.no}`
    nQ++
    if (exam.id.startsWith('yokdil-')) yokdilQ.add(id)
    const text = [q.passage ? passages.get(q.passage) : '', ...q.stem.map((s) => s.en), ...Object.values(q.options).map((o) => o.en)].join(' ')
    for (const tok of new Set(tokenize(text))) {
      if (tok.length < 3 || STOP.has(tok)) continue
      if (!index.has(tok)) index.set(tok, new Set())
      index.get(tok).add(id)
    }
  }
}

const words = {}
let matched = 0
let total = 0
for (const pool of POOLS) {
  const file = `public/data/${pool}.json`
  if (!fs.existsSync(file)) continue
  for (const w of JSON.parse(fs.readFileSync(file, 'utf8'))) {
    const term = String(w.term ?? '').toLowerCase().trim()
    if (!term || term.includes(' ') || term.length < 4 || STOP.has(term) || words[term]) continue
    total++
    // Kelimenin kendisi ya da çekimli biçimleri eşleşir: sorulardaki token'ın kökü terime eşitse
    const ids = new Set()
    for (const [tok, set] of index) {
      if (tok === term || (tok.length <= term.length + 3 && tok.length >= term.length - 3 && stems(tok).has(term))) for (const id of set) ids.add(id)
    }
    if (!ids.size) continue
    matched++
    const list = [...ids].sort()
    words[term] = { n: list.length, yokdil: list.filter((x) => yokdilQ.has(x)).length, ids: list.slice(0, MAX_IDS) }
  }
}

fs.mkdirSync(OUT_DIR, { recursive: true })
fs.writeFileSync(path.join(OUT_DIR, 'kelime_soru_eslesme.json'), JSON.stringify({ generatedAt: new Date().toISOString().slice(0, 10), questions: nQ, words }) + '\n')
const top = Object.entries(words).sort((a, b) => b[1].n - a[1].n).slice(0, 25).map(([w, v]) => `  ${String(v.n).padStart(4)} (YÖKDİL ${String(v.yokdil).padStart(3)})  ${w}`).join('\n')
const summary = `Kelime–soru eşleme: ${nQ} soru, havuzda ${total} tek sözcüklü kelimeden ${matched} tanesi en az bir soruda geçiyor.\n\nEn çok soruda geçenler:\n${top}\n`
fs.writeFileSync(path.join(OUT_DIR, 'kelime_soru_ozet.txt'), summary)
console.log(summary)
