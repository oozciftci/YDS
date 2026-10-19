import { guessGrammarTopics } from '../../data/grammar'
import { db } from '../../db'
import { generate } from '../../services/ai'
import { appMapText, isKnownRoute } from '../../services/appMap'
import { summarizeBySection } from '../../services/examProgress'
import { listNotes, type NoteSuggestion } from '../../services/memory'
import { COACH_MODE_RULES, tacticsContext } from '../../services/tactics'
import { getSection, sectionOf, type SectionKey } from '../../services/ydsSections'
import type { MemoryCategory } from '../../types/database'
import { loadExam, shortTitle } from './examData'

// "Hatalarımı analiz et" (yalnızca yerel): son yanlışların özetinden tekrar eden kök hataları bulur,
// alıştırma bağlantıları ve hafıza notu önerileri üretir. Son analiz cihazda saklanır (aiNotes, "analysis:last").

/** Analize giren en fazla yanlış sayısı ve analiz için gereken en az sayı. */
export const MAX_ITEMS = 40
export const MIN_ITEMS = 5
const NOTE_ID = 'analysis:last'

export interface AnalysisPattern {
  title: string
  explanation: string
  evidence: string
  advice: string
  links: { label: string; href: string }[]
}

export interface AnalysisResult {
  summary: string
  patterns: AnalysisPattern[]
  notes: NoteSuggestion[]
  createdAt: string
  itemCount: number
  meta: string
}

/** Analize girecek yanlışlar: önce hâlâ yanlış olanlar, sonra sonradan düzeltilmiş olanlar; en yeni önce. */
export async function wrongAnswers(userId: string) {
  const all = await db.examAnswers.where('userId').equals(userId).toArray()
  const current = all.filter((a) => !a.correct).sort((a, b) => b.answeredAt.localeCompare(a.answeredAt))
  const fixed = all.filter((a) => a.correct && a.wrongCount > 0).sort((a, b) => b.answeredAt.localeCompare(a.answeredAt))
  return { all, items: [...current, ...fixed].slice(0, MAX_ITEMS), currentCount: current.length, fixedCount: fixed.length }
}

const clip = (t: string, n: number) => (t.length > n ? t.slice(0, n) + '…' : t)

/** Her yanlış için kısa bir satır grubu (soru metni kısaltılır; okuma paragrafları gönderilmez). */
async function describe(items: Awaited<ReturnType<typeof wrongAnswers>>['items']): Promise<string> {
  const blocks: string[] = []
  for (const a of items) {
    try {
      const { exam } = await loadExam(a.examId)
      const q = exam.questions.find((x) => x.no === a.no)
      if (!q || !q.answer) continue
      const sec = sectionOf(q.no)
      const stem = q.stem.map((s) => s.en).join(' ')
      const opts = Object.entries(q.options)
        .map(([l, o]) => `${l}) ${clip(o.en, 90)}`)
        .join(' | ')
      const topics = sec.key === 'grammar' || sec.key === 'cloze' ? guessGrammarTopics(Object.values(q.options).map((o) => o.en)).map((t) => t.title) : []
      blocks.push(
        [
          `[${shortTitle(exam.title)} S${q.no} · ${sec.label}${topics.length ? ` · olası konu: ${topics.join(', ')}` : ''}]`,
          stem ? `Soru: ${clip(stem, 320)}` : '(Paragraf boşluğu / paragraf sorusu; paragraf gönderilmedi)',
          `Şıklar: ${opts}`,
          a.correct
            ? `Doğru: ${q.answer}. Önce ${a.wrongCount} kez yanlış yaptı, sonra düzeltti.`
            : `Doğru: ${q.answer}. Öğrencinin cevabı: ${a.choice} (yanlış${a.wrongCount > 1 ? `, ${a.wrongCount}. kez` : ''}).`,
        ].join('\n'),
      )
    } catch {
      // Sınav dosyası yoksa atla
    }
  }
  return blocks.join('\n\n')
}

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    summary: { type: 'STRING' },
    patterns: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          explanation: { type: 'STRING' },
          evidence: { type: 'STRING' },
          advice: { type: 'STRING' },
          links: {
            type: 'ARRAY',
            items: { type: 'OBJECT', properties: { label: { type: 'STRING' }, href: { type: 'STRING' } }, required: ['label', 'href'] },
          },
        },
        required: ['title', 'explanation', 'evidence', 'advice', 'links'],
      },
    },
    notes: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { text: { type: 'STRING' }, category: { type: 'STRING', enum: ['hata', 'konu', 'tercih', 'kisisel'] } },
        required: ['text', 'category'],
      },
    },
  },
  required: ['summary', 'patterns', 'notes'],
}

