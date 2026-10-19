import type { SectionStat } from './examProgress'
import { YDS_SECTIONS, type SectionKey } from './ydsSections'

/** YDS’de bir doğru 1,25 puan; 80 sorunun hepsi doğruysa 100. */
export const POINT_PER_CORRECT = 1.25

export interface SectionGain {
  key: SectionKey
  label: string
  questions: number
  /** Şu anki başarı (0-1); cevap yoksa genel ortalama kullanılır. */
  rate: number
  /** Bu tipte, hedef için eklenmesi önerilen doğru sayısı. */
  gain: number
}

export interface TargetPlan {
  target: number
  /** Hedef puan için gereken doğru sayısı (80 üzerinden). */
  needCorrect: number
  /** Şu anki başarıya göre tahmini doğru sayısı. */
  estCorrect: number
  /** Eksik doğru sayısı; 0 ise hedefe ulaşılmış görünüyor. */
  gap: number
  gains: SectionGain[]
}

/**
 * Hedef puana göre gereken doğru sayısı ve eksik doğruların hangi tiplerden kapatılacağı.
 * Eksik, tiplerin "yükselme payı" (soru sayısı × yanlış oranı) ile orantılı dağıtılır; gerçekçi olsun diye
 * bir tipte en fazla %95 başarı varsayılır. Yeterli veri yoksa (cevaplanan < minAnswered) null döner.
 */
export function buildTargetPlan(target: number, stats: SectionStat[], minAnswered = 20): TargetPlan | null {
  const totalAnswered = stats.reduce((s, x) => s + x.answered, 0)
  if (totalAnswered < minAnswered || !(target > 0)) return null
  const known = YDS_SECTIONS.map((s) => stats.find((x) => x.key === s.key)).filter((x) => x && x.answered >= 3)
  if (!known.length) return null
  const avg = known.reduce((s, x) => s + (x!.correct / x!.answered) * x!.answered, 0) / known.reduce((s, x) => s + x!.answered, 0)

  const rows = YDS_SECTIONS.map((s) => {
    const st = stats.find((x) => x.key === s.key)
    const questions = s.to - s.from + 1
    const rate = st && st.answered >= 3 ? st.correct / st.answered : avg
    return { key: s.key, label: s.label, questions, rate }
  })
  const estCorrect = rows.reduce((s, r) => s + r.questions * r.rate, 0)
  const needCorrect = Math.min(80, Math.ceil(target / POINT_PER_CORRECT - 1e-9))
  const gap = Math.max(0, needCorrect - estCorrect)

  const room = rows.map((r) => Math.max(0, r.questions * (0.95 - r.rate)))
  const roomSum = room.reduce((a, b) => a + b, 0)
  const gains: SectionGain[] = rows
    .map((r, i) => ({ ...r, gain: roomSum > 0 ? (gap * room[i]) / roomSum : 0 }))
    .sort((a, b) => b.gain - a.gain)
  return { target, needCorrect, estCorrect, gap, gains }
}
