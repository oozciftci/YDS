/** Tarayıcıda seslendirme var mı (yoksa dinleme modu gizlenir). */
export function canSpeak(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

const RATE_KEY = 'yds-tts-rate'
export const TTS_RATES = [0.75, 0.9, 1, 1.15] as const

/** Kayıtlı seslendirme hızı (kişisel tercih; varsayılan 0,9 — anlaşılır olması için hafif yavaş). */
export function getSpeechRate(): number {
  try {
    const v = Number(localStorage.getItem(RATE_KEY))
    return v >= 0.5 && v <= 1.5 ? v : 0.9
  } catch {
    return 0.9
  }
}

export function setSpeechRate(rate: number): void {
  try {
    localStorage.setItem(RATE_KEY, String(rate))
  } catch {
    // Depo kapalıysa yalnızca bu oturumda geçerli
  }
}

export type SpeechLang = 'en' | 'tr'

function englishVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices()
  return (
    voices.find((v) => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('David') || v.name.includes('Google'))) ||
    voices.find((v) => v.lang.startsWith('en'))
  )
}

function turkishVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('tr'))
  return voices.find((v) => v.name.includes('Natural') || v.name.includes('Online')) || voices[0]
}

/** Cihazda Türkçe ses var mı (yoksa tarayıcı Türkçe metni İngilizce sesle okuyabilir). Sesler geç yüklenebilir. */
export function hasTurkishVoice(): boolean {
  return canSpeak() && Boolean(turkishVoice())
}

function utter(text: string, rate: number, lang: SpeechLang = 'en'): SpeechSynthesisUtterance {
  const u = new SpeechSynthesisUtterance(text)
  u.lang = lang === 'tr' ? 'tr-TR' : 'en-US'
  u.rate = rate
  const voice = lang === 'tr' ? turkishVoice() : englishVoice()
  if (voice) u.voice = voice
  return u
}

/** Süren seslendirmeyi durdurur. */
export function stopSpeaking(): void {
  if (!canSpeak()) return
  speechToken++
  window.speechSynthesis.cancel()
}

/**
 * Web Speech API (Metin Seslendirme / Pronunciation)
 */
export function speakWord(text: string): boolean {
  if (!canSpeak()) return false
  try {
    speechToken++
    window.speechSynthesis.cancel() // Önceki seslendirmeyi durdur
    window.speechSynthesis.speak(utter(text, getSpeechRate()))
    return true
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('Ses çalınamadı:', err)
    return false
  }
}

/**
 * Cümleleri sırayla seslendirir. `onSentence(i)` o an okunan cümlenin sırasını, bitince `onDone()`'u çağırır.
 * Dönen fonksiyon okumayı durdurur. Cümle cümle okumak, uzun metinlerde bazı tarayıcıların sesi kesmesini de önler.
 */
export function speakSentences(
  sentences: string[],
  { rate = getSpeechRate(), start = 0, onSentence, onDone }: { rate?: number; start?: number; onSentence?: (i: number) => void; onDone?: () => void } = {},
): () => void {
  return speakQueue(
    sentences.map((text) => ({ text, lang: 'en' as const })),
    { rate, start, onItem: onSentence, onDone },
  )
}

/** Her yeni seslendirme bunu artırır; eski kuyruk araya girildiğini buradan anlar. */
let speechToken = 0

export interface SpeechItem {
  text: string
  lang: SpeechLang
  /** Bu parçadan sonra eklenecek sessizlik (ms). */
  pauseAfter?: number
}

/**
 * Parçaları (İngilizce/Türkçe karışık) sırayla okur. `onItem(i)` okunmaya başlayan parçanın sırası.
 * Dönen fonksiyon okumayı durdurur. Bir parça takılırsa (bazı tarayıcılarda `onend` gelmeyebilir)
 * süre aşımıyla bir sonrakine geçilir; uzun dinlemeler (gece modu) böylece durmaz.
 */
export function speakQueue(
  items: SpeechItem[],
  { rate = getSpeechRate(), start = 0, onItem, onDone }: { rate?: number; start?: number; onItem?: (i: number) => void; onDone?: () => void } = {},
): () => void {
  if (!canSpeak() || items.length === 0) {
    onDone?.()
    return () => {}
  }
  let cancelled = false
  const token = ++speechToken
  let timer: ReturnType<typeof setTimeout> | undefined
  let errors = 0
  // Konuşma nesnesini canlı tut: bazı tarayıcılar çöp toplanan nesnenin onend'ini hiç çağırmaz
  let current: SpeechSynthesisUtterance | null = null
  window.speechSynthesis.cancel()

  const play = (i: number) => {
    clearTimeout(timer)
    if (cancelled) return
    if (i >= items.length) {
      current = null
      onDone?.()
      return
    }
    const item = items[i]
    let settled = false
    const next = (failed: boolean) => {
      if (settled || cancelled) return
      settled = true
      clearTimeout(timer)
      errors = failed ? errors + 1 : 0
      if (errors >= 3) {
        current = null
        onDone?.()
        return
      }
      timer = setTimeout(() => play(i + 1), item.pauseAfter ?? 0)
    }
    const u = utter(item.text, rate, item.lang)
    current = u
    u.onstart = () => !cancelled && onItem?.(i)
    u.onend = () => next(false)
    u.onerror = (e) => {
      if (cancelled) return
      // Başka bir seslendirme araya girdiyse bu okuma biter
      if (token !== speechToken) {
        cancelled = true
        clearTimeout(timer)
        onDone?.()
        return
      }
      // Kendi süre aşımı durdurmamızdan gelen hata yok sayılır
      if (e.error === 'interrupted' || e.error === 'canceled') return
      next(true)
    }
    // Takılma güvencesi: metin uzunluğuna göre cömert bir üst süre
    const limit = Math.max(8000, (item.text.length * 140) / rate)
    timer = setTimeout(() => {
      if (settled || cancelled || token !== speechToken) return
      window.speechSynthesis.cancel()
      next(false)
    }, limit)
    window.speechSynthesis.speak(u)
  }

  play(start)
  return () => {
    cancelled = true
    clearTimeout(timer)
    void current
    current = null
    window.speechSynthesis.cancel()
  }
}

export type ListenOrder = 'en' | 'en-tr' | 'tr-en'

/** Cümlelerden okuma kuyruğu; `refs[i]` i. parçanın hangi cümleye ait olduğu. */
export function buildQueue(
  sentences: { en: string; tr?: string }[],
  order: ListenOrder,
  pause = 350,
): { items: SpeechItem[]; refs: number[] } {
  const items: SpeechItem[] = []
  const refs: number[] = []
  sentences.forEach((s, i) => {
    const en: SpeechItem = { text: s.en, lang: 'en', pauseAfter: pause }
    const tr: SpeechItem | null = s.tr ? { text: s.tr, lang: 'tr', pauseAfter: pause } : null
    const pair = order === 'en' || !tr ? [en] : order === 'en-tr' ? [en, tr] : [tr, en]
    for (const it of pair) {
      items.push(it)
      refs.push(i)
    }
  })
  return { items, refs }
}
