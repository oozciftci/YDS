import { useSettings } from '../stores/settings'

// Gemini API istemcisi. Önce ücretli anahtar (faturalı proje) denenir; bakiye bittiğinde (402), harcama
// sınırına ya da kotaya takıldığında (429/403) veya uygulamanın aylık üst sınırı aşıldığında ücretsiz
// katmandaki yedek anahtara geçilir. Anahtarlar yalnızca bu cihazdaki ayarlarda durur.

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models'

export interface AiModel {
  id: string
  label: string
}

export const AI_MODELS: AiModel[] = [
  { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash — en yeni (önerilen)' },
  { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash' },
  { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite — en ucuz, hızlı' },
  { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash-Lite' },
]

/** USD / 1M token (giriş, çıkış). Tahmin içindir; kesin tutar AI Studio > Dashboard > Usage'da görünür. */
function pricePerMillion(model: string, at = new Date()): [number, number] {
  const after2026 = at >= new Date('2027-01-01T00:00:00Z')
  switch (model) {
    case 'gemini-3.8-flash':
    case 'gemini-3.6-flash':
      return after2026 ? [1.5, 7.5] : [0.75, 3.75]
    case 'gemini-3.5-flash-lite':
      return [0.3, 2.5]
    case 'gemini-3.1-flash-lite':
      return [0.25, 1.5]
    default:
      return [1.5, 7.5] // Bilinmeyen model: temkinli tahmin
  }
}

// ---------------------------------------------------------------------------
// Aylık kullanım (tahmini maliyet) — kişisel kolaylık, tarayıcı deposunda
// ---------------------------------------------------------------------------

export interface AiUsage {
  month: string
  paidUsd: number
  paidCalls: number
  freeCalls: number
  /** Ücretli anahtar en son ne zaman bakiye/limit hatası verdi (ISO). */
  paidBlockedAt?: string
  paidBlockedReason?: string
}

const USAGE_KEY = 'yds-ai-usage'
/** Ücretli anahtar hata verdikten sonra yeniden denemeden önce beklenen süre (bakiye yüklenmiş olabilir). */
const PAID_RETRY_MS = 6 * 60 * 60 * 1000

function thisMonth() {
  return new Date().toISOString().slice(0, 7)
}

export function getAiUsage(): AiUsage {
  const empty: AiUsage = { month: thisMonth(), paidUsd: 0, paidCalls: 0, freeCalls: 0 }
  try {
    const u = JSON.parse(localStorage.getItem(USAGE_KEY) || 'null') as AiUsage | null
    if (!u || u.month !== empty.month) return { ...empty, paidBlockedAt: u?.paidBlockedAt, paidBlockedReason: u?.paidBlockedReason }
    return u
  } catch {
    return empty
  }
}

function saveUsage(u: AiUsage) {
  try {
    localStorage.setItem(USAGE_KEY, JSON.stringify(u))
  } catch {
    // yoksay
  }
}

/** Ücretli anahtarı yeniden denemeye aç (örn. bakiye yüklendikten sonra). */
export function resetPaidBlock(): void {
  const u = getAiUsage()
  delete u.paidBlockedAt
  delete u.paidBlockedReason
  saveUsage(u)
}

// ---------------------------------------------------------------------------
// İstek
// ---------------------------------------------------------------------------

export class AiError extends Error {
  readonly status: number
  constructor(message: string, status = 0) {
    super(message)
    this.status = status
  }
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[]
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number }
  error?: { code?: number; message?: string; status?: string }
}

async function call(key: string, model: string, system: string, prompt: string, temperature: number) {
  const res = await fetch(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature },
    }),
  })
  const data = (await res.json().catch(() => ({}))) as GeminiResponse
  if (!res.ok) throw new AiError(data.error?.message || `HTTP ${res.status}`, res.status)
  const text = (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('').trim()
  if (!text) throw new AiError('Model boş yanıt döndürdü (' + (data.candidates?.[0]?.finishReason ?? 'bilinmiyor') + ').', 200)
  const u = data.usageMetadata ?? {}
  return { text, inTokens: u.promptTokenCount ?? 0, outTokens: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0) }
}

/** Ücretliden ücretsize geçmeyi gerektiren hata mı (bakiye, harcama sınırı, kota, faturalandırma)? */
function isBillingOrQuota(e: unknown): boolean {
  return e instanceof AiError && (e.status === 402 || e.status === 429 || e.status === 403)
}

