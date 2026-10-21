// Çevirisi hazır olmayan cümleler (okuma kitapları) için: 🌐'ye dokununca internetten Türkçesi getirilir (kelime anlamındaki
// ücretsiz çeviri ucu) ve cihazda saklanır; aynı cümle bir daha sorulmaz. Aynı anda en çok 2 istek (“Çeviriler” açılınca
// sayfadaki tüm cümleler sıraya girer).

const KEY = 'yds-cumle-ceviri'
const MAX = 4000

let cache: Record<string, string> | null = null
function load(): Record<string, string> {
  if (cache) return cache
  try {
    cache = JSON.parse(localStorage.getItem(KEY) || '{}') as Record<string, string>
  } catch {
    cache = {}
  }
  return cache
}

function save(en: string, tr: string) {
  const c = load()
  c[en] = tr
  const keys = Object.keys(c)
  // En eskiler (ilk eklenenler) silinir: depo şişmesin
  if (keys.length > MAX) for (const k of keys.slice(0, keys.length - MAX)) delete c[k]
  try {
    localStorage.setItem(KEY, JSON.stringify(c))
  } catch {
    // Depo doluysa yalnızca bu oturumda hatırlanır
  }
}

export function cachedTranslation(en: string): string | undefined {
  return load()[en]
}

const queue: (() => Promise<void>)[] = []
let running = 0
function pump() {
  while (running < 2 && queue.length) {
    running++
    void queue.shift()!().finally(() => {
      running--
      pump()
    })
  }
}

const pending = new Map<string, Promise<string>>()

/** Cümlenin Türkçesi; internet yoksa ya da çevrilemezse hata fırlatır. */
export function translateSentence(en: string): Promise<string> {
  const hit = cachedTranslation(en)
  if (hit) return Promise.resolve(hit)
  const inFlight = pending.get(en)
  if (inFlight) return inFlight
  const p = new Promise<string>((resolve, reject) => {
    queue.push(async () => {
      try {
        if (!navigator.onLine) throw new Error('çevrimdışı')
        const ctl = new AbortController()
        const t = setTimeout(() => ctl.abort(), 6000)
        const r = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=tr&dt=t&q=${encodeURIComponent(en)}`, { signal: ctl.signal })
        clearTimeout(t)
        if (!r.ok) throw new Error(String(r.status))
        const data = (await r.json()) as unknown
        const tr = Array.isArray(data) && Array.isArray(data[0]) ? (data[0] as unknown[][]).map((x) => String(x?.[0] ?? '')).join('').trim() : ''
        if (!tr) throw new Error('boş')
        save(en, tr)
        resolve(tr)
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)))
      } finally {
        pending.delete(en)
      }
    })
    pump()
  })
  pending.set(en, p)
  return p
}
