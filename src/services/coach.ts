import { db } from '../db'
import type { CoachChat, CoachCorrection, CoachMode, CoachTurn } from '../types/database'
import { generate, generateChat, type AiResult, type ChatTurn } from './ai'

// YZ Koç: sohbetlerin oluşturulması, mesaj gönderme ve uzun sohbetlerin özetlenmesi.
// Sohbetler yalnızca bu cihazda (Dexie) saklanır; yalnızca istek anında Gemini'ye gider.

export interface CoachModeInfo {
  mode: CoachMode
  icon: string
  title: string
  desc: string
  ready: boolean
}

export const COACH_MODES: CoachModeInfo[] = [
  { mode: 'english', icon: '💬', title: 'İngilizce pratik', desc: 'Serbest sohbet ya da rol yapma; hataların konuşmayı bölmeden altta düzeltilir.', ready: true },
  { mode: 'yds', icon: '🎯', title: 'YDS koçu', desc: 'Durumunu değerlendirir, plan önerir, seni uygulamadaki alıştırmalara yönlendirir.', ready: false },
  { mode: 'dev', icon: '🛠️', title: 'Geliştirici danışmanı', desc: 'Uygulamayı bilerek iyileştirme ve yeni özellik önerir.', ready: false },
]

export interface Scenario {
  id: string
  icon: string
  title: string
  /** Modele verilen senaryo tarifi (İngilizce) */
  prompt: string
}

export const ENGLISH_SCENARIOS: Scenario[] = [
  { id: 'free', icon: '☕', title: 'Serbest sohbet', prompt: 'A relaxed everyday conversation. Ask about the learner’s day, interests and opinions; let topics flow naturally.' },
  { id: 'interview', icon: '💼', title: 'İş görüşmesi', prompt: 'You are an interviewer at a company; the learner is the candidate. Ask typical interview questions one at a time and react to the answers.' },
  { id: 'restaurant', icon: '🍽️', title: 'Restoranda', prompt: 'You are a waiter in a restaurant; the learner is the customer. Greet, take the order, answer questions about the menu and handle the bill.' },
  { id: 'travel', icon: '✈️', title: 'Seyahat ve havalimanı', prompt: 'You are an airline / hotel staff member helping the learner during a trip: check-in, questions, small problems to solve.' },
  { id: 'doctor', icon: '🩺', title: 'Doktorda', prompt: 'You are a doctor; the learner is a patient describing symptoms. Ask follow-up questions and give simple advice.' },
  { id: 'academic', icon: '🎓', title: 'Akademik tartışma', prompt: 'Discuss a topic of the kind found in YDS reading passages (science, health, history, environment, technology, society). Propose a topic, share a short claim and ask for the learner’s view; use some academic vocabulary.' },
]

export const LEVELS = [
  { id: 'A2', label: 'A2 — temel' },
  { id: 'B1', label: 'B1 — orta' },
  { id: 'B2', label: 'B2 — orta üstü' },
  { id: 'C1', label: 'C1 — ileri' },
]

/** Bu kadar mesajı aşınca eski kısım özetlenir; son RECENT_TURNS mesaj olduğu gibi gönderilir. */
const SUMMARIZE_AFTER = 24
const RECENT_TURNS = 12

function englishSystem(chat: CoachChat): string {
  const scenario = ENGLISH_SCENARIOS.find((s) => s.id === chat.scenario) ?? ENGLISH_SCENARIOS[0]
  const lines = [
    'You are a friendly English conversation partner for a Turkish adult learner who is also preparing for the YDS exam.',
    `Learner level: ${chat.level ?? 'B2'} (CEFR). Match vocabulary and sentence length to this level; at B2 and above occasionally use academic words that appear in YDS.`,
    `Scenario: ${scenario.prompt}`,
    '',
    'Rules:',
    '- Stay in the conversation / role. Keep "reply" short (2-4 sentences) and end with a question or prompt so the conversation continues.',
    '- Never stop the conversation to teach. Corrections go only in "corrections" and "better".',
    '- "corrections": real mistakes in the learner\'s LAST message only (grammar, word choice, unnatural phrasing), at most 3. Each item: "original" fragment, "corrected" fragment, "explanation" = one short sentence in Turkish. Empty list if there are no mistakes. Do not correct capitalisation or a missing final period.',
    '- "better": one more natural way to say the learner\'s whole last message, or an empty string if it is already natural.',
    '- If the learner writes in Turkish, reply in simple English and give an English version of their message in "better".',
    '- If there is no learner message yet, open the conversation: "corrections" empty, "better" empty.',
  ]
  if (chat.summary) lines.push('', `Summary of the earlier conversation: ${chat.summary}`)
  return lines.join('\n')
}

