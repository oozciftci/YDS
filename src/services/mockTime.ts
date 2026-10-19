import { ALL_SECTIONS, sectionOf, type SectionKey } from './ydsSections'

export interface SectionTime {
  key: SectionKey
  label: string
  questions: number
  totalSec: number
  /** Soru başına ortalama saniye */
  avgSec: number
  /** Bu denemenin genel ortalamasından belirgin yavaşsa true */
  slow: boolean
}

/** Gerçek sınavdaki ortalama tempo: 180 dk / 80 soru. */
export const TARGET_SEC_PER_QUESTION = 135

/**
 * Soru başına süreleri (soru no → saniye) tip bazında toplar.
 * "Yavaş": tipin soru başı süresi, denemenin genel ortalamasının 1,3 katından fazlaysa.
 */
export function summarizeTimes(times: Record<number, number>, examId: string): SectionTime[] {
  const acc = new Map<SectionKey, { q: number; t: number }>()
  for (const [noStr, sec] of Object.entries(times)) {
    const k = sectionOf(Number(noStr), examId).key
    const a = acc.get(k) ?? { q: 0, t: 0 }
    a.q++
    a.t += sec
    acc.set(k, a)
  }
  const totalQ = [...acc.values()].reduce((s, a) => s + a.q, 0)
  const totalT = [...acc.values()].reduce((s, a) => s + a.t, 0)
  const mean = totalQ ? totalT / totalQ : 0
  return ALL_SECTIONS.filter((s) => acc.has(s.key)).map((s) => {
    const a = acc.get(s.key)!
    const avgSec = a.t / a.q
    return { key: s.key, label: s.label, questions: a.q, totalSec: a.t, avgSec, slow: a.q >= 3 && avgSec > mean * 1.3 }
  })
}
