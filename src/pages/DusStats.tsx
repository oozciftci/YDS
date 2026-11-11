import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ActivityHeatmap } from '../components/ActivityHeatmap'
import { DUS_SUBJECTS, DUS_TESTS, dusNet, listDusExams, readDusAnswers, testSummary, type DusExamMeta } from '../services/dus'
import { readMockLog, subjectStats, weakestSubjects, type DusMockLogEntry } from '../services/dusMock'
import { useUserStore } from '../stores/user'
import type { ExamAnswer } from '../types/database'
import styles from './ExamStudy.module.css'
import m from './DusMock.module.css'

// DUS istatistik (/dus/istatistik): tüm DUS cevaplarından genel durum, ders ders başarı, sınav sınav tamamlama,
// çalışma takvimi ve süreli deneme gelişimi. Veri bu cihazdaki yds-dus:<kullanıcı> ve yds-dus-mocklog:<kullanıcı>.

const W = 600
const H = 180
const PAD = { l: 34, r: 12, t: 12, b: 22 }

/** Temel ve Klinik net, deneme deneme (basit SVG). */
function MockChart({ log }: { log: DusMockLogEntry[] }) {
  const pts = log.filter((e) => e.tests.tbt || e.tests.kbt)
  const nets = pts.flatMap((e) => [e.tests.tbt?.net, e.tests.kbt?.net]).filter((x): x is number => x !== undefined)
  const top = Math.max(40, Math.ceil(Math.max(...nets) / 10) * 10)
  const bottom = Math.min(0, Math.floor(Math.min(...nets) / 10) * 10)
  const x = (i: number) => (pts.length === 1 ? PAD.l + (W - PAD.l - PAD.r) / 2 : PAD.l + (i * (W - PAD.l - PAD.r)) / (pts.length - 1))
  const y = (v: number) => PAD.t + ((top - v) * (H - PAD.t - PAD.b)) / (top - bottom)
  const line = (k: 'tbt' | 'kbt') => {
    let d = ''
    pts.forEach((e, i) => {
      const v = e.tests[k]?.net
      if (v === undefined) return
      d += `${d ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)} `
    })
    return d.trim()
  }
  const ticks = Array.from({ length: 5 }, (_, i) => Math.round(bottom + ((top - bottom) * i) / 4))
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.chart} role="img" aria-label="Deneme netleri grafiği">
        {ticks.map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} className={styles.chartGrid} />
            <text x={PAD.l - 6} y={y(v) + 4} textAnchor="end" className={styles.chartLabel}>
              {v}
            </text>
          </g>
        ))}
        <path d={line('tbt')} className={styles.chartLine} />
        <path d={line('kbt')} className={m.lineK} />
        {pts.map((e, i) => (
          <g key={e.id}>
            {e.tests.tbt && (
              <circle cx={x(i)} cy={y(e.tests.tbt.net)} r={4.5} className={styles.chartDot}>
                <title>{`${new Date(e.finishedAt).toLocaleDateString('tr-TR')} · ${e.title}: Temel net ${e.tests.tbt.net}`}</title>
              </circle>
            )}
            {e.tests.kbt && (
              <circle cx={x(i)} cy={y(e.tests.kbt.net)} r={4.5} className={m.dotK}>
                <title>{`${new Date(e.finishedAt).toLocaleDateString('tr-TR')} · ${e.title}: Klinik net ${e.tests.kbt.net}`}</title>
              </circle>
            )}
          </g>
        ))}
      </svg>
      <div className={m.legend}>
        <span>Temel net (40 soru)</span>
        <span className={m.legK}>Klinik net (80 soru)</span>
      </div>
    </>
  )
}

