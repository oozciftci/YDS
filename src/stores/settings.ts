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

/** Yeni kelime sırası hangi sınavın sıklığına göre: YDS, YÖKDİL ya da ikisi aynı potada (hangisinde çok geçiyorsa) */
export type FreqSource = 'yds' | 'yokdil' | 'both'

export interface ExamSettings {
  freqSource?: FreqSource
  targetExamName: string
  targetExamDate: string
  targetScore: number
  dailyGoal: number
}

export interface ReminderSettings {
  enabled: boolean
  /** "HH:MM" yerel saat */
  time: string
}

/**
 * Yapay zekâ (Gemini) ayarları. Anahtarlar yalnızca bu cihazda (localStorage) tutulur; koda, GitHub'a ve
 * JSON yedeğine girmez. Ücretli anahtar faturalı projeden, yedek anahtar faturasız (ücretsiz katman) projeden.
 */
export interface AiSettings {
  paidKey: string
  freeKey: string
  model: string
  /** Uygulamanın tahmini aylık ücretli harcama üst sınırı (USD). Aşılınca ücretsiz anahtara geçilir. */
  monthlyLimitUsd: number
}

export interface SettingsState {
  backend: BackendSettings
  exam: ExamSettings
  reminder: ReminderSettings
  setReminder: (patch: Partial<ReminderSettings>) => void
  ai: AiSettings
  setAi: (patch: Partial<AiSettings>) => void
  setBackend: (patch: Partial<BackendSettings>) => void
  resetBackend: () => void
  setExam: (patch: Partial<ExamSettings>) => void
}

export const SETTINGS_STORAGE_KEY = 'yds.settings'

const emptyBackend: BackendSettings = { url: '', anonKey: '' }
const defaultExam: ExamSettings = {
  targetExamName: 'YDS 2026',
  targetExamDate: '2026-11-22',
  targetScore: 80,
  dailyGoal: 20,
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      backend: emptyBackend,
      exam: defaultExam,
      reminder: { enabled: false, time: '20:00' },
      setReminder: (patch) => set((s) => ({ reminder: { ...s.reminder, ...patch } })),
      ai: { paidKey: '', freeKey: '', model: 'gemini-3.8-flash', monthlyLimitUsd: 10 },
      setAi: (patch) => set((s) => ({ ai: { ...s.ai, ...patch } })),
      setBackend: (patch) => set((s) => ({ backend: { ...s.backend, ...patch } })),
      resetBackend: () => set({ backend: emptyBackend }),
      setExam: (patch) => set((s) => ({ exam: { ...s.exam, ...patch } })),
    }),
    {
      name: SETTINGS_STORAGE_KEY,
      version: 2,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ backend: s.backend, exam: s.exam, reminder: s.reminder, ai: s.ai }),
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
