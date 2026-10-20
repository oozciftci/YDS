// Özgün soru bankası kalite kontrolü: node scripts/qcOzgun.mjs
// Kontroller: 5 şık, şık tekrarı yok, 5 açıklama (doğru olan "Doğru" ile başlar), cevap aralığı, uzunluk dengesi, cevap dağılımı.
import fs from 'node:fs'
import path from 'node:path'

const DIR = 'public/data/ozgun'
let errors = 0
let total = 0
const err = (m) => {
  errors++
  console.log('HATA', m)
}
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith('.json'))) {
  const data = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))
  const dist = [0, 0, 0, 0, 0]
  let n = 0
  for (const set of data.sets) {
    set.qs.forEach((q, i) => {
      const id = `${set.id}#${i + 1}`
      n++
      const opts = q.o.length ? q.o : ['I', 'II', 'III', 'IV', 'V']
      if (opts.length !== 5) err(`${id}: ${opts.length} şık`)
      if (new Set(opts.map((o) => o.trim().toLowerCase())).size !== opts.length) err(`${id}: şık tekrarı`)
      if (!(q.a >= 0 && q.a < 5)) err(`${id}: cevap aralık dışı`)
      else dist[q.a]++
      if (!q.x || q.x.length !== 5) err(`${id}: açıklama sayısı`)
      else if (!q.x[q.a]?.startsWith('Doğru')) err(`${id}: doğru şık açıklaması "Doğru" ile başlamıyor`)
      else q.x.forEach((x, j) => j !== q.a && x.startsWith('Doğru') && err(`${id}: yanlış şıkta "Doğru"`))
      if (!q.s && !set.passage) err(`${id}: gövde yok`)
      const lens = opts.map((o) => o.length)
      if (opts.length === 5 && lens[q.a] === Math.max(...lens) && Math.max(...lens) > 2 * (lens.reduce((a, b) => a + b) - lens[q.a]) / 4 && opts[0].length > 25)
        err(`${id}: doğru şık belirgin biçimde en uzun`)
    })
  }
  total += n
  console.log(`${f}: ${data.sets.length} set, ${n} soru, cevap dağılımı A-E = ${dist.join('/')}`)
}
console.log(`Toplam ${total} soru, ${errors} hata`)
process.exit(errors ? 1 : 0)
