// Çıkmış YDS sınavlarının (local-data/yds/*.json) tamamında kelime sıklığı ve şık analizi.
//
//   node scripts/analyzeYdsCorpus.mjs
//
// Çıktılar:
//   local-data/analiz/kelime_analizi.json      -> tüm kelimelerin istatistiği + geçtiği cümleler (YEREL, telifli)
//   local-data/analiz/yds_kelime_analizi.html  -> çift tıklayıp açılan rapor (YEREL, telifli)
//   local-data/analiz/kelime_ornekleri.json    -> paket kelimeleri için sınav cümleleri (dev sunucusu sunar)
//   local-data/analiz/paket_adaylari.txt       -> pakete aday olup henüz anlamı yazılmamış kelimeler
//   public/data/yeni_yds_kelimeleri.json       -> "Yeni YDS Kelimeleri" paketi (YAYINA GİRER: yalnızca
//                                                 kelime, anlam ve sayısal istatistik; sınav cümlesi YOK)
// Paketin Türkçe anlamları scripts/data/yeni_yds_kelimeleri.txt dosyasındadır (kelime|tür|anlam|eş anlamlılar).
import fs from 'node:fs'
import path from 'node:path'

const EXAM_DIR = 'local-data/yds'
const OUT_DIR = 'local-data/analiz'
const MEANINGS = 'scripts/data/yeni_yds_kelimeleri.txt'
const PACK_OUT = 'public/data/yeni_yds_kelimeleri.json'
const OX_CACHE = path.join(OUT_DIR, 'oxford5000.json')
const ORDER = ['A1', 'A2', 'B1', 'B2', 'C1']

// ÖSYM 80 soruluk düzen (src/services/ydsSections.ts ile aynı aralıklar)
const SECTIONS = [
  ['vocab', 'Kelime', 1, 6],
  ['grammar', 'Dilbilgisi', 7, 16],
  ['cloze', 'Cloze', 17, 26],
  ['completion', 'Cümle Tamamlama', 27, 36],
  ['translation', 'Çeviri', 37, 42],
  ['reading', 'Okuma', 43, 62],
  ['dialogue', 'Diyalog', 63, 67],
  ['paraphrase', 'Yakın Anlam', 68, 71],
  ['paragraph', 'Paragraf Tamamlama', 72, 75],
  ['irrelevant', 'Anlam Bütünlüğü', 76, 80],
]
const sectionOf = (no) => SECTIONS.find(([, , a, b]) => no >= a && no <= b)?.[0] ?? 'other'

