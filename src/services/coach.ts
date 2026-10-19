import { db } from '../db'
import type { CoachChat, CoachCorrection, CoachMode, CoachSuggestion, CoachTurn } from '../types/database'
import { generate, generateChat, type AiResult, type ChatTurn } from './ai'
import { memoryContext } from './memory'
import { appMapText } from './appMap'
import { buildDailyPlan } from './dailyPlan'
import { daysUntil } from './dates'
import { YDS_SECTIONS, type SectionKey } from './ydsSections'
import { summarizeBySection } from './examProgress'
import { COACH_MODE_RULES, getSourceMode, tacticsAvailable, tacticsContext } from './tactics'
import { useSettings } from '../stores/settings'
import { roadmapDigest } from './roadmapDigest'

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
  { mode: 'yds', icon: '🎯', title: 'YDS koçu', desc: 'Durumunu değerlendirir, plan önerir, seni uygulamadaki alıştırmalara yönlendirir.', ready: true },
  { mode: 'dev', icon: '🛠️', title: 'Geliştirici danışmanı', desc: 'Uygulamayı ve yol haritasını bilerek iyileştirme ve yeni özellik önerir.', ready: true },
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

function englishSystem(chat: CoachChat, memory: string): string {
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
  if (memory) {
    lines.push(
      '',
      'What you know about this learner (notes in Turkish, confirmed by the learner). Use them naturally: pick topics they care about and watch for the mistakes they tend to make; do not mention the notes explicitly.',
      memory,
    )
  }
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
    `${chat.summary ? `Earlier summary: ${chat.summary}\n\n` : ''}Conversation:\n${older}\n\nWrite a summary of at most 120 words in the same language as the conversation: topics covered, facts the learner shared about themselves, advice or plans agreed, the role-play situation so far.`,
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
  const memory = await memoryContext(chat.userId, { profile: false })
  const r = await generateChat(englishSystem(next, memory), historyFor(next), 0.7, { jsonSchema: ENGLISH_SCHEMA })
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

/** "Hafızaya kaydet" için sohbet dökümü: görünen mesajlar ve düzeltmeler. */
export function coachTranscript(chat: CoachChat): string {
  const lines: string[] = []
  chat.messages.forEach((m, i) => {
    if (m.hidden) return
    lines.push(`${m.role === 'user' ? 'Öğrenci' : 'YZ'}: ${m.text}`)
    const next = chat.messages[i + 1]
    if (m.role === 'user' && next?.role === 'model') {
      for (const c of next.corrections ?? []) lines.push(`  (düzeltme: "${c.original}" → "${c.corrected}" — ${c.explanation})`)
    }
  })
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// YDS koçu
// ---------------------------------------------------------------------------

/** YDS koçunun hızlı soruları (sohbet ekranında tek dokunuşla gönderilir). */
export const YDS_QUICK_PROMPTS = [
  'Durumumu değerlendir',
  'Bu hafta için plan yap',
  'En zayıf olduğum konuda ne yapmalıyım?',
  'Bugün sadece 30 dakikam var, neye odaklanayım?',
  'Motivasyonum düştü',
]

const YDS_RULES = [
  'Sen deneyimli, samimi ve dürüst bir YDS (Yabancı Dil Seviye Tespit Sınavı) koçusun. Öğrenci Türk; Türkçe konuş.',
  'Görevin: öğrencinin durumunu verilerine dayanarak değerlendirmek, gerçekçi bir plan yapmak, motive etmek ve onu uygulamadaki doğru alıştırmalara yönlendirmek.',
  '',
  'Kurallar:',
  '- Kısa ve somut ol (çoğunlukla 120-200 kelime); maddeler kullan.',
  '- Verilere dayan. Bir konuda veri yoksa uydurma; "henüz veri yok" de ve verinin nasıl oluşacağını söyle (örn. birkaç deneme çözmek).',
  '- Uygulamadaki sayfalara YALNIZCA aşağıdaki UYGULAMA HARİTASI’ndaki adreslerle, Markdown bağlantısı olarak yönlendir: [Ad](/adres). Haritada olmayan adres yazma; bir yanıtta en fazla 3 bağlantı.',
  '- Gerçekçi ol: sınava kalan gün, hedef puan ve mevcut başarıyı karşılaştır; abartılı vaat verme, ama cesaret kır de değil.',
  '- Hafıza notlarındaki tekrar eden hatalara ve tercihlerine göre kişiselleştir.',
  '',
  'YDS bilgisi: 80 soru, 180 dakika; her doğru 1,25 puan, yanlış doğruyu götürmez (boş bırakmak yerine tahmin avantajlıdır).',
  'Soru tipleri: ' + YDS_SECTIONS.map((x) => `${x.label} (${x.from}-${x.to})`).join(', ') + '.',
]

/** Bugünkü plan özeti (Ana Sayfa’daki kartla aynı hesap; soru görevi yalnızca yerelde bilinir, burada yok). */
async function todayPlanText(userId: string): Promise<string> {
  const [cards, logs, answers] = await Promise.all([
    db.cardStates.where('userId').equals(userId).toArray(),
    db.reviewLogs.where('userId').equals(userId).toArray(),
    db.examAnswers.where('userId').equals(userId).toArray(),
  ])
  const { exam } = useSettings.getState()
  const plan = buildDailyPlan({ cards, logs, answers, daysLeft: daysUntil(exam.targetExamDate), newWordCap: exam.dailyGoal || 20 })
  return 'Bugünkü plan: ' + plan.map((t) => `${t.label} ${t.done}/${t.target}`).join(', ') + '.'
}

/** Koç modunda: öğrencinin en zayıf iki soru tipinin taktikleri (sayfa alıntısı olmadan, kısa). */
async function coachTactics(userId: string): Promise<string> {
  if (getSourceMode() !== 'koc' || !(await tacticsAvailable())) return ''
  const answers = await db.examAnswers.where('userId').equals(userId).toArray()
  const weakest = summarizeBySection(answers)
    .filter((s) => s.answered >= 5 && s.percent !== null)
    .sort((a, b) => (a.percent ?? 0) - (b.percent ?? 0))
    .slice(0, 2)
    .map((s) => s.key)
  const sections: SectionKey[] = weakest.length ? weakest : YDS_SECTIONS.map((s) => s.key)
  return tacticsContext({ sections })
}

async function ydsSystem(chat: CoachChat): Promise<{ system: string; koc: boolean }> {
  const [memory, plan, tactics] = await Promise.all([
    memoryContext(chat.userId, { profile: true }),
    todayPlanText(chat.userId),
    coachTactics(chat.userId),
  ])
  const lines = [...YDS_RULES, '', 'UYGULAMA HARİTASI:', appMapText()]
  if (tactics) lines.push('', COACH_MODE_RULES, tactics)
  lines.push('', 'ÖĞRENCİ VERİLERİ:', memory, plan)
  if (chat.summary) lines.push('', `Önceki konuşmanın özeti: ${chat.summary}`)
  return { system: lines.join('\n'), koc: Boolean(tactics) }
}

export async function createYdsChat(userId: string): Promise<CoachChat> {
  const now = new Date().toISOString()
  const chat: CoachChat = {
    id: crypto.randomUUID(),
    userId,
    mode: 'yds',
    title: `🎯 YDS koçu · ${new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}`,
    messages: [],
    createdAt: now,
    updatedAt: now,
  }
  await db.coachChats.put(chat)
  return chat
}

/** YDS koçu: mesajı (boşsa açılış isteğini) gönderir; yanıt serbest Markdown (uygulama içi bağlantılı). */
export async function sendYds(chat: CoachChat, text: string): Promise<CoachChat> {
  const now = new Date().toISOString()
  const userTurn: CoachTurn = text.trim()
    ? { role: 'user', text: text.trim(), at: now }
    : {
        role: 'user',
        text: '(Sohbeti başlat: kendini bir cümleyle tanıt, verilerime göre durumumu kısaca değerlendir ve bugün için 2-3 somut öneri ver.)',
        hidden: true,
        at: now,
      }
  let next: CoachChat = { ...chat, messages: [...chat.messages, userTurn] }
  next = await maybeSummarize(next)
  const { system, koc } = await ydsSystem(next)
  const r = await generateChat(system, historyFor(next), 0.5)
  const modeLabel = import.meta.env.DEV ? (koc ? ' · 📒 Koç (kaynaklı)' : ' · ✨ Saf Gemini') : ''
  const modelTurn: CoachTurn = { role: 'model', text: r.text.trim(), meta: metaOf(r) + modeLabel, at: new Date().toISOString() }
  next = { ...next, messages: [...next.messages, modelTurn], updatedAt: modelTurn.at }
  await db.coachChats.put(next)
  return next
}

// ---------------------------------------------------------------------------
// Geliştirici danışmanı
// ---------------------------------------------------------------------------

export const DEV_QUICK_PROMPTS = [
  'Uygulamayı genel olarak değerlendir',
  'Öğrenme açısından en etkili 3 iyileştirme?',
  'Arayüzü sadeleştirmek için ne önerirsin?',
  'Yol haritasındaki sıradaki işi nasıl yapmalıyım?',
  'Teknik borç ve riskler neler?',
]

const DEV_RULES = [
  'Sen bu uygulamanın (YDS Kelime: YDS sınavına hazırlık ve İngilizce öğrenme PWA’sı) kıdemli ürün ve yazılım danışmanısın. Kullanıcı hem öğrenci hem de uygulamanın geliştiricisi; React/TypeScript biliyor. Türkçe konuş.',
  '',
  'Teknik yapı: React 19 + TypeScript + Vite + Dexie (IndexedDB) PWA, çevrimdışı önce; Zustand ayarlar; FSRS (ts-fsrs) aralıklı tekrar; yapay zekâ Google Gemini (tarayıcıdan, anahtar cihazda; ücretli → ücretsiz katman geçişi; aylık ≈10 $ bütçe); Supabase senkron altyapısı var ama kullanılmıyor; GitHub Pages’te yayın.',
  'Kurallar: çıkmış YDS soruları ve hoca kitapları telifli, yalnızca yerelde (npm run dev) kullanılır, yayına girmez. Arayüz sade olmalı; yeni menü kalabalığı yok; her ekranda bir cümlelik açıklama.',
  '',
  'Nasıl yanıt vereceksin:',
  '- "reply": sohbet yanıtın (Markdown, kısa ve somut; çoğunlukla 150-250 kelime). Uygulama sayfalarına yalnızca aşağıdaki haritadaki adreslerle [Ad](/adres) biçiminde bağlantı ver.',
  '- "suggestions": yanıtında somut, uygulanabilir öneri varsa her birini ayrıca listele (en fazla 4). Her öneri: kısa "title"; "detail" = ne, neden (öğrenme ya da kullanım faydası), nasıl (hangi ekran/servis, teknik yaklaşım) 2-4 cümle; "effort" = S (birkaç saat) / M (1-2 gün) / L (daha uzun); "area" = ilgili alan. Öneri yoksa boş liste.',
  '- Yol haritasında zaten yapılmış ya da planlanmış şeyleri yeni öneri gibi sunma; ilgiliyse ona atıf yap ve nasıl daha iyi olabileceğini söyle.',
  '- Gerçekçi ol: bütçeyi, tek kişilik geliştirmeyi ve sadelik ilkesini göz önünde tut. Emin olmadığın teknik ayrıntıyı uydurma.',
]

const DEV_SCHEMA = {
  type: 'OBJECT',
  properties: {
    reply: { type: 'STRING' },
    suggestions: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          detail: { type: 'STRING' },
          effort: { type: 'STRING', enum: ['S', 'M', 'L'] },
          area: { type: 'STRING' },
        },
        required: ['title', 'detail', 'effort', 'area'],
      },
    },
  },
  required: ['reply', 'suggestions'],
}