export default function DusStats() {
  const userId = useUserStore((s) => s.activeUserId)
  const [exams, setExams] = useState<DusExamMeta[] | null>(null)
  const all = useMemo(() => readDusAnswers(userId), [userId])
  const log = useMemo(() => readMockLog(userId), [userId])
  const [now] = useState(() => Date.now())
  useEffect(() => {
    void listDusExams().then(setExams)
  }, [])

  const subj = useMemo(() => subjectStats(all), [all])
  const weak = useMemo(() => new Set(weakestSubjects(subj)), [subj])
  // Isı haritası soru kaydının `answeredAt` alanına bakar; DUS cevabının zamanı `t`
  const heat = useMemo(() => Object.values(all).map((a) => ({ answeredAt: a.t }) as ExamAnswer), [all])

  if (!exams) return <p className="muted">Yükleniyor…</p>

  const answered = Object.keys(all).length
  const correct = Object.values(all).filter((a) => a.ok).length
  const wrong = answered - correct
  const back = (
    <Link to="/dus" className={styles.backLink}>
      ← DUS
    </Link>
  )

  if (!answered && !log.length)
    return (
      <section className={styles.page}>
        {back}
        <h1 className={styles.title}>📊 DUS istatistik</h1>
        <p className="muted">
          Henüz DUS sorusu çözmedin; <Link to="/dus">DUS</Link> sayfasından bir ders ya da sınav seçerek başla, istatistiklerin burada
          birikir.
        </p>
      </section>
    )

  const totalQ = exams.reduce((n, e) => n + e.counts.tbt + e.counts.kbt, 0)
  const byId = new Map(subj.map((s) => [s.id, s]))

  return (
    <section className={styles.page}>
      <header className={styles.head}>
        <div>
          {back}
          <h1 className={styles.title}>📊 DUS istatistik</h1>
          <p className="muted" style={{ margin: 0 }}>
            Tüm DUS cevaplarından (normal çözüm ve denemeler) genel durum; her sorunun son cevabı sayılır.
          </p>
        </div>
      </header>

      <article className={`card ${styles.scoreCard}`}>
        <div className={m.statGrid}>
          <div className={m.stat}>
            <small>Çözülen</small>
            <strong>{answered}</strong>
            <small>/ {totalQ} soru</small>
          </div>
          <div className={m.stat}>
            <small>Doğruluk</small>
            <strong>%{answered ? Math.round((correct / answered) * 100) : 0}</strong>
            <small>
              {correct} doğru · {wrong} yanlış
            </small>
          </div>
          <div className={m.stat}>
            <small>Net</small>
            <strong>{dusNet(correct, wrong).toLocaleString('tr-TR')}</strong>
            <small>doğru − yanlış/4</small>
          </div>
        </div>
      </article>

      <article className="card">
        <h2 className={styles.blockTitle}>Ders ders</h2>
        <p className={styles.blockDesc}>Çubuk çözülen/toplam soruyu, sağdaki yüzde doğruluğu gösterir; en zayıf 3 ders kırmızı.</p>
        {DUS_TESTS.map((t) => (
          <div key={t.key}>
            <h3 className={m.groupTitle}>{t.title}</h3>
            <ul className={m.list}>
              {DUS_SUBJECTS.filter((s) => s.test === t.key).map((s) => {
                const st = byId.get(s.id)!
                const n = exams.length * (s.to - s.from + 1)
                const isWeak = weak.has(s.id)
                return (
                  <li key={s.id} className={`${m.subjRow} ${isWeak ? m.weak : ''}`}>
                    <span className={m.subjName}>
                      <span>
                        {s.icon} {s.title}
                      </span>
                      <small>
                        {st.answered}/{n} çözüldü
                        {isWeak && (
                          <>
                            {' · '}
                            <Link to={`/dus/ders/${s.id}`}>bu dersten çöz →</Link>
                          </>
                        )}
                      </small>
                    </span>
                    <span className={styles.bar} aria-hidden="true">
                      <span className={styles.barFill} style={{ width: `${Math.min(100, (st.answered / n) * 100)}%` }} />
                    </span>
                    <span className={m.subjNum}>{st.pct === null ? '–' : `%${st.pct}`}</span>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </article>

      <article className="card">
        <h2 className={styles.blockTitle}>Çalışma takvimi</h2>
        <p className={styles.blockDesc}>Son 12 hafta; her soru en son çözüldüğü güne sayılır.</p>
        <ActivityHeatmap logs={[]} answers={heat} now={now} />
      </article>

      <article className="card">
        <h2 className={styles.blockTitle}>Süreli denemeler</h2>
        {log.length ? (
          <>
            <p className={styles.blockDesc}>
              {log.length} deneme · son: {log[log.length - 1].title}, toplam net {log[log.length - 1].total.net.toLocaleString('tr-TR')}.
            </p>
            <MockChart log={log} />
          </>
        ) : (
          <p className={styles.blockDesc}>Henüz süreli deneme yok; netlerinin gelişimi burada çizilir.</p>
        )}
        <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem' }}>
          <Link to="/dus/deneme">⏱️ Süreli denemeye git →</Link>
        </p>
      </article>

      <article className="card">
        <h2 className={styles.blockTitle}>Sınav sınav</h2>
        <p className={styles.blockDesc}>Her kitapçığın Temel ve Klinik testinde çözülen soru.</p>
        <ul className={m.list}>
          {exams.map((e) => {
            const tb = testSummary(all, e.id, 'tbt')
            const kb = testSummary(all, e.id, 'kbt')
            const n = e.counts.tbt + e.counts.kbt
            const done = tb.answered + kb.answered
            return (
              <li key={e.id} className={m.subjRow}>
                <span className={m.subjName}>
                  <span>{e.title}</span>
                  <small>
                    Temel {tb.answered}/{e.counts.tbt} · Klinik {kb.answered}/{e.counts.kbt}
                  </small>
                </span>
                <span className={styles.bar} aria-hidden="true">
                  <span className={styles.barFill} style={{ width: `${n ? Math.min(100, (done / n) * 100) : 0}%` }} />
                </span>
                <span className={m.subjNum}>%{n ? Math.round((done / n) * 100) : 0}</span>
              </li>
            )
          })}
        </ul>
      </article>
    </section>
  )
}