const STOP = new Set(
  `a an the and or but nor so yet if of to in on at by for with from into onto upon about as than then that this these those
  there here what which who whom whose when where why how all any both each few more most other some such no not only own same
  too very can could may might must shall should will would do does did done doing be am is are was were been being have has had
  having i me my myself we us our ours you your yours he him his she her hers it its itself they them their theirs one also just
  s t don isn aren wasn weren hasn haven hadn doesn didn won wouldn shouldn couldn mustn mightn shan ll ve re d m o x e g i ii iii
  iv v vi etc per via up out off over under again further once non pre anti mid co re un multi inter sub semi`.split(/\s+/),
)
const IRREGULAR = {
  went: 'go', gone: 'go', saw: 'see', seen: 'see', took: 'take', taken: 'take', made: 'make', gave: 'give', given: 'give',
  came: 'come', became: 'become', began: 'begin', begun: 'begin', found: 'find', thought: 'think', brought: 'bring',
  bought: 'buy', caught: 'catch', taught: 'teach', sought: 'seek', fought: 'fight', held: 'hold', kept: 'keep', left: 'leave',
  led: 'lead', lost: 'lose', meant: 'mean', met: 'meet', paid: 'pay', said: 'say', sold: 'sell', sent: 'send', spent: 'spend',
  stood: 'stand', told: 'tell', understood: 'understand', won: 'win', wrote: 'write', written: 'write', drew: 'draw',
  drawn: 'draw', grew: 'grow', grown: 'grow', knew: 'know', known: 'know', threw: 'throw', thrown: 'throw', rose: 'rise',
  risen: 'rise', arose: 'arise', arisen: 'arise', fell: 'fall', fallen: 'fall', felt: 'feel', built: 'build', dealt: 'deal',
  ate: 'eat', eaten: 'eat', chose: 'choose', chosen: 'choose', broke: 'break', broken: 'break', spoke: 'speak', spoken: 'speak',
  wore: 'wear', worn: 'wear', drove: 'drive', driven: 'drive', forgot: 'forget', forgotten: 'forget', hid: 'hide',
  hidden: 'hide', lay: 'lie', laid: 'lay', bore: 'bear', borne: 'bear', undertook: 'undertake', undertaken: 'undertake',
  withdrew: 'withdraw', withdrawn: 'withdraw', overcame: 'overcome', children: 'child', women: 'woman', men: 'man',
  people: 'people', mice: 'mouse', teeth: 'tooth', feet: 'foot', data: 'data', phenomena: 'phenomenon', criteria: 'criterion',
  analyses: 'analysis', hypotheses: 'hypothesis', crises: 'crisis', bases: 'basis', theses: 'thesis', stimuli: 'stimulus',
  fungi: 'fungus', nuclei: 'nucleus', bacteria: 'bacteria', larvae: 'larva', better: 'good', best: 'good', worse: 'bad',
  worst: 'bad', lives: 'life', wives: 'wife', knives: 'knife', leaves: 'leaf', halves: 'half', shelves: 'shelf',
  selves: 'self', wolves: 'wolf', thieves: 'thief', shown: 'show', heard: 'hear', proven: 'prove', fed: 'feed',
  bred: 'breed', fled: 'flee', struck: 'strike', stuck: 'stick', sank: 'sink', sunk: 'sink', swam: 'swim', ran: 'run',
  sat: 'sit', slept: 'sleep', swept: 'sweep', woke: 'wake', woken: 'wake', froze: 'freeze', frozen: 'freeze',
  shook: 'shake', shaken: 'shake', flew: 'fly', flown: 'fly', forbade: 'forbid', forbidden: 'forbid', foresaw: 'foresee',
  foreseen: 'foresee', sprang: 'spring', sprung: 'spring', bound: 'bind', underwent: 'undergo',
  undergone: 'undergo', misled: 'mislead', got: 'get', gotten: 'get', lying: 'lie', dying: 'die', tying: 'tie', overtook: 'overtake', overtaken: 'overtake',
}

// ---------- Veri ----------
const examFiles = fs
  .readdirSync(EXAM_DIR)
  .filter((f) => /^yds-.*\.json$/.test(f) && !f.endsWith('.tr.json'))
  .sort()
const exams = examFiles.map((f) => {
  const exam = JSON.parse(fs.readFileSync(path.join(EXAM_DIR, f), 'utf8'))
  const trFile = path.join(EXAM_DIR, f.replace(/\.json$/, '.tr.json'))
  const tr = fs.existsSync(trFile) ? JSON.parse(fs.readFileSync(trFile, 'utf8')) : {}
  const year = Number(/(20\d\d)/.exec(exam.title)?.[1] || /(20\d\d)/.exec(exam.id)?.[1])
  return { exam, tr, year }
})

async function loadOxford() {
  if (fs.existsSync(OX_CACHE)) return JSON.parse(fs.readFileSync(OX_CACHE, 'utf8'))
  const ox = await (
    await fetch('https://raw.githubusercontent.com/tyypgzl/Oxford-5000-words/master/full-word.json')
  ).json()
  fs.mkdirSync(OUT_DIR, { recursive: true })
  fs.writeFileSync(OX_CACHE, JSON.stringify(ox))
  return ox
}
const levelMap = new Map()
for (const { value } of await loadOxford()) {
  if (!ORDER.includes(value?.level)) continue
  const w = value.word.toLowerCase().trim()
  if (!levelMap.has(w) || ORDER.indexOf(value.level) < ORDER.indexOf(levelMap.get(w))) levelMap.set(w, value.level)
}
const poolTerms = new Set()
for (const f of ['public/data/oxford3000_tr.json', 'public/data/yds_sinav_paketi.json']) {
  for (const w of JSON.parse(fs.readFileSync(f, 'utf8'))) poolTerms.add(w.term.toLowerCase().trim())
}
const builtinPackTerms = [...fs.readFileSync('src/data/wordPacks.ts', 'utf8').matchAll(/term:\s*'([^']+)'/g)].map((m) =>
  m[1].toLowerCase(),
)
for (const t of builtinPackTerms) poolTerms.add(t)

