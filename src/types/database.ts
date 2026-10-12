/**
 * YDS Kelime Uygulaması - Veri Tabanı ve Varlık Modelleri
 */

export type PartOfSpeech =
  | 'noun' // İsim
  | 'verb' // Fiil
  | 'adjective' // Sıfat
  | 'adverb' // Zarf
  | 'phrasal_verb' // Phrasal Verb (YDS için çok kritik)
  | 'conjunction' // Bağlaç (YDS için çok kritik)
  | 'preposition' // Edat
  | 'idiom' // Deyim / Kalıp ifade
  | 'other'

export interface SampleSentence {
  en: string
  tr?: string
  /**
   * Cümledeki her bir kelimenin Türkçe karşılığı (kelime sözlüğü / gloss)
   * Örn: { "patient": "hasta", "condition": "durum", "deteriorated": "kötüleşti" }
   */
  wordGlosses?: Record<string, string>
}

export interface WordItem {
  id: string // UUID
  userId: string // Hangi kullanıcıya ait
  term: string // İngilizce kelime / ifade (örn: "deteriorate")
  definition: string // Türkçe karşılığı (örn: "kötüleşmek, bozulmak")
  partOfSpeech: PartOfSpeech
  synonyms: string[] // Eş anlamlılar (örn: ["worsen", "decline", "degenerate"]) - YDS'de en çok sorulan alan
  antonyms?: string[] // Zıt anlamlılar (örn: ["improve", "recover"])
  collocations?: string[] // Birlikte kullanılan kalıplar (örn: ["deteriorate rapidly", "health deteriorates"])
  sentences?: SampleSentence[] // Örnek cümleler
  tags?: string[] // Etiketler (örn: ["Sağlık", "YDS 2023", "Akademik"])
  difficulty?: number // 1: Kolay, 2: Orta, 3: İleri seviye (Varsayılan: 2)
  notes?: string // Kullanıcının kişisel notları veya mnemonik/ipucu
  audioUrl?: string // Özel ses bağlantısı veya yerel ses dosya anahtarı
  createdAt: string // ISO string
  updatedAt: string // ISO string
  isDeleted: boolean // Soft-delete (Senkronizasyonda silinme çakışmalarını yönetmek için)
}

/**
 * FSRS (Free Spaced Repetition Scheduler) Kart Durumu
 */
export interface CardState {
  id: string // wordId + '_' + userId
  wordId: string
  userId: string
  state: number // 0: New, 1: Learning, 2: Review, 3: Relearning
  due: string // Sonraki tekrar zamanı (ISO string)
  stability: number // Kararlılık (gün)
  difficulty: number // Zorluk (1 - 10)
  elapsedDays: number // Son tekrardan bu yana geçen gün
  scheduledDays: number // Planlanan aralık (gün)
  reps: number // Toplam tekrar sayısı
  lapses: number // Unutulma / hata sayısı
  /** 1: Hiç bilmiyorum, 2: Biraz öğrendim, 3: Geliştirmeye muhtaç, 4: Baya öğrendim, 5: Tamamen öğrendim */
  masteryScore?: number
  lastReview?: string // Son tekrar zamanı (ISO string)
  updatedAt: string
}

export type MasteryLevel = 1 | 2 | 3 | 4 | 5

export const MASTERY_CONFIG: Record<MasteryLevel, { label: string; desc: string; color: string; badge: string }> = {
  1: { label: 'Hiç Bilmiyorum', desc: 'Henüz öğrenilmedi', color: '#ef4444', badge: '🔴 1' },
  2: { label: 'Biraz Öğrendim', desc: 'Hatırlamakta zorlanıyorum', color: '#f97316', badge: '🟠 2' },
  3: { label: 'Geliştirmeye Muhtaç', desc: 'Ara sıra karşıma çıksın', color: '#eab308', badge: '🟡 3' },
  4: { label: 'Baya Öğrendim', desc: 'İyi biliyorum, pekiştirmeli', color: '#3b82f6', badge: '🔵 4' },
  5: { label: 'Tamamen Öğrendim', desc: 'Kusursuz ezberlendi', color: '#10b981', badge: '🟢 5' },
}

/**
 * Kullanıcı Tekrar Geçmişi (Review Event)
 */
export interface ReviewLog {
  id: string // UUID
  wordId: string
  userId: string
  rating: number // 1: Again (Bilemedim), 2: Hard (Zor), 3: Good (İyi), 4: Easy (Kolay)
  state: number // Tekrar anındaki durum
  due: string
  stability: number
  difficulty: number
  elapsedDays: number
  lastElapsedDays: number
  scheduledDays: number
  reviewedAt: string // ISO string
  durationMs: number // Soruyu çözme süresi (milisaniye)
  questionType: 'flashcard' | 'multiple_choice' | 'synonym' | 'cloze' | 'listen'
  synced: boolean
}

/**
 * Kapsamlı Uygulama Log Kaydı
 * Hata, uyarı, bilgi ve kullanıcı etkileşimleri burada toplanır.
 */
export type LogLevel = 'error' | 'warn' | 'info' | 'interaction'
export type LogCategory = 'system' | 'sync' | 'study' | 'tts' | 'auth' | 'storage' | 'ui'

export interface AppLog {
  id: string // UUID
  userId?: string
  level: LogLevel
  category: LogCategory
  message: string
  details?: Record<string, unknown> | string
  timestamp: string // ISO string
  deviceInfo?: {
    userAgent: string
    isOnline: boolean
    url: string
  }
  synced: number // 0: Senkronize edilmedi, 1: Senkronize edildi (Dexie indekslemesi için number)
  syncedAt?: string
}

/**
 * Senkronizasyon Kuyruğu (Outbox Pattern)
 * Çevrimdışıyken yapılan ekleme/güncelleme/silme işlemleri internet gelene kadar burada bekler.
 */
export interface SyncQueueItem {
  id: string // UUID
  userId: string
  table: 'words' | 'card_states' | 'review_logs'
  action: 'insert' | 'update' | 'delete'
  recordId: string
  payload: Record<string, unknown>
  timestamp: string // ISO string
  retryCount: number
  lastError?: string
}

/**
 * Yerel Kullanıcı Profili (Osman, Eşim vb.)
 */
export interface UserProfile {
  id: string // UUID veya basit slug ('osman', 'esim')
  displayName: string
  email?: string
  avatarColor?: string
  createdAt: string
  lastActiveAt: string
}
