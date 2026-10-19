/** Yerel saate göre gün anahtarı (YYYY-AA-GG). ISO (UTC) dilimi Türkiye'de gece 00-03 arasını önceki güne yazar. */
export function dayKey(d: Date | string | number): string {
  const x = new Date(d)
  const m = String(x.getMonth() + 1).padStart(2, '0')
  const day = String(x.getDate()).padStart(2, '0')
  return `${x.getFullYear()}-${m}-${day}`
}

/** Bugünden `target` tarihine kalan tam gün (geçmişse 0). */
export function daysUntil(target: string, now = Date.now()): number | null {
  if (!target) return null
  const t = new Date(target + 'T00:00:00').getTime()
  if (Number.isNaN(t)) return null
  const today = new Date(dayKey(now) + 'T00:00:00').getTime()
  return Math.max(0, Math.round((t - today) / 86_400_000))
}

/** Ardışık çalışma günü serisi: bugün çalışılmadıysa dünden geriye sayılır. */
export function streakFromDays(days: Set<string>, now = Date.now()): number {
  const cursor = new Date(now)
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1)
  let streak = 0
  while (days.has(dayKey(cursor))) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}
