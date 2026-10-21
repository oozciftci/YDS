import { create } from 'zustand'

export type ThemeChoice = 'system' | 'light' | 'dark'

const KEY = 'yds-theme'
const media = window.matchMedia('(prefers-color-scheme: dark)')

function readChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {
    // depolama kapalıysa sistem ayarına düş
  }
  return 'system'
}

/** <html data-theme> ve tarayıcı çubuğu rengini seçime göre uygular. */
function applyTheme(choice: ThemeChoice) {
  const root = document.documentElement
  if (choice === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', choice)
  syncThemeColor()
}

/** Tarayıcı/durum çubuğu rengi = o anki zemin (--bg; Görünüm tercihleri de değiştirebilir). */
export function syncThemeColor() {
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()
  if (bg) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg)
}

interface ThemeState {
  theme: ThemeChoice
  setTheme: (t: ThemeChoice) => void
}

export const useTheme = create<ThemeState>((set) => ({
  theme: readChoice(),
  setTheme: (theme) => {
    try {
      localStorage.setItem(KEY, theme)
    } catch {
      // yoksay
    }
    applyTheme(theme)
    set({ theme })
  },
}))

export function initTheme() {
  applyTheme(useTheme.getState().theme)
  media.addEventListener('change', () => applyTheme(useTheme.getState().theme))
}
