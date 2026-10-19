import { db } from '../db'
import { useSettings } from '../stores/settings'
import type { MemoryCategory, MemoryNote } from '../types/database'
import { generate } from './ai'
import { dayKey, daysUntil, streakFromDays } from './dates'
import { summarizeBySection } from './examProgress'
import { isWeakCard } from './groups'
import { getSection } from './ydsSections'

// "Beni tanısın": otomatik öğrenci profili (uygulama verisinden, yapay zekâsız) ve kullanıcının onayladığı
// hafıza notları. İkisi de yalnızca bu cihazda durur; yapay zekâya yalnızca istek anında bağlam olarak gider.

export const MEMORY_CATEGORIES: Record<MemoryCategory, { label: string; icon: string }> = {
  hata: { label: 'Tekrar eden hata', icon: '⚠️' },
  konu: { label: 'Konu durumu', icon: '📘' },
  tercih: { label: 'Öğrenme tercihi', icon: '🎛️' },
  kisisel: { label: 'Kişisel bağlam', icon: '👤' },
}

// ---------------------------------------------------------------------------
// Otomatik profil
// ---------------------------------------------------------------------------

/** Uygulama verisinden kısa bir öğrenci profili (Türkçe, ~150 kelime). Yapay zekâ kullanılmaz. */
export async function buildProfile(userId: string): Promise<string> {
  const [answers, cards, words, logs, mocks] = await Promise.all([
    db.examAnswers.where('userId').equals(userId).toArray(),
    db.cardStates.where('userId').equals(userId).toArray(),
    db.words.where('userId').equals(userId).filter((w) => !w.isDeleted).toArray(),
    db.reviewLogs.where('userId').equals(userId).toArray(),
    db.mockResults.where('userId').equals(userId).toArray(),
  ])
  const { exam } = useSettings.getState()
  const lines: string[] = []

  const days = daysUntil(exam.targetExamDate)
  lines.push(`Hedef: ${exam.targetExamName}${days !== null ? `, sınava ${days} gün var` : ''}; hedef puan ${exam.targetScore}.`)

  const active = new Set(logs.map((l) => dayKey(l.reviewedAt)))
  for (const a of answers) active.add(dayKey(a.answeredAt))
  const last30 = dayKey(Date.now() - 29 * 86_400_000)
  lines.push(`Çalışma: şu anki seri ${streakFromDays(active)} gün; son 30 günde ${[...active].filter((d) => d >= last30).length} gün çalıştı.`)

  const learned = cards.filter((c) => c.reps > 0 && (c.masteryScore ?? 0) >= 4).length
  const started = cards.filter((c) => c.reps > 0).length
  lines.push(`Kelime: havuzda ${words.length} kelime; ${started} tanesi çalışıldı, ${learned} tanesi iyi biliniyor (4-5 puan).`)
  const wordById = new Map(words.map((w) => [w.id, w.term]))
  const weak = cards
    .filter((c) => isWeakCard(c))
    .map((c) => wordById.get(c.wordId))
    .filter(Boolean)
    .slice(0, 12)
  if (weak.length) lines.push(`Zorlandığı kelimeler: ${weak.join(', ')}.`)

  if (answers.length) {
    const correct = answers.filter((a) => a.correct).length
    const stats = summarizeBySection(answers).filter((s) => s.answered >= 3 && s.percent !== null)
    const bySec = stats.map((s) => `${getSection(s.key).label} %${s.percent} (${s.answered})`).join(', ')
    lines.push(`Çıkmış sorular: ${answers.length} soru çözdü, başarı %${Math.round((correct / answers.length) * 100)}.${bySec ? ` Tiplere göre: ${bySec}.` : ''}`)
    const weakest = [...stats].sort((a, b) => (a.percent ?? 0) - (b.percent ?? 0)).slice(0, 2)
    if (weakest.length) lines.push(`En zayıf soru tipleri: ${weakest.map((s) => getSection(s.key).label).join(', ')}.`)
    const book = answers.filter((a) => a.inWrongBook)
    if (book.length) {
      const counts = new Map<string, number>()
      for (const a of book) counts.set(a.section, (counts.get(a.section) ?? 0) + 1)
      const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
      lines.push(`Yanlış Defteri: ${book.length} soru (en çok ${top.map(([k, n]) => `${getSection(k as never).label} ${n}`).join(', ')}).`)
    }
  }

  if (mocks.length) {
    const lastMocks = [...mocks].sort((a, b) => a.finishedAt.localeCompare(b.finishedAt)).slice(-3)
    lines.push(`Deneme puanları (eskiden yeniye): ${lastMocks.map((m) => m.score.toLocaleString('tr-TR')).join(' → ')}.`)
  }
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Hafıza notları
// ---------------------------------------------------------------------------

export function listNotes(userId: string): Promise<MemoryNote[]> {
  return db.memoryNotes.where('[userId+updatedAt]').between([userId, ''], [userId, '￿']).reverse().toArray()
}

export async function addNotes(userId: string, notes: { text: string; category: MemoryCategory }[], source: string): Promise<void> {
  const now = new Date().toISOString()
  await db.memoryNotes.bulkPut(
    notes
      .filter((n) => n.text.trim())
      .map((n) => ({ id: crypto.randomUUID(), userId, text: n.text.trim(), category: n.category, source, createdAt: now, updatedAt: now })),
  )
}

export async function updateNote(id: string, patch: Partial<Pick<MemoryNote, 'text' | 'category'>>): Promise<void> {
  await db.memoryNotes.update(id, { ...patch, updatedAt: new Date().toISOString() })
}

export async function deleteNote(id: string): Promise<void> {
  await db.memoryNotes.delete(id)
}

/** Yapay zekâya verilecek bağlam metni. `profile` açıksa otomatik profil de eklenir. */
export async function memoryContext(userId: string, { profile }: { profile: boolean }): Promise<string> {
  const notes = await listNotes(userId)
  const parts: string[] = []
  if (profile) parts.push('ÖĞRENCİ PROFİLİ (uygulama verisinden):', await buildProfile(userId))
  if (notes.length) {
    parts.push(
      'HAFIZA NOTLARI (öğrencinin onayladığı gözlemler):',
      ...notes.slice(0, 30).map((n) => `- [${MEMORY_CATEGORIES[n.category]?.label ?? n.category}] ${n.text}`),
    )
  }
  return parts.join('\n')
}

// ---------------------------------------------------------------------------
// "Hafızaya kaydet": sohbetten not önerisi
// ---------------------------------------------------------------------------

const EXTRACT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    notes: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          text: { type: 'STRING' },
          category: { type: 'STRING', enum: ['hata', 'konu', 'tercih', 'kisisel'] },
        },
        required: ['text', 'category'],
      },
    },
  },
  required: ['notes'],
}

