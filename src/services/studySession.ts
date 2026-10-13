import type { CardState, PartOfSpeech, WordItem } from '../types/database'

export type QuestionMode = 'mixed' | 'flashcard' | 'multiple_choice' | 'synonym' | 'cloze'

export interface StudyQuestion {
  id: string
  word: WordItem
  cardState: CardState
  type: 'flashcard' | 'multiple_choice' | 'synonym' | 'cloze'
  prompt: string
  subPrompt?: string
  options?: string[] // Çoktan seçmeli seçenekler
  correctOptionIndex?: number
  explanation?: string
}

export interface StudyFilterOptions {
  posList?: PartOfSpeech[] // Seçilen türler (boşsa tümü)
  tags?: string[] // Seçilen etiketler (boşsa tümü)
  masteryScores?: number[] // Seçilen puanlar (1, 2, 3, 4, 5)
  dueOnly?: boolean // Sadece tekrarı gelenler
  lapsesOnly?: boolean // En çok hata yapılanlar
  limit: number // Oturum soru sınırı (10, 20, 30 vb., 0 ise limitsiz)
  mode: QuestionMode
  wordIds?: string[] // Belirli grup/kelime listesi kısıtlaması
}

/**
 * Kullanıcının filtrelerine göre çalışılacak kelimeleri seçer.
 */