/** Kullanım özeti: hangi özellikler ne kadar kullanılıyor (danışmanın önceliklendirmesi için). */
async function usageText(userId: string): Promise<string> {
  const [words, reviews, answers, mocks, chats, notes, suggestions] = await Promise.all([
    db.words.where('userId').equals(userId).count(),
    db.reviewLogs.where('userId').equals(userId).count(),
    db.examAnswers.where('userId').equals(userId).count(),
    db.mockResults.where('userId').equals(userId).count(),
    db.coachChats.where('userId').equals(userId).count(),
    db.memoryNotes.where('userId').equals(userId).count(),
    db.suggestions.where('userId').equals(userId).toArray(),
  ])
  const lines = [
    `Kullanım: ${words} kelime, ${reviews} kelime tekrarı, ${answers} çıkmış soru cevabı, ${mocks} deneme, ${chats} YZ sohbeti, ${notes} hafıza notu.`,
  ]
  if (suggestions.length) {
    lines.push('Öneriler listesindekiler (tekrar önerme):', ...suggestions.slice(0, 20).map((x) => `- ${x.title} [${x.status}]`))
  }
  return lines.join('\n')
}

async function devSystem(chat: CoachChat): Promise<string> {
  const lines = [
    ...DEV_RULES,
    '',
    'UYGULAMA HARİTASI:',
    appMapText(),
    '',
    'YOL HARİTASI ÖZETİ (YOL_HARITASI.md):',
    roadmapDigest(),
    '',
    await usageText(chat.userId),
  ]
  if (chat.summary) lines.push('', `Önceki konuşmanın özeti: ${chat.summary}`)
  return lines.join('\n')
}

