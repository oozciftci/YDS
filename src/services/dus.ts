import { localFetch } from './localContent'

// DUS (Diş Hekimliği Uzmanlık Eğitimi Giriş Sınavı) çıkmış soruları: ÖSYM kitapçıklarından üretilen görüntü tabanlı veri
// (scripts/dus/dus_yap.py → local-data/dus/sinavlar/<sınav>/). Telifli: yalnızca yerelde ve şifreli kaynak paketinde.
//   GET /local-api/dus/                -> [{ id, title, year, counts: { tbt, kbt } }]
//   GET /local-api/dus/<sınav>         -> sinav.json
//   GET /local-api/dus/<sınav>/p001.webp
// Cevaplar bu cihazda, kullanıcı başına tutulur (yds-dus:<kullanıcı>); YDS istatistiklerine karışmaz.

export type DusTestKey = 'tbt' | 'kbt'

export interface DusQuestion {
  n: number
  page: number
  /** Sayfadaki kutu (oran): x0, y0, x1, y1 */
  box: [number, number, number, number]
  /** 'A'..'E'; 'X' = ÖSYM iptal etti */
  answer: string
  text: string
}
export interface DusTest {
  key: DusTestKey
  title: string
  questions: DusQuestion[]
}
export interface DusExam {
  id: string
  title: string
  year: number
  pages: { w: number; h: number }[]
  tests: DusTest[]
}
export interface DusExamMeta {
  id: string
  title: string
  year: number
  counts: Record<DusTestKey, number>
}

export const DUS_TESTS: { key: DusTestKey; title: string; short: string }[] = [
  { key: 'tbt', title: 'Temel Bilimler Testi', short: 'Temel' },
  { key: 'kbt', title: 'Klinik Bilimler Testi', short: 'Klinik' },
]

// Dersler: ÖSYM soruları ders sırasıyla dizer; 2012–2021 kitapçıklarının hepsinde dağılım aynı
// (Temel: 6-4-6-6-6-4-4-4, Klinik: 10'ar). Sınırlar soru metinleriyle denetlendi (YOL_HARITASI.md, 09.11.2026).
export interface DusSubject {
  id: string
  title: string
  icon: string
  test: DusTestKey
  /** İlk ve son soru numarası (dâhil) */
  from: number
  to: number
}
const SUBJECT_ROWS: [string, string, string, DusTestKey, number][] = [
  ['anatomi', 'Anatomi', '🦴', 'tbt', 6],
  ['histoloji', 'Histoloji ve Embriyoloji', '🔬', 'tbt', 4],
  ['fizyoloji', 'Fizyoloji', '❤️', 'tbt', 6],
  ['biyokimya', 'Biyokimya', '⚗️', 'tbt', 6],
  ['mikrobiyoloji', 'Mikrobiyoloji', '🦠', 'tbt', 6],
  ['patoloji', 'Patoloji', '🧫', 'tbt', 4],
  ['farmakoloji', 'Farmakoloji', '💊', 'tbt', 4],
  ['biyoloji', 'Biyoloji ve Genetik', '🧬', 'tbt', 4],
  ['restoratif', 'Restoratif Diş Tedavisi', '🦷', 'kbt', 10],
  ['protetik', 'Protetik Diş Tedavisi', '👄', 'kbt', 10],
  ['cerrahi', 'Ağız, Diş ve Çene Cerrahisi', '🔪', 'kbt', 10],
  ['radyoloji', 'Ağız, Diş ve Çene Radyolojisi', '📷', 'kbt', 10],
  ['periodontoloji', 'Periodontoloji', '🪥', 'kbt', 10],
  ['ortodonti', 'Ortodonti', '😬', 'kbt', 10],
  ['endodonti', 'Endodonti', '🩺', 'kbt', 10],
  ['pedodonti', 'Pedodonti', '🧒', 'kbt', 10],
]
export const DUS_SUBJECTS: DusSubject[] = (() => {
  const next: Record<DusTestKey, number> = { tbt: 1, kbt: 1 }
  return SUBJECT_ROWS.map(([id, title, icon, test, count]) => {
    const from = next[test]
    next[test] += count
    return { id, title, icon, test, from, to: from + count - 1 }
  })
})()

