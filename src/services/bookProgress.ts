import { dayKey } from './dates'

// Kitaptan çalış: biten üniteler (günlük plan için) ve ünite konusuna uygun MODADİL testi eşlemesi.
// Kişisel kolaylık; tarayıcı deposunda tutulur.

const doneKey = (userId: string, bookId: string) => `yds-book-units:${userId}:${bookId}`

/** Biten üniteler: ünite no → bitirildiği zaman (ISO). */
export function getDoneUnits(userId: string, bookId: string): Record<number, string> {
  try {
    return JSON.parse(localStorage.getItem(doneKey(userId, bookId)) || '{}') as Record<number, string>
  } catch {
    return {}
  }
}

export function markUnitDone(userId: string, bookId: string, unitNo: number): void {
  const done = getDoneUnits(userId, bookId)
  if (done[unitNo]) return
  done[unitNo] = new Date().toISOString()
  try {
    localStorage.setItem(doneKey(userId, bookId), JSON.stringify(done))
  } catch {
    // Depo kapalıysa yalnızca bu oturumda
  }
}

export function unitsDoneToday(userId: string, bookId: string, now = Date.now()): number {
  const today = dayKey(now)
  return Object.values(getDoneUnits(userId, bookId)).filter((at) => dayKey(at) === today).length
}

/**
 * Ünite başlığından Sınav Stratejileri 3'teki gramer konusu (yoksa null).
 * Murphy başlıkları kalıpla eşlenir; sıra önemlidir (ilk eşleşen kazanır).
 */
const TOPIC_RULES: [RegExp, string][] = [
  [/passive|being done|is done|was done|be done|been done|get something done/i, 'Passive Voice'],
  [/\bif\b|wish|unless|in case/i, 'If Clauses'],
  [/\bwho\b|which|whose|whom|relative/i, 'Adjective Clauses'],
  [/reported|said that|\btold\b|asked me|do you know where|noun clause/i, 'Noun Clauses'],
  [/present|past|perfect|future|continuous|will|shall|going to|tense|was\/were|am\/is\/are|(am|is|are|was|were) doing|i've|have done|had done|\bago\b|for and since|did\b/i, 'Tenses'],
  [/\bcan\b|could|must|mustn|should|\bmay\b|might|have to|had better|would|need/i, 'Modals'],
  [/-ing|to \.\.\.|to do|infinitive|gerund|verb \+|used to|enjoy|want you to|prefer|for and to/i, 'Gerunds & Infinitives'],
  [/adjective|adverb|comparative|superlative|older|oldest|bigger|than|as \.\.\. as|\btoo\b|enough|quite|rather|-ly|so and such/i, 'Adjectives & Adverbs'],
  [/although|though|because|while|when|before|after|until|since|as soon as|in spite|despite|so that|conjunction|and but or|even/i, 'Adverb Clauses'],
  [/\bsome|\bany|much|many|\bfew\b|little|\ball\b|each|every|both|either|neither|none|a lot|plenty/i, 'Quantifiers'],
]

export function topicForUnit(title: string): string | null {
  for (const [re, topic] of TOPIC_RULES) if (re.test(title)) return topic
  return null
}
