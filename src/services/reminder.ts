import { db } from '../db'
import { useSettings } from '../stores/settings'
import { useUserStore } from '../stores/user'
import { dayKey } from './dates'

// Günlük hatırlatma. Sunucu (push) olmadığından yalnızca uygulama ya da sekmesi açıkken çalışır:
// her dakika kontrol eder; seçilen saat geçmişse ve bugün hiç çalışılmamışsa bir kez bildirim gösterir.

const NOTIFIED_KEY = 'yds-reminder-notified'

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

/** Bildirim izni ister; sonuç "granted" | "denied" | "default" | "unsupported". */
export async function requestReminderPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!notificationsSupported()) return 'unsupported'
  if (Notification.permission !== 'default') return Notification.permission
  return Notification.requestPermission()
}

function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

async function studiedToday(userId: string): Promise<boolean> {
  const today = dayKey(Date.now())
  const start = new Date(today + 'T00:00:00').toISOString()
  const reviews = await db.reviewLogs.where('[userId+reviewedAt]').between([userId, start], [userId, '￿']).count()
  if (reviews > 0) return true
  return (await db.examAnswers.where('userId').equals(userId).filter((a) => a.answeredAt >= start).count()) > 0
}

export function showReminder(title: string, body: string): void {
  if (!notificationsSupported() || Notification.permission !== 'granted') return
  const n = new Notification(title, { body, icon: `${import.meta.env.BASE_URL}favicon.svg`, tag: 'yds-daily' })
  n.onclick = () => {
    window.focus()
    n.close()
  }
}

async function tick(): Promise<void> {
  const { reminder } = useSettings.getState()
  if (!reminder.enabled || !notificationsSupported() || Notification.permission !== 'granted') return
  const now = new Date()
  const today = dayKey(now)
  try {
    if (localStorage.getItem(NOTIFIED_KEY) === today) return
  } catch {
    return
  }
  if (now.getHours() * 60 + now.getMinutes() < minutesOf(reminder.time)) return
  const userId = useUserStore.getState().activeUserId
  if (await studiedToday(userId)) return
  showReminder('YDS çalışma zamanı 📚', 'Bugünkü planın seni bekliyor. Birkaç dakikalık tekrar bile seriyi korur.')
  try {
    localStorage.setItem(NOTIFIED_KEY, today)
  } catch {
    // yoksay
  }
}

let started = false

/** Uygulama açılışında bir kez çağrılır. */
export function startReminderLoop(): void {
  if (started || typeof window === 'undefined') return
  started = true
  void tick()
  window.setInterval(() => void tick(), 60_000)
}
