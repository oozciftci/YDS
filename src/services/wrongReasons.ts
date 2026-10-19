import type { ExamAnswer, WrongReason } from '../types/database'

export const WRONG_REASONS: { key: WrongReason; label: string; hint: string }[] = [
  { key: 'bilmiyordum', label: 'Bilmiyordum', hint: 'Kelime, kalıp ya da konu eksik' },
  { key: 'dikkatsizlik', label: 'Dikkatsizlik', hint: 'Bilgi vardı, yanlış okudum / işaretledim' },
  { key: 'sure', label: 'Süre yetmedi', hint: 'Acele ettim ya da tahmin ettim' },
]

export function reasonLabel(r: WrongReason): string {
  return WRONG_REASONS.find((x) => x.key === r)?.label ?? r
}

/** Etiketlenmiş yanlışların neden dağılımı. `sinceDays` verilirse yalnızca son N gün. */
export function reasonCounts(answers: ExamAnswer[], sinceDays?: number, now = Date.now()) {
  const since = sinceDays ? new Date(now - sinceDays * 86400000).toISOString() : ''
  const counts: Record<WrongReason, number> = { bilmiyordum: 0, dikkatsizlik: 0, sure: 0 }
  let untagged = 0
  for (const a of answers) {
    if (a.correct) continue
    if (since && a.answeredAt < since) continue
    if (a.wrongReason) counts[a.wrongReason]++
    else untagged++
  }
  return { counts, untagged, tagged: counts.bilmiyordum + counts.dikkatsizlik + counts.sure }
}
