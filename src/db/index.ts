import Dexie, { type EntityTable } from 'dexie'
import type {
  AppLog,
  CardState,
  ReviewLog,
  SyncQueueItem,
  UserProfile,
  WordItem,
} from '../types/database'

export class YdsDatabase extends Dexie {
  words!: EntityTable<WordItem, 'id'>
  cardStates!: EntityTable<CardState, 'id'>
  reviewLogs!: EntityTable<ReviewLog, 'id'>
  logs!: EntityTable<AppLog, 'id'>
  syncQueue!: EntityTable<SyncQueueItem, 'id'>
  users!: EntityTable<UserProfile, 'id'>

  constructor() {
    super('YdsVocabularyDb')

    this.version(1).stores({
      words:
        'id, userId, term, partOfSpeech, *tags, difficulty, updatedAt, isDeleted, [userId+isDeleted], [userId+term]',
      cardStates: 'id, wordId, userId, due, state, [userId+due], [userId+state]',
      reviewLogs: 'id, wordId, userId, reviewedAt, synced, [userId+reviewedAt]',
      logs: 'id, userId, level, category, timestamp, synced, [synced+timestamp]',
      syncQueue: 'id, userId, table, timestamp, retryCount',
      users: 'id, displayName, lastActiveAt',
    })
  }
}

export const db = new YdsDatabase()

/**
 * İlk açılışta varsayılan kullanıcı profillerini oluşturur.
 * Sen ve eşin için ayrı profil hazır gelir.
 */
export async function ensureDefaultUsers(): Promise<UserProfile[]> {
  const count = await db.users.count()
  if (count === 0) {
    const now = new Date().toISOString()
    const defaultProfiles: UserProfile[] = [
      {
        id: 'user_osman',
        displayName: 'Osman',
        avatarColor: '#7c5cff',
        createdAt: now,
        lastActiveAt: now,
      },
      {
        id: 'user_esim',
        displayName: 'Eşim',
        avatarColor: '#1fc8a9',
        createdAt: now,
        lastActiveAt: now,
      },
    ]
    await db.users.bulkAdd(defaultProfiles)
    return defaultProfiles
  }
  return db.users.toArray()
}
