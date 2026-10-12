import { create } from 'zustand'

/**
 * Tarayıcı depolama kotası ve kalıcılık (persist) durumu.
 * persist() verildiğinde tarayıcı, disk dolsa bile IndexedDB verimizi
 * kendiliğinden silmez -> çevrimdışı veri güvenliği için kritik.
 */
interface StorageState {
  usageBytes: number | null
  quotaBytes: number | null
  persisted: boolean | null
  refresh: () => Promise<void>
  requestPersist: () => Promise<boolean>
}

export const useStorageInfo = create<StorageState>((set, get) => ({
  usageBytes: null,
  quotaBytes: null,
  persisted: null,
  async refresh() {
    if (!navigator.storage) return
    const [est, persisted] = await Promise.all([
      navigator.storage.estimate?.() ?? Promise.resolve({} as StorageEstimate),
      navigator.storage.persisted?.() ?? Promise.resolve(false),
    ])
    set({ usageBytes: est.usage ?? null, quotaBytes: est.quota ?? null, persisted })
  },
  async requestPersist() {
    if (!navigator.storage?.persist) return false
    const granted = await navigator.storage.persist()
    await get().refresh()
    return granted
  },
}))

export function formatBytes(n: number | null): string {
  if (n == null) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let v = n
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`
}
