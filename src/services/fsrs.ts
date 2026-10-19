import { fsrs, Rating, State, createEmptyCard, type Card as FSRSCard, type Grade } from 'ts-fsrs'
import { db } from '../db'
import type { CardState, MasteryLevel, ReviewLog } from '../types/database'
import { logger } from './logger'
import { queueChange } from './sync'

const MAX_INTERVAL_DAYS = 365
/** "Baya öğrendim" (4) ile "Geliştirmeye muhtaç" (3) arasındaki farkı korumak için tekrar aşamasında aralık bonusu. */
const MASTERY4_BONUS = 1.3

const scheduler = fsrs({
  request_retention: 0.9, // %90 hatırlama hedefi (YDS için ideal)
  maximum_interval: MAX_INTERVAL_DAYS,
})

/** Varsayılan öğrenme adımları [1 dk, 10 dk]: son adımın sırası. */
const LAST_LEARNING_STEP = 1

function toFsrsCard(c: CardState): FSRSCard {
  const base = createEmptyCard(new Date(c.due))
  // Eski sürüm öğrenme adımını kaydetmiyordu (her tekrarda 0 sayılıyordu) ve kartlar öğrenme aşamasında
  // takılı kalıyordu. Adım bilgisi olmayan, en az bir kez tekrarlanmış öğrenme kartı ilk adımı geçmiş sayılır.
  const steps = c.learningSteps ?? (c.state === State.Learning && c.reps > 0 ? LAST_LEARNING_STEP : 0)
  const isNew = !c.state
  return {
    ...base,
    due: new Date(c.due),
    // Yeni kartta FSRS kendi başlangıç değerlerini kullanmalı; sahte değer ilk aralıkları kısaltır
    stability: isNew ? base.stability : c.stability || 0.1,
    difficulty: isNew ? base.difficulty : c.difficulty || 5.0,
    elapsed_days: c.elapsedDays || 0,
    scheduled_days: c.scheduledDays || 0,
    reps: c.reps || 0,
    lapses: c.lapses || 0,
    state: c.state || State.New,
    learning_steps: steps,
    last_review: c.lastReview ? new Date(c.lastReview) : undefined,
  }
}

/**
 * 1-5 arası kullanıcı puanını FSRS derecesine (Grade 1..4) dönüştürür.
 * 1: Hiç bilmiyorum -> Again · 2: Biraz öğrendim -> Hard · 3: Geliştirmeye muhtaç -> Good
 * 4: Baya öğrendim -> Good (öğrenme adımlarını atlar, tekrar aşamasında aralık ×1,3) · 5: Tamamen öğrendim -> Easy
 */
function masteryToFsrsRating(score: MasteryLevel): Grade {
  switch (score) {
    case 1:
      return Rating.Again as Grade
    case 2:
      return Rating.Hard as Grade
    case 3:
    case 4:
      return Rating.Good as Grade
    case 5:
      return Rating.Easy as Grade
  }
}

export interface ScheduleResult {
  card: FSRSCard
  due: Date
  scheduledDays: number
}

/** Bir puanın kartı nereye taşıyacağını hesaplar (veritabanına yazmaz). */
export function scheduleCard(cardState: CardState, masteryScore: MasteryLevel, now = new Date()): ScheduleResult {
  const fsrsCard = toFsrsCard(cardState)
  // "Baya öğrendim": yeni/öğrenme aşamasındaki kart kısa adımları atlayıp doğrudan tekrar aşamasına geçer
  if (masteryScore === 4 && (fsrsCard.state === State.New || fsrsCard.state === State.Learning)) {
    fsrsCard.learning_steps = LAST_LEARNING_STEP
  }
  const card = scheduler.repeat(fsrsCard, now)[masteryToFsrsRating(masteryScore)].card

  let due = card.due
  let scheduledDays = card.scheduled_days
  if (masteryScore === 4 && card.state === State.Review) {
    scheduledDays = Math.min(MAX_INTERVAL_DAYS, Math.max(1, Math.round(scheduledDays * MASTERY4_BONUS)))
    due = new Date(now.getTime() + scheduledDays * 86_400_000)
  }
  return { card, due, scheduledDays }
}

