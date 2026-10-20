import { useSyncExternalStore } from 'react'
import { pageLabel } from './notebook'

// Kaydedilenler (☆ ile elle) ve sık kullanılanlar (ziyaret sayısına göre) — kişisel kolaylık, tarayıcı deposunda.

export interface SavedPage {
  path: string
  label: string
  at: string
}

/** Menüde zaten olan ya da kendi başına anlamsız sayfalar sık kullanılanlara girmez. */
const NOT_FREQUENT = new Set(['/', '/calis', '/words', '/stats', '/settings'])
const EVENT = 'yds-favorites-changed'

const savedKey = (userId: string) => `yds-saved:${userId}`
const visitsKey = (userId: string) => `yds-visits:${userId}`
const hiddenKey = (userId: string) => `yds-frequent-hidden:${userId}`

/** Sık kullanılanlardan kaldır (×): o sayfa bu listede bir daha önerilmez. */
export function hideFrequent(userId: string, path: string): void {
  write(hiddenKey(userId), [...new Set([...read<string[]>(hiddenKey(userId), []), path])])
}

function read<T>(key: string, fallback: T): T {
  try {
    return (JSON.parse(localStorage.getItem(key) || 'null') as T) ?? fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Depo kapalıysa yalnızca bu oturumda kaybolur
  }
  window.dispatchEvent(new Event(EVENT))
}

/** Kaydedilecek adres: otomatik başlatma gibi tek seferlik parametreler atılır. */
export function cleanPath(pathname: string, search = ''): string {
  const p = new URLSearchParams(search)
  p.delete('auto')
  p.delete('resume')
  const q = p.toString()
  return (pathname.replace(/\/+$/, '') || '/') + (q ? `?${q}` : '')
}

export function labelFor(path: string): string {
  const [pathname, search] = path.split('?')
  const base = pageLabel(pathname)
  const p = new URLSearchParams(search)
  if (p.get('preset') === 'due') return 'Günün tekrarları'
  const mode = p.get('mode')
  if (mode === 'cloze') return 'Cümle içinde kelime'
  if (mode === 'listen') return 'Dinleyerek kelime'
  return base
}

export function getSaved(userId: string): SavedPage[] {
  return read<SavedPage[]>(savedKey(userId), [])
}

export function isSaved(userId: string, path: string): boolean {
  return getSaved(userId).some((s) => s.path === path)
}

export function toggleSaved(userId: string, path: string): void {
  const list = getSaved(userId)
  write(
    savedKey(userId),
    list.some((s) => s.path === path)
      ? list.filter((s) => s.path !== path)
      : [...list, { path, label: labelFor(path), at: new Date().toISOString() }],
  )
}

export function recordVisit(userId: string, pathname: string): void {
  const path = cleanPath(pathname)
  if (NOT_FREQUENT.has(path)) return
  const visits = read<Record<string, number>>(visitsKey(userId), {})
  visits[path] = (visits[path] ?? 0) + 1
  write(visitsKey(userId), visits)
}

/** En çok açılan sayfalar (en az 2 kez, kaydedilmiş olanlar hariç). */
export function getFrequent(userId: string, limit = 6): { path: string; label: string }[] {
  const saved = new Set(getSaved(userId).map((s) => s.path))
  const hidden = read<string[]>(hiddenKey(userId), [])
  return Object.entries(read<Record<string, number>>(visitsKey(userId), {}))
    .filter(([path, n]) => n >= 2 && !saved.has(path) && !hidden.includes(path))
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([path]) => ({ path, label: labelFor(path) }))
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb)
  window.addEventListener('storage', cb)
  return () => {
    window.removeEventListener(EVENT, cb)
    window.removeEventListener('storage', cb)
  }
}

/** Değişince yeniden çizilsin diye depodaki ham metni izler. */
export function useFavoritesVersion(userId: string): string {
  return useSyncExternalStore(subscribe, () => {
    try {
      return `${localStorage.getItem(savedKey(userId))}|${localStorage.getItem(visitsKey(userId))}|${localStorage.getItem(hiddenKey(userId))}`
    } catch {
      return ''
    }
  })
}
