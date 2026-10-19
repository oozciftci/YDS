// cikmis2.pdf içindeki 12 resmî YÖKDİL sınavını (2018 İlkbahar/Yaz, 2019 Mart/Kasım × Sosyal/Sağlık/Fen)
// local-data/yds/yokdil-*.json olarak içe aktarır. OCR gerekmez: PDF'in kendi metni (pdftotext -raw) kullanılır.
// Çıktı YALNIZCA yerelde kalır (local-data, gitignore'da, şifreli kasaya dahil).
//
//   pdftotext -enc UTF-8 -raw cikmis_sorular/cikmis2.pdf c2_raw.txt
//   node scripts/importYokdil.mjs c2_raw.txt [sınav-id ...]
//
// YÖKDİL düzeni (hepsinde aynı): 1-20 boşluk (kelime + dilbilgisi), 21-25 ve 26-30 cloze parçaları, 31-41 cümle
// tamamlama, 42-47 İng→Tür, 48-53 Tür→İng, 54-59 paragraf tamamlama, 60-65 anlam bütünlüğünü bozan cümle,
// 66-80 beş okuma parçası × 3 soru.
import fs from 'node:fs'

// Cloze (21, 26) ve okuma (66, 69, 72, 75, 78) parçalarının ilk sorusu
const PASSAGE_STARTS = new Set([21, 26, 66, 69, 72, 75, 78])

const [rawFile, ...only] = process.argv.slice(2)
if (!rawFile) throw new Error('Kullanım: node scripts/importYokdil.mjs <pdftotext -raw çıktısı> [id ...]')

const EXAMS = [
  ['yokdil-2018-ilkbahar-sosyal', '2018 İlkbahar YÖKDİL Sosyal', 'Sosyal', 669, 693],
  ['yokdil-2018-ilkbahar-saglik', '2018 İlkbahar YÖKDİL Sağlık', 'Sağlık', 694, 717],
  ['yokdil-2018-ilkbahar-fen', '2018 İlkbahar YÖKDİL Fen', 'Fen', 718, 743],
  ['yokdil-2018-yaz-sosyal', '2018 Yaz YÖKDİL Sosyal', 'Sosyal', 599, 622],
  ['yokdil-2018-yaz-saglik', '2018 Yaz YÖKDİL Sağlık', 'Sağlık', 623, 645],
  ['yokdil-2018-yaz-fen', '2018 Yaz YÖKDİL Fen', 'Fen', 646, 668],
  ['yokdil-2019-mart-sosyal', '2019 Mart YÖKDİL Sosyal', 'Sosyal', 744, 766],
  ['yokdil-2019-mart-saglik', '2019 Mart YÖKDİL Sağlık', 'Sağlık', 483, 505],
  ['yokdil-2019-mart-fen', '2019 Mart YÖKDİL Fen', 'Fen', 506, 529],
  ['yokdil-2019-kasim-sosyal', '2019 Kasım YÖKDİL Sosyal', 'Sosyal', 530, 552],
  ['yokdil-2019-kasim-saglik', '2019 Kasım YÖKDİL Sağlık', 'Sağlık', 553, 575],
  ['yokdil-2019-kasim-fen', '2019 Kasım YÖKDİL Fen', 'Fen', 576, 598],
]

const pages = fs.readFileSync(rawFile, 'utf8').split('\f')

/**
 * Cevap anahtarı iki biçimde gelir: "A GRUBU CEVAP ANAHTARI" + numara/harf satır çiftleri ya da "1) A 2) B ..." satırları.
 * Yalnızca A grubu alınır.
 */
function parseKey(text) {
  const out = {}
  let body = text.slice(text.search(/CEVAP ANAHTAR[Iı]/i))
  const b = body.search(/B GRUBU/i)
  if (b > 0) body = body.slice(0, b)
  for (const m of body.matchAll(/(\d{1,2})\)\s*([A-E])\b/g)) out[Number(m[1])] = m[2]
  if (Object.keys(out).length >= 70) return out
  const lines = body.split('\n').map((l) => l.trim())
  for (let i = 0; i < lines.length - 1; i++) {
    if (/^\d{1,2}(?: \d{1,2})+$/.test(lines[i]) && /^[A-E](?: [A-E])+$/.test(lines[i + 1])) {
      const n = lines[i].split(' ')
      const l = lines[i + 1].split(' ')
      n.forEach((x, k) => (out[Number(x)] = l[k]))
      i++
    }
  }
  return out
}

