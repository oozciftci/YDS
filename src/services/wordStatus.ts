import { create } from 'zustand'
import { db } from '../db'
import type { CardState, KnownWord, WordItem, WordMark } from '../types/database'
import { getStemCandidates } from './dictionary'
import { EXAM_COLLECTED_TAG, READING_COLLECTED_TAG } from './groups'

// Okurken kelime durumu (LingQ tarzı): her kelime yeni / öğreniliyor / biliniyor / yok sayılır.
// Kaynaklar, öncelik sırasıyla: kullanıcının elle verdiği işaret (db.knownWords) → havuzdaki kartın durumu
// (çalışılmış ve 4-5 puan = biliniyor, çalışılıyor ya da okurken/sınavdan toplanmış = öğreniliyor) → en sık kelimeler
// (baştan biliniyor sayılır) → cümle ortasında büyük harfle başlayan, havuzda olmayan kelime (özel ad: yok sayılır).
// Kelime kök adaylarıyla eşleşir (countries → country). Kitap/metin başına bilinen kelime oranı `coverage`.

export type WordStatus = 'new' | 'learning' | 'known' | 'ignored'

/** En sık İngilizce kelimeler: işaretlemeden biliniyor sayılır (her satır mavi olmasın). */
const COMMON = new Set(
  `a about above across after again against ago all almost alone along already also although always am among an and another
any anyone anything are around as ask asked at away back be became because become been before began behind being believe
below best better between big both bring brought but by call called came can cannot could come comes coming day days did
didn't do does doesn't doing don't done down during each early either else end enough even ever every everyone everything
eye eyes face far feel felt few find first for found four from front gave get gets getting give given go goes going gone good
got great had hand hands has have having he head hear heard her here hers herself him himself his home house how however i
i'd i'll i'm i've if in into is isn't it it's its itself just keep kept knew know known last least left less let life like
little long look looked looking made make man many may me men might mind more most mother much must my myself name near need
never new next night no nobody none nor not nothing now of off often oh old on once one only open or other others our out
over own part people perhaps place put quite rather really right room said same saw say says see seemed seen she should since
so some someone something sometimes soon still such sure take taken tell than that that's the their them themselves then
there there's these they they're thing things think this those though thought three through time times to today together
told too took toward towards turn turned two under until up upon us use used very want wanted was wasn't water way we we're
well went were weren't what when where whether which while who whole whom whose why will with within without woman women
word words work world would year years yes yet you you're your yourself mr mrs miss dr sir st`.split(/\s+/),
)

