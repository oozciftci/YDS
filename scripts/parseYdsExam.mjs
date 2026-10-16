// OCR çıktısındaki (olmOCR sayfa .md dosyaları) bir YDS sınavını yapılandırılmış JSON'a çevirir.
// Çıktı YALNIZCA yerelde kalır: local-data/yds/<sınav>.json (git'e ve yayına girmez).
//
// Kullanım:
//   node scripts/parseYdsExam.mjs <sınav-adı> [ocr-klasörü]
//   örn: node scripts/parseYdsExam.mjs yds-2024-ilkbahar
//
// Çeviriler ayrı dosyada tutulur (local-data/yds/<sınav>.tr.json, anahtar -> Türkçe) ve
// uygulama açılırken birleştirilir; ayrıştırıcı yeniden çalışınca çeviriler kaybolmaz.
import fs from 'node:fs'
import path from 'node:path'

const name = process.argv[2]
if (!name) throw new Error('Kullanım: node scripts/parseYdsExam.mjs <sınav-adı> [ocr-klasörü]')
const ocrDir = process.argv[3] || 'C:/Projeler/OCR/output/raw/olmocr'
const outDir = 'local-data/yds'

const pages = fs
  .readdirSync(ocrDir)
  .filter((f) => f.startsWith(name + '_s') && f.endsWith('.md'))
  .sort()
if (pages.length === 0) throw new Error(`OCR sayfası bulunamadı: ${name} (${ocrDir})`)

// ---- sayfaları birleştir; cevap anahtarı sayfasını ayır ----
let body = ''
let keyHtml = ''
let title = ''
for (const f of pages) {
  const t = fs.readFileSync(path.join(ocrDir, f), 'utf8')
  if (/ANSWER KEY/i.test(t)) {
    keyHtml += t
    continue
  }
  const lines = t.split(/\r?\n/)
  // sayfa başlığı ("2024 Mart YDS") ve boş kapak sayfası
  if (!title && /^\d{4}\s.*YDS/i.test(lines[0] || '')) title = lines[0].trim()
  body += lines.filter((l) => !/^\d{4}\s.*(YDS|YÖKDİL)\s*$/i.test(l.trim())).join('\n') + '\n\n'
}

// ---- cevap anahtarı: <th>no</th> ... <td>harf</td> ----
const answers = {}
{
  const nums = [...keyHtml.matchAll(/<th>\s*(\d+)\s*<\/th>/g)].map((m) => Number(m[1]))
  const letters = [...keyHtml.matchAll(/<td>\s*([A-E])\s*<\/td>/g)].map((m) => m[1])
  nums.forEach((n, i) => {
    if (letters[i]) answers[n] = letters[i]
  })
}

// ---- cümlelere bölme ----
const ABBR = /\b(?:Mr|Mrs|Ms|Dr|Prof|St|vs|etc|e\.g|i\.e|U\.S|U\.K|No|Fig|approx|Jr|Sr|Inc|Ltd|Co|p\.m|a\.m)\.$/i
const ROMAN_MARK = / (?=\((?:I|II|III|IV|V)\) )/

function splitSentences(text) {
  const clean = text.replace(/\s+/g, ' ').trim()
  // (I) ... (II) ... biçimindeki "ilgisiz cümle" sorularında numaralı cümleler ayrı bölünür
  const marked = clean.split(ROMAN_MARK)
  if (marked.length > 1) return marked
  const parts = []
  let cur = ''
  const tokens = clean.split(' ')
  for (let i = 0; i < tokens.length; i++) {
    cur += (cur ? ' ' : '') + tokens[i]
    const next = tokens[i + 1]
    const endsSentence = /[.!?]["'”’)]*$/.test(tokens[i]) && !ABBR.test(tokens[i]) && !/^\d+\.$/.test(tokens[i])
    if (endsSentence && (!next || /^["'“‘(]*[A-ZİÖÜÇŞĞ0-9]/.test(next))) {
      parts.push(cur)
      cur = ''
    }
  }
  if (cur) parts.push(cur)
  return parts
}

// ---- soru bloklarını ayrıştır ----
const lines = body.split(/\r?\n/)
const passages = []
const questions = []
let q = null
let passageBuf = []

function flushPassage() {
  const text = passageBuf.join(' ').replace(/\s+/g, ' ').trim()
  passageBuf = []
  if (text.length < 40) return
  const id = `p${passages.length + 1}`
  passages.push({
    id,
    afterNo: questions.length ? questions[questions.length - 1].no : 0,
    text,
    sentences: splitSentences(text).map((en, i) => ({ id: `${id}.${i + 1}`, en })),
  })
}
function flushQuestion() {
  if (!q) return
  const stemText = q.stem.join(' ').replace(/\s+/g, ' ').trim()
  questions.push({
    no: q.no,
    passage: null,
    stem: stemText ? splitSentences(stemText).map((en, i) => ({ id: `q${q.no}.s${i + 1}`, en })) : [],
    options: Object.fromEntries(Object.entries(q.options).map(([k, en]) => [k, { id: `q${q.no}.${k}`, en }])),
    answer: answers[q.no] || null,
  })
  q = null
}

const INLINE_OPTS = /^A\)\s*(\S+)\s{2,}B\)\s*(\S+)\s{2,}C\)\s*(\S+)\s{2,}D\)\s*(\S+)\s{2,}E\)\s*(\S+)$/

