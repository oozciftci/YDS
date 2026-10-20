import type { SectionKey } from './ydsSections'

// Taktik Kitabı: YDS hocalarının kitaplarından (OCR) çıkarılan, soru tipine göre kısa uygulanabilir kurallar.
// Veri telifli olduğu için yalnızca yerelde, dev-only ara katmandan gelir (vite.config.ts → /local-api/kaynak).
// Yayın derlemesinde bu fonksiyonlar boş döner.
//
// local-data/kaynaklar/
//   harita.json            SourceMap: kitaplar + konu → sayfa aralıkları (bir soruda en fazla ~4 sayfa okunur)
//   taktik-kitabi.json     TacticsBook: kurallar (her biri kitap + sayfa atıflı)
//   <kitap-id>/sayfa-0001.md  OCR çıktısı, sayfa başına bir dosya (kitabın basılı sayfa numarasıyla değil PDF sırasıyla)

export interface SourceBook {
  id: string
  title: string
  author?: string
  /** Kaynak PDF dosya adı (local-data/kaynaklar/ altında) */
  pdf?: string
  /** OCR'lı sayfa sayısı */
  pages: number
}

export interface MapEntry {
  book: string
  from: number
  to: number
  title: string
  sections?: SectionKey[]
  /** grammar.ts konu id'leri */
  grammar?: string[]
  tags?: string[]
}

export interface SourceMap {
  books: SourceBook[]
  entries: MapEntry[]
}

export interface TacticRule {
  id: string
  section?: SectionKey
  grammar?: string
  /** Kuralın kendisi (Türkçe, kısa ve uygulanabilir) */
  text: string
  /** İsteğe bağlı kısa İngilizce örnek */
  example?: string
  source?: { book: string; page: number }
}

export interface TacticsBook {
  updatedAt: string | null
  rules: TacticRule[]
}

export type SourceMode = 'koc' | 'saf'

const EMPTY_MAP: SourceMap = { books: [], entries: [] }
const EMPTY_BOOK: TacticsBook = { updatedAt: null, rules: [] }

let mapCache: Promise<SourceMap> | null = null
let bookCache: Promise<TacticsBook> | null = null

async function getJson<T>(url: string, empty: T): Promise<T> {
  try {
    const r = await fetch(url)
    return r.ok ? ((await r.json()) as T) : empty
  } catch {
    return empty
  }
}

export function loadSourceMap(): Promise<SourceMap> {
  if (!import.meta.env.DEV) return Promise.resolve(EMPTY_MAP)
  mapCache ??= getJson('/local-api/kaynak/harita', EMPTY_MAP)
  return mapCache
}

export function loadTactics(): Promise<TacticsBook> {
  if (!import.meta.env.DEV) return Promise.resolve(EMPTY_BOOK)
  bookCache ??= getJson('/local-api/kaynak/taktik', EMPTY_BOOK)
  return bookCache
}

/** Düzenleme ekranından kaydeder (yalnızca yerelde). */
export async function saveTactics(book: TacticsBook): Promise<void> {
  if (!import.meta.env.DEV) throw new Error('Taktik Kitabı yalnızca yerelde düzenlenebilir.')
  const r = await fetch('/local-api/kaynak/taktik', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(book),
  })
  if (!r.ok) throw new Error('Kaydedilemedi: ' + (await r.text()))
  bookCache = null
}

async function pageText(book: string, page: number): Promise<string> {
  try {
    const r = await fetch(`/local-api/kaynak/sayfa/${encodeURIComponent(book)}/${page}`)
    return r.ok ? await r.text() : ''
  } catch {
    return ''
  }
}

// ---------------------------------------------------------------------------
// Mod tercihi (Koç: kaynaklı / Saf Gemini)
// ---------------------------------------------------------------------------

const MODE_KEY = 'yds-ai-source-mode'

