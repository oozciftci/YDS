import { useEffect, useSyncExternalStore } from 'react'
import { useLocation } from 'react-router-dom'

// "Bu sayfa" notu ve yapışkan notlar hangi sayfaya ait? Varsayılan: adres (pathname). Soruların adresi değişmeden
// önceki/sonraki ile gezildiği ekranlar (sınav, DUS, alıştırma) o anki soruyu bildirir; not o soruya bağlanır,
// başka soruya geçince görünmez, aynı soruya dönünce yeniden görünür.

let current: string | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

/**
 * Ekran o an gösterdiği soruyu bildirir.
 * - "Soru 12" gibi bir etiket → adres + "#Soru 12"
 * - "/" ile başlayan tam anahtar → olduğu gibi (aynı soru farklı ekranlarda açılsa da aynı not; ör. DUS)
 * - null → yalnızca adres
 */
export function useNoteSub(key: string | null | undefined) {
  useEffect(() => {
    if (!key) return
    current = key
    emit()
    return () => {
      if (current === key) {
        current = null
        emit()
      }
    }
  }, [key])
}

/** Notların bağlandığı anahtar: adres, ekran bir soru bildirdiyse ona özgü. */
export function useNotePageKey(): string {
  const { pathname } = useLocation()
  const sub = useSyncExternalStore(subscribe, () => current)
  const base = pathname.replace(/\/+$/, '') || '/'
  if (!sub) return base
  return sub.startsWith('/') ? sub : `${base}#${sub}`
}

/** Denemeler için: o an bildirilmiş soru (yoksa null). */
export const currentNoteSub = () => current
