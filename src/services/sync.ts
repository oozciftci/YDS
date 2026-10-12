import { create } from 'zustand'
import { db } from '../db'
import { useUserStore } from '../stores/user'
import type {
  AppLog,
  CardState,
  ReviewLog,
  SyncQueueItem,
  WordItem,
} from '../types/database'
import { logger } from './logger'
import { getSupabase } from './supabase'

interface SyncState {
  status: 'idle' | 'syncing' | 'success' | 'error'
  lastSyncTime: string | null
  pendingOutboxCount: number
  pendingLogsCount: number
  lastError: string | null
  syncNow: () => Promise<boolean>
  refreshPendingCounts: () => Promise<void>
}

export const useSyncStatus = create<SyncState>((set, get) => ({
  status: 'idle',
  lastSyncTime: localStorage.getItem('yds.last_sync_time'),
  pendingOutboxCount: 0,
  pendingLogsCount: 0,
  lastError: null,

  async refreshPendingCounts() {
    try {
      const outbox = await db.syncQueue.count()
      const logs = await db.logs.where('synced').equals(0).count()
      set({ pendingOutboxCount: outbox, pendingLogsCount: logs })
    } catch {
      // db kapalı veya erişilemezse sessiz geç
    }
  },

  async syncNow() {
    if (get().status === 'syncing') return false
    return await runFullSync()
  },
}))

/**
 * Veritabanı dönüşüm yardımcıları (TypeScript camelCase <-> PostgreSQL snake_case)
 */
function wordToDb(w: WordItem) {
  return {
    id: w.id,
    user_id: w.userId,
    term: w.term,
    definition: w.definition,
    part_of_speech: w.partOfSpeech,
    synonyms: w.synonyms,
    antonyms: w.antonyms || [],
    collocations: w.collocations || [],
    sentences: w.sentences || [],
    tags: w.tags || [],
    difficulty: w.difficulty ?? 2,
    notes: w.notes || null,
    audio_url: w.audioUrl || null,
    created_at: w.createdAt,
    updated_at: w.updatedAt,
    is_deleted: w.isDeleted,
  }
}

function wordFromDb(r: Record<string, unknown>): WordItem {
  return {
    id: String(r.id),
    userId: String(r.user_id),
    term: String(r.term),
    definition: String(r.definition),
    partOfSpeech: r.part_of_speech as WordItem['partOfSpeech'],
    synonyms: (r.synonyms as string[]) || [],
    antonyms: (r.antonyms as string[]) || [],
    collocations: (r.collocations as string[]) || [],
    sentences: (r.sentences as WordItem['sentences']) || [],
    tags: (r.tags as string[]) || [],
    difficulty: Number(r.difficulty ?? 2),
    notes: r.notes ? String(r.notes) : undefined,
    audioUrl: r.audio_url ? String(r.audio_url) : undefined,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
    isDeleted: Boolean(r.is_deleted),
  }
}

function cardStateToDb(c: CardState) {
  return {
    id: c.id,
    word_id: c.wordId,
    user_id: c.userId,
    state: c.state,
    due: c.due,
    stability: c.stability,
    difficulty: c.difficulty,
    elapsed_days: c.elapsedDays,
    scheduled_days: c.scheduledDays,
    reps: c.reps,
    lapses: c.lapses,
    last_review: c.lastReview || null,
    updated_at: c.updatedAt,
  }
}

function cardStateFromDb(r: Record<string, unknown>): CardState {
  return {
    id: String(r.id),
    wordId: String(r.word_id),
    userId: String(r.user_id),
    state: Number(r.state),
    due: String(r.due),
    stability: Number(r.stability),
    difficulty: Number(r.difficulty),
    elapsedDays: Number(r.elapsed_days),
    scheduledDays: Number(r.scheduled_days),
    reps: Number(r.reps),
    lapses: Number(r.lapses),
    lastReview: r.last_review ? String(r.last_review) : undefined,
    updatedAt: String(r.updated_at),
  }
}

