import { db } from '../db'
import type { CardState, LevelProgress, StudySessionLog, WordGroup, WordItem } from '../types/database'

export interface GroupDefinition {
  id: string
  name: string
  shortName: string
  description: string
  icon: string
  color: string
  badge: string
  isBuiltIn: boolean
  /** Kelimesi yoksa çalışma ekranındaki deste sekmelerinde gösterilmez (kalabalık yapmasın). */
  hideWhenEmpty?: boolean
  matcher: (word: WordItem, card?: CardState, nowIso?: string) => boolean
}

export type LevelGroup = 'A' | 'B' | 'C'

const CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

/**
 * Kelimenin seviye grubunu (A / B / C) döndürür. Her kelime tam olarak bir gruba girer.
 * Öncelik: CEFR etiketi (en düşük olan) > eski grup etiketleri > zorluk puanı.
 * Not: Zorluk puanı yalnızca etiketsiz (elle eklenen) kelimelerde kullanılır; aksi halde
 * B2 kelimeleri (puan 4) C1-C2 grubuna karışırdı.
 */
export function getWordLevelGroup(w: WordItem): LevelGroup | null {
  const tags = w.tags || []
  const cefr = CEFR_ORDER.find((l) => tags.includes(l))
  if (cefr) return cefr[0] as LevelGroup
  if (tags.includes('İleri') || tags.includes('YDS-Akademik') || tags.includes('C1-İleri')) return 'C'
  if (tags.includes('Orta')) return 'B'
  if (tags.includes('Başlangıç')) return 'A'
  if (w.difficulty === 1 || w.difficulty === 2) return 'A'
  if (w.difficulty === 3) return 'B'
  if (w.difficulty === 4 || w.difficulty === 5) return 'C'
  return null
}

export const BUILT_IN_GROUPS: GroupDefinition[] = [
  {
    id: 'level_c1_c2',
    name: 'Seviye 3: C1 - C2 İleri Düzey (YDS & Akademik)',
    shortName: 'C1 - C2 İleri Düzey',
    description: 'ÖSYM sınavlarında paragraf, çeviri ve kelime sorularında en belirleyici ileri düzey akademik kelimeler.',
    icon: '🎯',
    color: '#8b5cf6',
    badge: 'C1-C2',
    isBuiltIn: true,
    matcher: (w) => getWordLevelGroup(w) === 'C',
  },
  {
    id: 'level_b1_b2',
    name: 'Seviye 2: B1 - B2 Orta Düzey (Genel & Sınav)',
    shortName: 'B1 - B2 Orta Düzey',
    description: 'YDS okuma metinlerini rahatça anlamak ve kelime haznesini genişletmek için temel oluşturan orta düzey kelimeler.',
    icon: '📘',
    color: '#3b82f6',
    badge: 'B1-B2',
    isBuiltIn: true,
    matcher: (w) => getWordLevelGroup(w) === 'B',
  },
  {
    id: 'level_a1_a2',
    name: 'Seviye 1: A1 - A2 Başlangıç (Temel İngilizce)',
    shortName: 'A1 - A2 Başlangıç',
    description: 'Günlük dilde en sık geçen, sağlam bir İngilizce altyapısı kurmanı sağlayan temel kelimeler.',
    icon: '🌱',
    color: '#10b981',
    badge: 'A1-A2',
    isBuiltIn: true,
    matcher: (w) => getWordLevelGroup(w) === 'A',
  },
  {
    id: 'yds_phrasal',
    name: 'YDS Özel: Phrasal Verbs (Deyimsel Fiiller)',
    shortName: 'Phrasal Verbs',
    description: 'Her YDS ve YÖKDİL sınavında doğrudan en az 3-4 soru olarak çıkan en kritik deyimsel fiiller.',
    icon: '⚡',
    color: '#f59e0b',
    badge: 'Phrasal',
    isBuiltIn: true,
    matcher: (w) => {
      const tags = w.tags || []
      return w.partOfSpeech === 'phrasal_verb' || tags.includes('Phrasal-Verb') || tags.includes('phrasal')
    },
  },
  {
    id: 'yds_conjunction',
    name: 'YDS Özel: Bağlaçlar & Edatlar',
    shortName: 'Bağlaçlar & Edatlar',
    description: 'Zıtlık, sebep-sonuç, amaç ve şart bildiren bağlaçlar; sınav cümle tamamlama sorularının anahtarıdır.',
    icon: '🔗',
    color: '#06b6d4',
    badge: 'Bağlaç',
    isBuiltIn: true,
    matcher: (w) => {
      const tags = w.tags || []
      return (
        w.partOfSpeech === 'conjunction' ||
        w.partOfSpeech === 'preposition' ||
        tags.includes('Bağlaç') ||
        tags.includes('Edat')
      )
    },
  },
  {
    id: 'fsrs_due',
    name: 'Günün Akıllı Tekrarları (FSRS Algoritması)',
    shortName: 'Günün Tekrarları',
    description: 'Unutma eğrisi eşiğine gelmiş ve bugün tekrarlanması gereken kelimeler. Hafızayı en verimli şekilde diri tutar.',
    icon: '🧠',
    color: '#ec4899',
    badge: 'FSRS',
    isBuiltIn: true,
    matcher: (_w, card, nowIso) => {
      if (!card) return false
      return Boolean(card.due && nowIso && card.due <= nowIso)
    },
  },
  {
    id: 'weak_words',
    name: 'Zorlandıklarım (Sık Yanıldığın Kelimeler)',
    shortName: 'Zorlandıklarım',
    description: 'Son puanı 1-2 olan ya da en az iki kez unuttuğun kelimeler. 4-5 puan verdiğinde desteden kendiliğinden çıkar.',
    icon: '🎯',
    color: '#ef4444',
    badge: 'Zor',
    isBuiltIn: true,
    hideWhenEmpty: true,
    matcher: (_w, card) => isWeakCard(card),
  },
  {
    id: 'yds_collected',
    name: 'Sınavdan Topladıklarım',
    shortName: 'Sınavdan Topladıklarım',
    description: 'YDS sorularını çözerken bir kelimeye dokunup "Havuzuma ekle" ya da "Topladıklarıma ekle" dediğin kelimeler.',
    icon: '📥',
    color: '#14b8a6',
    badge: 'Sınav',
    isBuiltIn: true,
    hideWhenEmpty: true,
    matcher: (w) => (w.tags || []).includes(EXAM_COLLECTED_TAG),
  },
]

