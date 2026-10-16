// Çeviri yardımcıları (yalnızca yerel veri üzerinde çalışır).
//
//   node scripts/trTools.mjs list <sınav> <ilk> <son>   -> çevirisi eksik cümle/şıkları yazdırır
//   node scripts/trTools.mjs merge <sınav> <parça.json> -> parçayı local-data/yds/<sınav>.tr.json'a ekler
//   node scripts/trTools.mjs status <sınav>             -> kaç segmentin çevrildiğini gösterir
import fs from 'node:fs'

const [cmd, name, a, b] = process.argv.slice(2)
const dir = 'local-data/yds'
const examFile = `${dir}/${name}.json`
const trFile = `${dir}/${name}.tr.json`
if (!cmd || !name) throw new Error('Kullanım: node scripts/trTools.mjs list|merge|status <sınav> ...')

const exam = JSON.parse(fs.readFileSync(examFile, 'utf8'))
const tr = fs.existsSync(trFile) ? JSON.parse(fs.readFileSync(trFile, 'utf8')) : {}

function allSegments() {
  const segs = []
  for (const p of exam.passages) for (const s of p.sentences) segs.push(s.id)
  for (const q of exam.questions) {
    for (const s of q.stem) segs.push(s.id)
    for (const o of Object.values(q.options)) segs.push(o.id)
  }
  return segs
}

if (cmd === 'list') {
  const from = Number(a)
  const to = Number(b)
  const shownPassages = new Set()
  for (const q of exam.questions.filter((x) => x.no >= from && x.no <= to)) {
    const p = q.passage && exam.passages.find((y) => y.id === q.passage)
    if (p && !shownPassages.has(p.id)) {
      shownPassages.add(p.id)
      for (const s of p.sentences) if (!tr[s.id]) console.log(`${s.id} | ${s.en}`)
    }
  }
  for (const q of exam.questions.filter((x) => x.no >= from && x.no <= to)) {
    for (const s of q.stem) if (!tr[s.id]) console.log(`${s.id} | ${s.en}`)
    for (const o of Object.values(q.options)) if (!tr[o.id]) console.log(`${o.id} | ${o.en}`)
  }
} else if (cmd === 'merge') {
  const part = JSON.parse(fs.readFileSync(a, 'utf8'))
  const valid = new Set(allSegments())
  const unknown = Object.keys(part).filter((k) => !valid.has(k))
  if (unknown.length) console.log('UYARI: tanınmayan kimlikler atlandı:', unknown.join(', '))
  for (const [k, v] of Object.entries(part)) if (valid.has(k) && v) tr[k] = v
  fs.writeFileSync(trFile, JSON.stringify(tr, null, 1))
  console.log(`${Object.keys(part).length - unknown.length} çeviri eklendi; toplam ${Object.keys(tr).length}`)
} else if (cmd === 'status') {
  const segs = allSegments()
  const done = segs.filter((id) => tr[id]).length
  console.log(`${name}: ${done}/${segs.length} segment çevrildi`)
}
