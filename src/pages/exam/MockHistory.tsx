import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db'
import { daysUntil } from '../../services/dates'
import { compareMocks, mockAdvice } from '../../services/mockPlan'
import { useSettings } from '../../stores/settings'
import { useUserStore } from '../../stores/user'
import styles from '../ExamStudy.module.css'
import { shortTitle } from './examData'

const W = 600
const H = 170
const PAD = { l: 34, r: 12, t: 12, b: 22 }

/** Deneme sonuçlarının zaman içindeki gelişimi ve hedef puan çizgisi. Deneme yoksa hiç görünmez. */
export function MockHistory() {
  const userId = useUserStore((s) => s.activeUserId)
  const target = useSettings((s) => s.exam.targetScore)
  const examDate = useSettings((s) => s.exam.targetExamDate)
  const results = useLiveQuery(
    () => db.mockResults.where('[userId+finishedAt]').between([userId, ''], [userId, '￿']).toArray(),
    [userId],
  )
  if (!results || results.length === 0) return null

  const x = (i: number) =>
    results.length === 1 ? PAD.l + (W - PAD.l - PAD.r) / 2 : PAD.l + (i * (W - PAD.l - PAD.r)) / (results.length - 1)
  const y = (score: number) => PAD.t + ((100 - score) * (H - PAD.t - PAD.b)) / 100
  const path = results.map((r, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(r.score).toFixed(1)}`).join(' ')
  const last = results[results.length - 1]
  const best = Math.max(...results.map((r) => r.score))
  const advice = mockAdvice(results, daysUntil(examDate))
  const compare = results.length > 1 ? compareMocks(results) : []
  const diff = results.length > 1 ? last.score - results[results.length - 2].score : null

  return (
    <article className="card">
      <h2 className={styles.blockTitle}>Deneme geçmişi</h2>
      <p className={styles.blockDesc}>
        Son deneme <strong>{last.score.toLocaleString('tr-TR')}</strong> puan
        {diff !== null && (
          <span className={diff >= 0 ? styles.okText : styles.badText}>
            {' '}
            ({diff >= 0 ? '+' : ''}
            {diff.toLocaleString('tr-TR')})
          </span>
        )}
        {' · '}En iyi {best.toLocaleString('tr-TR')} · Hedef {target} (kesikli çizgi)
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.chart} role="img" aria-label="Deneme puanları grafiği">
        {[0, 25, 50, 75, 100].map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} className={styles.chartGrid} />
            <text x={PAD.l - 6} y={y(v) + 4} textAnchor="end" className={styles.chartLabel}>
              {v}
            </text>
          </g>
        ))}
        {target > 0 && target <= 100 && (
          <line x1={PAD.l} x2={W - PAD.r} y1={y(target)} y2={y(target)} className={styles.chartTarget} />
        )}
        <path d={path} className={styles.chartLine} />
        {results.map((r, i) => (
          <circle key={r.id} cx={x(i)} cy={y(r.score)} r={4.5} className={styles.chartDot}>
            <title>
              {`${new Date(r.finishedAt).toLocaleDateString('tr-TR')} · ${shortTitle(r.examTitle)}: ${r.score} puan (${r.correct} doğru)`}
            </title>
          </circle>
        ))}
      </svg>
      <ul className={styles.mockList}>
        {[...results]
          .reverse()
          .slice(0, 5)
          .map((r) => (
            <li key={r.id}>
              <span>{new Date(r.finishedAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}</span>
              <span className={styles.mockListName}>{shortTitle(r.examTitle)}</span>
              <span className="muted">
                {r.correct}D · {r.wrong}Y · {r.empty}B
              </span>
              <strong>{r.score.toLocaleString('tr-TR')}</strong>
            </li>
          ))}
      </ul>
      <p className={advice.due ? styles.badText : 'muted'} style={{ margin: '0.6rem 0 0', fontSize: '0.86rem' }}>
        Sınava göre öneri: deneme {advice.cadence.label}.{' '}
        {advice.sinceLast === null
          ? 'Henüz deneme çözmedin.'
          : advice.due
            ? `Son denemenin üstünden ${advice.sinceLast} gün geçti; yeni deneme zamanı.`
            : `Son denemenin üstünden ${advice.sinceLast} gün geçti.`}
      </p>
      {compare.length > 0 && (
        <details style={{ marginTop: '0.6rem' }}>
          <summary>Denemeler arası karşılaştırma (tip bazlı %)</summary>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem', marginTop: '0.4rem' }}>
              <tbody>
                {compare.map((r) => (
                  <tr key={r.key}>
                    <td style={{ padding: '0.2rem 0.4rem 0.2rem 0' }}>{r.label}</td>
                    {r.pcts.map((p, i) => (
                      <td key={i} style={{ textAlign: 'right', padding: '0.2rem 0.4rem' }}>
                        {p === null ? '–' : `%${p}`}
                      </td>
                    ))}
                    <td className={r.delta === null ? 'muted' : r.delta >= 0 ? styles.okText : styles.badText} style={{ textAlign: 'right', padding: '0.2rem 0 0.2rem 0.4rem' }}>
                      {r.delta === null ? '' : r.delta === 0 ? '=' : `${r.delta > 0 ? '▲' : '▼'} ${Math.abs(r.delta)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </article>
  )
}
