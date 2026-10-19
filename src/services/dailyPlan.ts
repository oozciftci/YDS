import type { CardState, ExamAnswer, ReviewLog } from '../types/database'
import { dayKey } from './dates'

export type PlanTaskKey = 'review' | 'new' | 'questions'

export interface PlanTask {
  key: PlanTaskKey
  icon: string
  label: string
  done: number
  target: number
  /** Görevin ne olduğunu anlatan kısa cümle. */
  hint: string
  /** Başlat düğmesinin gideceği adres. */
  to: string
}

export interface PlanInput {
  cards: CardState[]
  logs: ReviewLog[]
  answers: ExamAnswer[]
  daysLeft: number | null
  /** Günlük yeni kelime üst sınırı (Ayarlar). */
  newWordCap: number
  /** Çözülmemiş (cevap anahtarlı) çıkmış soru sayısı; yalnızca yerelde bilinir, yoksa soru görevi çıkmaz. */
  unansweredQuestions?: number
  now?: number
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/**
 * Bugünün planı. Hedefler gün içinde sabit kalsın diye "bugün yapılan + kalan" olarak hesaplanır.
 * - Tekrar: zamanı gelmiş (daha önce çalışılmış) kartların hepsi.
 * - Yeni kelime: kalan yeni kelimeleri sınava kadar eşit dağıtır, üst sınırı aşmaz.
 * - Soru (yerel): çözülmemiş soruları sınava kadar eşit dağıtır (günde 10-40).
 */
export function buildDailyPlan(input: PlanInput): PlanTask[] {
  const now = input.now ?? Date.now()
  const nowIso = new Date(now).toISOString()
  const today = dayKey(now)
  const days = Math.max(1, input.daysLeft ?? 30)

  // Kelimenin ilk tekrarı bugünse "bugün öğrenilen yeni kelime"
  const firstDay = new Map<string, string>()
  for (const l of input.logs) {
    const d = dayKey(l.reviewedAt)
    const prev = firstDay.get(l.wordId)
    if (!prev || d < prev) firstDay.set(l.wordId, d)
  }
  const reviewedToday = new Set<string>()
  const newToday = new Set<string>()
  for (const l of input.logs) {
    if (dayKey(l.reviewedAt) !== today) continue
    if (firstDay.get(l.wordId) === today) newToday.add(l.wordId)
    else reviewedToday.add(l.wordId)
  }

  const dueReviews = input.cards.filter((c) => c.state > 0 && c.due <= nowIso && !newToday.has(c.wordId)).length
  const dueNotDoneYet = input.cards.filter(
    (c) => c.state > 0 && c.due <= nowIso && !reviewedToday.has(c.wordId) && !newToday.has(c.wordId),
  ).length
  const newAvailable = input.cards.filter((c) => !c.state).length
  // Kalan yeni kelimeleri sınava kadar eşit dağıt; günde en az 5, en çok Ayarlar'daki üst sınır
  const newQuota = clamp(Math.ceil((newAvailable + newToday.size) / days), 5, Math.max(5, input.newWordCap))

  const tasks: PlanTask[] = [
    {
      key: 'review',
      icon: '🧠',
      label: 'Tekrar',
      done: reviewedToday.size,
      target: reviewedToday.size + dueNotDoneYet,
      hint:
        dueReviews > 0 || reviewedToday.size > 0
          ? 'Unutma eşiğine gelen kelimeler. Önce bunları bitir.'
          : 'Bugün tekrar zamanı gelen kelime yok.',
      to: '/study?preset=due&auto=1',
    },
    {
      key: 'new',
      icon: '🌱',
      label: 'Yeni kelime',
      done: newToday.size,
      target: Math.max(newToday.size, Math.min(newQuota, newToday.size + newAvailable)),
      hint: newAvailable > 0 ? 'YDS’de en sık çıkanlardan başlayarak.' : 'Havuzundaki tüm kelimeleri çalışmaya başladın.',
      to: '/study?group=new_words&auto=1',
    },
  ]

  if (input.unansweredQuestions !== undefined) {
    const answeredToday = input.answers.filter((a) => dayKey(a.answeredAt) === today).length
    const quota = clamp(Math.ceil((input.unansweredQuestions + answeredToday) / days), 10, 40)
    tasks.push({
      key: 'questions',
      icon: '📖',
      label: 'Soru',
      done: answeredToday,
      target: Math.max(answeredToday, Math.min(quota, answeredToday + input.unansweredQuestions)),
      hint: 'Çıkmış YDS sorularından; en zayıf olduğun tipe öncelik ver.',
      to: '/yds-sorular',
    })
  }
  return tasks
}

/** Tüm görevlerin toplam ilerlemesi (0-100). Hedefi 0 olan görev sayılmaz. */
export function planPercent(tasks: PlanTask[]): number {
  const active = tasks.filter((t) => t.target > 0)
  if (!active.length) return 100
  const sum = active.reduce((s, t) => s + Math.min(1, t.done / t.target), 0)
  return Math.round((sum / active.length) * 100)
}
