import { useSyncExternalStore } from 'react'

// Listelerden "×" ile kaldırılanlar (son çalışılanlar, devam et, sık kullanılanlar…). Kişisel kolaylık, tarayıcı deposunda.
// Kayıt silinmez; yalnızca gizlenir. Öğe daha sonra yeniden çalışılırsa (zamanı kaldırma anından yeniyse) tekrar görünür.

const EVENT = 'yds-dismissed-changed'
const key = (userId: string, list: string) => `yds-dismissed:${userId}:${list}`

function read(userId: string, list: string): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(key(userId, list)) || '{}') as Record<string, string>
  } catch {
    return {}
  }
}

export function dismiss(userId: string, list: string, id: string): void {
  try {
    localStorage.setItem(key(userId, list), JSON.stringify({ ...read(userId, list), [id]: new Date().toISOString() }))
  } catch {
    // Depo kapalıysa yalnızca bu oturumda kaybolur
  }
  window.dispatchEvent(new Event(EVENT))
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb)
  window.addEventListener('storage', cb)
  return () => {
    window.removeEventListener(EVENT, cb)
    window.removeEventListener('storage', cb)
  }
}

/** Gizlenmiş mi: `at` (öğenin son kullanım zamanı) gizleme anından eskiyse gizli kalır. */
export function useDismissed(userId: string, list: string): (id: string, at?: string) => boolean {
  const raw = useSyncExternalStore(subscribe, () => {
    try {
      return localStorage.getItem(key(userId, list)) || '{}'
    } catch {
      return '{}'
    }
  })
  const map = JSON.parse(raw) as Record<string, string>
  return (id, at) => Boolean(map[id]) && (!at || at <= map[id])
}
