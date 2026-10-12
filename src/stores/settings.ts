import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

/**
 * Uygulama ayarları. Backend adresleri ve anahtarlar ASLA koda gömülmez;
 * yalnızca burada (localStorage) tutulur ve tüm ağ katmanı değerleri
 * `getBackendConfig()` üzerinden okur.
 */
export interface BackendSettings {
  /** Örn: https://xyzcompany.supabase.co */
  url: string
  /** Supabase "anon/public" anahtarı. Service-role anahtarı GİRİLMEMELİ. */
  anonKey: string
}

export interface SettingsState {
  backend: BackendSettings
  setBackend: (patch: Partial<BackendSettings>) => void
  resetBackend: () => void
}

export const SETTINGS_STORAGE_KEY = 'yds.settings'

const emptyBackend: BackendSettings = { url: '', anonKey: '' }

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      backend: emptyBackend,
      setBackend: (patch) => set((s) => ({ backend: { ...s.backend, ...patch } })),
      resetBackend: () => set({ backend: emptyBackend }),
    }),
    {
      name: SETTINGS_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ backend: s.backend }),
    },
  ),
)

/** Ağ katmanı için tek giriş noktası: her çağrıda güncel değeri okur. */
export function getBackendConfig(): BackendSettings | null {
  const { url, anonKey } = useSettings.getState().backend
  if (!url || !anonKey) return null
  return { url: normalizeUrl(url), anonKey }
}

export function normalizeUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, '')
}

export function isValidHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw.trim())
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch {
    return false
  }
}
