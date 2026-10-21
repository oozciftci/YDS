// Okuma kayıtları (Okuma Modu ve Okuma Kütüphanesi): metin kimliği → süre, kelime, tarih, anlama sorusu sonucu.
// Kişisel kolaylık olarak tarayıcı deposunda; cihazlar arası eşitlemede `yds-*:user_*` anahtarlarıyla taşınır.

export interface ReadLog {
  sec: number
  words: number
  at: string
  /** Okuma hızı gerçekçi değildi (göz gezdirme): okundu sayılır ama hız ortalamasına girmez */
  skim?: boolean
  /** Anlama soruları: doğru / toplam */
  quiz?: { ok: number; all: number }
}

/** Bunun üstü göz gezdirmedir; okuma hızı olarak sayılmaz. */
export const MAX_REAL_WPM = 400

function logKey(userId: string) {
  return `yds-reading:${userId}`
}

export function readLogs(userId: string): Record<string, ReadLog> {
  try {
    return JSON.parse(localStorage.getItem(logKey(userId)) || '{}') as Record<string, ReadLog>
  } catch {
    return {}
  }
}

export function writeLog(userId: string, id: string, log: ReadLog) {
  try {
    localStorage.setItem(logKey(userId), JSON.stringify({ ...readLogs(userId), [id]: log }))
  } catch {
    // Depo kapalıysa sonuç yalnızca ekranda görünür
  }
}

/** Var olan kaydı günceller (anlama sorusu sonucu gibi). */
export function patchLog(userId: string, id: string, patch: Partial<ReadLog>) {
  const cur = readLogs(userId)[id]
  if (cur) writeLog(userId, id, { ...cur, ...patch })
}

export const wpmOf = (l: ReadLog) => Math.round((l.words / Math.max(1, l.sec)) * 60)

/** Okunan metin sayısı ve gerçek okumaların ortalama hızı */
export function readingStats(logs: ReadLog[]): { count: number; wpm: number | null } {
  const real = logs.filter((l) => !l.skim)
  const words = real.reduce((n, l) => n + l.words, 0)
  const sec = real.reduce((n, l) => n + l.sec, 0)
  return { count: logs.length, wpm: sec > 0 ? Math.round((words / sec) * 60) : null }
}

export function fmtDuration(sec: number) {
  const s = Math.max(0, Math.round(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
