import { db } from '../db'
import { logger } from './logger'
import { exportNotebook, importNotebook } from './notebook'

export interface BackupData {
  version: number
  exportedAt: string
  users: unknown[]
  words: unknown[]
  cardStates: unknown[]
  reviewLogs: unknown[]
  logs: unknown[]
  wordGroups?: unknown[]
  sessionLogs?: unknown[]
  levelProgress?: unknown[]
  /** Çıkmış soru cevapları ve deneme sonuçları (yalnızca kimlik/sayı; soru metni yok) */
  examAnswers?: unknown[]
  mockResults?: unknown[]
  /** Hafıza notları ve YZ Koç sohbetleri (yalnızca cihazda; senkrona girmez) */
  memoryNotes?: unknown[]
  coachChats?: unknown[]
  /** Geliştirici danışmanından eklenen öneriler */
  suggestions?: unknown[]
  /** Notlarım (sayfa notları + genel defter; ses/görsel data URL olarak) */
  notebook?: unknown[]
}

/**
 * Tüm yerel veritabanını JSON dosyası olarak indirir.
 */
export async function exportDatabaseToJson(): Promise<void> {
  try {
    const [users, words, cardStates, reviewLogs, logs, wordGroups, sessionLogs, levelProgress, examAnswers, mockResults, memoryNotes, coachChats, suggestions] =
      await Promise.all([
        db.users.toArray(),
        db.words.toArray(),
        db.cardStates.toArray(),
        db.reviewLogs.toArray(),
        db.logs.toArray(),
        db.wordGroups.toArray(),
        db.sessionLogs.toArray(),
        db.levelProgress.toArray(),
        db.examAnswers.toArray(),
        db.mockResults.toArray(),
        db.memoryNotes.toArray(),
        db.coachChats.toArray(),
        db.suggestions.toArray(),
      ])
    const notebook = await exportNotebook()

    const backup: BackupData = {
      version: 5,
      exportedAt: new Date().toISOString(),
      users,
      words,
      cardStates,
      reviewLogs,
      logs,
      wordGroups,
      sessionLogs,
      levelProgress,
      examAnswers,
      mockResults,
      memoryNotes,
      coachChats,
      suggestions,
      notebook,
    }

    const jsonStr = JSON.stringify(backup, null, 2)
    const blob = new Blob([jsonStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const dateStr = new Date().toISOString().slice(0, 10)

    const a = document.createElement('a')
    a.href = url
    a.download = `yds_kelime_yedek_${dateStr}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    logger.interaction('storage', 'Kullanıcı yerel veritabanı yedeğini JSON olarak indirdi.', {
      wordCount: words.length,
      cardCount: cardStates.length,
      groupCount: wordGroups.length,
      levelProgressCount: levelProgress.length,
    })
  } catch (err) {
    logger.error('storage', 'Veritabanı JSON yedeği alınırken hata oluştu', undefined, err)
    throw err
  }
}

/**
 * JSON yedek dosyasından veritabanını geri yükler.
 */
export async function importDatabaseFromJson(file: File): Promise<{ wordsImported: number }> {
  try {
    const text = await file.text()
    const data = JSON.parse(text) as Partial<BackupData>

    if (!data.words || !Array.isArray(data.words)) {
      throw new Error('Geçersiz yedek dosyası: Kelime listesi bulunamadı.')
    }

    await db.transaction(
      'rw',
      [
        db.users,
        db.words,
        db.cardStates,
        db.reviewLogs,
        db.wordGroups,
        db.sessionLogs,
        db.levelProgress,
        db.examAnswers,
        db.mockResults,
        db.memoryNotes,
        db.coachChats,
        db.suggestions,
      ],
      async () => {
        if (data.users && Array.isArray(data.users) && data.users.length > 0) {
          await db.users.bulkPut(data.users as never)
        }
        if (data.words && data.words.length > 0) {
          await db.words.bulkPut(data.words as never)
        }
        if (data.cardStates && Array.isArray(data.cardStates) && data.cardStates.length > 0) {
          await db.cardStates.bulkPut(data.cardStates as never)
        }
        if (data.reviewLogs && Array.isArray(data.reviewLogs) && data.reviewLogs.length > 0) {
          await db.reviewLogs.bulkPut(data.reviewLogs as never)
        }
        if (data.wordGroups && Array.isArray(data.wordGroups) && data.wordGroups.length > 0) {
          await db.wordGroups.bulkPut(data.wordGroups as never)
        }
        if (data.sessionLogs && Array.isArray(data.sessionLogs) && data.sessionLogs.length > 0) {
          await db.sessionLogs.bulkPut(data.sessionLogs as never)
        }
        if (data.levelProgress && Array.isArray(data.levelProgress) && data.levelProgress.length > 0) {
          await db.levelProgress.bulkPut(data.levelProgress as never)
        }
        if (Array.isArray(data.examAnswers) && data.examAnswers.length > 0) {
          await db.examAnswers.bulkPut(data.examAnswers as never)
        }
        if (Array.isArray(data.mockResults) && data.mockResults.length > 0) {
          await db.mockResults.bulkPut(data.mockResults as never)
        }
        if (Array.isArray(data.memoryNotes) && data.memoryNotes.length > 0) {
          await db.memoryNotes.bulkPut(data.memoryNotes as never)
        }
        if (Array.isArray(data.coachChats) && data.coachChats.length > 0) {
          await db.coachChats.bulkPut(data.coachChats as never)
        }
        if (Array.isArray(data.suggestions) && data.suggestions.length > 0) {
          await db.suggestions.bulkPut(data.suggestions as never)
        }
      },
    )

    // Defter görselleri/sesleri data URL'den Blob'a çevrilir (fetch gerektirdiği için işlem dışında)
    if (Array.isArray(data.notebook) && data.notebook.length > 0) await importNotebook(data.notebook)

    logger.interaction('storage', 'Kullanıcı JSON yedeğini başarıyla geri yükledi.', {
      wordsImported: data.words.length,
      groupsImported: data.wordGroups?.length || 0,
      progressImported: data.levelProgress?.length || 0,
    })

    return { wordsImported: data.words.length }
  } catch (err) {
    logger.error('storage', 'JSON yedeği geri yüklenirken hata oluştu', undefined, err)
    throw err
  }
}