for (const raw of lines) {
  const line = raw.trim()
  if (!line) continue
  const numMatch = /^(\d{1,2})$/.exec(line)
  if (numMatch && Number(numMatch[1]) <= 80) {
    flushQuestion()
    if (passageBuf.length) flushPassage()
    q = { no: Number(numMatch[1]), stem: [], options: {} }
    continue
  }
  const inline = INLINE_OPTS.exec(line)
  if (inline && q) {
    'ABCDE'.split('').forEach((k, i) => (q.options[k] = inline[i + 1]))
    continue
  }
  const optMatch = /^([A-E])\)\s*(.*)$/.exec(line)
  if (optMatch && q) {
    q.options[optMatch[1]] = optMatch[2].trim()
    continue
  }
  if (q && Object.keys(q.options).length >= 5) {
    // soru bitti; bu satır yeni bir paragrafın başlangıcı
    flushQuestion()
    passageBuf.push(line)
    continue
  }
  if (q) q.stem.push(line)
  else passageBuf.push(line)
}
flushQuestion()
if (passageBuf.length) flushPassage()

// ---- paragraf-soru eşleştirmesi ----
// Boşluklu paragraf (17)---- : numarası eşleşen sorular. Okuma paragrafı: kendisinden sonra gelen
// ve "passage/paragraph/author/..." geçen ardışık sorular.
for (const p of passages) {
  const gaps = [...p.text.matchAll(/\((\d+)\)\s*-{2,}/g)].map((m) => Number(m[1]))
  if (gaps.length) {
    p.kind = 'cloze'
    for (const x of questions) if (gaps.includes(x.no)) x.passage = p.id
  } else {
    p.kind = 'reading'
    // Sorular paragraftan hemen sonra gelir; bir sonraki paragrafın başladığı soruya kadar sürer.
    // Son paragrafta "passage/paragraph/author/..." geçmeyen ilk soruda durulur.
    const next = passages.find((y) => y.afterNo > p.afterNo)
    for (const x of questions.filter((y) => y.no > p.afterNo).sort((a, b) => a.no - b.no)) {
      if (next && x.no > next.afterNo) break
      const stem = x.stem.map((t) => t.en).join(' ')
      if (!next && !/\b(passage|paragraph|author|writer|text)\b/i.test(stem)) break
      x.passage = p.id
    }
  }
}
for (const p of passages) delete p.afterNo

const exam = {
  id: name,
  title: title || name,
  questionCount: questions.length,
  answered: questions.filter((x) => x.answer).length,
  passages,
  questions,
}
fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(path.join(outDir, name + '.json'), JSON.stringify(exam, null, 1))

const badOpts = questions.filter((x) => Object.keys(x.options).length !== 5).map((x) => x.no)
const missingNos = []
for (let i = 1; i <= 80; i++) if (!questions.some((x) => x.no === i)) missingNos.push(i)
console.log(`${name}: ${questions.length} soru, ${passages.length} paragraf, ${exam.answered} cevap`)
if (badOpts.length) console.log('Şık sayısı 5 olmayan sorular:', badOpts.join(', '))
if (missingNos.length) console.log('Bulunamayan soru numaraları:', missingNos.join(', '))
