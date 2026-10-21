// Okuma kitapları (uzun okumalar): bölümler, paragraflar, cümleler. İki kaynak:
//  - Özgün uyarlamalar (telifsiz, bu projede yazıldı): public/data/okuma/kitap/<id>.json + dizin public/data/okuma/kitaplar.json
//    (dizin: node scripts/okuma/dizin.mjs). Cümle çevirileri ve kelime anlamları hazırdır, yayında da açılır.
//  - Yerel kitaplar (ücretsiz ama yalnızca yerel tutulan): local-data/okuma/kitaplar → /local-api/okuma-kitap (geliştirme) ya da
//    cihaza yüklenen kaynak paketi (yayın). Çeviriler 🌐 ile internetten gelir (services/sentenceTranslate).
// Kitap okuyucuda sayfalara bölünür (paginate); kaldığın yer kişi başına tarayıcı deposunda (`yds-kitap:<kullanıcı>`).
import { hasLocalContent, localFetch } from './localContent'
import type { LibQuestion, ReadingLevel } from './readingLibrary'

/** Cümle: düz metin ya da hazır çevirisiyle */
export type BookSentence = string | { en: string; tr: string }
/** Paragraf (cümleler) ya da ara başlık */
export type BookPara = BookSentence[] | { h: string }

export interface BookChapter {
  title: string
  titleTr?: string
  paras: BookPara[]
  /** Bölüm sonu anlama soruları (özgün uyarlamalarda) */
  qs?: LibQuestion[]
}

export interface BookMeta {
  id: string
  title: string
  titleTr?: string
  author: string
  level: ReadingLevel
  levelNote?: string
  source?: string
  license?: string
  words: number
  /** Özgün uyarlama (hazır çeviri + anlam) mı, yerel kitap mı */
  origin: 'ozgun' | 'yerel'
  summary?: string
}

export interface Book extends BookMeta {
  chapters: BookChapter[]
  glosses?: Record<string, string>
}

export interface BookPage {
  chapter: number
  /** Bölümdeki paragraf aralığı [from, to) */
  from: number
  to: number
  words: number
  /** Bölümün son sayfası mı (bölüm soruları burada) */
  lastOfChapter: boolean
}

export const sentenceEn = (s: BookSentence) => (typeof s === 'string' ? s : s.en)
const paraWords = (p: BookPara) => (Array.isArray(p) ? p.reduce((n, s) => n + sentenceEn(s).split(/\s+/).length, 0) : 0)

/** Sayfalar: bölüm başı her zaman yeni sayfa; paragraf ortasından bölünmez; hedef ~`target` kelime. */
export function paginate(book: Pick<Book, 'chapters'>, target = 320): BookPage[] {
  const pages: BookPage[] = []
  book.chapters.forEach((c, ci) => {
    let from = 0
    let words = 0
    c.paras.forEach((p, pi) => {
      const w = paraWords(p)
      // Ara başlık sayfanın sonunda kalmasın
      const isHead = !Array.isArray(p)
      if (words > 0 && (words + w > target * 1.25 || (isHead && words > target * 0.6))) {
        pages.push({ chapter: ci, from, to: pi, words, lastOfChapter: false })
        from = pi
        words = 0
      }
      words += w
    })
    if (c.paras.length > from) pages.push({ chapter: ci, from, to: c.paras.length, words, lastOfChapter: true })
    else if (pages.length) pages[pages.length - 1].lastOfChapter = true
  })
  return pages
}

let publicIndex: Promise<BookMeta[]> | null = null

async function loadPublicIndex(): Promise<BookMeta[]> {
  publicIndex ??= fetch(`${import.meta.env.BASE_URL}data/okuma/kitaplar.json`)
    .then((r) => (r.ok ? (r.json() as Promise<BookMeta[]>) : []))
    .catch(() => [])
  const list = await publicIndex
  if (!list.length) publicIndex = null
  return list
}

async function loadLocalIndex(): Promise<BookMeta[]> {
  if (!hasLocalContent()) return []
  try {
    const r = await localFetch('/local-api/okuma-kitap/')
    return r.ok ? ((await r.json()) as BookMeta[]) : []
  } catch {
    return []
  }
}

/** Tüm kitaplar: önce özgün uyarlamalar, sonra yerel kitaplar */
export async function listBooks(): Promise<BookMeta[]> {
  const [a, b] = await Promise.all([loadPublicIndex(), loadLocalIndex()])
  return [...a, ...b]
}

const bookCache = new Map<string, Promise<Book | null>>()

export function loadBook(id: string): Promise<Book | null> {
  if (!/^[a-z0-9-]+$/.test(id)) return Promise.resolve(null)
  let p = bookCache.get(id)
  if (!p) {
    p = (async () => {
      const pub = await fetch(`${import.meta.env.BASE_URL}data/okuma/kitap/${id}.json`).catch(() => null)
      if (pub?.ok && (pub.headers.get('content-type') || '').includes('json')) return { ...((await pub.json()) as Book), origin: 'ozgun' as const }
      if (!hasLocalContent()) return null
      const loc = await localFetch(`/local-api/okuma-kitap/${id}`)
      return loc.ok ? { ...((await loc.json()) as Book), origin: 'yerel' as const } : null
    })().catch(() => null)
    bookCache.set(id, p)
    void p.then((b) => b || bookCache.delete(id))
  }
  return p
}

// Kaldığın yer
export interface BookProgress {
  page: number
  pages: number
  at: string
}

const progressKey = (userId: string) => `yds-kitap:${userId}`

export function readProgress(userId: string): Record<string, BookProgress> {
  try {
    return JSON.parse(localStorage.getItem(progressKey(userId)) || '{}') as Record<string, BookProgress>
  } catch {
    return {}
  }
}

export function saveProgress(userId: string, bookId: string, page: number, pages: number) {
  try {
    const all = readProgress(userId)
    all[bookId] = { page, pages, at: new Date().toISOString() }
    localStorage.setItem(progressKey(userId), JSON.stringify(all))
  } catch {
    // Depo kapalıysa yalnızca bu oturumda
  }
}