/** "10 dk", "2 gün", "3 ay" gibi kısa süre etiketi. */
export function formatInterval(from: Date, to: Date): string {
  const min = Math.max(1, Math.round((to.getTime() - from.getTime()) / 60_000))
  if (min < 60) return `${min} dk`
  const hours = Math.round(min / 60)
  if (hours < 24) return `${hours} sa`
  const days = Math.round(min / 1440)
  if (days < 30) return `${days} gün`
  if (days < 365) return `${Math.round(days / 30)} ay`
  return `${(days / 365).toFixed(1).replace('.', ',')} yıl`
}

/** Her puan için bir sonraki tekrarın ne zaman olacağı (düğmelerde gösterilir). */
export function previewIntervals(cardState: CardState, now = new Date()): Record<MasteryLevel, string> {
  const out = {} as Record<MasteryLevel, string>
  for (const m of [1, 2, 3, 4, 5] as MasteryLevel[]) out[m] = formatInterval(now, scheduleCard(cardState, m, now).due)
  return out
}

export interface ReviewResult {
  cardState: CardState
  reviewLog: ReviewLog
}

/**
 * Bir kelime kartına 1-5 arası puan verildiğinde FSRS algoritmasını çalıştırır,
 * bir sonraki tekrar zamanını belirler ve çevrimdışı kuyruğa yazar.
 */
export async function processCardReview(
  cardState: CardState,
  masteryScore: MasteryLevel,
  questionType: ReviewLog['questionType'] = 'flashcard',
  durationMs = 0,
): Promise<ReviewResult> {
  const now = new Date()
  const { card: updatedFsrs, due, scheduledDays } = scheduleCard(cardState, masteryScore, now)

  const updatedState: CardState = {
    ...cardState,
    state: updatedFsrs.state,
    due: due.toISOString(),
    stability: updatedFsrs.stability,
    difficulty: updatedFsrs.difficulty,
    elapsedDays: updatedFsrs.elapsed_days,
    scheduledDays,
    learningSteps: updatedFsrs.learning_steps,
    reps: updatedFsrs.reps,
    // Uygulama kendi "yanılma" sayısını tutar: öğrenme aşamasındaki "Hiç bilmiyorum" da sayılır
    lapses: masteryScore === 1 ? cardState.lapses + 1 : cardState.lapses,
    masteryScore,
    lastReview: now.toISOString(),
    updatedAt: now.toISOString(),
  }

  const logId = crypto.randomUUID()
  const reviewLog: ReviewLog = {
    id: logId,
    wordId: cardState.wordId,
    userId: cardState.userId,
    rating: masteryScore,
    state: updatedFsrs.state,
    due: updatedState.due,
    stability: updatedFsrs.stability,
    difficulty: updatedFsrs.difficulty,
    elapsedDays: updatedFsrs.elapsed_days,
    lastElapsedDays: cardState.elapsedDays,
    scheduledDays,
    reviewedAt: now.toISOString(),
    durationMs,
    questionType,
    synced: false,
  }

  // Yerel veritabanına kaydet
  await db.transaction('rw', [db.cardStates, db.reviewLogs], async () => {
    await db.cardStates.put(updatedState)
    await db.reviewLogs.add(reviewLog)
  })

  // Senkronizasyon kuyruğuna yaz (Outbox)
  void queueChange('card_states', 'update', updatedState.id, updatedState as unknown as Record<string, unknown>)
  void queueChange('review_logs', 'insert', reviewLog.id, reviewLog as unknown as Record<string, unknown>)

  logger.interaction('study', `Kelime tekrarı puanlandı: ${masteryScore} puan (${questionType})`, {
    cardId: cardState.id,
    masteryScore,
    scheduledDays,
    due: updatedState.due,
  })

  return { cardState: updatedState, reviewLog }
}