export interface NoteSuggestion {
  text: string
  category: MemoryCategory
}

/**
 * Bir sohbet dökümünden kalıcı hafıza notu önerileri çıkarır. Kaydetmez; kullanıcı seçip onaylar.
 * `transcript` düz metindir (kim ne dedi, varsa düzeltmeler).
 */
export async function suggestNotes(userId: string, transcript: string): Promise<NoteSuggestion[]> {
  const existing = await listNotes(userId)
  const prompt = [
    'Aşağıda bir YDS / İngilizce öğrencisinin yapay zekâyla sohbeti var.',
    '',
    'MEVCUT NOTLAR (bunları tekrar yazma):',
    existing.length ? existing.map((n) => `- ${n.text}`).join('\n') : '(yok)',
    '',
    'SOHBET:',
    transcript.slice(-12000),
    '',
    'Görev: İleride bu öğrenciye daha iyi yardım etmek için saklanmaya değer KALICI gözlemleri çıkar.',
    '- Yalnızca tekrar eden ya da önemli şeyler: dilbilgisi/kelime karışıklıkları (örn. "unless ile if not’u karıştırıyor"), zorlandığı ya da iyi olduğu konular, öğrenme tercihleri (örn. "örnek cümleyle anlatılınca daha iyi anlıyor"), işe yarar kişisel bağlam (meslek, ilgi alanı).',
    '- Tek seferlik ayrıntıları, sohbetin kendisini ve mevcut notlarla aynı olanları yazma.',
    '- Her not Türkçe, tek kısa cümle; özne gerekirse "Öğrenci" değil doğrudan durum yaz (örn. "Present perfect ile past simple’ı karıştırıyor.").',
    '- En fazla 5 not. Kalıcı bir gözlem yoksa boş liste döndür.',
    '- category: hata | konu | tercih | kisisel',
  ].join('\n')
  const r = await generate('Bir dil öğrencisi hakkında kısa, doğru ve kalıcı notlar çıkarırsın. Uydurma.', prompt, 0.2, {
    jsonSchema: EXTRACT_SCHEMA,
  })
  try {
    const o = JSON.parse(r.text) as { notes?: NoteSuggestion[] }
    const valid: MemoryCategory[] = ['hata', 'konu', 'tercih', 'kisisel']
    return (o.notes ?? [])
      .filter((n) => n && typeof n.text === 'string' && n.text.trim())
      .map((n) => ({ text: n.text.trim(), category: valid.includes(n.category) ? n.category : 'konu' }))
      .slice(0, 5)
  } catch {
    return []
  }
}
