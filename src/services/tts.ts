/**
 * Web Speech API (Metin Seslendirme / Pronunciation)
 */
export function speakWord(text: string): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return false
  }

  try {
    window.speechSynthesis.cancel() // Önceki seslendirmeyi durdur

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'en-US'
    utterance.rate = 0.9 // Anlaşılır olması için hafif yavaş

    // Mümkünse İngilizce ses seç
    const voices = window.speechSynthesis.getVoices()
    const enVoice = voices.find((v) => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('David') || v.name.includes('Google')))
      || voices.find((v) => v.lang.startsWith('en'))

    if (enVoice) {
      utterance.voice = enVoice
    }

    window.speechSynthesis.speak(utterance)
    return true
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('Ses çalınamadı:', err)
    return false
  }
}
