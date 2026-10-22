// Yerel okuma kitaplarının cümle çevirileri: local-data/okuma/ceviri/<id>.json = { "<İngilizce cümle>": "<Türkçesi>" }.
// Çeviri servisi çağırmaz; çevirileri elle (ya da Claude ile) yazıp buradan eklersin. Sonra: node scripts/okuma/kitap_yap.mjs
// Kullanım:
//   node scripts/okuma/ceviri_eksik.mjs --durum                      → kitap başına çevirili / toplam (tekil cümle)
//   node scripts/okuma/ceviri_eksik.mjs <id> [--adet 150] [--json]   → sıradaki eksik cümleler (numaralı satırlar ya da
//                                                                       { "<en>": "" } JSON); parti _parti/<id>.json'a yazılır
//   node scripts/okuma/ceviri_eksik.mjs <id> --ekle <dosya>          → dosya: "N<TAB>Türkçe" satırları (son partinin
//                                                                       numaraları) ya da { "<en>": "<tr>" } JSON; haritaya eklenir
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..', '..')
const BOOKS = path.join(ROOT, 'local-data', 'okuma', 'kitaplar')
const TR = path.join(ROOT, 'local-data', 'okuma', 'ceviri')
const PART = path.join(TR, '_parti')
fs.mkdirSync(PART, { recursive: true })

const args = process.argv.slice(2)
const opt = (name) => {
  const i = args.indexOf(name)
  return i < 0 ? undefined : args[i + 1]
}
const loadMap = (id) => {
  const f = path.join(TR, `${id}.json`)
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {}
}
const saveMap = (id, map) => fs.writeFileSync(path.join(TR, `${id}.json`), JSON.stringify(map, null, 1))

/** Kitaptaki tekil cümleler, kitap sırasıyla */
function sentences(id) {
  const book = JSON.parse(fs.readFileSync(path.join(BOOKS, `${id}.json`), 'utf8'))
  const seen = new Set()
  for (const c of book.chapters)
    for (const p of c.paras) if (Array.isArray(p)) for (const s of p) seen.add(typeof s === 'string' ? s : s.en)
  return [...seen]
}

if (args.includes('--durum')) {
  for (const f of fs.readdirSync(BOOKS).filter((x) => x.endsWith('.json'))) {
    const id = f.replace(/\.json$/, '')
    const all = sentences(id)
    const map = loadMap(id)
    const done = all.filter((s) => map[s]).length
    console.log(`${id}: ${done}/${all.length}${done === all.length ? ' ✓' : ''}`)
  }
  process.exit(0)
}

const id = args[0]
if (!id || !fs.existsSync(path.join(BOOKS, `${id}.json`))) {
  console.error('Kitap kimliği gerekli (local-data/okuma/kitaplar/<id>.json). --durum ile listele.')
  process.exit(1)
}
const map = loadMap(id)
const partFile = path.join(PART, `${id}.json`)

const ekle = opt('--ekle')
if (ekle) {
  const raw = fs.readFileSync(ekle, 'utf8').replace(/^﻿/, '')
  const all = new Set(sentences(id))
  let added = 0
  const put = (en, tr) => {
    tr = tr?.trim()
    if (!tr || !all.has(en)) return console.log(`  ! atlandı: ${en?.slice(0, 60)}`)
    map[en] = tr
    added++
  }
  if (raw.trimStart().startsWith('{')) for (const [en, tr] of Object.entries(JSON.parse(raw))) put(en, tr)
  else {
    const part = JSON.parse(fs.readFileSync(partFile, 'utf8'))
    for (const line of raw.split(/\r?\n/)) {
      // "N<TAB>tr"; sekme yerine boşluk, "N | tr" ya da "N. tr" de olur (başka araçlar sekmeyi boşluğa çevirebilir)
      const m = line.match(/^(\d+)(?:\t|\s*[|.)]\s*|\s+)(.*)$/)
      if (m) put(part[Number(m[1]) - 1], m[2])
    }
  }
  saveMap(id, map)
  const total = all.size
  const done = [...all].filter((s) => map[s]).length
  console.log(`${id}: ${added} eklendi, ${done}/${total} çevirili`)
  process.exit(0)
}

const adet = Number(opt('--adet') ?? 150)
const missing = sentences(id).filter((s) => !map[s])
const part = missing.slice(0, adet)
fs.writeFileSync(partFile, JSON.stringify(part))
if (args.includes('--json')) console.log(JSON.stringify(Object.fromEntries(part.map((s) => [s, ''])), null, 1))
else {
  console.log(`# ${id}: ${missing.length} eksik, bu parti ${part.length}`)
  part.forEach((s, i) => console.log(`${i + 1}\t${s}`))
}
