import { db } from '../db'
import type { CardState, PartOfSpeech, SampleSentence, WordItem } from '../types/database'
import { logger } from './logger'
import { queueChange, queueBulkChanges } from './sync'

export interface CreateWordInput {
  term: string
  definition: string
  partOfSpeech: PartOfSpeech
  synonyms?: string[]
  antonyms?: string[]
  collocations?: string[]
  sentences?: SampleSentence[]
  tags?: string[]
  difficulty?: number
  notes?: string
}

/**
 * Yeni kelime oluşturur, aynı zamanda FSRS tekrar kartını başlatır
 * ve her ikisini de çevrimdışı senkronizasyon kuyruğuna (outbox) ekler.
 */
export async function createWord(userId: string, input: CreateWordInput): Promise<WordItem> {
  const wordId = crypto.randomUUID()
  const now = new Date().toISOString()

  const word: WordItem = {
    id: wordId,
    userId,
    term: input.term.trim(),
    definition: input.definition.trim(),
    partOfSpeech: input.partOfSpeech,
    synonyms: (input.synonyms || []).map((s) => s.trim()).filter(Boolean),
    antonyms: (input.antonyms || []).map((s) => s.trim()).filter(Boolean),
    collocations: (input.collocations || []).map((c) => c.trim()).filter(Boolean),
    sentences: input.sentences || [],
    tags: (input.tags || []).map((t) => t.trim()).filter(Boolean),
    difficulty: input.difficulty ?? 2,
    notes: input.notes?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
    isDeleted: false,
  }

  // FSRS Başlangıç Kart Durumu (State 0: New)
  const cardStateId = `${wordId}_${userId}`
  const cardState: CardState = {
    id: cardStateId,
    wordId,
    userId,
    state: 0,
    due: now,
    stability: 0,
    difficulty: 0,
    elapsedDays: 0,
    scheduledDays: 0,
    reps: 0,
    lapses: 0,
    updatedAt: now,
  }

  await db.transaction('rw', [db.words, db.cardStates, db.syncQueue], async () => {
    await db.words.add(word)
    await db.cardStates.add(cardState)
  })

  // Senkronizasyon kuyruğuna gönder
  void queueChange('words', 'insert', word.id, word as unknown as Record<string, unknown>)
  void queueChange('card_states', 'insert', cardState.id, cardState as unknown as Record<string, unknown>)

  logger.interaction('study', `Yeni kelime eklendi: "${word.term}"`, {
    wordId: word.id,
    partOfSpeech: word.partOfSpeech,
  })

  return word
}

/**
 * Kelimeyi günceller ve değişiklik kuyruğuna yazar.
 */
export async function updateWord(
  wordId: string,
  userId: string,
  updates: Partial<CreateWordInput>,
): Promise<WordItem | null> {
  const existing = await db.words.get(wordId)
  if (!existing || existing.userId !== userId) return null

  const now = new Date().toISOString()
  const updated: WordItem = {
    ...existing,
    ...(updates.term !== undefined ? { term: updates.term.trim() } : {}),
    ...(updates.definition !== undefined ? { definition: updates.definition.trim() } : {}),
    ...(updates.partOfSpeech !== undefined ? { partOfSpeech: updates.partOfSpeech } : {}),
    ...(updates.synonyms !== undefined ? { synonyms: updates.synonyms.map((s) => s.trim()).filter(Boolean) } : {}),
    ...(updates.antonyms !== undefined ? { antonyms: updates.antonyms.map((s) => s.trim()).filter(Boolean) } : {}),
    ...(updates.collocations !== undefined ? { collocations: updates.collocations.map((c) => c.trim()).filter(Boolean) } : {}),
    ...(updates.sentences !== undefined ? { sentences: updates.sentences } : {}),
    ...(updates.tags !== undefined ? { tags: updates.tags.map((t) => t.trim()).filter(Boolean) } : {}),
    ...(updates.difficulty !== undefined ? { difficulty: updates.difficulty } : {}),
    ...(updates.notes !== undefined ? { notes: updates.notes.trim() || undefined } : {}),
    updatedAt: now,
  }

  await db.words.put(updated)
  void queueChange('words', 'update', updated.id, updated as unknown as Record<string, unknown>)

  logger.interaction('study', `Kelime güncellendi: "${updated.term}"`, { wordId: updated.id })
  return updated
}

