// Soru etiket veritabanı (YEREL): node scripts/tagQuestions.mjs
// Her çıkmış sorunun tipi, dilbilgisi konusu, bağlaç/ipucu türü ve okuma soru türü etiketlenir.
// Amaç: konu bazlı hedefli çalışma ve konu bazlı Yanlış Defteri (uygulama bu dosyayı dev sunucusu üzerinden okuyabilir).
//
// Girdi : local-data/yds/*.json (telifli; yalnızca yerelde)
// Çıktı : local-data/analiz/soru_etiketleri.json  (YEREL; yayına girmez, soru metni içermez — yalnızca kimlik + etiket)
//         local-data/analiz/soru_etiketleri_ozet.txt (okunabilir sayı özeti)
// Not   : Etiketler kalıp tabanlıdır (tahmin). Elle düzeltme için local-data/analiz/soru_etiketleri_duzeltme.json
//         (id -> { topics?: [], signals?: [] }) varsa üzerine yazılır.
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const { guessGrammarTopics } = await import(pathToFileURL(path.resolve('src/data/grammar.ts')).href)

const EXAM_DIR = 'local-data/yds'
const OUT_DIR = 'local-data/analiz'
const YDS = [
  ['vocab', 1, 6],
  ['grammar', 7, 16],
  ['cloze', 17, 26],
  ['completion', 27, 36],
  ['translation', 37, 42],
  ['reading', 43, 62],
  ['dialogue', 63, 67],
  ['paraphrase', 68, 71],
  ['paragraph', 72, 75],
  ['irrelevant', 76, 80],
]
const YOKDIL = [
  ['vocgram', 1, 20],
  ['cloze', 21, 30],
  ['completion', 31, 41],
  ['translation', 42, 53],
  ['paragraph', 54, 59],
  ['irrelevant', 60, 65],
  ['reading', 66, 80],
]
const sectionOf = (examId, no) => (examId.startsWith('yokdil-') ? YOKDIL : YDS).find(([, a, b]) => no >= a && no <= b)?.[0] ?? 'unknown'

// Bağlaç / ipucu sınıfları (şıklarda ve soru kökünde aranır)
const SIGNALS = {
  'zitlik-bagi': /\b(although|though|even though|despite|in spite of|whereas|while|however|nevertheless|nonetheless|on the other hand|in contrast|yet)\b/i,
  'kosul': /\b(if|unless|provided that|providing that|supposing|as long as|in case|otherwise|were it not|had it not)\b/i,
  'neden': /\b(because|since|as a result of|due to|owing to|thanks to|on account of)\b/i,
  'sonuc': /\b(therefore|thus|consequently|as a result|hence|so that|so \w+ that|such \w+ that)\b/i,
  'ekleme': /\b(moreover|furthermore|in addition|besides|also|likewise|similarly)\b/i,
  'zaman': /\b(when|while|as soon as|once|before|after|until|by the time|no sooner|hardly|scarcely)\b/i,
  'devrik': /\b(not only|never|rarely|seldom|little|only (when|after|if|by)|no sooner|hardly|scarcely|under no circumstances|not until)\b/i,
  'karsilastirma': /\b(more|less|than|the \w+er|as \w+ as|the more|the most)\b/i,
}
const READING_TYPES = [
  ['ana-fikir', /(main (idea|point|purpose)|best (describes|summarises|summarizes)|mainly (about|concerned)|primarily (about|concerned)|title)/i],
  ['cikarim', /(inferred|implied|implies|suggests|can be concluded|it is clear that)/i],
  ['kelime-baglam', /(closest in meaning|same meaning|as used in the passage|refers to|\bit\b.*refers)/i],
  ['ayrinti', /(according to the (passage|text|writer|author)|mentioned|stated|which of the following|is NOT|except)/i],
  ['yazar-tutumu', /(attitude|tone|writer's|author's)/i],
]
const isTurkish = (s) => /[çğıöşüİ]/.test(s)

const corrections = fs.existsSync(path.join(OUT_DIR, 'soru_etiketleri_duzeltme.json'))
  ? JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'soru_etiketleri_duzeltme.json'), 'utf8'))
  : {}

const out = []
const counts = { section: {}, topic: {}, signal: {}, reading: {} }
const bump = (o, k) => (o[k] = (o[k] ?? 0) + 1)

for (const f of fs.readdirSync(EXAM_DIR).filter((x) => x.endsWith('.json') && !x.endsWith('.tr.json') && !x.startsWith('_')).sort()) {
  const exam = JSON.parse(fs.readFileSync(path.join(EXAM_DIR, f), 'utf8'))
  for (const q of exam.questions) {
    const section = sectionOf(exam.id, q.no)
    const stem = q.stem.map((s) => s.en).join(' ')
    const opts = Object.values(q.options).map((o) => o.en)
    const tag = { id: `${exam.id}#${q.no}`, exam: exam.id, no: q.no, section, answer: q.answer ?? null, topics: [], signals: [] }
    if (section === 'grammar' || section === 'cloze' || section === 'vocgram') {
      tag.topics = guessGrammarTopics(opts).map((t) => t.id)
    }
    if (section === 'completion' || section === 'cloze' || section === 'grammar' || section === 'vocgram') {
      const hay = opts.join(' | ') + ' | ' + stem
      for (const [name, re] of Object.entries(SIGNALS)) if (re.test(hay)) tag.signals.push(name)
    }
    if (section === 'translation') {
      tag.direction = isTurkish(opts[0] ?? '') ? 'en-tr' : 'tr-en'
    }
    if (section === 'reading') {
      const t = READING_TYPES.find(([, re]) => re.test(stem))
      tag.readingType = t ? t[0] : 'diger'
      tag.passage = q.passage
      bump(counts.reading, tag.readingType)
    }
    const fix = corrections[tag.id]
    if (fix) Object.assign(tag, fix)
    out.push(tag)
    bump(counts.section, section)
    for (const t of tag.topics) bump(counts.topic, t)
    for (const s of tag.signals) bump(counts.signal, s)
  }
}

fs.mkdirSync(OUT_DIR, { recursive: true })
fs.writeFileSync(path.join(OUT_DIR, 'soru_etiketleri.json'), JSON.stringify({ generatedAt: new Date().toISOString().slice(0, 10), count: out.length, tags: out }, null, 1) + '\n')
const fmt = (o) =>
  Object.entries(o)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `  ${String(v).padStart(5)}  ${k}`)
    .join('\n')
const summary = `Soru etiketleri (${out.length} soru)\n\nTip:\n${fmt(counts.section)}\n\nDilbilgisi konusu (tahmin):\n${fmt(counts.topic)}\n\nBağlaç/ipucu:\n${fmt(counts.signal)}\n\nOkuma soru türü:\n${fmt(counts.reading)}\n`
fs.writeFileSync(path.join(OUT_DIR, 'soru_etiketleri_ozet.txt'), summary)
console.log(summary)
