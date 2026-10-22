// Çıkmış sınavların (local-data/yds/<sınav>.json) cümle çevirileri: local-data/yds/<sınav>.tr.json = { "<kimlik>": "<Türkçe>" }.
// Okuma Modu ve soru ekranındaki 🌐 bu dosyadan gelir. İngilizce olup Türkçesi eksik paragraf cümlesi, soru kökü ve şıkları listeler.
// Türkçe metinler (çeviri sorularının kökü/şıkları) ve I–V gibi şık etiketleri sayılmaz. Çeviri servisi çağırmaz.
// Kullanım:
//   node scripts/okuma/sinav_eksik.mjs                       → sınav başına eksik sayısı
//   node scripts/okuma/sinav_eksik.mjs <sınav> [--adet 150]  → eksikler "kimlik<TAB>İngilizce" satırları
//   node scripts/okuma/sinav_eksik.mjs <sınav> --ekle <dosya> → "kimlik<TAB>Türkçe" satırlarını .tr.json'a ekler
import fs from 'node:fs'
import path from 'node:path'

const DIR = path.resolve(import.meta.dirname, '..', '..', 'local-data', 'yds')
const args = process.argv.slice(2)
const opt = (name) => {
  const i = args.indexOf(name)
  return i < 0 ? undefined : args[i + 1]
}

const isEnglish = (s) =>
  /[A-Za-z]{2}/.test(s) && (s.match(/[çğıöşüÇĞİÖŞÜ]/g) || []).length < 2 && !/^\s*(I|II|III|IV|V|VI)\s*$/.test(s)

function items(exam) {
  const e = JSON.parse(fs.readFileSync(path.join(DIR, `${exam}.json`), 'utf8'))
  const out = []
  for (const p of e.passages || []) for (const s of p.sentences || []) out.push(s)
  for (const q of e.questions || []) {
    for (const s of q.stem || []) out.push(s)
    for (const o of Object.values(q.options || {})) out.push(o)
  }
  return out.filter((x) => x?.id && x.en && isEnglish(x.en))
}
const trFile = (exam) => path.join(DIR, `${exam}.tr.json`)
const loadTr = (exam) => (fs.existsSync(trFile(exam)) ? JSON.parse(fs.readFileSync(trFile(exam), 'utf8')) : {})
const missing = (exam) => {
  const tr = loadTr(exam)
  return items(exam).filter((x) => !tr[x.id]?.trim())
}

const exams = fs
  .readdirSync(DIR)
  .filter((f) => /^(yds|yokdil)-.*\.json$/.test(f) && !f.endsWith('.tr.json'))
  .map((f) => f.replace(/\.json$/, ''))

const exam = args.find((a) => !a.startsWith('--') && exams.includes(a))
if (!exam) {
  let total = 0
  for (const x of exams) {
    const n = missing(x).length
    total += n
    if (n) console.log(`${x}: ${n} eksik`)
  }
  console.log(`Toplam eksik: ${total} (${exams.length} sınav)`)
  process.exit(0)
}

const ekle = opt('--ekle')
if (ekle) {
  const tr = loadTr(exam)
  const ids = new Set(items(exam).map((x) => x.id))
  let added = 0
  for (const line of fs.readFileSync(ekle, 'utf8').replace(/^﻿/, '').split(/\r?\n/)) {
    const m = line.match(/^([^\t]+)\t(.+)$/)
    if (!m) continue
    if (!ids.has(m[1])) console.log(`  ! bilinmeyen kimlik: ${m[1]}`)
    else (tr[m[1]] = m[2].trim()), added++
  }
  fs.writeFileSync(trFile(exam), JSON.stringify(tr, null, 1))
  console.log(`${exam}: ${added} eklendi, ${missing(exam).length} eksik kaldı`)
  process.exit(0)
}

const list = missing(exam).slice(0, Number(opt('--adet') ?? 150))
for (const x of list) console.log(`${x.id}\t${x.en}`)