export function subjectOf(test: DusTestKey, n: number): DusSubject | undefined {
  return DUS_SUBJECTS.find((s) => s.test === test && n >= s.from && n <= s.to)
}

export async function listDusExams(): Promise<DusExamMeta[]> {
  const r = await localFetch('/local-api/dus/')
  if (!r.ok) return []
  const list = (await r.json()) as DusExamMeta[]
  return list.sort((a, b) => b.id.localeCompare(a.id))
}

const examCache = new Map<string, Promise<DusExam>>()
export function loadDusExam(id: string): Promise<DusExam> {
  let p = examCache.get(id)
  if (!p) {
    p = localFetch(`/local-api/dus/${id}`).then((r) => {
      if (!r.ok) throw new Error(String(r.status))
      return r.json() as Promise<DusExam>
    })
    p.catch(() => examCache.delete(id))
    examCache.set(id, p)
  }
  return p
}

// Hazır çözümler ve terimler (yerel; local-data/dus/cozumler/<sınav>.json, anahtar "<test>/<no>"). Yapay zekâ ile
// önceden yazılır ve kontrol edilmemiştir; yoksa boş nesne.
/** Hazır çözümdeki terim: t = terim, a = açıklama. */
export interface DusSolutionTerm {
  t: string
  a: string
}
export interface DusSolution {
  /** Sade Markdown (AiText) */
  cozum: string
  terimler?: DusSolutionTerm[]
}
export type DusSolutions = Record<string, DusSolution>

const solCache = new Map<string, Promise<DusSolutions>>()
export function loadDusSolutions(id: string): Promise<DusSolutions> {
  let p = solCache.get(id)
  if (!p) {
    p = localFetch(`/local-api/dus/${id}/cozum`)
      .then((r) => (r.ok ? (r.json() as Promise<DusSolutions>) : {}))
      .catch(() => ({}))
    solCache.set(id, p)
  }
  return p
}

// Soru metni (yerel; local-data/dus/ocr/<sınav>.json, scripts/dus/dus_ocr.py): soru kutusu OCR projesindeki görme-dil
// modeliyle okunur, PDF'in metin katmanıyla kelime kelime denetlenir. durum: ok (katmanla uyuşuyor), duzeltildi /
// onaylandi (görüntüye bakılarak düzeltildi), incele (denetimden geçmedi). Yoksa boş nesne → görüntü gösterilir.
export interface DusText {
  soru: string
  siklar: Record<string, string>
  /** Soruda şekil/fotoğraf var: metin yetmez, orijinal görüntü varsayılan */
  sekil: boolean
  durum: 'ok' | 'duzeltildi' | 'onaylandi' | 'incele'
}
const textCache = new Map<string, Promise<Record<string, DusText>>>()
export function loadDusTexts(id: string): Promise<Record<string, DusText>> {
  let p = textCache.get(id)
  if (!p) {
    p = localFetch(`/local-api/dus/${id}/metin`)
      .then((r) => (r.ok ? (r.json() as Promise<Record<string, DusText>>) : {}))
      .catch(() => ({}))
    textCache.set(id, p)
  }
  return p
}

/** Terim sözlüğü (docs/antigravity/DUS_SOZLUK_GOREVI.md): soru ve şıklardaki terimlere dokununca açılan balon. */
export interface DusGlossTerm {
  /** Soru/şık metninde birebir geçen hâli (altı çizilir) */
  metin: string
  terim: string
  kisa: string
  aciklama: string
  koken?: string
}
/** Eski ad (DusTerms.tsx ve öteki sayfalar kullanıyor): sözlük terimi. Çözüm terimi için DusSolutionTerm. */
export type DusTerm = DusGlossTerm
export interface DusGloss {
  neSoruyor: string
  terimler: DusGlossTerm[]
}

