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
}
export interface Exam {
  id: string
  pdf?: string
  pageFrom?: number
  pageTo?: number
  title: string
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
}

let listCache: Promise<ExamMeta[]> | null = null
const examCache = new Map<string, Promise<ExamBundle>>()

function getJson<T>(url: string): Promise<T> {
  return fetch(url).then((r) => (r.ok ? (r.json() as Promise<T>) : Promise.reject(new Error(String(r.status)))))
}

/** Sınav listesi, kronolojik sırada. */
export function listExams(): Promise<ExamMeta[]> {
  listCache ??= getJson<ExamMeta[]>('/local-api/yds/').catch((e) => {
    listCache = null
    throw e
  })
  return listCache
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
