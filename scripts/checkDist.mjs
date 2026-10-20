// Yayın güvenlik denetimi: node scripts/checkDist.mjs   (önce: npm run build)
// Amaç: telifli çıkmış sınav metninin dist/ (yayına giden klasör) içine sızmadığından emin olmak.
// Kontroller:
//   1) local-data/yds/*.json içindeki İngilizce metinlerden 8 kelimelik parçalar (shingle) çıkarılır ve dist/ içindeki
//      tüm metin dosyalarında aranır. Tek bir eşleşme bile HATADIR.
//   2) dist/ içinde yasak yol/imzalar aranır (local-data, cikmis_sorular, /local-api, sınav dosyası adları).
// Çıkış kodu: 0 = temiz, 1 = sızıntı, 2 = dist yok. local-data yoksa (ör. başka bilgisayar) yalnızca 2. kontrol çalışır.
import fs from 'node:fs'
import path from 'node:path'

const DIST = 'dist'
const EXAMS = 'local-data/yds'
const N = 8
const TEXT_EXT = new Set(['.js', '.mjs', '.json', '.html', '.css', '.txt', '.map', '.webmanifest', '.svg'])

if (!fs.existsSync(DIST)) {
  console.log('dist/ yok. Önce `npm run build` çalıştır.')
  process.exit(2)
}

function walk(dir) {
  const out = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...walk(p))
    else out.push(p)
  }
  return out
}

const norm = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9ğüşöçıİ' ]+/gi, ' ')
    .split(/\s+/)
    .filter(Boolean)

const files = walk(DIST)
const problems = []
const warnings = []

// 2) Yasak imzalar
const FORBIDDEN_NAMES = [/local-data/i, /cikmis_sorular/i, /cikmis\d?\.pdf/i, /yds-20\d\d-[a-z]+\.json/i, /yokdil-20\d\d-/i]
for (const f of files) {
  const rel = path.relative(DIST, f)
  if (FORBIDDEN_NAMES.some((re) => re.test(rel))) problems.push(`yasak dosya adı: ${rel}`)
  if (!TEXT_EXT.has(path.extname(f).toLowerCase())) continue
  const text = fs.readFileSync(f, 'utf8')
  for (const sig of ['local-data/', 'cikmis_sorular', 'cikmis2.pdf']) {
    if (text.includes(sig)) warnings.push(`yol/dosya adı anılıyor "${sig}" (yalnızca ad; içerik değil): ${rel}`)
  }
}

// 1) Sınav metni parçaları
let shingleCount = 0
const MIN_RUN = 3
const longRuns = []
// Bilinen zararsız ortaklıklar (ör. sözlük tanımı ile sınav metninin aynı kaynaktan gelmesi): scripts/data/checkDist_allow.txt
const ALLOW = fs.existsSync('scripts/data/checkDist_allow.txt')
  ? fs.readFileSync('scripts/data/checkDist_allow.txt', 'utf8').split(String.fromCharCode(10)).map((x) => norm(x).join(' ')).filter(Boolean)
  : []
if (fs.existsSync(EXAMS)) {
  const set = new Set()
  for (const f of fs.readdirSync(EXAMS).filter((x) => x.endsWith('.json') && !x.endsWith('.tr.json') && !x.startsWith('_'))) {
    const exam = JSON.parse(fs.readFileSync(path.join(EXAMS, f), 'utf8'))
    const segs = []
    for (const p of exam.passages ?? []) for (const s of p.sentences ?? []) segs.push(s.en)
    for (const q of exam.questions ?? []) {
      for (const s of q.stem ?? []) segs.push(s.en)
      for (const o of Object.values(q.options ?? {})) segs.push(o.en)
    }
    for (const seg of segs) {
      const w = norm(seg ?? '')
      for (let i = 0; i + N <= w.length; i++) set.add(w.slice(i, i + N).join(' '))
    }
  }
  shingleCount = set.size
  for (const f of files) {
    if (!TEXT_EXT.has(path.extname(f).toLowerCase())) continue
    // Kaynak haritaları orijinal kaynak kodunu içerir; metin taraması yine de yapılır (sızıntı orada da istenmez)
    const w = norm(fs.readFileSync(f, 'utf8'))
    // Ardışık eşleşen parçalar = uzun ortak kelime dizisi. MIN_RUN parçadan kısa (≈ N+MIN_RUN-1 kelimeden kısa) ortaklıklar
    // genel kalıplardır ("it can be inferred from the passage that") ve yok sayılır.
    let run = 0
    let runStart = 0
    const flush = (end) => {
      if (run >= MIN_RUN) {
        const text = w.slice(runStart, end + N - 1).join(' ')
        if (!ALLOW.some((a) => text.includes(a))) longRuns.push({ file: path.relative(DIST, f), words: run + N - 1, text })
      }
      run = 0
    }
    for (let i = 0; i + N <= w.length; i++) {
      if (set.has(w.slice(i, i + N).join(' '))) {
        if (!run) runStart = i
        run++
      } else if (run) flush(i - 1)
    }
    if (run) flush(w.length - N)
  }
  for (const r of longRuns) problems.push(`sınav metniyle ${r.words} kelimelik ortak dizi: ${r.file} — "${r.text.slice(0, 90)}…"`)
} else {
  console.log('Uyarı: local-data/yds yok; metin sızıntı taraması atlandı (yalnızca imza kontrolü yapıldı).')
}

console.log(`${files.length} dosya tarandı${shingleCount ? `, ${shingleCount} sınav parçası arandı` : ''}.`)
for (const w of warnings) console.log('UYARI: ' + w)
if (problems.length) {
  console.log('\nSIZINTI / SORUN:')
  for (const p of problems) console.log(' - ' + p)
  process.exit(1)
}
console.log('Temiz: dist/ içinde çıkmış sınav metni bulunamadı.')
