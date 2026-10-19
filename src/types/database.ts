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
  groupIds?: string[] // Dahil olduğu özel kelime grupları (Örn: ["grup_1", "grup_2"])
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
  /** FSRS öğrenme adımı sırası (öğrenme/yeniden öğrenme aşamasında). Eski kayıtlarda yok. */
  learningSteps?: number
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

/**
 * Kelime Grupları & Özel Desteler (Level / Konu / Kullanıcı Grupları)
 */
export interface WordGroup {
  id: string
  userId: string
  name: string
  description?: string
  color?: string
  icon?: string
  isBuiltIn?: boolean
  wordIds?: string[] // Özel gruptaki kelime ID listesi
  targetLevel?: string // 'A1-A2' | 'B1-B2' | 'C1-C2' | 'Özel'
  createdAt: string
  updatedAt: string
}

/**
 * Tamamlanan Çalışma Oturumu Kaydı (Grup bazlı günlük takip)
 */
export interface StudySessionLog {
  id: string
  userId: string
  groupId: string
  subGroupId?: string
  groupName: string
  mode: 'flashcard' | 'mixed' | 'multiple_choice' | 'synonym' | 'cloze' | 'listen'
  startedAt: string
  completedAt: string
  totalQuestions: number
  correctCount: number // Skor 4-5 veya test doğru
  wrongCount: number // Skor 1-2 veya test yanlış
  learningCount: number // Skor 3
  accuracyPercent: number
  wordIds: string[]
  isCompleted?: boolean // Oturum sonuna kadar tamamlandı mı yoksa yarıda mı bırakıldı
}

/**
 * Çıkmış YDS sorusuna verilen cevap (sorunun son durumu). Soru metni tutulmaz; yalnızca
 * sınav kimliği + soru numarası. Telifli içerik içermediği için yedeğe dahil edilir.
 */
export interface ExamAnswer {
  id: string // `${userId}_${examId}_${no}`
  userId: string
  examId: string
  no: number
  section: string // SectionKey (ydsSections.ts)
  choice: string // Son verilen cevap (A-E)
  correct: boolean // Son cevap doğru mu
  attempts: number // Toplam deneme
  wrongCount: number // Toplam yanlış
  /** Yanlış Defteri'nde mi: yanlışta açılır, defterden doğru çözülünce kapanır. */
  inWrongBook: boolean
  firstAnsweredAt: string
  answeredAt: string
}

/**
 * Yapay zekâ çıktısı önbelleği (aynı istek için yeniden ücret ödenmesin). Yalnızca bu cihazda; yedeğe girmez.
 */
export interface AiNote {
  id: string // örn. explain:<sınav>#<soru no>
  kind: string
  text: string // ilk yapay zekâ yanıtı
  model: string
  createdAt: string
  /** Sohbet geçmişi (ilk açıklama + devam soruları). Eski kayıtlarda yok. */
  messages?: AiNoteTurn[]
}

/** Hafıza notu türü: tekrar eden hata, konu durumu, öğrenme tercihi, kişisel bağlam. */
export type MemoryCategory = 'hata' | 'konu' | 'tercih' | 'kisisel'

/** "Beni tanısın": kullanıcının onayladığı kalıcı gözlem. Yapay zekâ isteklerine bağlam olarak eklenir. */
export interface MemoryNote {
  id: string
  userId: string
  text: string
  category: MemoryCategory
  /** Notun çıkarıldığı yer, örn. "coach:<sohbet>" ya da "explain:<sınav>#<soru>"; elle eklenende "manual" */
  source: string
  createdAt: string
  updatedAt: string
}

/** YZ Koç sohbet modu. */
export type CoachMode = 'english' | 'yds' | 'dev'

/** İngilizce pratikte bir öğrenci mesajı için düzeltme notu (Türkçe açıklamalı). */
export interface CoachCorrection {
  original: string
  corrected: string
  explanation: string
}

