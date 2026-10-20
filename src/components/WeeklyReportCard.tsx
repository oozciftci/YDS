import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { db } from '../db'
import { aiConfigured, generate } from '../services/ai'
import { buildWeeklyReport, reportToText } from '../services/weeklyReport'
import { useUserStore } from '../stores/user'

const SYSTEM = [
  'Sen YDS/YÖKDİL öğrencisinin koçusun. Sana yalnızca bir haftalık çalışma SAYILARI verilir.',
  'Türkçe, samimi ve kısa yaz: 1) bu haftanın en güçlü yanı, 2) en önemli sorun, 3) önümüzdeki hafta için TEK öncelik ve somut hedef sayı. En fazla 5 cümle, madde işareti kullanma.',
  'Veri yetersizse bunu açıkça söyle; uydurma yapma.',
].join('\n')

const dash = (v: number | null, suffix = '') => (v === null ? '—' : `${v}${suffix}`)
const arrow = (a: number | null, b: number | null) => (a === null || b === null ? '' : a > b ? ' ▲' : a < b ? ' ▼' : ' =')

/** Haftalık koç raporu: sayılar yerelde hesaplanır; isteğe bağlı koç yorumu Gemini'den gelir ve hafta başına önbelleğe alınır. */
export function WeeklyReportCard() {
  const userId = useUserStore((s) => s.activeUserId)
  const logs = useLiveQuery(() => db.reviewLogs.where('userId').equals(userId).toArray(), [userId], [])
  const answers = useLiveQuery(() => db.examAnswers.where('userId').equals(userId).toArray(), [userId], [])
  const mocks = useLiveQuery(() => db.mockResults.where('userId').equals(userId).toArray(), [userId], [])
  const [now] = useState(() => Date.now())
  const report = useMemo(() => buildWeeklyReport(logs, answers, mocks, now), [logs, answers, mocks, now])
  const cacheId = `haftalik:${userId}:${report.weekStart}`
  const cached = useLiveQuery(() => db.aiNotes.get(cacheId), [cacheId])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const w = report.thisWeek
  const p = report.lastWeek
  if (!w.reviews && !w.questions) return null

  async function ask() {
    setBusy(true)
    setError('')
    try {
      const r = await generate(SYSTEM, reportToText(report), 0.5)
      await db.aiNotes.put({ id: cacheId, kind: 'haftalik', text: r.text, model: r.model, createdAt: new Date().toISOString() })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className="card" style={{ display: 'grid', gap: '0.5rem' }}>
      <h2 style={{ margin: 0, fontSize: '1.05rem' }}>📅 Haftalık rapor</h2>
      <p className="muted" style={{ margin: 0, fontSize: '0.86rem' }}>
        Son 7 gün (▲▼ geçen haftayla karşılaştırma)
      </p>
      <ul style={{ margin: 0, paddingLeft: '1.1rem', lineHeight: 1.7 }}>
        <li>
          <strong>{w.activeDays}</strong> gün çalıştın{arrow(w.activeDays, p.activeDays)}
        </li>
        <li>
          <strong>{w.reviews}</strong> kelime tekrarı, başarı {dash(w.successRate, '%')}
          {arrow(w.reviews, p.reviews)} · <strong>{w.newWords}</strong> yeni kelime
        </li>
        {w.questions > 0 && (
          <li>
            <strong>{w.questions}</strong> çıkmış soru, doğruluk {dash(w.questionPct, '%')}
            {arrow(w.questionPct, p.questionPct)}
          </li>
        )}
        {report.weakest && (
          <li>
            En zayıf tip: <strong>{report.weakest.label}</strong> (%{report.weakest.pct}, {report.weakest.n} soru)
          </li>
        )}
        {report.mocks.count > 0 && (
          <li>
            {report.mocks.count} deneme, en iyi puan <strong>{report.mocks.best}</strong>
          </li>
        )}
      </ul>
      {cached ? (
        <p style={{ margin: 0, lineHeight: 1.6 }}>🧑‍🏫 {cached.text}</p>
      ) : aiConfigured() ? (
        <div>
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void ask()}>
            {busy ? 'Koç yazıyor…' : '🧑‍🏫 Koç yorumu al'}
          </button>
        </div>
      ) : null}
      {error && <p style={{ margin: 0, color: 'var(--danger, #c0392b)' }}>{error}</p>}
    </article>
  )
}