function friendly(e: unknown, tier: 'paid' | 'free'): string {
  if (!(e instanceof AiError)) return 'Bağlantı kurulamadı. İnternet bağlantını kontrol et.'
  if (e.status === 400 && /api key/i.test(e.message)) return 'API anahtarı geçersiz. Ayarlar > Yapay Zekâ’dan kontrol et.'
  if (e.status === 404) return 'Seçili model bulunamadı. Ayarlar’dan başka bir model seç.'
  if (e.status === 429 && tier === 'free') return 'Ücretsiz katmanın sınırı doldu; birkaç dakika sonra (günlük sınırsa ertesi gün) yeniden dene.'
  if (e.status === 402) return 'Ücretli bakiye bitti ve yedek (ücretsiz) anahtar tanımlı değil.'
  return `Gemini hatası (${e.status}): ${e.message}`
}

export interface AiResult {
  text: string
  tier: 'paid' | 'free'
  model: string
  usd: number
}

export function aiConfigured(): boolean {
  const { paidKey, freeKey } = useSettings.getState().ai
  return Boolean(paidKey.trim() || freeKey.trim())
}

/**
 * Gemini'ye bir istek gönderir; ücretli → ücretsiz geçişini kendisi yönetir.
 * Hata mesajları Türkçe ve kullanıcıya gösterilebilir.
 */
export async function generate(system: string, prompt: string, temperature = 0.4): Promise<AiResult> {
  const { paidKey, freeKey, model, monthlyLimitUsd } = useSettings.getState().ai
  const usage = getAiUsage()
  const blockedRecently = usage.paidBlockedAt && Date.now() - new Date(usage.paidBlockedAt).getTime() < PAID_RETRY_MS
  const overLimit = monthlyLimitUsd > 0 && usage.paidUsd >= monthlyLimitUsd
  const tryPaid = Boolean(paidKey.trim()) && !blockedRecently && !overLimit

  if (!paidKey.trim() && !freeKey.trim()) throw new AiError('Yapay zekâ için önce Ayarlar > Yapay Zekâ bölümünden bir Gemini anahtarı ekle.')

  if (tryPaid) {
    try {
      const r = await call(paidKey.trim(), model, system, prompt, temperature)
      const [pin, pout] = pricePerMillion(model)
      const usd = (r.inTokens * pin + r.outTokens * pout) / 1_000_000
      const u = getAiUsage()
      saveUsage({ ...u, paidUsd: u.paidUsd + usd, paidCalls: u.paidCalls + 1, paidBlockedAt: undefined, paidBlockedReason: undefined })
      return { text: r.text, tier: 'paid', model, usd }
    } catch (e) {
      if (!isBillingOrQuota(e) || !freeKey.trim()) throw new AiError(friendly(e, 'paid'), e instanceof AiError ? e.status : 0)
      saveUsage({ ...getAiUsage(), paidBlockedAt: new Date().toISOString(), paidBlockedReason: (e as AiError).message })
    }
  }

  if (!freeKey.trim()) {
    throw new AiError(
      overLimit
        ? `Bu ayki ücretli üst sınıra (${monthlyLimitUsd} $) ulaşıldı ve yedek (ücretsiz) anahtar tanımlı değil.`
        : 'Ücretli anahtar şu an kullanılamıyor ve yedek (ücretsiz) anahtar tanımlı değil.',
    )
  }
  try {
    const r = await call(freeKey.trim(), model, system, prompt, temperature)
    const u = getAiUsage()
    saveUsage({ ...u, freeCalls: u.freeCalls + 1 })
    return { text: r.text, tier: 'free', model, usd: 0 }
  } catch (e) {
    throw new AiError(friendly(e, 'free'), e instanceof AiError ? e.status : 0)
  }
}

/** Tek bir anahtarı küçük bir istekle dener (Ayarlar > Bağlantıyı test et). */
export async function testKey(key: string, model: string): Promise<{ ok: boolean; message: string }> {
  try {
    const r = await call(key.trim(), model, 'Answer with one word.', 'Say OK.', 0)
    return { ok: true, message: `Çalışıyor (yanıt: "${r.text.slice(0, 20)}")` }
  } catch (e) {
    if (e instanceof AiError && e.status === 402) return { ok: false, message: 'Bakiye yok (402). AI Studio’da kredi yükle.' }
    if (e instanceof AiError && e.status === 429) return { ok: false, message: 'Kota / harcama sınırı dolu (429).' }
    return { ok: false, message: friendly(e, 'paid') }
  }
}
