// "60 Günde YDS Kelimeleri" (Modadil / İrem Yayıncılık) PDF'inden kelime paketi çıkarır.
// Telifli bir kitap olduğu için çıktı YALNIZCA yerelde kalır: local-data/paketler/modadil-60-gun.json (gitignore'da,
// şifreli kasaya dahil). Yayın derlemesine girmez; Kelimeler > Hazır Paketler'de yalnızca `npm run dev`'de görünür.
//
//   pdftotext -enc UTF-8 -raw    kitap.pdf kitap_raw.txt      (1-59. günler)
//   pdftotext -enc UTF-8 -layout kitap.pdf kitap_layout.txt   (60. gün tablosu: sütunlar boşlukla ayrılı)
//   node scripts/parseModadil.mjs kitap_raw.txt kitap_layout.txt
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'local-data', 'paketler', 'modadil-60-gun.json')

const [rawFile, layoutFile] = process.argv.slice(2)
if (!rawFile || !layoutFile) {
  console.error('Kullanım: node scripts/parseModadil.mjs <raw.txt> <layout.txt>')
  process.exit(1)
}

const TAG = 'Modadil-60-Gün'
const POS = { adj: 'adjective', n: 'noun', v: 'verb', adv: 'adverb', prep: 'preposition', conj: 'conjunction' }
const NOISE = /^(www\.iremyayincilik\.com\.tr.*|SUAT GÜRCAN & DIRVAN GÜRBÜZ|60 GÜNDE YDS KELİMELERİ|\d{1,3}|[IVX]+|(\d+ ){3,}\d+)$/
const LABELS = [
  ['tr', /^Türkçe Karşılığı\s*:\s*(.*)$/],
  ['ex', /^Örnek Cümle(?:\s*\d+)?\s*:\s*(.*)$/],
  ['exTr', /^Çevirisi\s*:\s*(.*)$/],
  ['syn', /^Eş ya da Yakın Anlamlılar\s*:\s*(.*)$/],
  ['ant', /^Zıt Anlamlılar\s*:\s*(.*)$/],
  ['forms', /^Diğer Halleri\s*:\s*(.*)$/],
]
// Başlık: BÜYÜK HARFLİ kelime, ardından isteğe bağlı küçük harfli edat(lar) ve (tür): "DEDUCE from (v)"
const HEAD = /^([A-ZÇĞİÖŞÜ][A-ZÇĞİÖŞÜ' \-/().,]*?)((?:\s+[a-zçğıöşü…./()]+)*)\s*\(([a-z.]+)\)\s*(.*)$/

const clean = (s) => (s ?? '').replace(/\s+/g, ' ').trim()
/** "Correct, precise" → ["correct", "precise"]; cümle başı büyük harf küçültülür. */
const list = (v) =>
  clean(v)
    .split(/[,;]/)
    .map((s) => clean(s).replace(/\.$/, ''))
    .filter(Boolean)
    .map((s) => (/^[A-ZÇĞİÖŞÜ][a-zçğıöşü]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s))
const unique = (a) => [...new Set(a)]

const lines = fs.readFileSync(rawFile, 'utf8').replace(/\r/g, '').split('\n')
const firstTable = lines.findIndex((l) => /^PHRASAL VERB \/ DEFINITION$/.test(l.trim()))
if (firstTable < 0) throw new Error('Tablo bölümü bulunamadı')

// ---------------------------------------------------------------------------
// 1-54. günler: etiketli kelime kartları
// ---------------------------------------------------------------------------
const entries = []
let cur = null
let field = null
let skipping = false
const flush = () => {
  if (cur) entries.push(cur)
  cur = null
  field = null
}

for (const raw of lines.slice(0, firstTable)) {
  // Sayfa numarası etikete yapışmış olabilir: "7Türkçe Karşılığı : …"
  const line = raw.trim().replace(/^\d+(?=Türkçe|Örnek|Çevirisi|Eş ya|Zıt|Diğer)/, '')
  if (!line || NOISE.test(line)) continue
  if (/ALIŞTIRMALARI?$|Alıştırma|CEVAP ANAHTARI/i.test(line) && !/^Türkçe/.test(line)) {
    flush()
    skipping = true
    continue
  }
  if (/GÜNÜN KELİMELERİ$/i.test(line)) {
    flush()
    skipping = false
    continue
  }
  if (skipping) continue

  let matched = false
  for (const [key, re] of LABELS) {
    const m = re.exec(line)
    if (m && cur) {
      // Kartta birden çok örnek olabilir ("Örnek Cümle 1", "Örnek Cümle 2"): ilki ex/exTr, sonrakiler more[]
      if (key === 'ex' && cur.ex !== undefined) {
        ;(cur.more ??= []).push({ en: m[1].trim(), tr: '' })
        field = 'more.en'
      } else if (key === 'exTr' && cur.more?.length && !cur.more.at(-1).tr) {
        cur.more.at(-1).tr = m[1].trim()
        field = 'more.tr'
      } else {
        // Kitapta bazı kartlarda etiketler kaymıştır (örn. iki "Çevirisi"); ikinci kez geçeni ayrı tut
        field = key === 'exTr' && cur.exTr !== undefined ? 'exTr2' : key
        cur[field] = (cur[field] ? cur[field] + ' ' : '') + m[1].trim()
      }
      matched = true
      break
    }
  }
  if (matched) continue

  // Birkaç başlık büyük harfle değil "Condemn (v)" biçiminde yazılmış
  const h = HEAD.exec(line) ?? /^([A-ZÇĞİÖŞÜ][A-Za-zÇĞİÖŞÜçğıöşü'-]{2,25})()\s*\((adj|n|v|adv|prep|conj)\)\s*()$/.exec(line)
  if (h && (h[1].replace(/[^A-ZÇĞİÖŞÜ]/g, '').length >= 2 || /^[A-ZÇĞİÖŞÜ][a-zçğıöşü]/.test(h[1]))) {
    flush()
    // Kelime = ilk "(" öncesi; tür = ilk parantez ("ADJOURN (v) / (n)" → adjourn, v)
    const open = line.indexOf('(')
    cur = { term: clean(line.slice(0, open)).toLowerCase(), pos: /\(([a-z.]+)\)/.exec(line)?.[1] ?? h[3], extra: '' }
    continue
  }
  if (cur && field === 'more.en') cur.more.at(-1).en = (cur.more.at(-1).en + ' ' + line).trim()
  else if (cur && field === 'more.tr') cur.more.at(-1).tr = (cur.more.at(-1).tr + ' ' + line).trim()
  else if (cur && field) cur[field] = (cur[field] + ' ' + line).trim()
}
flush()

const words = []
const issues = []
const seen = new Set()
const add = (w) => {
  const key = w.term + '|' + w.partOfSpeech
  if (seen.has(key)) return
  seen.add(key)
  words.push(w)
}

for (const e of entries) {
  const pos = POS[e.pos.replace(/\./g, '')] ?? 'other'
  const def = clean(e.tr).replace(/\.$/, '')
  if (!def || e.term.length < 3 || !/^[a-z]/.test(e.term)) {
    issues.push(`"${e.term}" (${e.pos}): ${def ? 'geçersiz kelime' : 'Türkçe anlam yok'}`)
    continue
  }
  let ex = clean(e.ex)
  let exTr = clean(e.exTr)
  let syn = e.syn
  let ant = e.ant
  if (e.exTr2) {
    // Kayma: "Örnek Cümle" aslında zıt anlamlılar; ilk "Çevirisi" örnek cümle; ikincisi çeviri
    ant = [ex, e.ant].filter(Boolean).join(', ')
    ex = clean(e.exTr)
    exTr = clean(e.exTr2)
  }
  const forms = clean(e.extra ? `${e.extra} ${e.forms ?? ''}` : e.forms)
  add({
    term: e.term,
    definition: def,
    partOfSpeech: pos,
    synonyms: unique(list(syn)),
    antonyms: unique(list(ant)),
    collocations: [],
    sentences: [
      ...(ex ? [{ en: ex, tr: exTr || undefined }] : []),
      ...(e.more ?? []).filter((x) => x.en).map((x) => ({ en: clean(x.en), tr: clean(x.tr) || undefined })),
    ],
    tags: [TAG, 'YDS', pos === 'adjective' ? 'Sıfat' : pos === 'verb' ? 'Fiil' : pos === 'noun' ? 'İsim' : 'Diğer'].slice(0, 2),
    difficulty: 4,
    notes: forms ? `Diğer halleri: ${forms}` : undefined,
  })
}
const dailyCount = words.length

// ---------------------------------------------------------------------------
// 55-59. günler: "ifade : Türkçe" tabloları (phrasal verb, fiil/sıfat/isim + edat, edat + isim)
// ---------------------------------------------------------------------------
const SECTIONS = [
  { re: /^PHRASAL VERB \/ DEFINITION$/, pos: 'phrasal_verb', tag: 'Phrasal-Verb' },
  { re: /^VERB \+ PREP \/ DEFINITION$/, pos: 'verb', tag: 'Fiil+Edat' },
  { re: /^ADJ\. \+ PREP \/ DEFINITION$/, pos: 'adjective', tag: 'Sıfat+Edat' },
  { re: /^NOUN \+ PREP \/ DEFINITION$/, pos: 'noun', tag: 'İsim+Edat' },
  { re: /^[A-Z ]+ \+ NOUN \/ DEFINITION$/, pos: 'idiom', tag: 'Edat+İsim' },
]
let section = null
let tableCount = 0
for (const raw of lines.slice(firstTable)) {
  const line = raw.trim()
  const sec = SECTIONS.find((s) => s.re.test(line))
  if (sec) {
    section = sec
    continue
  }
  if (/EXERCISE|^PREP \+ NOUN COMBINATIONS|ALIŞTIRMALARI|CEVAP ANAHTARI|SON SINAVLARDA/i.test(line)) {
    if (!/^PREP \+ NOUN COMBINATIONS/.test(line)) section = null
    continue
  }
  if (!section || !line || NOISE.test(line)) continue
  const m = /^(.{2,50}?)\s+:\s+(\S.*)$/.exec(line)
  if (!m || /^(Türkçe|Örnek|Çevirisi)/.test(m[1])) continue
  const term = clean(m[1]).toLowerCase()
  const def = clean(m[2]).replace(/\.$/, '')
  if (!/^[a-z]/.test(term)) continue
  const before = words.length
  add({
    term,
    definition: def,
    partOfSpeech: section.pos,
    synonyms: [],
    antonyms: [],
    collocations: [],
    sentences: [],
    tags: [TAG, section.tag],
    difficulty: 4,
  })
  if (words.length > before) tableCount++
}

// ---------------------------------------------------------------------------
// 60. gün: "kelime | Türkçe | eş/yakın anlam" üç sütunlu tablo (yerleşim kipi)
// ---------------------------------------------------------------------------
const layout = fs.readFileSync(layoutFile, 'utf8').replace(/\r/g, '').split('\n')
const start = layout.findIndex((l) => /SON SINAVLARDA SIKLIKLA GEÇEN/.test(l))
const end = layout.findIndex((l, i) => i > start && /^\s*CEVAP ANAHTARI/i.test(l))
let day60 = 0
for (const raw of layout.slice(start, end > 0 ? end : undefined)) {
  const cols = raw.trim().split(/\s{2,}/)
  if (cols.length !== 3 || /Kelime|www\.|GÜRCAN/.test(raw)) continue
  const [term, tr, syn] = cols.map(clean)
  if (!/^[a-z][a-z' \-]+$/.test(term) || !tr) continue
  const before = words.length
  add({
    term,
    definition: tr.replace(/\.$/, ''),
    partOfSpeech: 'other',
    synonyms: unique(list(syn)),
    antonyms: [],
    collocations: [],
    sentences: [],
    tags: [TAG, 'Son-Sınavlar'],
    difficulty: 4,
  })
  if (words.length > before) day60++
}

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, JSON.stringify(words, null, 2))
console.log(`Yazıldı: ${path.relative(ROOT, OUT)} — toplam ${words.length} kelime`)
console.log(`  1-54. gün kartları: ${dailyCount} (okunan ${entries.length}) · 55-59. gün tabloları: ${tableCount} · 60. gün: ${day60}`)
const byPos = {}
for (const w of words) byPos[w.partOfSpeech] = (byPos[w.partOfSpeech] ?? 0) + 1
console.log('  Türlere göre:', byPos)
console.log(`  Örnek cümlesi olan: ${words.filter((w) => w.sentences.length).length} · eş anlamlısı olan: ${words.filter((w) => w.synonyms.length).length}`)
if (issues.length) console.log(`${issues.length} atlanan girdi:\n - ` + issues.slice(0, 25).join('\n - '))
