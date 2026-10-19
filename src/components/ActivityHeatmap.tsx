import { useMemo } from 'react'
import { dayKey, streakFromDays } from '../services/dates'
import type { ExamAnswer, ReviewLog } from '../types/database'
import styles from './ActivityHeatmap.module.css'

const WEEKS = 12
const DAY_LABELS = ['Pzt', '', 'Çar', '', 'Cum', '', '']
const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']

function level(n: number): number {
  if (n === 0) return 0
  if (n < 10) return 1
  if (n < 25) return 2
  if (n < 50) return 3
  return 4
}

/** Son 12 haftanın çalışma yoğunluğu (kelime tekrarı + çözülen soru), GitHub tarzı. */
export function ActivityHeatmap({
  logs,
  answers,
  now,
}: {
  logs: ReviewLog[]
  answers: ExamAnswer[]
  now: number
}) {
  const data = useMemo(() => {
    const words = new Map<string, number>()
    const questions = new Map<string, number>()
    for (const l of logs) {
      const k = dayKey(l.reviewedAt)
      words.set(k, (words.get(k) ?? 0) + 1)
    }
    // Soru kaydı yalnızca son cevabı tutar; o soru son çözüldüğü güne sayılır
    for (const a of answers) {
      const k = dayKey(a.answeredAt)
      questions.set(k, (questions.get(k) ?? 0) + 1)
    }

    // Pazartesi başlangıçlı haftalar; son sütun bu hafta
    const today = new Date(now)
    const mondayOffset = (today.getDay() + 6) % 7
    const start = new Date(today)
    start.setDate(today.getDate() - mondayOffset - (WEEKS - 1) * 7)

    const todayKey = dayKey(now)
    const weeks: { key: string; w: number; q: number; future: boolean; date: Date }[][] = []
    const cursor = new Date(start)
    for (let wk = 0; wk < WEEKS; wk++) {
      const col = []
      for (let d = 0; d < 7; d++) {
        const k = dayKey(cursor)
        col.push({ key: k, w: words.get(k) ?? 0, q: questions.get(k) ?? 0, future: k > todayKey, date: new Date(cursor) })
        cursor.setDate(cursor.getDate() + 1)
      }
      weeks.push(col)
    }

    const activeDays = new Set([...words.keys(), ...questions.keys()])
    const last30 = new Date(today)
    last30.setDate(today.getDate() - 29)
    const last30Key = dayKey(last30)
    const activeLast30 = [...activeDays].filter((k) => k >= last30Key && k <= todayKey).length

    // En uzun seri
    const sorted = [...activeDays].sort()
    let best = 0
    let run = 0
    let prev: string | null = null
    for (const k of sorted) {
      if (prev) {
        const p = new Date(prev + 'T00:00:00')
        p.setDate(p.getDate() + 1)
        run = dayKey(p) === k ? run + 1 : 1
      } else run = 1
      best = Math.max(best, run)
      prev = k
    }
    return { weeks, activeLast30, best, current: streakFromDays(activeDays, now) }
  }, [logs, answers, now])

  return (
    <div className={styles.wrap}>
      <div className={styles.summary}>
        <span>
          <strong>{data.activeLast30}</strong> / 30 gün çalıştın
        </span>
        <span>
          🔥 Şu anki seri <strong>{data.current}</strong> gün
        </span>
        <span>
          🏆 En uzun seri <strong>{data.best}</strong> gün
        </span>
      </div>

      <div className={styles.scroller}>
        <div className={styles.grid}>
          <div className={styles.dayLabels}>
            <span />
            {DAY_LABELS.map((l, i) => (
              <span key={i}>{l}</span>
            ))}
          </div>
          {data.weeks.map((col, i) => {
            const first = col[0].date
            const showMonth = i === 0 || first.getDate() <= 7
            return (
              <div key={col[0].key} className={styles.col}>
                <span className={styles.month}>{showMonth ? MONTHS[first.getMonth()] : ''}</span>
                {col.map((c) => (
                  <span
                    key={c.key}
                    className={`${styles.cell} ${c.future ? styles.future : styles[`l${level(c.w + c.q)}`]}`}
                    title={
                      c.future
                        ? undefined
                        : `${c.date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}: ${c.w} kelime tekrarı${
                            c.q ? `, ${c.q} soru` : ''
                          }`
                    }
                  />
                ))}
              </div>
            )
          })}
        </div>
      </div>

      <div className={styles.legend}>
        Az
        {[0, 1, 2, 3, 4].map((l) => (
          <span key={l} className={`${styles.cell} ${styles[`l${l}`]}`} />
        ))}
        Çok
      </div>
    </div>
  )
}
