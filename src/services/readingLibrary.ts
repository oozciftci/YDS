// Okuma Kütüphanesi: seviyeli özgün (telifsiz, bu projede yazılmış) okuma metinleri — public/data/okuma/<seviye>.json.
// Her metinde cümle cümle Türkçe, metne özgü kelime anlamları, Türkçe özet ve anlama soruları vardır; yayında da açılır.
// Denetim: node scripts/qcOkuma.mjs

export type ReadingLevel = 'A2' | 'B1' | 'B2' | 'C1'

export interface LibQuestion {
  /** Soru (İngilizce) ve Türkçesi */
  q: string
  qt: string
  /** 4 şık; a = doğru şıkkın sırası (0 = A) */
  o: string[]
  a: number
  /** Neden doğru (Türkçe, metindeki cümleye dayanarak) */
  why: string
}

export interface LibText {
  id: string
  title: string
  titleTr: string
  topic: string
  sentences: { en: string; tr: string }[]
  /** Küçük harfli kelime (metinde geçtiği biçimiyle) → bu metindeki anlamı */
  glosses: Record<string, string>
  summary: string
  qs: LibQuestion[]
}

export interface LibEntry extends LibText {
  level: ReadingLevel
}

/** Seviyeler (kolaydan zora). Dosyası olmayan seviye listede görünmez. */
export const READING_LEVELS: { level: ReadingLevel; file: string; label: string; hint: string }[] = [
  { level: 'A2', file: 'a2', label: 'A2 · Başlangıç', hint: 'Kısa cümleler, günlük kelimeler' },
  { level: 'B1', file: 'b1', label: 'B1 · Orta', hint: 'Uzun cümleler, bağlaçlar, akademik kelimelere giriş' },
  { level: 'B2', file: 'b2', label: 'B2 · İyi', hint: 'YDS paragraflarına yaklaşan metinler' },
  { level: 'C1', file: 'c1', label: 'C1 · YDS düzeyi', hint: 'Sınavdaki gibi yoğun akademik metinler' },
]

let cache: Promise<LibEntry[]> | null = null

/** Tüm metinler: seviye sırasıyla, her seviyede dosyadaki sırayla. */
export function loadLibrary(): Promise<LibEntry[]> {
  cache ??= Promise.all(
    READING_LEVELS.map(async ({ level, file }) => {
      try {
        const r = await fetch(`${import.meta.env.BASE_URL}data/okuma/${file}.json`)
        if (!r.ok) return []
        const data = (await r.json()) as { texts: LibText[] }
        return data.texts.map((t) => ({ ...t, level }))
      } catch {
        return []
      }
    }),
  ).then((all) => all.flat())
  // Ağ hatasında bir sonraki açılış yeniden denesin
  cache.then((l) => l.length || (cache = null)).catch(() => (cache = null))
  return cache
}

const WORD = /[A-Za-z]+(?:['’][A-Za-z]+)?/g

export function countWords(sentences: { en: string }[]): number {
  return sentences.reduce((n, s) => n + (s.en.match(WORD) || []).length, 0)
}

/** Dokunulan kelimenin bu metindeki anlamı (yoksa undefined; o zaman genel sözlüğe bakılır). */
export function glossFor(glosses: Record<string, string>, token: string): string | undefined {
  const w = token.toLowerCase().replace(/^[^a-z]+|[^a-z]+$/g, '')
  return glosses[w] ?? glosses[w.replace(/['’]s$/, '')]
}