/** Geliştirici danışmanının yapılandırılmış önerisi. */
export interface CoachSuggestion {
  title: string
  /** Ne, neden (öğrenme faydası), nasıl (teknik yaklaşım) */
  detail: string
  /** Tahmini efor: S (saatler), M (1-2 gün), L (daha uzun) */
  effort: 'S' | 'M' | 'L'
  /** İlgili alan, örn. "Soru Merkezi", "Kelime motoru", "YZ" */
  area: string
}

export type SuggestionStatus = 'yeni' | 'planlandi' | 'yapildi' | 'vazgecildi'

/** "Öneriler" listesine eklenmiş öneri. Yalnızca cihazda (JSON yedeğine girer). */
export interface Suggestion extends CoachSuggestion {
  id: string
  userId: string
  status: SuggestionStatus
  /** Önerinin geldiği sohbet */
  chatId?: string
  createdAt: string
  updatedAt: string
}

export interface CoachTurn {
  role: 'user' | 'model'
  /** Ekranda gösterilen metin */
  text: string
  /** Ekranda gösterilmeyen yardımcı mesaj (örn. sohbeti başlatma talimatı) */
  hidden?: boolean
  /** Model mesajında: bir önceki öğrenci mesajının düzeltmeleri */
  corrections?: CoachCorrection[]
  /** Model mesajında: öğrencinin mesajını daha doğal söyleme biçimi */
  better?: string
  /** Geliştirici danışmanı: bu yanıttaki öneriler */
  suggestions?: CoachSuggestion[]
  meta?: string
  at: string
}

/** YZ Koç sohbeti. Yalnızca bu cihazda saklanır. */
export interface CoachChat {
  id: string
  userId: string
  mode: CoachMode
  title: string
  /** İngilizce pratik: senaryo kimliği ve CEFR seviyesi */
  scenario?: string
  level?: string
  messages: CoachTurn[]
  /** Uzun sohbetlerde eski mesajların özeti ve özetlenen mesaj sayısı */
  summary?: string
  summarizedCount?: number
  createdAt: string
  updatedAt: string
}

export interface AiNoteTurn {
  role: 'user' | 'model'
  /** Ekranda gösterilen metin */
  text: string
  /** Modele gönderilen metin (ilk mesajda soru bağlamı burada); yoksa text gönderilir */
  prompt?: string
  /** Yanıtı üreten model ve katman, örn. "gemini-3.8-flash · ücretli" */
  meta?: string
  at: string
}

/**
 * Tamamlanan süreli deneme sınavı sonucu (yalnızca sayılar; soru metni yok).
 */
export interface MockExamResult {
  id: string
  userId: string
  examId: string
  examTitle: string
  startedAt: string
  finishedAt: string
  durationSec: number
  correct: number
  wrong: number
  empty: number
  score: number // 100 üzerinden (doğru × 1,25)
  /** Tip bazlı doğru/toplam: { grammar: [7, 10], ... } */
  sections: Record<string, [number, number]>
  /** Soru no -> verilen cevap (boşlar yok) */
  choices: Record<number, string>
  /** Soru no -> o soruda geçirilen saniye (eski denemelerde yok) */
  times?: Record<number, number>
}

/**
 * 20'şer Kelimelik Alt Seviye (Level) İlerleme Kaydı
 */
export interface LevelProgress {
  id: string // `${userId}_${subGroupId}`
  userId: string
  categoryGroupId: string // 'level_c1_c2', 'level_b1_b2', etc.
  subGroupId: string // 'level_c1_c2_lvl_1'
  levelNumber: number
  title: string
  mode?: 'flashcard' | 'multiple_choice' | 'synonym' | 'cloze' | 'mixed' | 'listen'
  status: 'completed' | 'in_progress' | 'not_started'
  completedQuestions: number
  totalQuestions: number
  correctCount: number
  wrongCount: number
  accuracyPercent: number
  lastStudiedAt: string
}