export async function createDevChat(userId: string): Promise<CoachChat> {
  const now = new Date().toISOString()
  const chat: CoachChat = {
    id: crypto.randomUUID(),
    userId,
    mode: 'dev',
    title: `🛠️ Geliştirici danışmanı · ${new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}`,
    messages: [],
    createdAt: now,
    updatedAt: now,
  }
  await db.coachChats.put(chat)
  return chat
}

function parseDev(text: string): { reply: string; suggestions: CoachSuggestion[] } {
  try {
    const o = JSON.parse(text) as { reply?: string; suggestions?: CoachSuggestion[] }
    if (typeof o.reply === 'string' && o.reply.trim()) {
      const effort = (e: string): CoachSuggestion['effort'] => (e === 'S' || e === 'L' ? e : 'M')
      return {
        reply: o.reply.trim(),
        suggestions: (o.suggestions ?? [])
          .filter((x) => x && x.title && x.detail)
          .slice(0, 4)
          .map((x) => ({ title: x.title.trim(), detail: x.detail.trim(), effort: effort(x.effort), area: (x.area || 'Genel').trim() })),
      }
    }
  } catch {
    // Şemaya uymadıysa metni olduğu gibi göster
  }
  return { reply: text.trim(), suggestions: [] }
}

/** Geliştirici danışmanı: yanıt + (varsa) yapılandırılmış öneriler. */
export async function sendDev(chat: CoachChat, text: string): Promise<CoachChat> {
  const now = new Date().toISOString()
  const userTurn: CoachTurn = text.trim()
    ? { role: 'user', text: text.trim(), at: now }
    : {
        role: 'user',
        text: '(Sohbeti başlat: kendini bir cümleyle tanıt, yol haritası ve kullanım verisine bakarak uygulamanın şu anki durumunu kısaca değerlendir ve en değerli 2-3 öneriyi ver.)',
        hidden: true,
        at: now,
      }
  let next: CoachChat = { ...chat, messages: [...chat.messages, userTurn] }
  next = await maybeSummarize(next)
  const r = await generateChat(await devSystem(next), historyFor(next), 0.6, { jsonSchema: DEV_SCHEMA })
  const out = parseDev(r.text)
  const modelTurn: CoachTurn = {
    role: 'model',
    text: out.reply,
    suggestions: out.suggestions.length ? out.suggestions : undefined,
    meta: metaOf(r),
    at: new Date().toISOString(),
  }
  next = { ...next, messages: [...next.messages, modelTurn], updatedAt: modelTurn.at }
  await db.coachChats.put(next)
  return next
}

/** Öneriyi "Öneriler" listesine ekler. */
export async function addSuggestion(userId: string, s: CoachSuggestion, chatId?: string): Promise<void> {
  const now = new Date().toISOString()
  await db.suggestions.put({ ...s, id: crypto.randomUUID(), userId, status: 'yeni', chatId, createdAt: now, updatedAt: now })
}

/** Sohbetin moduna göre gönderir. */
export function sendMessage(chat: CoachChat, text: string): Promise<CoachChat> {
  if (chat.mode === 'yds') return sendYds(chat, text)
  if (chat.mode === 'dev') return sendDev(chat, text)
  return sendEnglish(chat, text)
}

export async function deleteChat(id: string): Promise<void> {
  await db.coachChats.delete(id)
}
