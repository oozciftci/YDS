// Ayrıştırılmış sınavların yapısal denetimi (yerel veri): şık sayısı, paragraf-soru eşleşmesi, boş metin
import fs from 'node:fs'
const dir = 'local-data/yds'
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json') && !x.endsWith('.tr.json')).sort()) {
  const e = JSON.parse(fs.readFileSync(`${dir}/${f}`, 'utf8'))
  const issues = []
  const bad = e.questions.filter((q) => Object.keys(q.options).length !== 5).map((q) => q.no)
  if (bad.length) issues.push('şık≠5: ' + bad.join(','))
  const emptyOpt = e.questions.filter((q) => Object.values(q.options).some((o) => o.en.length < 1)).map((q) => q.no)
  if (emptyOpt.length) issues.push('boş şık: ' + emptyOpt.join(','))
  const cloze = e.passages.filter((p) => p.kind === 'cloze').length
  const reading = e.passages.filter((p) => p.kind === 'reading').length
  if (cloze !== 2 || reading !== 5) issues.push(`paragraf ${cloze} cloze/${reading} okuma`)
  const clozeQ = e.questions.filter((q) => q.no >= 17 && q.no <= 26 && !q.passage).map((q) => q.no)
  if (clozeQ.length) issues.push('paragrafsız cloze: ' + clozeQ.join(','))
  const readQ = e.questions.filter((q) => q.no >= 43 && q.no <= 62 && !q.passage).map((q) => q.no)
  if (readQ.length) issues.push('paragrafsız okuma: ' + readQ.join(','))
  const noStem = e.questions.filter((q) => (q.no <= 16 || (q.no >= 27 && q.no <= 80)) && q.stem.length === 0).map((q) => q.no)
  if (noStem.length) issues.push('sorusuz: ' + noStem.join(','))
  const noAns = e.questions.filter((q) => !q.answer).length
  const segs = e.passages.reduce((a, p) => a + p.sentences.length, 0) + e.questions.reduce((a, q) => a + q.stem.length + Object.keys(q.options).length, 0)
  console.log(`${e.id.padEnd(24)} soru ${e.questionCount} cevap ${80 - noAns} segment ${segs} ${issues.length ? '⚠ ' + issues.join(' | ') : '✓'}`)
}