/** Soru çözerken toplanan kelimelerin etiketi. */
export const EXAM_COLLECTED_TAG = 'YDS-Sınav-Sorusu'

/** Zorlanılan kart: çalışılmış ve son puanı düşük, ya da sık unutulmuş ve henüz iyi bilinmiyor. */
export function isWeakCard(card?: CardState): boolean {
  if (!card || !card.reps) return false
  const score = card.masteryScore ?? 1
  return score <= 2 || (card.lapses >= 2 && score < 4)
}

/**
 * Belirli bir grup (yerleşik veya özel) için kelimeleri filtreler.
 */
export function getWordsForGroup(
  groupId: string,
  allWords: WordItem[],
  cardMap: Map<string, CardState>,
  customGroup?: WordGroup | null,
  nowIso = new Date().toISOString(),
): WordItem[] {
  // 1. Yerleşik grup kontrolü
  const builtIn = BUILT_IN_GROUPS.find((g) => g.id === groupId)
  if (builtIn) {
    return allWords.filter((w) => {
      const card = cardMap.get(w.id)
      return builtIn.matcher(w, card, nowIso)
    })
  }

  // 2. Özel kullanıcı grubu kontrolü
  if (customGroup) {
    const wordIdSet = new Set(customGroup.wordIds || [])
    return allWords.filter((w) => wordIdSet.has(w.id) || (w.groupIds && w.groupIds.includes(customGroup.id)))
  }

  // Eşleşme yoksa boş döndür
  return []
}

/**
 * Grup için hakimiyet ve tekrar istatistiklerini hesaplar.
 */
export function calculateGroupStats(words: WordItem[], cardMap: Map<string, CardState>, nowIso = new Date().toISOString()) {
  const total = words.length
  if (total === 0) {
    return {
      total: 0,
      dueCount: 0,
      masteredCount: 0,
      learningCount: 0,
      masteryPercent: 0,
    }
  }

  let dueCount = 0
  let masteredCount = 0 // 4 veya 5 puan
  let learningCount = 0 // 1, 2 veya 3 puan

  for (const w of words) {
    const card = cardMap.get(w.id)
    if (card) {
      if (card.due && card.due <= nowIso) {
        dueCount++
      }
      const score = card.masteryScore || 1
      if (score >= 4) {
        masteredCount++
      } else {
        learningCount++
      }
    } else {
      learningCount++
    }
  }

  const masteryPercent = Math.round((masteredCount / total) * 100)

  return {
    total,
    dueCount,
    masteredCount,
    learningCount,
    masteryPercent,
  }
}

