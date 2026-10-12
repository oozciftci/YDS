import { db } from '../db'
import type { CardState, WordItem } from '../types/database'
import { logger } from './logger'
import { queueChange } from './sync'

export interface TransferOptions {
  wordIds?: string[]
  tags?: string[]
  copyAll?: boolean
}

export interface TransferResult {
  copiedCount: number
  skippedCount: number
  totalCandidates: number
  copiedTerms: string[]
}

export interface SourceProfileStats {
  totalWords: number
  tagsWithCounts: Array<{ tag: string; count: number }>
  availableNewCount: number
  alreadyExistingCount: number
}

/**
 * İki profil arasında kelime aktarımı öncesinde analiz ve önizleme istatistikleri üretir.
 */
export async function getTransferableStats(
  fromUserId: string,
  toUserId: string,
): Promise<SourceProfileStats> {
  const sourceWords = await db.words
    .where('userId')
    .equals(fromUserId)
    .filter((w) => !w.isDeleted)
    .toArray()

  const targetWords = await db.words
    .where('userId')
    .equals(toUserId)
    .filter((w) => !w.isDeleted)
    .toArray()

  const targetTerms = new Set(targetWords.map((w) => w.term.toLowerCase().trim()))

  let availableNewCount = 0
  let alreadyExistingCount = 0

  const tagCountMap = new Map<string, number>()

  for (const w of sourceWords) {
    if (targetTerms.has(w.term.toLowerCase().trim())) {
      alreadyExistingCount++
    } else {
      availableNewCount++
    }

    if (w.tags && w.tags.length > 0) {
      for (const t of w.tags) {
        const cleanTag = t.trim()
        if (cleanTag) {
          tagCountMap.set(cleanTag, (tagCountMap.get(cleanTag) || 0) + 1)
        }
      }
    }
  }

  const tagsWithCounts = Array.from(tagCountMap.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)

  return {
    totalWords: sourceWords.length,
    tagsWithCounts,
    availableNewCount,
    alreadyExistingCount,
  }
}

/**
 * Bir kullanıcı profilinden diğerine seçilen kelimeleri veya kelime gruplarını kopyalar.
 * Aktarılan her kelime hedef kullanıcının havuzuna bağımsız bir FSRS kart durumu ile eklenir.
 */
export async function copyWordsBetweenUsers(
  fromUserId: string,
  toUserId: string,
  options: TransferOptions,
): Promise<TransferResult> {
  if (fromUserId === toUserId) {
    return { copiedCount: 0, skippedCount: 0, totalCandidates: 0, copiedTerms: [] }
  }

  const sourceWords = await db.words
    .where('userId')
    .equals(fromUserId)
    .filter((w) => !w.isDeleted)
    .toArray()

  const targetWords = await db.words
    .where('userId')
    .equals(toUserId)
    .filter((w) => !w.isDeleted)
    .toArray()

  const targetTerms = new Set(targetWords.map((w) => w.term.toLowerCase().trim()))

  // Filtreleme
  let candidates: WordItem[] = sourceWords

  if (options.wordIds && options.wordIds.length > 0) {
    const idSet = new Set(options.wordIds)
    candidates = candidates.filter((w) => idSet.has(w.id))
  } else if (options.tags && options.tags.length > 0) {
    const tagSet = new Set(options.tags.map((t) => t.toLowerCase()))
    candidates = candidates.filter(
      (w) => w.tags && w.tags.some((t) => tagSet.has(t.toLowerCase())),
    )
  }

  const now = new Date().toISOString()
  const wordsToInsert: WordItem[] = []
  const cardsToInsert: CardState[] = []
  const copiedTerms: string[] = []
  let skippedCount = 0

  for (const w of candidates) {
    const normalizedTerm = w.term.toLowerCase().trim()
    if (targetTerms.has(normalizedTerm)) {
      skippedCount++
      continue
    }

    const newWordId = crypto.randomUUID()

    const clonedWord: WordItem = {
      ...w,
      id: newWordId,
      userId: toUserId,
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
    }

    // Hedef kullanıcı için sıfırdan öğrenme kartı
    const clonedCard: CardState = {
      id: `${newWordId}_${toUserId}`,
      wordId: newWordId,
      userId: toUserId,
      state: 0, // New
      due: now,
      stability: 0,
      difficulty: 0,
      elapsedDays: 0,
      scheduledDays: 0,
      reps: 0,
      lapses: 0,
      masteryScore: 1, // Hiç bilmiyorum
      updatedAt: now,
    }

    wordsToInsert.push(clonedWord)
    cardsToInsert.push(clonedCard)
    copiedTerms.push(clonedWord.term)
    targetTerms.add(normalizedTerm)
  }

  if (wordsToInsert.length > 0) {
    await db.words.bulkAdd(wordsToInsert)
    await db.cardStates.bulkAdd(cardsToInsert)

    // Senkronizasyon kuyruğuna yaz
    for (const w of wordsToInsert) {
      void queueChange('words', 'insert', w.id, w as unknown as Record<string, unknown>, toUserId)
    }
    for (const c of cardsToInsert) {
      void queueChange('card_states', 'insert', c.id, c as unknown as Record<string, unknown>, toUserId)
    }

    logger.interaction('study', `Profiller arası kelime aktarıldı: ${wordsToInsert.length} kelime`, {
      fromUserId,
      toUserId,
      count: wordsToInsert.length,
      skipped: skippedCount,
    })
  }

  return {
    copiedCount: wordsToInsert.length,
    skippedCount,
    totalCandidates: candidates.length,
    copiedTerms,
  }
}

/**
 * Tek bir kelimeyi diğer kullanıcıya anında aktarır.
 */
export async function copySingleWordToUser(
  word: WordItem,
  toUserId: string,
): Promise<{ success: boolean; message: string }> {
  const existing = await db.words
    .where('userId')
    .equals(toUserId)
    .filter((w) => !w.isDeleted && w.term.toLowerCase() === word.term.toLowerCase())
    .first()

  if (existing) {
    return {
      success: false,
      message: `"${word.term}" kelimesi hedef kullanıcının havuzunda zaten mevcut.`,
    }
  }

  const now = new Date().toISOString()
  const newWordId = crypto.randomUUID()

  const clonedWord: WordItem = {
    ...word,
    id: newWordId,
    userId: toUserId,
    createdAt: now,
    updatedAt: now,
    isDeleted: false,
  }

  const clonedCard: CardState = {
    id: `${newWordId}_${toUserId}`,
    wordId: newWordId,
    userId: toUserId,
    state: 0,
    due: now,
    stability: 0,
    difficulty: 0,
    elapsedDays: 0,
    scheduledDays: 0,
    reps: 0,
    lapses: 0,
    masteryScore: 1,
    updatedAt: now,
  }

  await db.words.add(clonedWord)
  await db.cardStates.add(clonedCard)

  void queueChange('words', 'insert', clonedWord.id, clonedWord as unknown as Record<string, unknown>, toUserId)
  void queueChange('card_states', 'insert', clonedCard.id, clonedCard as unknown as Record<string, unknown>, toUserId)

  logger.interaction('study', `Tek kelime aktarıldı: "${word.term}"`, { fromUserId: word.userId, toUserId })

  return {
    success: true,
    message: `"${word.term}" kelimesi başarıyla aktarıldı.`,
  }
}
