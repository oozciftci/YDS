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
export interface DusTerm {
  t: string
  a: string
}
export interface DusSolution {
  /** Sade Markdown (AiText) */
  cozum: string
  terimler?: DusTerm[]
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

export const dusImageUrl = (examId: string, page: number) => `/local-api/dus/${examId}/p${String(page).padStart(3, '0')}.webp`

/** İptal edilen sorular çözülmez. */
export const solvable = (t: DusTest) => t.questions.filter((q) => q.answer !== 'X')

// --- Cevap kayıtları -------------------------------------------------------

export interface DusAnswer {
  /** Seçilen şık */
  c: string
  ok: boolean
  /** Toplam yanlış sayısı */
  w: number
  t: string
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

export function saveDusAnswer(userId: string, key: string, choice: string, ok: boolean): DusAnswers {
  const all = readDusAnswers(userId)
  const prev = all[key]
  all[key] = { c: choice, ok, w: (prev?.w ?? 0) + (ok ? 0 : 1), t: new Date().toISOString() }
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