const ENGLISH_SCHEMA = {
  type: 'OBJECT',
  properties: {
    reply: { type: 'STRING' },
    corrections: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { original: { type: 'STRING' }, corrected: { type: 'STRING' }, explanation: { type: 'STRING' } },
        required: ['original', 'corrected', 'explanation'],
      },
    },
    better: { type: 'STRING' },
  },
  required: ['reply', 'corrections', 'better'],
}

interface EnglishOutput {
  reply: string
  corrections: CoachCorrection[]
  better: string
}

function parseEnglish(text: string): EnglishOutput {
  try {
    const o = JSON.parse(text) as Partial<EnglishOutput>
    if (typeof o.reply === 'string' && o.reply.trim()) {
      return {
        reply: o.reply.trim(),
        corrections: Array.isArray(o.corrections) ? o.corrections.filter((c) => c && c.original && c.corrected) : [],
        better: typeof o.better === 'string' ? o.better.trim() : '',
      }
    }
  } catch {
    // Model şemaya uymadıysa metni olduğu gibi göster
  }
  return { reply: text.trim(), corrections: [], better: '' }
}

function metaOf(r: AiResult): string {
  return `${r.model} · ${r.tier === 'paid' ? `ücretli (~${r.usd.toFixed(4)} $)` : 'ücretsiz katman'}`
}

/** Modele gidecek mesajlar: özetlenen kısım hariç; model mesajlarında yalnızca cevap metni. */
function historyFor(chat: CoachChat): ChatTurn[] {
  const turns = chat.messages.slice(chat.summarizedCount ?? 0).map((t) => ({ role: t.role, text: t.text }))
  // Gemini sohbeti kullanıcı mesajıyla başlamalı
  while (turns.length && turns[0].role === 'model') turns.shift()
  return turns.length ? turns : [{ role: 'user', text: '(Start the conversation now.)' }]
}

/** Sohbet uzadıysa eski mesajları kısa bir İngilizce özete çevirir (maliyeti düşük tutmak için). */
async function maybeSummarize(chat: CoachChat): Promise<CoachChat> {
  const done = chat.summarizedCount ?? 0
  if (chat.messages.length - done <= SUMMARIZE_AFTER) return chat
  let cut = chat.messages.length - RECENT_TURNS
  // Kalan kısım kullanıcı mesajıyla başlasın
  while (cut < chat.messages.length && chat.messages[cut].role !== 'user') cut++
  const older = chat.messages
    .slice(done, cut)
    .filter((t) => !t.hidden)
    .map((t) => `${t.role === 'user' ? 'Learner' : 'Partner'}: ${t.text}`)
    .join('\n')
  const r = await generate(
    'Summarise conversations briefly and factually.',
    `${chat.summary ? `Earlier summary: ${chat.summary}\n\n` : ''}Conversation:\n${older}\n\nWrite a summary of at most 120 words in English: topics covered, facts the learner shared about themselves, the role-play situation so far.`,
    0.2,
  )
  return { ...chat, summary: r.text.trim(), summarizedCount: cut }
}

export async function createEnglishChat(userId: string, scenarioId: string, level: string): Promise<CoachChat> {
  const scenario = ENGLISH_SCENARIOS.find((s) => s.id === scenarioId) ?? ENGLISH_SCENARIOS[0]
  const now = new Date().toISOString()
  const chat: CoachChat = {
    id: crypto.randomUUID(),
    userId,
    mode: 'english',
    title: `${scenario.icon} ${scenario.title} · ${level}`,
    scenario: scenario.id,
    level,
    messages: [],
    createdAt: now,
    updatedAt: now,
  }
  await db.coachChats.put(chat)
  return chat
}

/**
 * İngilizce pratik: kullanıcının mesajını (boşsa sohbeti başlatma isteğini) gönderir, yanıtı ve düzeltmeleri
 * sohbete ekleyip kaydeder. Hata olursa sohbet değişmeden kalır ve hata fırlatılır.
 */
export async function sendEnglish(chat: CoachChat, text: string): Promise<CoachChat> {
  const now = new Date().toISOString()
  const userTurn: CoachTurn = text.trim()
    ? { role: 'user', text: text.trim(), at: now }
    : { role: 'user', text: '(Start the conversation now with a short opening line for the scenario.)', hidden: true, at: now }
  let next: CoachChat = { ...chat, messages: [...chat.messages, userTurn] }
  next = await maybeSummarize(next)
  const r = await generateChat(englishSystem(next), historyFor(next), 0.7, { jsonSchema: ENGLISH_SCHEMA })
  const out = parseEnglish(r.text)
  const modelTurn: CoachTurn = {
    role: 'model',
    text: out.reply,
    corrections: out.corrections,
    better: out.better || undefined,
    meta: metaOf(r),
    at: new Date().toISOString(),
  }
  next = { ...next, messages: [...next.messages, modelTurn], updatedAt: modelTurn.at }
  await db.coachChats.put(next)
  return next
}

export async function deleteChat(id: string): Promise<void> {
  await db.coachChats.delete(id)
}