export function getSourceMode(): SourceMode {
  try {
    return localStorage.getItem(MODE_KEY) === 'koc' ? 'koc' : 'saf'
  } catch {
    return 'saf'
  }
}

export function setSourceMode(m: SourceMode): void {
  try {
    localStorage.setItem(MODE_KEY, m)
  } catch {
    // yoksay
  }
}

/** Koç modu seçilebilir mi: Taktik Kitabı'nda kural ya da kaynak haritasında en az bir bölüm olmalı. */
export async function tacticsAvailable(): Promise<boolean> {
  const [book, map] = await Promise.all([loadTactics(), loadSourceMap()])
  return book.rules.length > 0 || map.entries.length > 0
}

// ---------------------------------------------------------------------------
// Modele gidecek kaynak bağlamı
// ---------------------------------------------------------------------------

const MAX_PAGES = 4
const MAX_PAGE_CHARS = 3000

export interface TacticsQuery {
  sections?: SectionKey[]
  grammar?: string[]
  /** true ise haritadan ilgili en fazla 4 sayfanın metni de eklenir */
  withPages?: boolean
}

function bookTitle(map: SourceMap, id: string): string {
  return map.books.find((b) => b.id === id)?.title ?? id
}

/**
 * Koç modu için kaynak bağlamı: ilgili kurallar (atıflı) + istenirse haritadan en fazla 4 sayfalık alıntı.
 * Kural yoksa boş metin döner.
 */
export async function tacticsContext(q: TacticsQuery): Promise<string> {
  const [book, map] = await Promise.all([loadTactics(), loadSourceMap()])
  const secs = new Set(q.sections ?? [])
  const gram = new Set(q.grammar ?? [])
  const rules = book.rules.filter((r) => (r.section && secs.has(r.section)) || (r.grammar && gram.has(r.grammar)))
  // Kural yoksa da kaynak sayfaları (ör. Sınav Stratejileri 1-2 konu anlatımı) tek başına bağlam olabilir
  if (!rules.length && !q.withPages) return ''

  const cite = (r: TacticRule) => (r.source ? ` [${bookTitle(map, r.source.book)}, s. ${r.source.page}]` : '')
  const lines = rules.length
    ? ['KAYNAK TAKTİKLERİ (hocaların kitaplarından):', ...rules.map((r) => `- ${r.text}${r.example ? ` Örnek: ${r.example}` : ''}${cite(r)}`)]
    : []

  if (q.withPages) {
    const entries = map.entries.filter((e) => e.sections?.some((s) => secs.has(s)) || e.grammar?.some((g) => gram.has(g)))
    const pages: { book: string; page: number }[] = []
    for (const e of entries) {
      for (let p = e.from; p <= e.to && pages.length < MAX_PAGES; p++) pages.push({ book: e.book, page: p })
      if (pages.length >= MAX_PAGES) break
    }
    const texts = await Promise.all(pages.map((p) => pageText(p.book, p.page)))
    const excerpts = pages
      .map((p, i) => (texts[i] ? `[${bookTitle(map, p.book)}, s. ${p.page}]\n${texts[i].slice(0, MAX_PAGE_CHARS)}` : ''))
      .filter(Boolean)
    if (excerpts.length) lines.push('', 'KAYNAK SAYFALARINDAN ALINTI:', ...excerpts)
  }
  return lines.join('\n')
}

/** Koç modunda sistem talimatına eklenen davranış kuralı. */
export const COACH_MODE_RULES = [
  'KOÇ MODU: Öncelikle aşağıdaki kaynak taktiklerine dayan ve anlatımı taktik ağırlıklı yap (örn. "paragrafı tam anlamasan bile şu ipucuyla çözülür").',
  'Kullandığın kuralın kaynağını köşeli parantezle belirt: [Kitap, s. X].',
  'Kaynakta olmayan bir şey söyleyeceksen ayrı bir satırda "Kaynakta yok, genel bilgi:" diye başlat.',
].join('\n')
