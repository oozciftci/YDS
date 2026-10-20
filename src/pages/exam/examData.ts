// Çıkmış YDS sınav verisi: yalnızca yerel geliştirme sunucusundan gelir (/local-api/yds).
// Bu klasör yalnızca dev-only ExamStudy sayfasından içe aktarılır; yayın derlemesine girmez.

export interface Seg {
  id: string
  en: string
}
export interface Passage {
  id: string
  page?: number
  kind: 'cloze' | 'reading'
  text: string
  sentences: Seg[]
}
export interface Question {
  no: number
  page?: number
  passage: string | null
  stem: Seg[]
  options: Record<string, Seg>
  answer: string | null
  /** Kaynak kitabın çözümü (soru bankalarında). */
  explain?: string | null
}
export interface Exam {
  id: string
  pdf?: string
  pageFrom?: number
  pageTo?: number
  title: string
  /** 'yokdil' ise YÖKDİL sınavı (yoksa YDS) */
  kind?: 'yds' | 'yokdil'
  field?: string
  /** Soru bankası testi ise tüm soruların tipi (örn. 'grammar'); sınav değildir. */
  bank?: string
  passages: Passage[]
  questions: Question[]
}
export interface ExamBundle {
  exam: Exam
  tr: Record<string, string>
}
export interface ExamMeta {
  id: string
  title: string
  /** Cevap anahtarı var mı (yoksa kontrol/deneme yapılamaz) */
  hasKey: boolean
  kind?: 'yds' | 'yokdil'
  /** YÖKDİL alanı: Sosyal, Sağlık, Fen */
  field?: string
  /** Soru bankası testi (sınav listesinde değil, ayrı gösterilir) */
  bank?: string
  count?: number
}

/** Havuz süzgeci: hepsi, yalnız YDS, yalnız YÖKDİL ya da bir YÖKDİL alanı. */
export type Pool = 'all' | 'yds' | 'yokdil' | 'Sosyal' | 'Sağlık' | 'Fen'
export const POOLS: { key: Pool; label: string }[] = [
  { key: 'all', label: 'Tümü' },
  { key: 'yds', label: 'YDS' },
  { key: 'yokdil', label: 'YÖKDİL' },
  { key: 'Sosyal', label: 'YÖKDİL Sosyal' },
  { key: 'Sağlık', label: 'YÖKDİL Sağlık' },
  { key: 'Fen', label: 'YÖKDİL Fen' },
]
export function inPool(e: { kind?: string; field?: string }, pool: Pool): boolean {
  const kind = e.kind ?? 'yds'
  if (pool === 'all') return true
  if (pool === 'yds' || pool === 'yokdil') return kind === pool
  return kind === 'yokdil' && e.field === pool
}
const POOL_KEY = 'yds-pool-filter'
export function readPool(): Pool {
  try {
    const v = localStorage.getItem(POOL_KEY) as Pool | null
    if (v && POOLS.some((p) => p.key === v)) return v
  } catch {
    // yoksay
  }
  return 'all'
}
export function savePool(p: Pool) {
  try {
    localStorage.setItem(POOL_KEY, p)
  } catch {
    // yoksay
  }
}

let listCache: Promise<ExamMeta[]> | null = null
const examCache = new Map<string, Promise<ExamBundle>>()

function getJson<T>(url: string): Promise<T> {
  return fetch(url).then((r) => (r.ok ? (r.json() as Promise<T>) : Promise.reject(new Error(String(r.status)))))
}

function listAll(): Promise<ExamMeta[]> {
  listCache ??= getJson<ExamMeta[]>('/local-api/yds/').catch((e) => {
    listCache = null
    throw e
  })
  return listCache
}

/** Çıkmış sınav listesi, kronolojik sırada (soru bankaları hariç). */
export function listExams(): Promise<ExamMeta[]> {
  return listAll().then((all) => all.filter((e) => !e.bank))
}

/** Soru bankası testleri (örn. MODADİL gramer testleri), başlık sırasıyla. */
export function listBanks(): Promise<ExamMeta[]> {
  return listAll().then((all) =>
    all.filter((e) => e.bank).sort((a, b) => a.title.localeCompare(b.title, 'tr', { numeric: true })),
  )
}

export function loadExam(id: string): Promise<ExamBundle> {
  let p = examCache.get(id)
  if (!p) {
    p = getJson<ExamBundle>(`/local-api/yds/${encodeURIComponent(id)}`).catch((e) => {
      examCache.delete(id)
      throw e
    })
    examCache.set(id, p)
  }
  return p
}

/** Tüm sınavları yükler (konuya göre çalışma ve Yanlış Defteri için). */
export async function loadAllExams(): Promise<ExamBundle[]> {
  const list = await listExams()
  return Promise.all(list.map((m) => loadExam(m.id)))
}

/** Kısa başlık: "YDS 2013 İlkbahar" gibi. */
export function shortTitle(title: string): string {
  return title.replace(/\s*\(.*?\)\s*/g, ' ').trim()
}