const glossCache = new Map<string, Promise<Record<string, DusGloss>>>()
export function loadDusGlossary(id: string): Promise<Record<string, DusGloss>> {
  let p = glossCache.get(id)
  if (!p) {
    p = localFetch(`/local-api/dus/${id}/sozluk`)
      .then((r) => (r.ok ? (r.json() as Promise<Record<string, DusGloss>>) : {}))
      .catch(() => ({}))
    glossCache.set(id, p)
  }
  return p
}

// Alt konu + spot bilgi kartları (docs/antigravity/DUS_KONU_SPOT_GOREVI.md; local-data/dus/konu/<sınav>.json).
export interface DusSpot {
  on: string
  arka: string
}
export interface DusTopicRecord {
  /** "<ders>/<konu>" (scripts/dus/konular.json) */
  konu: string
  altBaslik: string
  zorluk: 1 | 2 | 3
  spotlar: DusSpot[]
}
const spotCache = new Map<string, Promise<Record<string, DusTopicRecord>>>()
export function loadDusSpots(id: string): Promise<Record<string, DusTopicRecord>> {
  let p = spotCache.get(id)
  if (!p) {
    p = localFetch(`/local-api/dus/${id}/konu`)
      .then((r) => (r.ok ? (r.json() as Promise<Record<string, DusTopicRecord>>) : {}))
      .catch(() => ({}))
    spotCache.set(id, p)
  }
  return p
}

/** Ders başına alt konu listesi (scripts/dus/konular.json). */
export interface DusTopicSubject {
  id: string
  ad: string
  konular: { id: string; ad: string; kapsam?: string }[]
}
let topicsCache: Promise<DusTopicSubject[]> | null = null
export function loadDusTopics(): Promise<DusTopicSubject[]> {
  topicsCache ??= localFetch('/local-api/dus/konular')
    .then((r) => (r.ok ? (r.json() as Promise<{ dersler?: DusTopicSubject[] }>) : {}))
    .then((d: { dersler?: DusTopicSubject[] }) => d.dersler ?? [])
    .catch(() => [])
  return topicsCache
}

export const dusImageUrl =(examId: string, page: number) => `/local-api/dus/${examId}/p${String(page).padStart(3, '0')}.webp`

/** İptal edilen sorular çözülmez. */
export const solvable = (t: DusTest) => t.questions.filter((q) => q.answer !== 'X')

// --- Cevap kayıtları -------------------------------------------------------

export interface DusAnswer {
  /** Seçilen şık */
  c: string
  ok: boolean
  /** Toplam yanlış sayısı */
  w: number
  /** Son cevap zamanı (eşitlemede daha yeni t kazanır) */
  t: string
  /** Toplam deneme sayısı (eski kayıtlarda yok: w + (ok ? 1 : 0) sayılır) */
  n?: number
  /** İlk cevap zamanı (eski kayıtlarda yok: t sayılır) */
  f?: string
  /** Kullanıcı ⭐ ile işaretledi */
  flag?: boolean
}
export type DusAnswers = Record<string, DusAnswer>

export const answerKey = (examId: string, test: DusTestKey, n: number) => `${examId}/${test}/${n}`
const storeKey = (userId: string) => `yds-dus:${userId}`

export function readDusAnswers(userId: string): DusAnswers {
  try {
    return JSON.parse(localStorage.getItem(storeKey(userId)) || '{}') as DusAnswers
  } catch {
    return {}
  }
}

function write(userId: string, all: DusAnswers) {
  try {
    localStorage.setItem(storeKey(userId), JSON.stringify(all))
  } catch {
    // depo dolu ya da kapalı: bu oturumda bellekte kalır
  }
}

/** Deneme sayısı: eski kayıtta n yoksa en az w + (son cevap doğruysa 1). */
export const dusAttempts = (a: DusAnswer) => a.n ?? Math.max(1, a.w + (a.ok ? 1 : 0))

