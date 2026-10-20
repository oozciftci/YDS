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

// Seçenekler (isteğe bağlı):
//   --pdf <dosya>     kaynak PDF adı (cikmis_sorular içinde); varsayılan <sınav-adı>.pdf
//   --prefix <ön ek>  OCR sayfa dosyalarının ön eki; varsayılan <sınav-adı>
//   --offset <n>      OCR sayfa numarasına eklenip PDF sayfa numarası bulunur (bölünmüş PDF'ler için)
//   --range a-b       yalnızca bu PDF sayfa aralığı (büyük derlemeden tek sınav ayırmak için)
//   --answers f.json  cevap anahtarı (no -> harf); verilirse OCR'dan okunanın üzerine yazar
const argv = process.argv.slice(2)
const flags = {}
const positional = []
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--')) flags[argv[i].slice(2)] = argv[++i]
  else positional.push(argv[i])
}
const name = positional[0]
if (!name) throw new Error('Kullanım: node scripts/parseYdsExam.mjs <sınav-adı> [ocr-klasörü] [--pdf f] [--prefix p] [--offset n] [--range a-b]')
const ocrDir = positional[1] || 'C:/Projeler/OCR/output/raw/olmocr'
const outDir = 'local-data/yds'
const pdfName = flags.pdf || name + '.pdf'
const prefix = flags.prefix || name
const offset = Number(flags.offset || 0)
const [rangeFrom, rangeTo] = (flags.range || '1-99999').split('-').map(Number)

// OCR sayfa dosyaları: <ön ek>_s<no>.md ; PDF sayfa numarası = no + offset
const pageRe = new RegExp('^' + prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '_s(\\d+)\\.md$')
const pages = fs
  .readdirSync(ocrDir)
  .map((f) => ({ f, m: pageRe.exec(f) }))
  .filter((x) => x.m)
  .map((x) => ({ f: x.f, pdfPage: Number(x.m[1]) + offset }))
  .filter((x) => x.pdfPage >= rangeFrom && x.pdfPage <= rangeTo)
  .sort((a, b) => a.pdfPage - b.pdfPage)
if (pages.length === 0) throw new Error(`OCR sayfası bulunamadı: ${name} (${ocrDir})`)

// ---- sayfaları birleştir; cevap anahtarı sayfasını ayır ----
let body = ''
let keyHtml = ''
let title = ''
let started = false
const extraAnswers = {}
const PAGE_MARK = '\u0001PAGE:'
for (const { f, pdfPage } of pages) {
  const t = fs.readFileSync(path.join(ocrDir, f), 'utf8')
  if (/ANSWER KEY/i.test(t) || /<td>\s*\d{1,2}-[A-E]\s*<\/td>/.test(t)) {
    keyHtml += t
    continue
  }
  // Eski/derleme kitapçıklarda cevap anahtarı: "1. A" satırları, iki sütunlu "1. C   48. A" ya da <th>1.C</th>
  const keyPairs = [...t.matchAll(/(?:^|[\s>])(\d{1,2})\s*[.\-]\s*([A-E])(?![A-Za-z)\w])/gm)]
  if (keyPairs.length >= 40) {
    for (const m of keyPairs) if (Number(m[1]) <= 80 && !extraAnswers[Number(m[1])]) extraAnswers[Number(m[1])] = m[2]
    continue
  }
  // Kitapçık sonundaki "SINAVDA UYULACAK KURALLAR" sayfası soru içermez
  if (/SINAVDA UYULACAK KURALLAR/i.test(t)) continue
  // Kapak / "AÇIKLAMA" sayfaları: ilk şık satırı (A) ...) görülene kadar atlanır
  if (!started && !/^\s*A\)/m.test(t)) continue
  started = true
  const lines = t.split(/\r?\n/)
  // sayfa başlığı ("2024 Mart YDS") ve boş kapak sayfası
  if (!title && /^\d{4}\s.*YDS/i.test(lines[0] || '')) title = lines[0].trim()
  body += PAGE_MARK + pdfPage + '\n' + lines.filter((l) => !/^\d{4}\s.*(YDS|YÖKDİL)\s*$/i.test(l.trim())).join('\n') + '\n\n'
}

// ---- cevap anahtarı: <th>no</th> ... <td>harf</td> ----
const answers = {}
{
  const nums = [...keyHtml.matchAll(/<th>\s*(\d+)\s*<\/th>/g)].map((m) => Number(m[1]))
  const letters = [...keyHtml.matchAll(/<td>\s*([A-E])\s*<\/td>/g)].map((m) => m[1])
  nums.forEach((n, i) => {
    if (letters[i]) answers[n] = letters[i]
  })
  // Resmî ÖSYM kitapçığı biçimi: <td>20-A</td> çiftleri
  for (const m of keyHtml.matchAll(/<td>\s*(\d{1,2})-([A-E])\s*<\/td>/g)) answers[Number(m[1])] = m[2]
  for (const [k, v] of Object.entries(extraAnswers)) if (!answers[k]) answers[k] = v
  // --answers <dosya.json>: { "1": "A", ... } (PDF metninden okunan resmî anahtar; OCR gerekmeyen kaynaklar için)
  if (flags.answers) Object.assign(answers, JSON.parse(fs.readFileSync(flags.answers, 'utf8')))
  // OCR'ın okuyamadığı (filigranlı) cevaplar elle düzeltilir: scripts/data/answer_overrides.json
  const ovFile = 'scripts/data/answer_overrides.json'
  if (fs.existsSync(ovFile)) Object.assign(answers, JSON.parse(fs.readFileSync(ovFile, 'utf8'))[name] || {})
}