// ---------- Segmentler ----------
const isTurkish = (s) => (s.match(/[çğışöüÇĞİŞÖÜ]/g) || []).length >= 3 || /\b(ve|bir|için|ile|olarak|daha)\b/.test(s)
const segments = [] // {key, examIdx, id, en, tr, kind, no, section, letter, correct}
for (const [examIdx, { exam, tr }] of exams.entries()) {
  const passageSection = new Map()
  for (const q of exam.questions) if (q.passage && !passageSection.has(q.passage)) passageSection.set(q.passage, q)
  for (const p of exam.passages) {
    const q = passageSection.get(p.id)
    for (const s of p.sentences)
      segments.push({ examIdx, id: s.id, en: s.en, tr: tr[s.id], kind: 'passage', no: q?.no ?? 0, section: q ? sectionOf(q.no) : 'other' })
  }
  for (const q of exam.questions) {
    const section = sectionOf(q.no)
    for (const s of q.stem) segments.push({ examIdx, id: s.id, en: s.en, tr: tr[s.id], kind: 'stem', no: q.no, section })
    for (const [letter, o] of Object.entries(q.options))
      segments.push({
        examIdx, id: o.id, en: o.en, tr: tr[o.id], kind: 'option', no: q.no, section, letter,
        correct: q.answer ? q.answer === letter : null,
      })
  }
}
const english = segments.filter((s) => s.en && !isTurkish(s.en))

