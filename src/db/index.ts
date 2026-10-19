import Dexie, { type EntityTable } from 'dexie'
import type {
  AiNote,
  AppLog,
  ExamAnswer,
  MockExamResult,
  CardState,
  LevelProgress,
  ReviewLog,
  StudySessionLog,
  SyncQueueItem,
  UserProfile,
  WordGroup,
  WordItem,
} from '../types/database'

export class YdsDatabase extends Dexie {
  words!: EntityTable<WordItem, 'id'>
  cardStates!: EntityTable<CardState, 'id'>
  reviewLogs!: EntityTable<ReviewLog, 'id'>
  logs!: EntityTable<AppLog, 'id'>
  syncQueue!: EntityTable<SyncQueueItem, 'id'>
  users!: EntityTable<UserProfile, 'id'>
  wordGroups!: EntityTable<WordGroup, 'id'>
  sessionLogs!: EntityTable<StudySessionLog, 'id'>
  levelProgress!: EntityTable<LevelProgress, 'id'>
  examAnswers!: EntityTable<ExamAnswer, 'id'>
  mockResults!: EntityTable<MockExamResult, 'id'>
  aiNotes!: EntityTable<AiNote, 'id'>

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

    this.version(2).stores({
      words:
        'id, userId, term, partOfSpeech, *tags, difficulty, updatedAt, [userId+term]',
    })

    this.version(3).stores({
      wordGroups: 'id, userId, name, isBuiltIn, updatedAt, [userId+updatedAt]',
      sessionLogs: 'id, userId, groupId, startedAt, [userId+startedAt]',
    })

    this.version(4).stores({
      levelProgress:
        'id, userId, categoryGroupId, subGroupId, status, lastStudiedAt, [userId+categoryGroupId], [userId+status]',
    })

    this.version(5).stores({
      examAnswers: 'id, userId, examId, section, answeredAt, [userId+examId], [userId+section]',
      mockResults: 'id, userId, examId, finishedAt, [userId+finishedAt]',
    })

    this.version(6).stores({
      aiNotes: 'id, kind, createdAt',
    })
  }
}

export const db = new YdsDatabase()

/**
 * İlk açılışta varsayılan kullanıcı profillerini oluşturur.
 * Sen ve eşin için ayrı profil hazır gelir.
 */
export async function ensureDefaultUsers(): Promise<UserProfile[]> {
  const users = await db.users.toArray()
  const now = new Date().toISOString()

  if (users.length === 0) {
    const defaultProfiles: UserProfile[] = [
      {
        id: 'user_ozgur',
        displayName: 'Özgür',
        avatarColor: '#7c5cff',
        createdAt: now,
        lastActiveAt: now,
      },
      {
        id: 'user_izafet',
        displayName: 'İzafet',
        avatarColor: '#1fc8a9',
        createdAt: now,
        lastActiveAt: now,
      },
    ]
    await db.users.bulkAdd(defaultProfiles)
    return defaultProfiles
  }

  // Mevcut profiller varsa isimleri güncelle: Osman -> Özgür, Eşim -> İzafet
  for (const u of users) {
    if (u.id === 'user_osman' || u.displayName.toLowerCase() === 'osman') {
      await db.users.update(u.id, { displayName: 'Özgür' })
      u.displayName = 'Özgür'
    } else if (u.id === 'user_esim' || u.displayName.toLowerCase() === 'eşim') {
      await db.users.update(u.id, { displayName: 'İzafet' })
      u.displayName = 'İzafet'
    }
  }

  // İzafet profili henüz yoksa ekle
  const hasIzafet = users.some(
    (u) => u.displayName.toLowerCase() === 'izafet' || u.id === 'user_izafet',
  )
  if (!hasIzafet) {
    const izafet: UserProfile = {
      id: 'user_izafet',
      displayName: 'İzafet',
      avatarColor: '#1fc8a9',
      createdAt: now,
      lastActiveAt: now,
    }
    await db.users.add(izafet)
    users.push(izafet)
  }

  return users
}