/** Yeni cevabı önceki kayda işler (saf): n, f ve ⭐ korunur; eski biçimli kayıt da sorunsuz. */
export function nextDusAnswer(prev: DusAnswer | undefined, choice: string, ok: boolean, now: string): DusAnswer {
  const next: DusAnswer = {
    c: choice,
    ok,
    w: (prev?.w ?? 0) + (ok ? 0 : 1),
    t: now,
    n: (prev ? dusAttempts(prev) : 0) + 1,
    f: prev ? (prev.f ?? prev.t) : now,
  }
  if (prev?.flag) next.flag = true
  return next
}

export function saveDusAnswer(userId: string, key: string, choice: string, ok: boolean): DusAnswers {
  const all = readDusAnswers(userId)
  all[key] = nextDusAnswer(all[key], choice, ok, new Date().toISOString())
  write(userId, all)
  return all
}

/** ⭐ işaretini açar/kapar (yalnızca cevaplanmış soruda; t değişmez ki "bugün çözülen" sayılmasın). */
export function setDusFlag(userId: string, key: string, flag: boolean): DusAnswers {
  const all = readDusAnswers(userId)
  const a = all[key]
  if (!a) return all
  const next = { ...a }
  if (flag) next.flag = true
  else delete next.flag
  all[key] = next
  write(userId, all)
  return all
}

export function resetDusTest(userId: string, examId: string, test: DusTestKey): DusAnswers {
  const all = readDusAnswers(userId)
  const prefix = `${examId}/${test}/`
  for (const k of Object.keys(all)) if (k.startsWith(prefix)) delete all[k]
  write(userId, all)
  return all
}

/** Bir testin özeti: çözülen ve doğru sayısı. */
export function testSummary(all: DusAnswers, examId: string, test: DusTestKey) {
  const prefix = `${examId}/${test}/`
  let answered = 0
  let correct = 0
  for (const [k, a] of Object.entries(all)) {
    if (!k.startsWith(prefix)) continue
    answered++
    if (a.ok) correct++
  }
  return { answered, correct }
}

/** Son cevabı yanlış olan sorular (en eskiden yeniye). */
export function wrongKeys(all: DusAnswers): string[] {
  return Object.entries(all)
    .filter(([, a]) => !a.ok)
    .sort((a, b) => a[1].t.localeCompare(b[1].t))
    .map(([k]) => k)
}

/** DUS'ta net: doğru − yanlış/4. */
export const dusNet = (correct: number, wrong: number) => Math.round((correct - wrong / 4) * 100) / 100

/** Bir dersteki çözülen/doğru sayısı (tüm sınavlar). */
export function subjectSummary(all: DusAnswers, subject: DusSubject) {
  let answered = 0
  let correct = 0
  for (const [k, a] of Object.entries(all)) {
    const [, test, n] = k.split('/')
    if (test !== subject.test) continue
    const no = Number(n)
    if (no < subject.from || no > subject.to) continue
    answered++
    if (a.ok) correct++
  }
  return { answered, correct }
}

// --- Sınavlar arası soru listesi --------------------------------------------

export interface DusQueueItem {
  exam: DusExam
  test: DusTestKey
  q: DusQuestion
  key: string
}

/** Anahtarlardan (sınav/test/no) soru listesi kurar; sınavlar gerektiği kadar yüklenir, iptal edilenler atlanır. */
export async function dusItemsOf(keys: string[]): Promise<DusQueueItem[]> {
  const ids = [...new Set(keys.map((k) => k.split('/')[0]))]
  const list = await Promise.all(ids.map((id) => loadDusExam(id).catch(() => null)))
  const byId = new Map(list.filter((e): e is DusExam => !!e).map((e) => [e.id, e]))
  const out: DusQueueItem[] = []
  for (const k of keys) {
    const [id, test, n] = k.split('/')
    const exam = byId.get(id)
    const q = exam?.tests.find((t) => t.key === test)?.questions.find((x) => x.n === Number(n))
    if (exam && q && q.answer !== 'X') out.push({ exam, test: test as DusTestKey, q, key: k })
  }
  return out
}