const TOKEN_RE = /[A-Za-z]+(?:['’][A-Za-z]+)?/g

/** Durum hesabı için gereken her şey (kullanıcıya özel, bellekte) */
export interface StatusIndex {
  marks: Map<string, WordMark>
  /** Havuzdaki tek kelimelik terimlerin durumu */
  pool: Map<string, 'learning' | 'known' | 'pool'>
}

export const emptyIndex = (): StatusIndex => ({ marks: new Map(), pool: new Map() })

/** Havuzdaki kelimenin durumu: çalışılmış ve 4-5 → biliniyor; çalışılıyor ya da toplanmış → öğreniliyor */
export function poolStatus(w: Pick<WordItem, 'tags'>, c?: Pick<CardState, 'reps' | 'masteryScore'>): 'learning' | 'known' | 'pool' {
  if (c && c.reps > 0) return (c.masteryScore ?? 0) >= 4 ? 'known' : 'learning'
  const tags = w.tags || []
  return tags.includes(READING_COLLECTED_TAG) || tags.includes(EXAM_COLLECTED_TAG) ? 'learning' : 'pool'
}

/**
 * Bir kelimenin durumu. `midCap`: cümle ortasında büyük harfle başlıyor (özel ad olasılığı).
 * Aday sırası: önce yazıldığı biçim, sonra kökler; ilk işaret/havuz eşleşmesi geçerlidir.
 */
export function statusOf(ix: StatusIndex, token: string, midCap = false): WordStatus {
  const cands = getStemCandidates(token)
  if (!cands.length) return 'ignored'
  for (const c of cands) {
    const m = ix.marks.get(c)
    if (m && m !== 'new') return m // 'new' = işaret kaldırılmış (eşitlemede geri gelmesin diye silinmez)
  }
  for (const c of cands) {
    const p = ix.pool.get(c)
    if (p === 'learning' || p === 'known') return p
  }
  if (cands.some((c) => COMMON.has(c))) return 'known'
  if (/^\d/.test(cands[0])) return 'ignored'
  if (midCap && !cands.some((c) => ix.pool.has(c))) return 'ignored'
  return 'new'
}

/** Metindeki kelimeler (cümle ortasında büyük harf bilgisiyle) */
export function wordsOf(sentence: string): { w: string; midCap: boolean }[] {
  const out: { w: string; midCap: boolean }[] = []
  let first = true
  for (const m of sentence.matchAll(TOKEN_RE)) {
    out.push({ w: m[0], midCap: !first && /^[A-Z]/.test(m[0]) && m[0] !== 'I' && !/^I['’]/.test(m[0]) })
    first = false
  }
  return out
}

export interface Coverage {
  /** Sayılan kelime geçişi (yok sayılanlar hariç) */
  total: number
  known: number
  learning: number
  /** Bilinen oranı (0-100, geçiş üzerinden) */
  pct: number
  /** Benzersiz yeni kelimeler (küçük harf) */
  newWords: string[]
}

export function coverage(ix: StatusIndex, sentences: Iterable<string>): Coverage {
  let total = 0
  let known = 0
  let learning = 0
  const fresh = new Set<string>()
  for (const s of sentences)
    for (const { w, midCap } of wordsOf(s)) {
      const st = statusOf(ix, w, midCap)
      if (st === 'ignored') continue
      total++
      if (st === 'known') known++
      else if (st === 'learning') learning++
      else fresh.add(w.toLowerCase())
    }
  return { total, known, learning, pct: total ? Math.round((known / total) * 100) : 0, newWords: [...fresh] }
}

/** Büyük metinler için: kelime biçimi (+ cümle ortası büyük harf) → geçiş sayısı; bir kez sayılır, oran hızlı yenilenir */
export type TokenCounts = Map<string, number>
export function countTokens(sentences: Iterable<string>): TokenCounts {
  const counts: TokenCounts = new Map()
  for (const s of sentences)
    for (const { w, midCap } of wordsOf(s)) {
      const k = (midCap ? '^' : '') + w
      counts.set(k, (counts.get(k) ?? 0) + 1)
    }
  return counts
}

export function coverageOfCounts(ix: StatusIndex, counts: TokenCounts): Coverage {
  let total = 0
  let known = 0
  let learning = 0
  const fresh = new Set<string>()
  for (const [k, n] of counts) {
    const midCap = k.startsWith('^')
    const w = midCap ? k.slice(1) : k
    const st = statusOf(ix, w, midCap)
    if (st === 'ignored') continue
    total += n
    if (st === 'known') known += n
    else if (st === 'learning') learning += n
    else fresh.add(w.toLowerCase())
  }
  return { total, known, learning, pct: total ? Math.round((known / total) * 100) : 0, newWords: [...fresh] }
}

// ---- Bellekteki dizin (kullanıcı başına) ----

interface StatusStore {
  userId: string | null
  ix: StatusIndex
  /** Her değişiklikte artar (vurgulu metinler yeniden çizilsin) */
  version: number
  loaded: boolean
  load: (userId: string) => Promise<void>
  mark: (userId: string, terms: string[], status: WordMark) => Promise<void>
  /** Havuza yeni eklenen/etiketlenen kelimeyi dizine işler (yeniden yüklemeden) */
  notePool: (term: string, status: 'learning' | 'known') => void
}

export const useWordStatus = create<StatusStore>((set, get) => ({
  userId: null,
  ix: emptyIndex(),
  version: 0,
  loaded: false,
  async load(userId) {
    const [marks, words, cards] = await Promise.all([
      db.knownWords.where('userId').equals(userId).toArray(),
      db.words.where('userId').equals(userId).toArray(),
      db.cardStates.where('userId').equals(userId).toArray(),
    ])
    const ix = emptyIndex()
    for (const m of marks) ix.marks.set(m.term, m.status)
    const byWord = new Map(cards.map((c) => [c.wordId, c]))
    for (const w of words) {
      if (w.isDeleted) continue
      const term = w.term.trim().toLowerCase()
      if (!term || /\s/.test(term)) continue
      const st = poolStatus(w, byWord.get(w.id))
      const prev = ix.pool.get(term)
      // Aynı terim birden çok kez varsa en ileri durum
      if (!prev || prev === 'pool' || (prev === 'learning' && st === 'known')) ix.pool.set(term, st)
    }
    set({ userId, ix, loaded: true, version: get().version + 1 })
  },
  async mark(userId, terms, status) {
    const now = new Date().toISOString()
    // Kök adaylarına da yazılır: "islands" bilindiyse "island" da bilinir (2 harften kısa adaylar hariç)
    const all = terms.flatMap((t) => [t.toLowerCase(), ...getStemCandidates(t).filter((c) => c.length >= 3)])
    const rows: KnownWord[] = [...new Set(all.filter(Boolean))].map((term) => ({
      id: `${userId}|${term}`,
      userId,
      term,
      status,
      updatedAt: now,
    }))
    if (!rows.length) return
    await db.knownWords.bulkPut(rows)
    const { ix } = get()
    for (const r of rows) ix.marks.set(r.term, r.status)
    set({ version: get().version + 1 })
  },
  notePool(term, status) {
    const { ix } = get()
    const t = term.trim().toLowerCase()
    ix.pool.set(t, status)
    set({ version: get().version + 1 })
  },
}))

// ---- Kelime vurgusu tercihi ----

const HL_KEY = 'yds-kelime-vurgu'
export function readHighlight(): boolean {
  try {
    return localStorage.getItem(HL_KEY) !== '0'
  } catch {
    return true
  }
}
export function saveHighlight(on: boolean) {
  try {
    localStorage.setItem(HL_KEY, on ? '1' : '0')
  } catch {
    // depo kapalıysa yalnızca bu oturumda
  }
}

// ---- Kitap başına bilinen oranı (önbellek: listede gösterilir) ----

export interface CachedCoverage {
  pct: number
  newCount: number
  at: string
}
const covKey = (userId: string) => `yds-kitap-kapsam:${userId}`
export function readBookCoverage(userId: string): Record<string, CachedCoverage> {
  try {
    return JSON.parse(localStorage.getItem(covKey(userId)) || '{}') as Record<string, CachedCoverage>
  } catch {
    return {}
  }
}
export function saveBookCoverage(userId: string, bookId: string, c: Coverage) {
  try {
    const all = readBookCoverage(userId)
    all[bookId] = { pct: c.pct, newCount: c.newWords.length, at: new Date().toISOString() }
    localStorage.setItem(covKey(userId), JSON.stringify(all))
  } catch {
    // depo kapalıysa listede oran görünmez
  }
}