function appLogToDb(l: AppLog) {
  return {
    id: l.id,
    user_id: l.userId || null,
    level: l.level,
    category: l.category,
    message: l.message,
    details: l.details || null,
    timestamp: l.timestamp,
    device_info: l.deviceInfo || null,
  }
}

/**
 * Yerel Değişiklikleri Outbox Kuyruğuna Ekleme Fonksiyonları
 */
export async function queueChange(
  table: SyncQueueItem['table'],
  action: SyncQueueItem['action'],
  recordId: string,
  payload: Record<string, unknown>,
) {
  const userId = useUserStore.getState().activeUserId
  const item: SyncQueueItem = {
    id: crypto.randomUUID(),
    userId,
    table,
    action,
    recordId,
    payload,
    timestamp: new Date().toISOString(),
    retryCount: 0,
  }
  await db.syncQueue.add(item)
  void useSyncStatus.getState().refreshPendingCounts()

  // Eğer şu anda çevrimiçiysek bekletmeden arka planda senkronizasyonu dene
  if (navigator.onLine && getSupabase()) {
    void runFullSync()
  }
}

/**
 * Tam Senkronizasyon Döngüsü:
 * 1. Outbox (Bekleyen değişiklikler) -> Supabase'e gönder
 * 2. Loglar -> Supabase app_logs tablosuna gönder
 * 3. 200 MB kuralı -> Gönderim onaylandıysa ve yer dolduysa sil
 * 4. Buluttan yenilikleri çek -> Yerel veritabanına uygula
 */