// ---------- Kök bulma ----------
const tokenRe = /[A-Za-z]+(?:'[A-Za-z]+)?/g
const corpusTokens = new Set()
const capStats = new Map() // kelime -> [büyük harfli (cümle ortası), toplam]
for (const s of english) {
  for (const m of s.en.matchAll(tokenRe)) {
    const raw = m[0].replace(/'s$|'$/i, '')
    const low = raw.toLowerCase()
    corpusTokens.add(low)
    const c = capStats.get(low) || [0, 0] // [küçük harfle geçiş, toplam]
    c[1]++
    if (/^[a-z]/.test(raw)) c[0]++
    capStats.set(low, c)
  }
}
const strong = (w) => levelMap.has(w) || poolTerms.has(w)
// İngiliz yazımı (-ise, -isation, -our) havuzdaki Amerikan yazımına eşlenir
function spellingVariant(w) {
  const v = w.replace(/is(e|ed|es|ing|ation|ations|er|ers)$/, 'iz$1').replace(/our(s?)$/, 'or$1')
  return v !== w ? v : null
}
const undouble = (b) => (/([b-df-hj-np-tv-z])\1$/.test(b) ? b.slice(0, -1) : null)
function lemmaRaw(t) {
  if (IRREGULAR[t]) return IRREGULAR[t]
  if (poolTerms.has(t)) return t
  const pick = (cands) => cands.filter(Boolean).find(strong)
  const pickWeak = (cands) => cands.filter(Boolean).find((c) => corpusTokens.has(c) && c.length > 2)
  const s = [] // çoğul / 3. tekil
  if (/ies$/.test(t)) s.push(t.slice(0, -3) + 'y')
  if (/ves$/.test(t)) s.push(t.slice(0, -3) + 'f', t.slice(0, -3) + 'fe')
  if (/(ss|sh|ch|x|z|o|us)es$/.test(t)) s.push(t.slice(0, -2))
  if (/s$/.test(t) && !/(ss|us|is)$/.test(t)) s.push(t.slice(0, -1))
  if (/ses$/.test(t)) s.push(t.slice(0, -2))
  const v = [] // -ed / -ing
  if (/ied$/.test(t)) v.push(t.slice(0, -3) + 'y')
  if (/ed$/.test(t)) v.push(t.slice(0, -1), t.slice(0, -2), undouble(t.slice(0, -2)))
  if (/ing$/.test(t)) v.push(t.slice(0, -3) + 'e', t.slice(0, -3), undouble(t.slice(0, -3)))
  const a = [] // -er / -est (yalnızca kelimenin kendisi sözlükte yoksa: teacher -> teach olmasın)
  if (/ier$/.test(t)) a.push(t.slice(0, -3) + 'y')
  if (/iest$/.test(t)) a.push(t.slice(0, -4) + 'y')
  if (/er$/.test(t)) a.push(t.slice(0, -2), t.slice(0, -1), undouble(t.slice(0, -2)))
  if (/est$/.test(t)) a.push(t.slice(0, -3), t.slice(0, -2), undouble(t.slice(0, -3)))
  const strongPick = pick(s) || pick(v) || (!strong(t) && pick(a))
  if (strongPick) return strongPick
  if (strong(t)) return t
  const weak = pickWeak(s) || pickWeak(v)
  if (weak) return weak
  // Sözlükte de korpusta da tekili olmayan nadir çoğullar (wavelengths -> wavelength)
  if (/ies$/.test(t) && t.length > 6) return t.slice(0, -3) + 'y'
  if (/[^s]s$/.test(t) && !/(ies|us|is|ous|ics|ys|as|ss)$/.test(t) && t.length > 4) return t.slice(0, -1)
  return t
}
const lemmaCache = new Map()
function lemma(t) {
  if (lemmaCache.has(t)) return lemmaCache.get(t)
  let out = lemmaRaw(t)
  const alt = !strong(out) && spellingVariant(t)
  if (alt && strong(lemmaRaw(alt))) out = lemmaRaw(alt)
  lemmaCache.set(t, out)
  return out
}

// ---------- Sayım ----------
const words = new Map()
const get = (w) => {
  if (!words.has(w))
    words.set(w, {
      w, total: 0, forms: {}, exams: new Set(), years: {}, sections: {}, kinds: { passage: 0, stem: 0, option: 0 },
      optionSegs: 0, correctSegs: 0, vocabOffered: 0, vocabCorrect: 0, refs: [],
    })
  return words.get(w)
}
for (const [segIdx, s] of english.entries()) {
  const seen = new Set()
  for (const m of s.en.matchAll(tokenRe)) {
    const low = m[0].replace(/'s$|'$/i, '').toLowerCase()
    if (low.length < 2 || STOP.has(low)) continue
    const c = capStats.get(low)
    if (c && c[0] === 0) continue // hiç küçük harfle geçmeyen: özel isim / kısaltma
    const l = lemma(low)
    if (STOP.has(l)) continue
    const e = get(l)
    e.total++
    e.forms[low] = (e.forms[low] || 0) + 1
    const { exam, year } = exams[s.examIdx]
    e.exams.add(exam.id)
    e.years[year] = (e.years[year] || 0) + 1
    e.sections[s.section] = (e.sections[s.section] || 0) + 1
    e.kinds[s.kind]++
    if (!seen.has(l)) {
      seen.add(l)
      e.refs.push(segIdx)
      if (s.kind === 'option') {
        e.optionSegs++
        if (s.correct) e.correctSegs++
        if (s.section === 'vocab') {
          e.vocabOffered++
          if (s.correct) e.vocabCorrect++
        }
      }
    }
  }
}

// Kelime sorularının (1-6) şıkları olduğu gibi (phrasal verb'ler dahil)
const vocabOptions = new Map()
for (const [segIdx, s] of english.entries()) {
  if (s.kind !== 'option' || s.section !== 'vocab') continue
  // Bazı sınavlarda şık iki boşluklu olabilir ("x / y"); her parçayı ayrı say
  for (const part of s.en.split('/').map((x) => x.trim().toLowerCase().replace(/[.,;]+$/, ''))) {
    if (!part) continue
    const key = part.split(/\s+/).map((t, i) => (i === 0 ? lemma(t) : t)).join(' ')
    const v = vocabOptions.get(key) || { item: key, forms: new Set(), offered: 0, correct: 0, refs: [] }
    v.forms.add(part)
    v.offered++
    if (s.correct) v.correct++
    v.refs.push(segIdx)
    vocabOptions.set(key, v)
  }
}

// ---------- Paket adayları ----------
const levelOf = (w) => levelMap.get(w) || null
const list = [...words.values()].sort((a, b) => b.total - a.total || a.w.localeCompare(b.w))
const isCandidate = (e) =>
  !poolTerms.has(e.w) &&
  !['A1', 'A2'].includes(levelOf(e.w)) &&
  e.w.length > 2 &&
  /^[a-z]+$/.test(e.w) &&
  (e.exams.size >= 4 || e.vocabOffered > 0)
const meanings = new Map()
if (fs.existsSync(MEANINGS)) {
  for (const line of fs.readFileSync(MEANINGS, 'utf8').split(/\r?\n/)) {
    if (!line.trim() || line.startsWith('#')) continue
    const [term, pos, definition, syn] = line.split('|').map((s) => s.trim())
    meanings.set(term.toLowerCase(), { term, pos, definition, syn })
  }
}

// ---------- Çıktılar ----------
fs.mkdirSync(OUT_DIR, { recursive: true })
const examMeta = exams.map(({ exam, year }) => ({ id: exam.id, title: exam.title, year, keyed: exam.answered > 0 }))
const years = [...new Set(exams.map((e) => e.year))].sort()
const summary = {
  exams: exams.length,
  years,
  segments: english.length,
  tokens: list.reduce((n, e) => n + e.total, 0),
  lemmas: list.length,
  generatedAt: new Date().toISOString(),
}
const wordRows = list.map((e) => ({
  w: e.w,
  level: levelOf(e.w),
  inPool: poolTerms.has(e.w),
  inPack: meanings.has(e.w) && meanings.get(e.w).definition !== '-',
  total: e.total,
  exams: e.exams.size,
  years: e.years,
  sections: e.sections,
  kinds: e.kinds,
  optionSegs: e.optionSegs,
  correctSegs: e.correctSegs,
  vocabOffered: e.vocabOffered,
  vocabCorrect: e.vocabCorrect,
  forms: e.forms,
  refs: e.refs,
}))
const vocabRows = [...vocabOptions.values()]
  .sort((a, b) => b.offered - a.offered || b.correct - a.correct || a.item.localeCompare(b.item))
  .map((v) => ({ item: v.item, forms: [...v.forms], offered: v.offered, correct: v.correct, refs: v.refs }))
const segRows = english.map((s) => ({
  e: s.examIdx, id: s.id, en: s.en, tr: s.tr || '', k: s.kind, no: s.no, sec: s.section, l: s.letter || '', c: s.correct,
}))
const analysis = { summary, sections: SECTIONS.map(([k, label]) => ({ k, label })), exams: examMeta, words: wordRows, vocab: vocabRows, segments: segRows }
fs.writeFileSync(path.join(OUT_DIR, 'kelime_analizi.json'), JSON.stringify(analysis))

const candidates = list.filter(isCandidate)
const missing = candidates.filter((e) => !meanings.has(e.w))
fs.writeFileSync(
  path.join(OUT_DIR, 'paket_adaylari.txt'),
  missing
    .map((e) => `${e.w}\t${e.total}\t${e.exams.size}\t${levelOf(e.w) || '-'}\t${e.vocabOffered}/${e.vocabCorrect}\t${Object.keys(e.forms).join(',')}`)
    .join('\n'),
)

// Paket: anlamı yazılmış adaylar
const POS = { n: 'noun', v: 'verb', adj: 'adjective', adv: 'adverb', prep: 'preposition', conj: 'conjunction', phr: 'phrase' }
const DIFFICULTY = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 5 }
const GROUP_TAGS = { A: ['Başlangıç', 'Temel-İngilizce'], B: ['Orta', 'Genel-İngilizce'], C: ['İleri'] }
const freqTag = (e) => (e.exams.size >= 15 ? 'YDS-Çok-Sık' : e.exams.size >= 8 ? 'YDS-Sık' : e.exams.size >= 4 ? 'YDS-Ara' : null)
const pack = []
const examples = {}
for (const e of list) {
  const m = meanings.get(e.w)
  if (!m || m.definition === '-') continue
  const known = levelOf(e.w)
  const level = known || 'C1'
  const yearSpan = Object.keys(e.years).map(Number)
  const parts = [`${exams.length} çıkmış sınavın ${e.exams.size} tanesinde toplam ${e.total} kez geçti (${Math.min(...yearSpan)}–${Math.max(...yearSpan)}).`]
  if (e.vocabOffered) parts.push(`Kelime sorularında ${e.vocabOffered} kez şık oldu, ${e.vocabCorrect} kez doğru cevaptı.`)
  else if (e.optionSegs) parts.push(`${e.optionSegs} şıkta yer aldı${e.correctSegs ? `, ${e.correctSegs} kez doğru şıkta` : ''}.`)
  const tag = freqTag(e)
  pack.push({
    term: m.term,
    definition: m.definition,
    partOfSpeech: POS[m.pos] || 'noun',
    synonyms: m.syn ? m.syn.split(',').map((s) => s.trim()).filter(Boolean) : [],
    antonyms: [],
    collocations: [],
    sentences: [],
    tags: [
      level, ...GROUP_TAGS[level[0]], 'Yeni-YDS-Kelimeleri', ...(known ? [] : ['Seviye-Tahmini']), ...(tag ? [tag] : []),
      ...(e.vocabOffered ? ['YDS-Şıkta-Çıktı'] : []), ...(e.vocabCorrect ? ['YDS-Doğru-Cevap'] : []),
    ],
    difficulty: DIFFICULTY[level],
    notes: parts.join(' '),
  })
  // Dev sunucusunda pakete eklenecek gerçek sınav cümleleri (en fazla 3, en yeni sınavlardan). Kelime
  // sorusunda doğru cevapsa soru kökündeki boşluk bu kelimeyle doldurulur; kısa şıklar (tek kelime) atlanır.
  const picked = []
  for (const i of [...e.refs].reverse()) {
    const s = english[i]
    const src = `(${exams[s.examIdx].exam.title}, ${s.no}. soru)`
    if (s.kind === 'option' && s.section === 'vocab' && s.correct) {
      const stem = english.find((x) => x.examIdx === s.examIdx && x.no === s.no && x.kind === 'stem' && /-{3,}/.test(x.en))
      if (stem) picked.unshift({ en: stem.en.replace(/-{3,}/, s.en), tr: `Kelime sorusunun doğru cevabı ${src}` })
      continue
    }
    if (s.kind === 'option' && !s.correct) continue
    if (s.en.split(/\s+/).length < 6 || /-{3,}/.test(s.en)) continue
    if (!/^[A-Z0-9“"‘'(]/.test(s.en)) continue // cümle ortasından başlayan bozuk bölütler
    const clean = (t) => t.replace(/^\([IVX]+\)\s*/, '')
    picked.push({ en: clean(s.en), tr: s.tr ? `${clean(s.tr)} ${src}` : src })
  }
  examples[m.term.toLowerCase()] = picked.slice(0, 3)
}
fs.writeFileSync(PACK_OUT, JSON.stringify(pack))
fs.writeFileSync(path.join(OUT_DIR, 'kelime_ornekleri.json'), JSON.stringify(examples))

// HTML rapor: şablona veriyi gömer
const tpl = fs.readFileSync('scripts/data/kelime_analizi_sablon.html', 'utf8')
fs.writeFileSync(
  path.join(OUT_DIR, 'yds_kelime_analizi.html'),
  tpl.replace('/*__DATA__*/null', JSON.stringify(analysis).replace(/</g, '\\u003c')),
)

console.log(
  `${summary.exams} sınav, ${summary.segments} İngilizce segment, ${summary.tokens} kelime, ${summary.lemmas} farklı kök.`,
  `\nPaket adayı: ${candidates.length} (anlamı eksik: ${missing.length}); pakete yazılan: ${pack.length}`,
  `\nKelime sorusu şık maddesi: ${vocabRows.length}`,
)