// ---- cümlelere bölme (parseYdsExam.mjs ile aynı kurallar) ----
const ABBR = /(?:\b(?:Mr|Mrs|Ms|Dr|Prof|St|vs|etc|e\.g|i\.e|U\.S|U\.K|No|Fig|approx|Jr|Sr|Inc|Ltd|Co|p\.m|a\.m)\.|^[A-Z]\.|\b[A-Z]\.)$/i
const ROMAN_MARK = / (?=\((?:I|II|III|IV|V)\) )/
function splitSentences(text) {
  const clean = text.replace(/\s+/g, ' ').trim()
  const marked = clean.split(ROMAN_MARK)
  if (marked.length > 1) return marked
  const parts = []
  let cur = ''
  const tokens = clean.split(' ')
  for (let i = 0; i < tokens.length; i++) {
    cur += (cur ? ' ' : '') + tokens[i]
    const next = tokens[i + 1]
    const ends = /[.!?]["'”’)]*$/.test(tokens[i]) && !ABBR.test(tokens[i]) && !/^\d{1,2}\.$/.test(tokens[i])
    if (ends && (!next || /^["'“‘(]*[A-ZİÖÜÇŞĞ0-9]/.test(next))) {
      parts.push(cur)
      cur = ''
    }
  }
  if (cur) parts.push(cur)
  return parts
}

/** Satırları birleştirir; satır sonundaki tire ("non-" + "alcoholic") boşluksuz bitişir. */
function joinLines(lines) {
  let out = ''
  for (const l of lines) {
    if (!out) out = l
    else if (/[A-Za-zÇĞİÖŞÜçğıöşü]-$/.test(out) && /^[a-zçğıöşü]/.test(l)) out += l
    else out += ' ' + l
  }
  // Boşluk işareti PDF'te "-- --" ya da "-----" çıkabilir; hepsi "----" olur
  return out
    .replace(/\s+/g, ' ')
    .replace(/[-–—]{3,}/g, '----')
    .replace(/(^|[\s(,;:])[-–—]{1,2}\s?[-–—]{1,2}(?=[\s.,;:)]|$)/g, '$1----')
    .trim()
}

function parseExam([id, title, field, from, to]) {
  const range = pages.slice(from - 1, to)
  const keyIdx = range.findLastIndex((p) => /CEVAP ANAHTAR[Iı]/i.test(p))
  const answers = keyIdx >= 0 ? parseKey(range[keyIdx]) : {}

  // Satır akışı: [metin, pdfSayfa]; üst bilgi ve tek başına sayfa numaraları atılır
  const stream = []
  range.forEach((text, i) => {
    if (i === keyIdx) return
    for (const raw of text.split('\n')) {
      const l = raw.trim()
      if (!l || /^YÖKDİL .*SORULARI$/.test(l) || /^\d{1,2}$/.test(l)) continue
      stream.push([l, from + i])
    }
  })

  const passages = []
  const questions = []
  let q = null
  let opt = null
  let buf = [] // aktif parça / soru gövdesi satırları
  let bufPage = from
  let mode = 'stem' // 'stem' | 'passage'
  let passageKind = null
  let passageNo = null // aktif parçanın id'si (cloze/okuma sorularına bağlanır)
  let nextNo = 1
  let curPage = from

  const flushPassage = () => {
    const text = joinLines(buf)
    buf = []
    if (!text) return
    // Gerçek parçalar uzundur; çok kısa olan, önceki sorunun E şıkkının büyük harfle başlayan devam satırıdır
    if (text.length < 150 && questions.length && questions.at(-1).options.E) {
      questions.at(-1).options.E.en = (questions.at(-1).options.E.en + ' ' + text).trim()
      return
    }
    const pid = `p${passages.length + 1}`
    passages.push({
      id: pid,
      page: bufPage,
      afterNo: nextNo - 1,
      kind: passageKind,
      text,
      sentences: splitSentences(text).map((en, i) => ({ id: `${pid}.${i + 1}`, en })),
    })
    passageNo = pid
  }
  const finishQuestion = () => {
    if (!q) return
    q.stemText = joinLines(q.stemLines)
    // PDF'in metin katmanı bazı boşlukları (----) hiç içermez; yapıdan güvenle geri konur
    if (!/----/.test(q.stemText) && !(q.no >= 21 && q.no <= 30) && (q.no <= 20 || (q.no >= 31 && q.no <= 41) || (q.no >= 54 && q.no <= 59))) {
      if (/^[a-zçğıöşü]/.test(q.stemText)) q.stemText = '---- ' + q.stemText
      else if (/,\s*\.$/.test(q.stemText)) q.stemText = q.stemText.replace(/,\s*\.$/, ', ---- .')
      else if (/[;:]\s*\.$/.test(q.stemText)) q.stemText = q.stemText.replace(/([;:])\s*\.$/, '$1 ---- .')
      q.repaired = /----/.test(q.stemText)
    }
    q.stem = q.stemText ? splitSentences(q.stemText).map((en, i) => ({ id: `q${q.no}.s${i + 1}`, en })) : []
    for (const k of Object.keys(q.options)) q.options[k] = { id: `q${q.no}.${k}`, en: joinLines(q.options[k]) }
    delete q.stemLines
    delete q.stemText
    questions.push(q)
    q = null
    opt = null
  }

  for (let i = 0; i < stream.length; i++) {
    const [l, pg] = stream[i]
    curPage = pg

    // Yönerge: "21 - 25. sorularda, ..." (birkaç satır; "bulunuz." / "cevaplayınız." ile biter)
    const ins = /^(\d{1,2})\s*[-–]\s*(\d{1,2})\.\s*soru/i.exec(l)
    if (ins) {
      finishQuestion()
      if (mode === 'passage') flushPassage()
      let text = l
      while (!/(bulunuz|cevaplayınız|işaretleyiniz)\.\s*$/i.test(text) && i + 1 < stream.length) text += ' ' + stream[++i][0]
      const from2 = Number(ins[1])
      if (/aşağıdaki parçada\s+numaralanmış/i.test(text)) {
        mode = 'passage'
        passageKind = 'cloze'
      } else if (/parçaya göre cevaplayınız/i.test(text)) {
        mode = 'passage'
        passageKind = 'reading'
        // Okuma parçası yönergeyle aynı satırda başlar: "... cevaplayınız. Cancer is one of ..."
        const rest = /cevaplayınız\.\s*(.*)$/i.exec(text)?.[1]
        buf = []
        bufPage = pg
        if (rest) buf.push(rest)
      } else {
        mode = 'stem'
        passageKind = null
        passageNo = null
      }
      if (mode === 'passage' && passageKind === 'cloze') {
        buf = []
        bufPage = pg
      }
      nextNo = from2
      continue
    }

    // Cloze seçenek grubu: "21." tek başına
    const clozeNo = /^(\d{1,2})\.$/.exec(l)
    if (clozeNo && Number(clozeNo[1]) === nextNo) {
      finishQuestion()
      if (mode === 'passage') {
        flushPassage()
        mode = 'stem'
      }
      q = { no: nextNo, page: pg, passage: passageNo, stemLines: [], options: {} }
      nextNo++
      opt = null
      continue
    }

    // Soru başı: "66. According to ..." (beklenen numara)
    const qm = /^(\d{1,2})\.\s+(\S.*)$/.exec(l)
    if (qm && Number(qm[1]) === nextNo && !/^[A-E]\)/.test(l)) {
      finishQuestion()
      if (mode === 'passage') {
        flushPassage()
        mode = 'stem'
      }
      q = { no: nextNo, page: pg, passage: passageKind === 'reading' || passageKind === 'cloze' ? passageNo : null, stemLines: [qm[2]], options: {} }
      nextNo++
      opt = null
      continue
    }

    if (q && /^[A-E]\)/.test(l)) {
      // Aynı satırda iki seçenek olabilir: "A) since B) so that"
      for (const part of l.split(/\s+(?=[A-E]\)\s)/)) {
        const om = /^([A-E])\)\s*(.*)$/.exec(part)
        if (!om) continue
        opt = om[1]
        q.options[opt] = [om[2]]
      }
      continue
    }
    if (q) {
      // Yönergesiz sınavlarda (2019 Kasım) parça, cloze/okuma bölümünün ilk sorusundan hemen önce başlar:
      // son sorunun E şıkkından sonra büyük harfle (ya da tırnak/rakamla) başlayan satır parçanın ilk satırıdır
      if (opt === 'E' && PASSAGE_STARTS.has(nextNo) && mode === 'stem' && /^[A-ZÇĞİÖŞÜ0-9"“‘']/.test(l)) {
        finishQuestion()
        mode = 'passage'
        passageKind = nextNo === 21 || nextNo === 26 ? 'cloze' : 'reading'
        buf = [l]
        bufPage = pg
        continue
      }
      if (opt) q.options[opt].push(l)
      else q.stemLines.push(l)
      continue
    }
    if (mode === 'passage') {
      if (!buf.length) bufPage = pg
      buf.push(l)
    }
  }
  finishQuestion()
  if (mode === 'passage') flushPassage()

  // Cevap ve parça bağlantıları
  for (const x of questions) {
    x.answer = answers[x.no] ?? null
    // 1-20, 31-65: parçasız
    if (x.no < 21 || (x.no > 30 && x.no < 66)) x.passage = null
  }
  return {
    id,
    pdf: 'cikmis2.pdf',
    pageFrom: from,
    pageTo: to,
    title,
    kind: 'yokdil',
    field,
    questionCount: questions.length,
    answered: questions.filter((x) => x.answer).length,
    passages,
    questions,
  }
}

fs.mkdirSync('local-data/yds', { recursive: true })
for (const def of EXAMS) {
  if (only.length && !only.includes(def[0])) continue
  const exam = parseExam(def)
  fs.writeFileSync(`local-data/yds/${def[0]}.json`, JSON.stringify(exam, null, 1))
  const cloze = exam.passages.filter((p) => p.kind === 'cloze').length
  const reading = exam.passages.filter((p) => p.kind === 'reading').length
  console.log(`${def[0].padEnd(28)} ${exam.questionCount} soru · ${exam.answered} cevap · ${cloze} cloze + ${reading} okuma parçası`)
}
