import type { CardState, ExamAnswer, MockExamResult, ReviewLog } from '../types/database'
import { dayKey } from './dates'

export interface Milestone {
  id: string
  icon: string
  title: string
  desc: string
  current: number
  goal: number
  earned: boolean
}

export interface MilestoneInput {
  cards: CardState[]
  logs: ReviewLog[]
  answers: ExamAnswer[]
  mocks: MockExamResult[]
  targetScore: number
  /** Soru rozetleri yalnızca soru modülü varken (yerel) ya da hiç soru çözülmüşse gösterilir. */
  showQuestions: boolean
}

function longestStreak(days: Set<string>): number {
  let best = 0
  let run = 0
  let prev: string | null = null
  for (const k of [...days].sort()) {
    if (prev) {
      const p = new Date(prev + 'T00:00:00')
      p.setDate(p.getDate() + 1)
      run = dayKey(p) === k ? run + 1 : 1
    } else run = 1
    best = Math.max(best, run)
    prev = k
  }
  return best
}

/** Kilometre taşları: ayrıca saklanmaz, her seferinde mevcut verilerden hesaplanır. */
export function computeMilestones(input: MilestoneInput): Milestone[] {
  const days = new Set(input.logs.map((l) => dayKey(l.reviewedAt)))
  for (const a of input.answers) days.add(dayKey(a.answeredAt))
  const streak = longestStreak(days)
  const learned = input.cards.filter((c) => c.reps > 0 && (c.masteryScore ?? 0) >= 4).length
  const solved = input.answers.length
  const cleared = input.answers.filter((a) => a.wrongCount > 0 && !a.inWrongBook && a.correct).length
  const bestMock = input.mocks.reduce((m, r) => Math.max(m, r.score), 0)

  const m = (id: string, icon: string, title: string, desc: string, current: number, goal: number): Milestone => ({
    id,
    icon,
    title,
    desc,
    current: Math.min(current, goal),
    goal,
    earned: current >= goal,
  })

  const list: Milestone[] = [
    m('first', '👣', 'İlk adım', 'İlk kelime tekrarını yap', input.logs.length, 1),
    m('streak7', '🔥', '7 gün seri', 'Art arda 7 gün çalış', streak, 7),
    m('streak30', '🌋', '30 gün seri', 'Art arda 30 gün çalış', streak, 30),
    m('learned100', '📗', '100 kelime', '100 kelimeye 4-5 puan ver', learned, 100),
    m('learned500', '📚', '500 kelime', '500 kelimeye 4-5 puan ver', learned, 500),
    m('learned1500', '🏛️', '1500 kelime', '1500 kelimeye 4-5 puan ver', learned, 1500),
  ]
  if (input.showQuestions || solved > 0 || input.mocks.length > 0) {
    list.push(
      m('solved100', '✏️', '100 soru', '100 çıkmış soru çöz', solved, 100),
      m('solved1000', '🗂️', '1000 soru', '1000 çıkmış soru çöz', solved, 1000),
      m('cleared25', '📕', 'Yanlıştan doğruya', 'Yanlış Defteri’nden 25 soruyu doğru çözerek çıkar', cleared, 25),
      m('mock1', '⏱️', 'İlk deneme', 'Bir süreli denemeyi bitir', input.mocks.length, 1),
      m('mockTarget', '🎯', 'Hedef puan', `Bir denemede ${input.targetScore} puana ulaş`, Math.floor(bestMock), input.targetScore),
    )
  }
  return list
}
