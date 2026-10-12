import { fsrs, Rating, createEmptyCard, type Card as FSRSCard, type Grade } from 'ts-fsrs'
import { db } from '../db'
import type { CardState, MasteryLevel, ReviewLog } from '../types/database'
import { logger } from './logger'
import { queueChange } from './sync'

const scheduler = fsrs({
  request_retention: 0.9, // %90 hatırlama hedefi (YDS için ideal)
  maximum_interval: 365,
})

function toFsrsCard(c: CardState): FSRSCard {
  const base = createEmptyCard(new Date(c.due))
  return {
    ...base,
    due: new Date(c.due),
    stability: c.stability || 0.1,
    difficulty: c.difficulty || 5.0,
    elapsed_days: c.elapsedDays || 0,
    scheduled_days: c.scheduledDays || 0,
    reps: c.reps || 0,
    lapses: c.lapses || 0,
    state: c.state || 0,
    learning_steps: 0,
    last_review: c.lastReview ? new Date(c.lastReview) : undefined,
  }
}

/**
 * 1-5 arası kullanıcı puanını FSRS derecesine (Grade 1..4) dönüştürür.
 * 1: Hiç bilmiyorum -> Rating.Again (1)
 * 2: Biraz öğrendim -> Rating.Hard (2)
 * 3: Geliştirmeye muhtaç -> Rating.Good (3)
 * 4: Baya öğrendim -> Rating.Good (3) (ancak aralık biraz daha genişletilir)
 * 5: Tamamen öğrendim -> Rating.Easy (4)
 */
function masteryToFsrsRating(score: MasteryLevel): Grade {
  switch (score) {
    case 1:
      return Rating.Again as Grade
    case 2:
      return Rating.Hard as Grade
    case 3:
      return Rating.Good as Grade
    case 4:
      return Rating.Good as Grade
    case 5:
      return Rating.Easy as Grade
  }
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
  const fsrsRating = masteryToFsrsRating(masteryScore)
  const fsrsCard = toFsrsCard(cardState)

  const repeatResults = scheduler.repeat(fsrsCard, now)
  const item = repeatResults[fsrsRating]
  const updatedFsrs = item.card

  // Eğer kullanıcı 4 puan verdiyse ("Baya öğrendim"), süreyi ek %25 uzat
  let scheduledDays = updatedFsrs.scheduled_days
  let dueDate = updatedFsrs.due
  if (masteryScore === 4) {
    scheduledDays = Math.max(1, Math.round(scheduledDays * 1.3))
    dueDate = new Date(now.getTime() + scheduledDays * 24 * 60 * 60 * 1000)
  }

  const updatedState: CardState = {
    ...cardState,
    state: updatedFsrs.state,
    due: dueDate.toISOString(),
    stability: updatedFsrs.stability,
    difficulty: updatedFsrs.difficulty,
    elapsedDays: updatedFsrs.elapsed_days,
    scheduledDays,
    reps: updatedFsrs.reps,
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