// ---- cümlelere bölme ----
// Tek harfli baş harfler (E. M. Forster, J. K. Rowling) cümle sonu sayılmaz
const ABBR = /(?:\b(?:Mr|Mrs|Ms|Dr|Prof|St|vs|etc|e\.g|i\.e|U\.S|U\.K|No|Fig|approx|Jr|Sr|Inc|Ltd|Co|p\.m|a\.m)\.|^[A-Z]\.|\b[A-Z]\.)$/i
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
    const endsSentence = /[.!?]["'”’)]*$/.test(tokens[i]) && !ABBR.test(tokens[i]) && !/^\d{1,2}\.$/.test(tokens[i])
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
let curPage = 0
let passagePage = 0
const pushPassageLine = (l) => {
  if (passageBuf.length === 0) passagePage = curPage
  passageBuf.push(l)
}

function flushPassage() {
  const text = passageBuf.join(' ').replace(/\s+/g, ' ').trim()
  passageBuf = []
  if (text.length < 40) return
  const id = `p${passages.length + 1}`
  passages.push({
    id,
    page: passagePage,
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
    page: q.page,
    passage: null,
    stem: stemText ? splitSentences(stemText).map((en, i) => ({ id: `q${q.no}.s${i + 1}`, en })) : [],
    options: Object.fromEntries(Object.entries(q.options).map(([k, en]) => [k, { id: `q${q.no}.${k}`, en }])),
    answer: answers[q.no] || null,
  })
  q = null
}


for (const raw of lines) {
  const line = raw.trim()
  if (!line) continue
  if (line.startsWith(PAGE_MARK)) {
    curPage = Number(line.slice(PAGE_MARK.length))
    continue
  }
  // "17 - 21: For these questions, ..." gibi bölüm yönergeleri soru/paragraf değildir
  // (Türkçe biçim: "43. - 46. soruları aşağıdaki parçaya göre cevaplayınız.")
  if (/^\d{1,2}\.?\s*-\s*\d{1,2}\.?\s*(:|sorular)/i.test(line)) continue
  // Sayfa üst bilgileri: "2013-YDS İlkbahar/İNGİLİZCE", "TEST OF ENGLISH"
  if (/^\d{4}\s*[-–]\s*YDS\b/i.test(line) || /^(TEST OF ENGLISH|İNGİLİZCE|ENGLISH)\s*$/i.test(line)) continue
  const numMatch = /^(\d{1,2})\.?$/.exec(line)
  // Resmî kitapçık biçimi: "12. Soru metni ..." (numara + nokta + aynı satırda metin); sırayla artmalı
  const inlineNum = /^(\d{1,2})\.\s+(\S.*)$/.exec(line)
  const expectedNo = (q ? q.no : questions.length ? questions[questions.length - 1].no : 0) + 1
  if (inlineNum && Number(inlineNum[1]) === expectedNo && expectedNo <= 80) {
    flushQuestion()
    if (expectedNo === 1) {
      passages.length = 0
      passageBuf = []
    }
    if (passageBuf.length) flushPassage()
    q = { no: expectedNo, page: curPage, stem: [inlineNum[2]], options: {} }
    continue
  }
  if (numMatch && Number(numMatch[1]) <= 80) {
    flushQuestion()
    if (passageBuf.length) flushPassage()
    q = { no: Number(numMatch[1]), page: curPage, stem: [], options: {} }
    continue
  }
  // Bir satırda birden çok şık olabilir: "A) x    B) y    C) z" ya da "D) x    E) y"
  if (q && /^[A-E]\)\s/.test(line)) {
    for (const piece of line.split(/\s{2,}(?=[A-E]\)\s)/)) {
      const m = /^([A-E])\)\s*(.*)$/.exec(piece.trim())
      if (m) q.options[m[1]] = m[2].trim()
    }
    continue
  }
  if (q && Object.keys(q.options).length >= 5) {
    // soru bitti; bu satır yeni bir paragrafın başlangıcı
    flushQuestion()
    pushPassageLine(line)
    continue
  }
  if (q) q.stem.push(line)
  else pushPassageLine(line)
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
    let taken = 0
    for (const x of questions.filter((y) => y.no > p.afterNo).sort((a, b) => a.no - b.no)) {
      if (next && x.no > next.afterNo) break
      const stem = x.stem.map((t) => t.en).join(' ')
      // Son paragraf: YDS'de okuma paragrafları 4'er sorudur; diyalog sorusu ("Ad: – ...") başlarsa dur
      if (!next && (taken >= 4 || /^[A-Z][A-Za-z ]{1,20}: [–-]/.test(stem))) break
      x.passage = p.id
      taken++
    }
  }
}
for (const p of passages) delete p.afterNo

const exam = {
  id: name,
  title: flags.title || title || name,
  pdf: pdfName,
  pageFrom: pages[0].pdfPage,
  pageTo: pages[pages.length - 1].pdfPage,
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