/**
 * Kelimeyi siler (Soft-delete: çevrimdışıyken silinse bile diğer cihazlarla eşitlenir)
 */
export async function deleteWord(wordId: string, userId: string): Promise<boolean> {
  const existing = await db.words.get(wordId)
  if (!existing || existing.userId !== userId) return false

  const now = new Date().toISOString()
  const softDeleted: WordItem = {
    ...existing,
    isDeleted: true,
    updatedAt: now,
  }

  await db.words.put(softDeleted)
  void queueChange('words', 'update', wordId, softDeleted as unknown as Record<string, unknown>)

  logger.interaction('study', `Kelime silindi: "${existing.term}"`, { wordId })
  return true
}

/**
 * Toplu kelime ekleme (İçe aktarma için optimize edilmiştir)
 */
export async function bulkCreateWords(
  userId: string,
  items: CreateWordInput[],
): Promise<{ addedCount: number; skippedCount: number }> {
  if (items.length === 0) return { addedCount: 0, skippedCount: 0 }

  const now = new Date().toISOString()
  const existingWords = await db.words
    .where('userId')
    .equals(userId)
    .filter((w) => !w.isDeleted)
    .toArray()

  const existingTerms = new Set(existingWords.map((w) => w.term.toLowerCase().trim()))

  const wordsToAdd: WordItem[] = []
  const cardStatesToAdd: CardState[] = []
  let skippedCount = 0

  for (const item of items) {
    const trimmedTerm = item.term.trim()
    if (!trimmedTerm || existingTerms.has(trimmedTerm.toLowerCase())) {
      skippedCount++
      continue
    }

    const wordId = crypto.randomUUID()
    const word: WordItem = {
      id: wordId,
      userId,
      term: trimmedTerm,
      definition: item.definition.trim(),
      partOfSpeech: item.partOfSpeech || 'noun',
      synonyms: (item.synonyms || []).map((s) => s.trim()).filter(Boolean),
      antonyms: (item.antonyms || []).map((s) => s.trim()).filter(Boolean),
      collocations: (item.collocations || []).map((c) => c.trim()).filter(Boolean),
      sentences: item.sentences || [],
      tags: (item.tags || []).map((t) => t.trim()).filter(Boolean),
      difficulty: item.difficulty ?? 2,
      notes: item.notes?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
    }

    const cardState: CardState = {
      id: `${wordId}_${userId}`,
      wordId,
      userId,
      state: 0,
      due: now,
      stability: 0,
      difficulty: 0,
      elapsedDays: 0,
      scheduledDays: 0,
      reps: 0,
      lapses: 0,
      updatedAt: now,
    }

    existingTerms.add(trimmedTerm.toLowerCase())
    wordsToAdd.push(word)
    cardStatesToAdd.push(cardState)
  }

  if (wordsToAdd.length > 0) {
    await db.transaction('rw', [db.words, db.cardStates], async () => {
      await db.words.bulkAdd(wordsToAdd)
      await db.cardStates.bulkAdd(cardStatesToAdd)
    })

    // Senkronizasyon kuyruğuna yüksek performanslı tek toplu işlemle yaz
    const syncItems = [
      ...wordsToAdd.map((w) => ({
        table: 'words' as const,
        action: 'insert' as const,
        recordId: w.id,
        payload: w as unknown as Record<string, unknown>,
        userId,
      })),
      ...cardStatesToAdd.map((c) => ({
        table: 'card_states' as const,
        action: 'insert' as const,
        recordId: c.id,
        payload: c as unknown as Record<string, unknown>,
        userId,
      })),
    ]
    void queueBulkChanges(syncItems)

    logger.interaction('study', `Toplu ${wordsToAdd.length} kelime içe aktarıldı.`, {
      addedCount: wordsToAdd.length,
      skippedCount,
    })
  }

  return { addedCount: wordsToAdd.length, skippedCount }
}
