// Özgün sorularda doğru şıkkın harf dağılımını dengeler (A-E eşit). Bir dosyada bir kez çalışır (balanced: true işaretler).
//   node scripts/balanceOzgun.mjs
// Doğru şık ile hedef konumdaki şık yer değiştirir; şık çevirisi (ot) ve açıklama (x) birlikte taşınır.
// Anlam bütünlüğü (I-V) ve şıkları boş olan sorular atlanır.
import fs from 'node:fs'
import path from 'node:path'

const DIR = 'public/data/ozgun'
const ORDER = [2, 4, 1, 3, 0, 3, 1, 4, 2, 0] // sabit, karışık görünen hedef dizisi (her 10 soruda A-E ikişer kez)
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith('.json'))) {
  const p = path.join(DIR, f)
  const data = JSON.parse(fs.readFileSync(p, 'utf8'))
  if (data.balanced || !Array.isArray(data.sets)) continue
  let k = 0
  for (const set of data.sets)
    for (const q of set.qs) {
      if (!q.o?.length) continue
      const to = ORDER[k++ % ORDER.length]
      const sw = (arr) => {
        if (!arr) return
        ;[arr[q.a], arr[to]] = [arr[to], arr[q.a]]
      }
      sw(q.o)
      sw(q.ot)
      sw(q.x)
      q.a = to
    }
  data.balanced = true
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n')
  console.log('dengelendi:', f)
}
