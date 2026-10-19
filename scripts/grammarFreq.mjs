// Dilbilgisi konularının çıkmış sınavlarda kaç soruda göründüğünü sayar (yerel veriden; yalnızca SAYILAR yayına girer).
//
//   node scripts/grammarFreq.mjs
//
// Girdi : local-data/yds/*.json (YDS + YÖKDİL, telifli; yalnızca yerelde)
// Çıktı : public/data/grammar_freq.json  -> { exams, questions, matched, topics: { <konuId>: { count, exams } } }
//         (soru metni YOK; yayına girebilir)
// Yöntem: src/data/grammar.ts içindeki `guessGrammarTopics` (şık kalıpları) — dilbilgisi ve cloze sorularına uygulanır.
// Not   : Tahmin kalıp tabanlıdır; bir soru en çok 2 konuya sayılır. Sayılar "yaklaşık" olarak gösterilmelidir.
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const { GRAMMAR_TOPICS, guessGrammarTopics } = await import(pathToFileURL(path.resolve('src/data/grammar.ts')).href)

const EXAM_DIR = 'local-data/yds'
const OUT = 'public/data/grammar_freq.json'

// Dilbilgisi içeren aralıklar (src/services/ydsSections.ts ile aynı): YDS 7-26, YÖKDİL 1-30
const inRange = (examId, no) => (examId.startsWith('yokdil-') ? no >= 1 && no <= 30 : no >= 7 && no <= 26)

const files = fs
  .readdirSync(EXAM_DIR)
  .filter((f) => f.endsWith('.json') && !f.endsWith('.tr.json') && !f.startsWith('_'))
const topics = Object.fromEntries(GRAMMAR_TOPICS.map((t) => [t.id, { count: 0, exams: new Set() }]))
let questions = 0
let matched = 0
let exams = 0

for (const f of files) {
  const exam = JSON.parse(fs.readFileSync(path.join(EXAM_DIR, f), 'utf8'))
  exams++
  for (const q of exam.questions) {
    if (!inRange(exam.id, q.no)) continue
    questions++
    const guess = guessGrammarTopics(Object.values(q.options).map((o) => o.en))
    if (guess.length) matched++
    for (const t of guess) {
      topics[t.id].count++
      topics[t.id].exams.add(exam.id)
    }
  }
}

const out = {
  generatedAt: new Date().toISOString().slice(0, 10),
  exams,
  questions,
  matched,
  topics: Object.fromEntries(Object.entries(topics).map(([id, v]) => [id, { count: v.count, exams: v.exams.size }])),
}
fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n')
console.log(`${exams} sınav, ${questions} dilbilgisi/cloze sorusu, ${matched} tanesi bir konuya eşlendi`)
for (const t of GRAMMAR_TOPICS) console.log(String(topics[t.id].count).padStart(4), String(topics[t.id].exams.size).padStart(3), t.title)