/**
 * Yeni özel grup oluştur
 */
export async function createCustomGroup(
  userId: string,
  name: string,
  description?: string,
  color = '#7c5cff',
  icon = '📁',
): Promise<WordGroup> {
  const now = new Date().toISOString()
  const group: WordGroup = {
    id: `grp_${crypto.randomUUID()}`,
    userId,
    name: name.trim(),
    description: description?.trim(),
    color,
    icon,
    isBuiltIn: false,
    wordIds: [],
    targetLevel: 'Özel',
    createdAt: now,
    updatedAt: now,
  }
  await db.wordGroups.add(group)
  return group
}

/**
 * Özel grubu sil
 */
export async function deleteCustomGroup(groupId: string): Promise<void> {
  await db.wordGroups.delete(groupId)
}

/**
 * Bir kelimeyi özel gruba ekle / gruptan çıkar (toggle)
 */
export async function toggleWordInGroup(groupId: string, wordId: string): Promise<boolean> {
  const group = await db.wordGroups.get(groupId)
  if (!group) return false

  const existingIds = new Set(group.wordIds || [])
  let isNowIncluded = false

  if (existingIds.has(wordId)) {
    existingIds.delete(wordId)
    isNowIncluded = false
  } else {
    existingIds.add(wordId)
    isNowIncluded = true
  }

  await db.wordGroups.update(groupId, {
    wordIds: Array.from(existingIds),
    updatedAt: new Date().toISOString(),
  })

  // Kelimenin kendi groupIds alanını da güncelle
  const word = await db.words.get(wordId)
  if (word) {
    const wordGroupSet = new Set(word.groupIds || [])
    if (isNowIncluded) wordGroupSet.add(groupId)
    else wordGroupSet.delete(groupId)

    await db.words.update(wordId, {
      groupIds: Array.from(wordGroupSet),
      updatedAt: new Date().toISOString(),
    })
  }

  return isNowIncluded
}

/**
 * Birden fazla kelimeyi toplu olarak bir gruba ekle
 */
export async function bulkAddWordsToGroup(groupId: string, wordIds: string[]): Promise<number> {
  const group = await db.wordGroups.get(groupId)
  if (!group) return 0

  const existingIds = new Set(group.wordIds || [])
  let added = 0

  for (const wid of wordIds) {
    if (!existingIds.has(wid)) {
      existingIds.add(wid)
      added++
    }
  }

  await db.wordGroups.update(groupId, {
    wordIds: Array.from(existingIds),
    updatedAt: new Date().toISOString(),
  })

  return added
}

/**
 * Çalışma oturumu sonucunu kaydet
 */
export async function saveStudySessionLog(
  session: Omit<StudySessionLog, 'id'>,
): Promise<StudySessionLog> {
  const record: StudySessionLog = {
    ...session,
    id: `sess_${crypto.randomUUID()}`,
  }
  await db.sessionLogs.add(record)
  return record
}

/**
 * Bugünkü oturumları getir
 */
export async function getTodaySessionLogs(userId: string): Promise<StudySessionLog[]> {
  const todayPrefix = new Date().toISOString().slice(0, 10)
  const allLogs = await db.sessionLogs.where('userId').equals(userId).toArray()
  return allLogs
    .filter((s) => s.startedAt.startsWith(todayPrefix))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
}

/**
 * 20'şer kelimelik alt seviye (Level) modeli
 */
export interface SubLevel {
  id: string // `${categoryGroupId}_lvl_${levelNumber}`
  categoryGroupId: string
  categoryName: string
  levelNumber: number
  title: string // `Level ${levelNumber} (${start} - ${end})`
  words: WordItem[]
  wordCount: number
}

/**
 * Bir kategorideki tüm kelimeleri 20'şer kelimelik seviyelere böler.
 * Örn: 898 kelimelik C1-C2 kategorisini 45 seviyeye ayırır.
 */
