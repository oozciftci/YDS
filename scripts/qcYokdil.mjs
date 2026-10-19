// YÖKDİL sınavlarının yapısal denetimi (yerel veri): şık sayısı, parça-soru eşleşmesi, cevap, boş metin.
import fs from 'node:fs'
const dir = 'local-data/yds'
let bad = 0
for (const f of fs.readdirSync(dir).filter((x) => x.startsWith('yokdil-') && x.endsWith('.json') && !x.endsWith('.tr.json')).sort()) {
  const e = JSON.parse(fs.readFileSync(`${dir}/${f}`, 'utf8'))
  const issues = []
  const nums = e.questions.map((q) => q.no)
  if (nums.join() !== Array.from({ length: 80 }, (_, i) => i + 1).join()) issues.push('soru numaraları 1-80 değil')
  const opt = e.questions.filter((q) => Object.keys(q.options).join('') !== 'ABCDE' || Object.values(q.options).some((o) => o.en.length < 1)).map((q) => q.no)
  if (opt.length) issues.push('şık sorunu: ' + opt.join(','))
  const noAns = e.questions.filter((q) => !q.answer).map((q) => q.no)
  if (noAns.length) issues.push('cevapsız: ' + noAns.join(','))
  const cloze = e.passages.filter((p) => p.kind === 'cloze')
  const reading = e.passages.filter((p) => p.kind === 'reading')
  if (cloze.length !== 2 || reading.length !== 5) issues.push(`parça ${cloze.length} cloze / ${reading.length} okuma`)
  const short = e.passages.filter((p) => p.text.length < 350).map((p) => `${p.id}(${p.text.length})`)
  if (short.length) issues.push('kısa parça: ' + short.join(','))
  const wrongPassage = e.questions.filter((q) => (q.no >= 21 && q.no <= 30 && !q.passage) || (q.no >= 66 && !q.passage) || (q.no < 21 || (q.no > 30 && q.no < 66)) && q.passage).map((q) => q.no)
  if (wrongPassage.length) issues.push('parça bağı yanlış: ' + wrongPassage.slice(0, 12).join(','))
  const noStem = e.questions.filter((q) => !(q.no >= 21 && q.no <= 30) && q.stem.length === 0).map((q) => q.no)
  if (noStem.length) issues.push('sorusuz: ' + noStem.join(','))
  const noBlank = e.questions.filter((q) => ((q.no >= 1 && q.no <= 20) || (q.no >= 31 && q.no <= 41) || (q.no >= 54 && q.no <= 59)) && !/----/.test(q.stem.map((s) => s.en).join(' '))).map((q) => q.no)
  if (noBlank.length) issues.push('boşluksuz: ' + noBlank.join(','))
  if (issues.length) bad++
  console.log(`${e.id.padEnd(28)} ${issues.length ? '⚠ ' + issues.join(' | ') : '✓'}`)
}
process.exit(bad ? 1 : 0)
