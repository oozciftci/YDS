import type { MockExamResult } from '../types/database'
import { ALL_SECTIONS, type SectionKey } from './ydsSections'

export interface MockCadence {
  /** İki deneme arası önerilen gün sayısı */
  everyDays: number
  label: string
}

/** Sınava kalan güne göre deneme sıklığı önerisi. */
export function mockCadence(daysLeft: number | null): MockCadence {
  if (daysLeft === null) return { everyDays: 14, label: '2 haftada bir' }
  if (daysLeft > 180) return { everyDays: 30, label: 'ayda bir' }
  if (daysLeft > 90) return { everyDays: 14, label: '2 haftada bir' }
  if (daysLeft > 30) return { everyDays: 7, label: 'haftada bir' }
  if (daysLeft > 14) return { everyDays: 5, label: 'haftada 1-2' }
  return { everyDays: 3, label: 'haftada 2' }
}

export interface MockAdvice {
  cadence: MockCadence
  /** Son denemeden beri geçen gün (deneme yoksa null) */
  sinceLast: number | null
  /** Yeni deneme zamanı geldi mi */
  due: boolean
}

export function mockAdvice(results: MockExamResult[], daysLeft: number | null, now = Date.now()): MockAdvice {
  const cadence = mockCadence(daysLeft)
  const last = results.reduce((m, r) => Math.max(m, new Date(r.finishedAt).getTime()), 0)
  const sinceLast = last ? Math.floor((now - last) / 86_400_000) : null
  return { cadence, sinceLast, due: sinceLast === null || sinceLast >= cadence.everyDays }
}

export interface CompareRow {
  key: SectionKey
  label: string
  /** Eski → yeni sırasıyla yüzde (0-100); o tipte soru yoksa null */
  pcts: (number | null)[]
  /** Son denemeyle bir öncekinin farkı (puan); karşılaştırılamıyorsa null */
  delta: number | null
}

/** Son N denemenin tip bazlı başarı karşılaştırması. */
export function compareMocks(results: MockExamResult[], take = 4): CompareRow[] {
  const recent = [...results].sort((a, b) => a.finishedAt.localeCompare(b.finishedAt)).slice(-take)
  return ALL_SECTIONS.map((s) => {
    const pcts = recent.map((r) => {
      const v = r.sections[s.key]
      return v && v[1] > 0 ? Math.round((v[0] / v[1]) * 100) : null
    })
    const a = pcts[pcts.length - 1]
    const b = pcts[pcts.length - 2]
    return { key: s.key, label: s.label, pcts, delta: a !== null && b !== null && b !== undefined && a !== undefined ? a - b : null }
  }).filter((r) => r.pcts.some((p) => p !== null))
}