export function chunkIntoSubLevels(
  categoryGroupId: string,
  categoryName: string,
  words: WordItem[],
  chunkSize = 20,
): SubLevel[] {
  const subLevels: SubLevel[] = []
  const total = words.length
  if (total === 0) return []

  let lvl = 1
  for (let i = 0; i < total; i += chunkSize) {
    const slice = words.slice(i, i + chunkSize)
    const start = i + 1
    const end = Math.min(i + chunkSize, total)
    subLevels.push({
      id: `${categoryGroupId}_lvl_${lvl}`,
      categoryGroupId,
      categoryName,
      levelNumber: lvl,
      title: `Level ${lvl} (${start} - ${end})`,
      words: slice,
      wordCount: slice.length,
    })
    lvl++
  }
  return subLevels
}

/**
 * Bir alt seviyenin ilerlemesini kaydeder veya günceller
 */
export async function saveLevelProgress(progress: LevelProgress): Promise<void> {
  await db.levelProgress.put(progress)
}

/**
 * Belirli bir alt seviyenin ilerleme kaydını getirir
 */
export async function getLevelProgress(
  userId: string,
  subGroupId: string,
): Promise<LevelProgress | undefined> {
  const id = `${userId}_${subGroupId}`
  return await db.levelProgress.get(id)
}

/**
 * Kategori ID'sinden kullanıcı dostu kısa seviye adını üretir
 */
export function getCategoryBadgeOrName(categoryGroupId: string): string {
  switch (categoryGroupId) {
    case 'level_c1_c2':
      return 'C1-C2 İleri Düzey'
    case 'level_b1_b2':
      return 'B1-B2 Orta Düzey'
    case 'level_a1_a2':
      return 'A1-A2 Başlangıç'
    case 'yds_phrasal':
      return 'Phrasal Verbs'
    case 'yds_conjunction':
      return 'Bağlaçlar & Edatlar'
    case 'fsrs_due':
      return 'Günün Tekrarları'
    case 'weak_words':
      return 'Zorlandıklarım'
    case 'yds_collected':
      return 'Sınavdan Topladıklarım'
    default:
      return categoryGroupId.startsWith('grp_') ? 'Özel Deste' : categoryGroupId
  }
}

/**
 * Çalışma modu adını Türkçe ve anlaşılır döndürür
 */
export function getModeLabel(mode?: string): string {
  switch (mode) {
    case 'multiple_choice':
      return 'Çoktan Seçmeli Test'
    case 'synonym':
      return 'YDS Eş Anlamlı'
    case 'cloze':
      return 'Cümle İçi Boşluk'
    case 'mixed':
      return 'Karışık Mod'
    case 'flashcard':
    default:
      return 'Flaşkart Modu'
  }
}

/**
 * Yarıda bırakılan veya çalışılan seviyenin temiz başlığını üretir.
 * Örn: "C1-C2 İleri Düzey • Level 3 • Flaşkart Modu" (41-60 gibi kafa karıştıran sayılar olmadan!)
 */
export function formatLevelStudyTitle(
  categoryGroupId: string,
  levelNumber: number,
  mode?: string,
): string {
  const cat = getCategoryBadgeOrName(categoryGroupId)
  const modeStr = getModeLabel(mode)
  return `${cat} • Level ${levelNumber} • ${modeStr}`
}

/**
 * Bir seviyeyi 'yarıda bırakıldı' (in_progress) olarak işaretler veya günceller
 */
export async function markLevelInProgress(
  userId: string,
  categoryGroupId: string,
  subGroupId: string,
  levelNumber: number,
  title: string,
  completedQuestions: number,
  totalQuestions: number,
  correctCount: number,
  wrongCount: number,
  mode?: 'flashcard' | 'multiple_choice' | 'synonym' | 'cloze' | 'mixed',
): Promise<LevelProgress> {
  const id = `${userId}_${subGroupId}`
  const accuracyPercent =
    completedQuestions > 0 ? Math.round((correctCount / completedQuestions) * 100) : 0
  const record: LevelProgress = {
    id,
    userId,
    categoryGroupId,
    subGroupId,
    levelNumber,
    title,
    mode: mode || 'flashcard',
    status: completedQuestions >= totalQuestions ? 'completed' : 'in_progress',
    completedQuestions,
    totalQuestions,
    correctCount,
    wrongCount,
    accuracyPercent,
    lastStudiedAt: new Date().toISOString(),
  }
  await db.levelProgress.put(record)
  return record
}

