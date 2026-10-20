import { useEffect, useRef, useState } from 'react'
import styles from '../ExamStudy.module.css'
import type { Seg } from './examData'

// Okuma hızı antrenörü: seçilen hızda (kelime/dakika) cümleleri sırayla vurgular; gözün vurguyu izler.
// Biten antrenmanlar kaydedilir, böylece hızın zamanla nasıl arttığı görülür (tarayıcı deposu).

const SPEEDS = [120, 150, 180, 210, 250, 300]
const LOG_KEY = (userId: string) => `yds-pacer:${userId}`

interface PacerLog {
  wpm: number
  words: number
  at: string
}

function readLogs(userId: string): PacerLog[] {
  try {
    return JSON.parse(localStorage.getItem(LOG_KEY(userId)) || '[]') as PacerLog[]
  } catch {
    return []
  }
}

const countWords = (s: string) => (s.match(/[A-Za-z]+(?:['’][A-Za-z]+)?/g) || []).length

export function PacerControls({ userId, sentences, onActive }: { userId: string; sentences: Seg[]; onActive: (i: number | null) => void }) {
  const [wpm, setWpm] = useState(() => {
    const last = readLogs(userId).at(-1)
    return last ? last.wpm : 150
  })
  const [running, setRunning] = useState(false)
  const [logs, setLogs] = useState(() => readLogs(userId))
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  function stop() {
    clearTimeout(timer.current)
    setRunning(false)
    onActive(null)
  }

  function start() {
    clearTimeout(timer.current)
    setRunning(true)
    const step = (i: number) => {
      if (i >= sentences.length) {
        // Antrenman tamam: kaydet
        const words = sentences.reduce((n, s) => n + countWords(s.en), 0)
        const next = [...readLogs(userId), { wpm, words, at: new Date().toISOString() }].slice(-50)
        try {
          localStorage.setItem(LOG_KEY(userId), JSON.stringify(next))
        } catch {
          // yoksay
        }
        setLogs(next)
        stop()
        return
      }
      onActive(i)
      const ms = (Math.max(3, countWords(sentences[i].en)) / wpm) * 60_000
      timer.current = setTimeout(() => step(i + 1), ms)
    }
    step(0)
  }

  const best = logs.reduce((m, l) => Math.max(m, l.wpm), 0)
  const recent = logs.slice(-5).map((l) => l.wpm)

  return (
    <span className={styles.listen} title="Vurguyu gözünle izle; hızı yavaş yavaş artır">
      {running ? (
        <button type="button" className="btn btn-secondary" onClick={stop}>
          ⏹ Antrenmanı durdur
        </button>
      ) : (
        <button type="button" className="btn btn-secondary" onClick={start}>
          🏃 Hız antrenörü
        </button>
      )}
      <select className={styles.rateSelect} value={wpm} disabled={running} onChange={(e) => setWpm(Number(e.target.value))} aria-label="Okuma hızı">
        {SPEEDS.map((s) => (
          <option key={s} value={s}>
            {s} kelime/dk
          </option>
        ))}
      </select>
      {logs.length > 0 && (
        <small className="muted">
          son: {recent.join(' → ')} · en iyi {best}
        </small>
      )}
    </span>
  )
}
