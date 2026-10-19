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

function englishVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices()
  return (
    voices.find((v) => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('David') || v.name.includes('Google'))) ||
    voices.find((v) => v.lang.startsWith('en'))
  )
}

function utter(text: string, rate: number): SpeechSynthesisUtterance {
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'en-US'
  u.rate = rate
  const voice = englishVoice()
  if (voice) u.voice = voice
  return u
}

/** Süren seslendirmeyi durdurur. */
export function stopSpeaking(): void {
  if (canSpeak()) window.speechSynthesis.cancel()
}

/**
 * Web Speech API (Metin Seslendirme / Pronunciation)
 */
export function speakWord(text: string): boolean {
  if (!canSpeak()) return false
  try {
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
  if (!canSpeak() || sentences.length === 0) {
    onDone?.()
    return () => {}
  }
  let cancelled = false
  window.speechSynthesis.cancel()
  const play = (i: number) => {
    if (cancelled) return
    if (i >= sentences.length) {
      onDone?.()
      return
    }
    const u = utter(sentences[i], rate)
    u.onstart = () => !cancelled && onSentence?.(i)
    u.onend = () => play(i + 1)
    u.onerror = () => {
      if (!cancelled) onDone?.()
    }
    window.speechSynthesis.speak(u)
  }
  play(start)
  return () => {
    cancelled = true
    window.speechSynthesis.cancel()
  }
}
