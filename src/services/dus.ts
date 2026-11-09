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
