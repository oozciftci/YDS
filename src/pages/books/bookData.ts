// Kitaptan çalış: telifli kitapların sayfa görüntüleri geliştirmede yerel sunucudan (/local-api/kitap), yayında cihaza
// yüklenen kaynak paketinden gelir (src/services/localContent.ts; görüntüler için useLocalUrl).
import { localFetch } from '../../services/localContent'

export interface BookMeta {
  id: string
  title: string
  short: string
  level: string
  pageCount: number
  unitCount: number
}

export interface BookPage {
  n: number
  w: number
  h: number
  /** Sayfanın ikiye bölüneceği yükseklik oranı (0–1); null = tam sayfa (tablo, resim vb.) */
  split: number | null
  unit?: number
}

export interface Book {
  id: string
  title: string
  short: string
  level: string
  pageCount: number
  firstUnitPage: number
  units: { no: number; title: string; page: number }[]
  pages: BookPage[]
}

/** Ekranda gösterilen parça: bir sayfanın üst/alt yarısı ya da tamamı. */
export interface Frame {
  page: number
  /** 0 = tam sayfa, 1 = üst yarı, 2 = alt yarı */
  half: 0 | 1 | 2
  start: number
  end: number
}

/** Yarımlar arasında bağlam kopmasın diye bırakılan örtüşme (sayfa yüksekliğinin oranı). */
const OVERLAP = 0.025

export function buildFrames(book: Book, mode: 'half' | 'full'): Frame[] {
  const out: Frame[] = []
  for (const p of book.pages) {
    if (mode === 'half' && p.split !== null) {
      out.push({ page: p.n, half: 1, start: 0, end: Math.min(1, p.split + OVERLAP) })
      out.push({ page: p.n, half: 2, start: Math.max(0, p.split - OVERLAP), end: 1 })
    } else {
      out.push({ page: p.n, half: 0, start: 0, end: 1 })
    }
  }
  return out
}

export function imageUrl(bookId: string, page: number): string {
  return `/local-api/kitap/${bookId}/p${String(page).padStart(3, '0')}.webp`
}

function getJson<T>(url: string): Promise<T> {
  return localFetch(url).then((r) => (r.ok ? (r.json() as Promise<T>) : Promise.reject(new Error(String(r.status)))))
}

export function listBooks(): Promise<BookMeta[]> {
  return getJson<BookMeta[]>('/local-api/kitap/')
}

const cache = new Map<string, Promise<Book>>()
export function loadBook(id: string): Promise<Book> {
  let p = cache.get(id)
  if (!p) {
    p = getJson<Book>(`/local-api/kitap/${encodeURIComponent(id)}`).catch((e) => {
      cache.delete(id)
      throw e
    })
    cache.set(id, p)
  }
  return p
}

// ---- Kaldığın yer ve görünüm tercihi (kişisel kolaylık, tarayıcı deposunda) ----

export interface BookPos {
  page: number
  half: 0 | 1 | 2
  at: string
}

const posKey = (userId: string, bookId: string) => `yds-book-pos:${userId}:${bookId}`

export function readPos(userId: string, bookId: string): BookPos | null {
  try {
    return JSON.parse(localStorage.getItem(posKey(userId, bookId)) || 'null') as BookPos | null
  } catch {
    return null
  }
}

export function savePos(userId: string, bookId: string, page: number, half: 0 | 1 | 2): void {
  try {
    localStorage.setItem(posKey(userId, bookId), JSON.stringify({ page, half, at: new Date().toISOString() }))
  } catch {
    // Depo kapalıysa yalnızca bu oturumda geçerli
  }
}

const MODE_KEY = 'yds-book-mode'
export function readMode(): 'half' | 'full' {
  try {
    const v = localStorage.getItem(MODE_KEY)
    if (v === 'half' || v === 'full') return v
  } catch {
    // yoksay
  }
  // Varsayılan: telefonda yarım, geniş ekranda tam sayfa
  return typeof window !== 'undefined' && window.innerWidth < 820 ? 'half' : 'full'
}
export function saveMode(m: 'half' | 'full'): void {
  try {
    localStorage.setItem(MODE_KEY, m)
  } catch {
    // yoksay
  }
}

/** Sayfanın ait olduğu ünite (ünite sayfaları arasında kalan ek sayfalar bir öncekine sayılır). */
export function unitOf(book: Book, page: number): { no: number; title: string; page: number } | null {
  let found = null
  for (const u of book.units) {
    if (u.page <= page) found = u
    else break
  }
  return found
}