/**
 * Bir seviyeyi 'tamamlandı' (completed) olarak işaretler
 */
export async function markLevelCompleted(
  userId: string,
  categoryGroupId: string,
  subGroupId: string,
  levelNumber: number,
  title: string,
  totalQuestions: number,
  correctCount: number,
  wrongCount: number,
  mode?: 'flashcard' | 'multiple_choice' | 'synonym' | 'cloze' | 'mixed',
): Promise<LevelProgress> {
  const id = `${userId}_${subGroupId}`
  const accuracyPercent =
    totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0
  const record: LevelProgress = {
    id,
    userId,
    categoryGroupId,
    subGroupId,
    levelNumber,
    title,
    mode: mode || 'flashcard',
    status: 'completed',
    completedQuestions: totalQuestions,
    totalQuestions,
    correctCount,
    wrongCount,
    accuracyPercent,
    lastStudiedAt: new Date().toISOString(),
  }
  await db.levelProgress.put(record)
  return record
}

/**
 * Bir kelimeyi özel gruba belirli bir sıra numarası ile ekler.
 * Sıra numarası (1-indexed) belirtilirse o sıraya yerleştirilir, sonrakiler 1 kaydırılır.
 * Sıra numarası boş bırakılırsa veya eleman sayısından büyükse en sona eklenir.
 */
export async function addWordToGroupAtPosition(
  groupId: string,
  wordId: string,
  position?: number | null,
): Promise<{ success: boolean; finalPosition: number; totalWords: number }> {
  const group = await db.wordGroups.get(groupId)
  if (!group) return { success: false, finalPosition: 0, totalWords: 0 }

  let ids = [...(group.wordIds || [])]
  // Eğer kelime zaten gruptaysa önce çıkarılır
  ids = ids.filter((id) => id !== wordId)

  let finalIndex: number
  if (position !== undefined && position !== null && position > 0 && position <= ids.length) {
    finalIndex = position - 1 // 1-indexed to 0-indexed
    ids.splice(finalIndex, 0, wordId)
  } else {
    ids.push(wordId)
    finalIndex = ids.length - 1
  }

  await db.wordGroups.update(groupId, {
    wordIds: ids,
    updatedAt: new Date().toISOString(),
  })

  // Kelimenin kendi groupIds alanını da güncelle
  const word = await db.words.get(wordId)
  if (word) {
    const wordGroupSet = new Set(word.groupIds || [])
    wordGroupSet.add(groupId)
    await db.words.update(wordId, {
      groupIds: Array.from(wordGroupSet),
      updatedAt: new Date().toISOString(),
    })
  }

  return { success: true, finalPosition: finalIndex + 1, totalWords: ids.length }
}

const RECENT_CUSTOM_GROUPS_KEY = 'yds_recent_custom_groups_v1'

/**
 * Son ekleme yapılan 2 özel grubun ID listesini döndürür
 */
export function getRecentCustomGroupIds(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_CUSTOM_GROUPS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.slice(0, 2) : []
  } catch {
    return []
  }
}

/**
 * Bir gruba ekleme yapıldığında onu son kullanılan 2 grup listesinin başına ekler
 */
export function saveRecentCustomGroupId(groupId: string): string[] {
  try {
    const existing = getRecentCustomGroupIds().filter((id) => id !== groupId)
    const updated = [groupId, ...existing].slice(0, 2)
    localStorage.setItem(RECENT_CUSTOM_GROUPS_KEY, JSON.stringify(updated))
    return updated
  } catch {
    return [groupId]
  }
}


/**
 * Kullanıcının belirli bir kategorideki veya tüm seviye ilerlemelerini getirir
 */
export async function getUserLevelProgressList(
  userId: string,
  categoryGroupId?: string,
): Promise<LevelProgress[]> {
  if (categoryGroupId) {
    return await db.levelProgress
      .where('userId')
      .equals(userId)
      .filter((p) => p.categoryGroupId === categoryGroupId)
      .toArray()
  }
  return await db.levelProgress.where('userId').equals(userId).toArray()
}