const SYSTEM = [
  'Sen deneyimli bir YDS öğretmeni ve sınav koçusun. Türk bir öğrencinin yanlış yaptığı çıkmış YDS sorularını inceliyorsun. Türkçe yaz.',
  'Amaç: tek tek soruları açıklamak değil, yanlışların ALTINDA YATAN tekrar eden kök hataları bulmak (örn. "zıtlık bağlaçlarında yapıya (cümle / isim öbeği) bakmıyor", "okumada metinde olmayan çıkarım yapıyor", "çeviri sorularında zaman uyumunu kaçırıyor").',
  'Kurallar:',
  '- "summary": genel tablo, 2-4 cümle; güçlü yanını da söyle.',
  '- "patterns": en fazla 5 kök hata; en sık / en etkili olan önce. "explanation" hatanın ne olduğu ve neden yapılıyor olabileceği; "evidence" bunu gösteren 2-4 soru (örn. "2019 Mart S12, 2021 Nisan S8"); "advice" somut çalışma önerisi (ne yapmalı, nasıl fark etmeli); "links" en fazla 2 bağlantı, YALNIZCA aşağıdaki UYGULAMA HARİTASI’ndaki adreslerden (href tam olarak listedeki gibi).',
  '- Kanıtı zayıf bir örüntü uydurma; az veri varsa bunu söyle.',
  '- "notes": öğrencinin hafızasına eklenmeye değer kalıcı gözlemler (en fazla 4, tek kısa cümle, Türkçe). Mevcut notlarla aynı olanları yazma.',
].join('\n')

export async function runAnalysis(userId: string, opts: { koc: boolean }): Promise<AnalysisResult> {
  const { all, items } = await wrongAnswers(userId)
  const [described, notes] = await Promise.all([describe(items), listNotes(userId)])
  const stats = summarizeBySection(all)
    .filter((s) => s.answered > 0)
    .map((s) => `${getSection(s.key).label} %${s.percent} (${s.answered} soru)`)
    .join(', ')
  const sections = [...new Set(items.map((a) => a.section as SectionKey))]
  const tactics = opts.koc ? await tacticsContext({ sections }) : ''

  const system = [SYSTEM, '', 'UYGULAMA HARİTASI:', appMapText(), ...(tactics ? ['', COACH_MODE_RULES, tactics] : [])].join('\n')
  const prompt = [
    `Soru tiplerine göre genel başarı: ${stats || 'veri yok'}.`,
    '',
    'MEVCUT HAFIZA NOTLARI:',
    notes.length ? notes.map((n) => `- ${n.text}`).join('\n') : '(yok)',
    '',
    `YANLIŞLAR (${items.length}, en yeni önce):`,
    described,
  ].join('\n')

  const r = await generate(system, prompt, 0.3, { jsonSchema: SCHEMA })
  let parsed: { summary?: string; patterns?: AnalysisPattern[]; notes?: NoteSuggestion[] } = {}
  try {
    parsed = JSON.parse(r.text)
  } catch {
    parsed = { summary: r.text }
  }
  const valid: MemoryCategory[] = ['hata', 'konu', 'tercih', 'kisisel']
  const result: AnalysisResult = {
    summary: (parsed.summary ?? '').trim(),
    patterns: (parsed.patterns ?? []).slice(0, 5).map((p) => ({
      title: p.title?.trim() ?? '',
      explanation: p.explanation?.trim() ?? '',
      evidence: p.evidence?.trim() ?? '',
      advice: p.advice?.trim() ?? '',
      // Yalnızca uygulamada gerçekten var olan sayfalar
      links: (p.links ?? []).filter((l) => l?.href && isKnownRoute(l.href)).slice(0, 2),
    })),
    notes: (parsed.notes ?? [])
      .filter((n) => n?.text?.trim())
      .slice(0, 4)
      .map((n) => ({ text: n.text.trim(), category: valid.includes(n.category) ? n.category : 'hata' })),
    createdAt: new Date().toISOString(),
    itemCount: items.length,
    meta: `${r.model} · ${r.tier === 'paid' ? `ücretli (~${r.usd.toFixed(4)} $)` : 'ücretsiz katman'}${tactics ? ' · 📒 Koç (kaynaklı)' : ' · ✨ Saf Gemini'}`,
  }
  await db.aiNotes.put({ id: NOTE_ID, kind: 'analysis', text: JSON.stringify(result), model: r.model, createdAt: result.createdAt })
  return result
}

/** Kayıtlı son analiz (yoksa null). */
export async function lastAnalysis(): Promise<AnalysisResult | null> {
  const n = await db.aiNotes.get(NOTE_ID)
  if (!n) return null
  try {
    return JSON.parse(n.text) as AnalysisResult
  } catch {
    return null
  }
}

