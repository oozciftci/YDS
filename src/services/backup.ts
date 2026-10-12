import { db } from '../db'
import { logger } from './logger'

export interface BackupData {
  version: number
  exportedAt: string
  users: unknown[]
  words: unknown[]
  cardStates: unknown[]
  reviewLogs: unknown[]
  logs: unknown[]
}

/**
 * Tüm yerel veritabanını JSON dosyası olarak indirir.
 */
export async function exportDatabaseToJson(): Promise<void> {
  try {
    const [users, words, cardStates, reviewLogs, logs] = await Promise.all([
      db.users.toArray(),
      db.words.toArray(),
      db.cardStates.toArray(),
      db.reviewLogs.toArray(),
      db.logs.toArray(),
    ])

    const backup: BackupData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      users,
      words,
      cardStates,
      reviewLogs,
      logs,
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

    await db.transaction('rw', [db.users, db.words, db.cardStates, db.reviewLogs], async () => {
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
    })

    logger.interaction('storage', 'Kullanıcı JSON yedeğini başarıyla geri yükledi.', {
      wordsImported: data.words.length,
    })

    return { wordsImported: data.words.length }
  } catch (err) {
    logger.error('storage', 'JSON yedeği geri yüklenirken hata oluştu', undefined, err)
    throw err
  }
}
