import type { CreateWordInput } from './words'
import { getStemCandidates } from './dictionary'

export interface FoundWord {
  word: CreateWordInput
  /** Metinde kaç kez geçti (çekimli biçimler dahil) */
  count: number
}

export interface TextWordsResult {
  found: FoundWord[]
  /** Metinde geçen, sözlüğümüzde karşılığı olmayan (çoğunlukla özel isim/nadir) sözcük sayısı */
  unknown: number
  /** Havuzunda zaten olduğu için atlanan sözcük sayısı */
  owned: number
}

const FREQ_ORDER = ['YDS-Çok-Sık', 'YÖKDİL-Çok-Sık', 'YDS-Sık', 'YÖKDİL-Sık', 'YDS-Ara', 'YÖKDİL-Ara']

/** Sınav sıklığına göre öncelik (küçük = önce). Etiketsizler en sona. */
export function freqRank(tags: string[] | undefined): number {
  const t = tags ?? []
  const idx = FREQ_ORDER.findIndex((f) => t.includes(f))
  return idx === -1 ? FREQ_ORDER.length : idx
}

export function isBasicLevel(tags: string[] | undefined): boolean {
  return (tags ?? []).some((t) => t === 'A1' || t === 'A2' || t === 'A1-A2')
}

/**
 * Metindeki sözcükleri sözlükle eşleştirir: havuzunda olmayanları sınav sıklığına, sonra metindeki sayıya göre sıralar.
 * `dict`: kelime paketleri (Oxford + Yeni YDS + YÖKDİL alanları); `owned`: kullanıcının havuzundaki kelimeler (küçük harf).
 */
export function extractWordsFromText(text: string, dict: CreateWordInput[], owned: Set<string>): TextWordsResult {
  const byTerm = new Map<string, CreateWordInput>()
  for (const w of dict) {
    const k = w.term.toLowerCase().trim()
    if (k && !byTerm.has(k)) byTerm.set(k, w)
  }
  const counts = new Map<string, number>()
  for (const raw of text.split(/\s+/)) {
    const cands = getStemCandidates(raw)
    if (!cands.length) continue
    const hit = cands.find((c) => byTerm.has(c))
    const key = hit ?? cands[0]
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const found: FoundWord[] = []
  let unknown = 0
  let ownedCount = 0
  for (const [key, count] of counts) {
    const word = byTerm.get(key)
    if (!word) {
      if (key.length > 3 && !/\d/.test(key)) unknown++
      continue
    }
    if (owned.has(key)) {
      ownedCount++
      continue
    }
    found.push({ word, count })
  }
  found.sort((a, b) => freqRank(a.word.tags) - freqRank(b.word.tags) || b.count - a.count || a.word.term.localeCompare(b.word.term))
  return { found, unknown, owned: ownedCount }
}