export async function runFullSync(): Promise<boolean> {
  const supabase = getSupabase()
  if (!supabase) {
    useSyncStatus.setState({
      status: 'idle',
      lastError: 'Sunucu adresi veya anahtar ayarlanmamış.',
    })
    return false
  }

  if (!navigator.onLine) {
    useSyncStatus.setState({
      status: 'idle',
      lastError: 'Cihaz çevrimdışı. Bağlantı geldiğinde otomatik gönderilecek.',
    })
    return false
  }

  useSyncStatus.setState({ status: 'syncing', lastError: null })
  logger.info('sync', 'Senkronizasyon işlemi başlatıldı.')

  try {
    // ----------------------------------------------------
    // ADIM 1: Outbox Kuyruğunu Gönder (Kelimeler & Kartlar)
    // ----------------------------------------------------
    const outboxItems = await db.syncQueue.orderBy('timestamp').toArray()

    for (const item of outboxItems) {
      try {
        if (item.table === 'words') {
          const dbRow = wordToDb(item.payload as unknown as WordItem)
          const { error } = await supabase.from('words').upsert(dbRow)
          if (error) throw error
        } else if (item.table === 'card_states') {
          const dbRow = cardStateToDb(item.payload as unknown as CardState)
          const { error } = await supabase.from('card_states').upsert(dbRow)
          if (error) throw error
        } else if (item.table === 'review_logs') {
          const r = item.payload as unknown as ReviewLog
          const { error } = await supabase.from('review_logs').upsert({
            id: r.id,
            word_id: r.wordId,
            user_id: r.userId,
            rating: r.rating,
            state: r.state,
            due: r.due,
            stability: r.stability,
            difficulty: r.difficulty,
            elapsed_days: r.elapsedDays,
            last_elapsed_days: r.lastElapsedDays,
            scheduled_days: r.scheduledDays,
            reviewed_at: r.reviewedAt,
            duration_ms: r.durationMs,
            question_type: r.questionType,
          })
          if (error) throw error
        }

        // Başarıyla gönderildi, kuyruktan çıkar
        await db.syncQueue.delete(item.id)
      } catch (itemErr) {
        // eslint-disable-next-line no-console
        console.error('Kuyruk öğesi gönderilemedi:', item, itemErr)
        await db.syncQueue.update(item.id, {
          retryCount: item.retryCount + 1,
          lastError: String(itemErr),
        })
      }
    }

    // ----------------------------------------------------
    // ADIM 2: Logları Gönder (Kapsamlı Loglama)
    // ----------------------------------------------------
    const unsyncedLogs = await db.logs.where('synced').equals(0).limit(100).toArray()

    if (unsyncedLogs.length > 0) {
      const dbLogs = unsyncedLogs.map(appLogToDb)
      const { error: logErr } = await supabase.from('app_logs').upsert(dbLogs)

      if (logErr) {
        logger.warn('sync', 'Loglar buluta aktarılamadı:', { error: logErr.message })
      } else {
        // TEYİT ALINDI: Gönderilen logları synced=1 olarak işaretle
        const nowIso = new Date().toISOString()
        await db.transaction('rw', db.logs, async () => {
          for (const l of unsyncedLogs) {
            await db.logs.update(l.id, { synced: 1, syncedAt: nowIso })
          }
        })

        // ADIM 3: 200 MB Kontrolü
        // Gönderildiği teyit edildikten sonra cihazda 200 MB'dan fazla yer kaplıyorsa sil
        await logger.pruneSyncedLogsIfStorageExceeded()
      }
    }

    // ----------------------------------------------------
    // ADIM 4: Buluttan Yeni Değişiklikleri Çek
    // ----------------------------------------------------
    const activeUserId = useUserStore.getState().activeUserId
    const lastSync = localStorage.getItem('yds.last_sync_time')

    // Kelimeleri çek
    let wordsQuery = supabase.from('words').select('*').eq('user_id', activeUserId)
    if (lastSync) {
      wordsQuery = wordsQuery.gt('updated_at', lastSync)
    }
    const { data: remoteWords, error: wordsFetchErr } = await wordsQuery

    if (wordsFetchErr) {
      logger.warn('sync', 'Uzak kelimeler çekilemedi:', { error: wordsFetchErr.message })
    } else if (remoteWords && remoteWords.length > 0) {
      const localWords = remoteWords.map(wordFromDb)
      await db.words.bulkPut(localWords)
    }

    // Kart durumlarını çek
    let cardsQuery = supabase.from('card_states').select('*').eq('user_id', activeUserId)
    if (lastSync) {
      cardsQuery = cardsQuery.gt('updated_at', lastSync)
    }
    const { data: remoteCards, error: cardsFetchErr } = await cardsQuery

    if (cardsFetchErr) {
      logger.warn('sync', 'Uzak kart durumları çekilemedi:', { error: cardsFetchErr.message })
    } else if (remoteCards && remoteCards.length > 0) {
      const localCards = remoteCards.map(cardStateFromDb)
      await db.cardStates.bulkPut(localCards)
    }

    // Başarıyla tamamlandı
    const completedAt = new Date().toISOString()
    localStorage.setItem('yds.last_sync_time', completedAt)
    useSyncStatus.setState({
      status: 'success',
      lastSyncTime: completedAt,
      lastError: null,
    })
    void useSyncStatus.getState().refreshPendingCounts()
    logger.info('sync', 'Senkronizasyon başarıyla tamamlandı.')
    return true
  } catch (syncErr) {
    const errorMsg = syncErr instanceof Error ? syncErr.message : String(syncErr)
    logger.error('sync', 'Senkronizasyon hatası:', { error: errorMsg }, syncErr)
    useSyncStatus.setState({
      status: 'error',
      lastError: errorMsg,
    })
    void useSyncStatus.getState().refreshPendingCounts()
    return false
  }
}

/**
 * Otomatik Senkronizasyon Olay Dinleyicileri:
 * - İnternet geldiğinde (online event)
 * - Periyodik olarak (çevrimiçiyse 5 dakikada bir)
 */
export function initAutoSync() {
  if (typeof window === 'undefined') return

  window.addEventListener('online', () => {
    void runFullSync()
  })

  // 5 dakikada bir otomatik senkronizasyon kontrolü
  setInterval(() => {
    if (navigator.onLine && getSupabase()) {
      void runFullSync()
    }
  }, 5 * 60 * 1000)

  // Sayfa ilk yüklendiğinde sayaçları tazele
  void useSyncStatus.getState().refreshPendingCounts()
}