export function filterStudyCards(
  allWords: WordItem[],
  allCardStates: CardState[],
  filters: StudyFilterOptions,
): Array<{ word: WordItem; cardState: CardState }> {
  const cardMap = new Map<string, CardState>()
  for (const c of allCardStates) {
    cardMap.set(c.wordId, c)
  }

  const now = new Date().toISOString()
  const wordIdSet = filters.wordIds ? new Set(filters.wordIds) : null

  const eligible: Array<{ word: WordItem; cardState: CardState }> = []

  for (const w of allWords) {
    if (w.isDeleted) continue

    // 0. Kelime ID kısıtlaması (Grup çalışması için)
    if (wordIdSet && !wordIdSet.has(w.id)) {
      continue
    }

    const card = cardMap.get(w.id) || {
      id: `${w.id}_${w.userId}`,
      wordId: w.id,
      userId: w.userId,
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

    // 1. Tür filtresi
    if (filters.posList && filters.posList.length > 0 && !filters.posList.includes(w.partOfSpeech)) {
      continue
    }

    // 2. Etiket / Kategori filtresi
    if (filters.tags && filters.tags.length > 0) {
      const hasMatchingTag = w.tags && w.tags.some((t) => filters.tags!.includes(t))
      if (!hasMatchingTag) continue
    }

    // 3. Kullanıcının 1-5 Puan Filtresi (örn: [1, 2, 3] seçilmişse)
    const score = card.masteryScore || 1
    if (filters.masteryScores && filters.masteryScores.length > 0 && !filters.masteryScores.includes(score)) {
      continue
    }

    // 4. Sadece tekrarı gelenler filtresi
    if (filters.dueOnly && card.due > now) {
      continue
    }

    // 5. En çok yanıldıklarım filtresi
    if (filters.lapsesOnly && card.lapses < 1) {
      continue
    }

    eligible.push({ word: w, cardState: card })
  }

  // Sıralama mantığı:
  // - Tekrar tarihi geçmiş olanlar önce
  // - Puanı düşük (1 ve 2) olanlar önce
  eligible.sort((a, b) => {
    const scoreA = a.cardState.masteryScore || 1
    const scoreB = b.cardState.masteryScore || 1
    if (scoreA !== scoreB) return scoreA - scoreB
    return a.cardState.due.localeCompare(b.cardState.due)
  })

  // Soru limitini uygula
  return filters.limit > 0 ? eligible.slice(0, filters.limit) : eligible
}

/**
 * Bir kelime için soru üretir (Flaşkart, Çoktan Seçmeli, Eş Anlamlı veya Boşluk Doldurma)
 */
export function buildQuestion(
  item: { word: WordItem; cardState: CardState },
  allWords: WordItem[],
  mode: QuestionMode,
): StudyQuestion {
  const { word, cardState } = item

  let resolvedType: StudyQuestion['type'] = 'flashcard'

  if (mode === 'flashcard') {
    resolvedType = 'flashcard'
  } else if (mode === 'multiple_choice') {
    resolvedType = 'multiple_choice'
  } else if (mode === 'synonym') {
    resolvedType = word.synonyms && word.synonyms.length > 0 ? 'synonym' : 'multiple_choice'
  } else if (mode === 'cloze') {
    resolvedType = word.sentences && word.sentences.length > 0 && word.sentences[0].en ? 'cloze' : 'multiple_choice'
  } else {
    // Karma mod (mixed)
    const canCloze = word.sentences && word.sentences.length > 0 && word.sentences[0].en
    const canSynonym = word.synonyms && word.synonyms.length > 0

    const rand = Math.random()
    if (canSynonym && rand < 0.35) {
      resolvedType = 'synonym'
    } else if (canCloze && rand < 0.65) {
      resolvedType = 'cloze'
    } else if (rand < 0.85) {
      resolvedType = 'multiple_choice'
    } else {
      resolvedType = 'flashcard'
    }
  }

  // 1. EŞ ANLAMLI TESTİ
  if (resolvedType === 'synonym') {
    const correctSyn = word.synonyms[Math.floor(Math.random() * word.synonyms.length)]
    const distractors = pickDistractors(
      allWords.filter((w) => w.id !== word.id).map((w) => (w.synonyms?.[0] ? w.synonyms[0] : w.term)),
      correctSyn,
      3,
    )
    const { options, correctIdx } = shuffleOptions(correctSyn, distractors)

    return {
      id: crypto.randomUUID(),
      word,
      cardState,
      type: 'synonym',
      prompt: `"${word.term}" kelimesinin eş anlamlısı hangisidir?`,
      subPrompt: `Kelime türü: ${word.partOfSpeech.toUpperCase()}`,
      options,
      correctOptionIndex: correctIdx,
      explanation: `Doğru cevap: ${correctSyn}. Anlamı: ${word.definition}`,
    }
  }

  // 2. CÜMLEDE BOŞLUK DOLDURMA (CLOZE)
  if (resolvedType === 'cloze' && word.sentences && word.sentences[0]?.en) {
    const sentenceEn = word.sentences[0].en
    const regex = new RegExp(`\\b${escapeRegExp(word.term)}[a-z]*\\b`, 'i')
    const blankedSentence = sentenceEn.replace(regex, '_________')

    const distractors = pickDistractors(
      allWords.filter((w) => w.id !== word.id).map((w) => w.term),
      word.term,
      3,
    )
    const { options, correctIdx } = shuffleOptions(word.term, distractors)

    return {
      id: crypto.randomUUID(),
      word,
      cardState,
      type: 'cloze',
      prompt: blankedSentence,
      subPrompt: word.sentences[0].tr ? `Çeviri ipucu: "${word.sentences[0].tr}"` : undefined,
      options,
      correctOptionIndex: correctIdx,
      explanation: `Doğru kelime: ${word.term} (${word.definition})`,
    }
  }

  // 3. ÇOKTAN SEÇMELİ TEST (İNGİLİZCE -> TÜRKÇE)
  if (resolvedType === 'multiple_choice') {
    const distractors = pickDistractors(
      allWords.filter((w) => w.id !== word.id).map((w) => w.definition),
      word.definition,
      3,
    )
    const { options, correctIdx } = shuffleOptions(word.definition, distractors)

    return {
      id: crypto.randomUUID(),
      word,
      cardState,
      type: 'multiple_choice',
      prompt: word.term,
      subPrompt: `Tür: ${word.partOfSpeech.toUpperCase()}`,
      options,
      correctOptionIndex: correctIdx,
      explanation: `Doğru anlam: ${word.definition}`,
    }
  }

  // 4. KLASİK FLAŞKART
  return {
    id: crypto.randomUUID(),
    word,
    cardState,
    type: 'flashcard',
    prompt: word.term,
    subPrompt: `Kelime Türü: ${word.partOfSpeech.toUpperCase()}`,
  }
}

function pickDistractors(candidates: string[], correct: string, count: number): string[] {
  const filtered = Array.from(new Set(candidates.filter((c) => c && c.toLowerCase() !== correct.toLowerCase())))
  const shuffled = filtered.sort(() => 0.5 - Math.random())
  const picked = shuffled.slice(0, count)

  // Yeterli çeldirici yoksa genel YDS kelimelerinden doldur
  const fallbacks = ['önemli ölçüde', 'vazgeçmek', 'hızlandırmak', 'üstesinden gelmek', 'benimsemek', 'meydana gelmek']
  let fIdx = 0
  while (picked.length < count && fIdx < fallbacks.length) {
    if (!picked.includes(fallbacks[fIdx]) && fallbacks[fIdx] !== correct) {
      picked.push(fallbacks[fIdx])
    }
    fIdx++
  }
  return picked
}

function shuffleOptions(correct: string, distractors: string[]): { options: string[]; correctIdx: number } {
  const combined = [correct, ...distractors]
  for (let i = combined.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[combined[i], combined[j]] = [combined[j], combined[i]]
  }
  return {
    options: combined,
    correctIdx: combined.indexOf(correct),
  }
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
