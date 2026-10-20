import type { ExamAnswer, MockExamResult, ReviewLog } from '../types/database'
import { dayKey } from './dates'
import { reasonCounts } from './wrongReasons'
import { ALL_SECTIONS, type SectionKey } from './ydsSections'

export interface WeekSlice {
  reviews: number
  activeDays: number
  /** Başarı oranı (puan ≥ 3), 0-100; veri yoksa null */
  successRate: number | null
  newWords: number
  questions: number
  /** Soru doğruluğu 0-100; veri yoksa null */
  questionPct: number | null
}

export interface WeeklyReport {
  thisWeek: WeekSlice
  lastWeek: WeekSlice
  /** Bu haftanın en zayıf soru tipi (en az 5 soru) */
  weakest: { key: SectionKey; label: string; pct: number; n: number } | null
  mocks: { count: number; best: number | null }
  reasons: ReturnType<typeof reasonCounts>
  /** Önbellek anahtarı için haftanın ilk günü (yerel gün anahtarı) */
  weekStart: string
}

const DAY = 86_400_000

function slice(logs: ReviewLog[], answers: ExamAnswer[], firstAt: Map<string, string>, from: number, to: number): WeekSlice {
  const f = new Date(from).toISOString()
  const t = new Date(to).toISOString()
  const l = logs.filter((x) => x.reviewedAt >= f && x.reviewedAt < t)
  const a = answers.filter((x) => x.answeredAt >= f && x.answeredAt < t)
  const days = new Set<string>([...l.map((x) => dayKey(x.reviewedAt)), ...a.map((x) => dayKey(x.answeredAt))])
  const newWords = [...firstAt.values()].filter((d) => d >= f && d < t).length
  return {
    reviews: l.length,
    activeDays: days.size,
    successRate: l.length ? Math.round((l.filter((x) => x.rating >= 3).length / l.length) * 100) : null,
    newWords,
    questions: a.length,
    questionPct: a.length ? Math.round((a.filter((x) => x.correct).length / a.length) * 100) : null,
  }
}

/** Son 7 günün (ve bir önceki haftanın) çalışma özeti. Yalnızca sayılar; soru metni içermez. */
export function buildWeeklyReport(logs: ReviewLog[], answers: ExamAnswer[], mocks: MockExamResult[], now = Date.now()): WeeklyReport {
  // Kelimenin ilk tekrarının zamanı = "yeni kelime" olduğu an
  const firstDay = new Map<string, string>()
  for (const l of logs) {
    const prev = firstDay.get(l.wordId)
    if (!prev || l.reviewedAt < prev) firstDay.set(l.wordId, l.reviewedAt)
  }
  const start = now - 7 * DAY
  const thisWeek = slice(logs, answers, firstDay, start, now + 1)
  const lastWeek = slice(logs, answers, firstDay, start - 7 * DAY, start)

  const since = new Date(start).toISOString()
  const weekAnswers = answers.filter((a) => a.answeredAt >= since)
  let weakest: WeeklyReport['weakest'] = null
  for (const s of ALL_SECTIONS) {
    const list = weekAnswers.filter((a) => a.section === s.key)
    if (list.length < 5) continue
    const pct = Math.round((list.filter((a) => a.correct).length / list.length) * 100)
    if (!weakest || pct < weakest.pct) weakest = { key: s.key, label: s.label, pct, n: list.length }
  }
  const weekMocks = mocks.filter((m) => m.finishedAt >= since)
  return {
    thisWeek,
    lastWeek,
    weakest,
    mocks: { count: weekMocks.length, best: weekMocks.length ? Math.max(...weekMocks.map((m) => m.score)) : null },
    reasons: reasonCounts(answers, 7, now),
    weekStart: dayKey(start),
  }
}

/** Yapay zekâ koç yorumu için kısa Türkçe özet metni (yalnızca sayılar). */
export function reportToText(r: WeeklyReport): string {
  const w = r.thisWeek
  const p = r.lastWeek
  const parts = [
    `Bu hafta: ${w.activeDays} gün çalışıldı, ${w.reviews} kelime tekrarı (başarı ${w.successRate ?? '—'}%), ${w.newWords} yeni kelime, ${w.questions} çıkmış soru (doğruluk ${w.questionPct ?? '—'}%).`,
    `Geçen hafta: ${p.activeDays} gün, ${p.reviews} tekrar (başarı ${p.successRate ?? '—'}%), ${p.newWords} yeni kelime, ${p.questions} soru (doğruluk ${p.questionPct ?? '—'}%).`,
  ]
  if (r.weakest) parts.push(`En zayıf soru tipi: ${r.weakest.label} (%${r.weakest.pct}, ${r.weakest.n} soru).`)
  if (r.mocks.count) parts.push(`Bu hafta ${r.mocks.count} deneme çözüldü, en iyi puan ${r.mocks.best}.`)
  if (r.reasons.tagged) {
    const c = r.reasons.counts
    parts.push(`Yanlış nedenleri (7 gün): bilmiyordum ${c.bilmiyordum}, dikkatsizlik ${c.dikkatsizlik}, süre ${c.sure}.`)
  }
  return parts.join('\n')
}
