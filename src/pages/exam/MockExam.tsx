import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { db } from '../../db'
import { recordAnswer } from '../../services/examProgress'
import { sectionOf, YDS_SECTIONS, ydsScore } from '../../services/ydsSections'
import { useUserStore } from '../../stores/user'
import type { MockExamResult } from '../../types/database'
import styles from '../ExamStudy.module.css'
import { loadExam, type ExamBundle } from './examData'
import { QuestionCard } from './QuestionCard'

const DURATION_SEC = 180 * 60

interface Saved {
  startedAt: string
  choices: Record<number, string>
}

function storageKey(userId: string, examId: string) {
  return `yds-mock:${userId}:${examId}`
}
function readSaved(key: string): Saved | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as Saved) : null
  } catch {
    return null
  }
}
function writeSaved(key: string, s: Saved | null) {
  try {
    if (s) localStorage.setItem(key, JSON.stringify(s))
    else localStorage.removeItem(key)
  } catch {
    // Depo kapalıysa deneme yine çalışır, yalnızca sayfa yenilenince kaybolur
  }
}
function fmt(sec: number) {
  const s = Math.max(0, Math.floor(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `${h}:${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/** Süreli deneme: 80 soru / 180 dk; yardım kapalı, cevaplar sonda açıklanır. */
export function MockExam() {
  const { examId = '' } = useParams()
  const userId = useUserStore((s) => s.activeUserId)
  const key = storageKey(userId, examId)
  const [bundle, setBundle] = useState<ExamBundle | null>(null)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState<Saved | null>(() => readSaved(key))
  const [phase, setPhase] = useState<'intro' | 'running' | 'result' | 'review'>('intro')
  const [idx, setIdx] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [result, setResult] = useState<MockExamResult | null>(null)

  useEffect(() => {
    loadExam(examId)
      .then(setBundle)
      .catch((e) => setError('Sınav yüklenemedi: ' + e))
  }, [examId])

  const remaining = saved ? DURATION_SEC - (now - new Date(saved.startedAt).getTime()) / 1000 : DURATION_SEC

  const finish = useCallback(async () => {
    if (!bundle || !saved) return
    const finishedAt = new Date()
    const sections: Record<string, [number, number]> = {}
    let correct = 0
    let wrong = 0
    for (const q of bundle.exam.questions) {
      const sec = sectionOf(q.no).key
      sections[sec] ??= [0, 0]
      sections[sec][1]++
      const c = saved.choices[q.no]
      if (!c) continue
      if (c === q.answer) {
        correct++
        sections[sec][0]++
      } else wrong++
    }
    const res: MockExamResult = {
      id: crypto.randomUUID(),
      userId,
      examId,
      examTitle: bundle.exam.title,
      startedAt: saved.startedAt,
      finishedAt: finishedAt.toISOString(),
      durationSec: Math.min(DURATION_SEC, Math.round((finishedAt.getTime() - new Date(saved.startedAt).getTime()) / 1000)),
      correct,
      wrong,
      empty: bundle.exam.questions.length - correct - wrong,
      score: ydsScore(correct),
      sections,
      choices: saved.choices,
    }
    await db.mockResults.add(res)
    // Cevaplar genel ilerlemeye ve Yanlış Defteri'ne de işlenir
    for (const q of bundle.exam.questions) {
      const c = saved.choices[q.no]
      if (c && q.answer) await recordAnswer(userId, examId, q.no, c, c === q.answer)
    }
    writeSaved(key, null)
    setResult(res)
    setPhase('result')
    setIdx(0)
  }, [bundle, saved, userId, examId, key])

  // Sayaç
  useEffect(() => {
    if (phase !== 'running') return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [phase])

  // Süre bitince otomatik bitir
  useEffect(() => {
    if (phase === 'running' && remaining <= 0) void finish()
  }, [phase, remaining, finish])

  const choices = useMemo(() => (phase === 'review' ? (result?.choices ?? {}) : (saved?.choices ?? {})), [phase, result, saved])

  if (error) return <p className="muted">{error}</p>
  if (!bundle) return <p className="muted">Yükleniyor…</p>

  const total = bundle.exam.questions.length
  const answeredCount = Object.keys(choices).length

  function start(fresh: boolean) {
    const s: Saved = fresh || !saved ? { startedAt: new Date().toISOString(), choices: {} } : saved
    writeSaved(key, s)
    setSaved(s)
    setNow(Date.now())
    setPhase('running')
  }

  function choose(no: number, letter: string) {
    if (!saved) return
    const next = { ...saved.choices }
    if (next[no] === letter) delete next[no]
    else next[no] = letter
    const s = { ...saved, choices: next }
    setSaved(s)
    writeSaved(key, s)
  }

  function askFinish() {
    const empty = total - answeredCount
    const msg = empty > 0 ? `${empty} soru boş. Denemeyi bitirmek istiyor musun?` : 'Denemeyi bitirmek istiyor musun?'
    if (confirm(msg)) void finish()
  }

  const back = (
    <Link to="/yds-sorular" className={styles.backLink}>
      ← Soru Merkezi
    </Link>
  )

  if (phase === 'intro') {
    const resumable = saved && remaining > 0
    return (
      <section className={styles.page}>
        <header className={styles.head}>
          <div>
            {back}
            <h1 className={styles.title}>⏱️ Deneme: {bundle.exam.title}</h1>
          </div>
        </header>
        <article className={`card ${styles.introCard}`}>
          <ul className={styles.ruleList}>
            <li>
              <strong>{total} soru, 180 dakika.</strong> Süre bitince deneme kendiliğinden biter.
            </li>
            <li>Gerçek sınav gibi: çeviri ve kelime sözlüğü kapalıdır.</li>
            <li>Sorular arasında serbestçe gezebilir, cevabını değiştirebilirsin. Seçili şıkka tekrar dokunmak cevabı siler.</li>
            <li>Sayfadan çıksan da süre işlemeye devam eder; döndüğünde kaldığın yerden sürersin.</li>
            <li>Sonuçta puanını (her doğru 1,25), soru tiplerine göre dökümü ve tüm çözümleri görürsün.</li>
          </ul>
          <div className={styles.actions}>
            {resumable ? (
              <>
                <button type="button" className="btn btn-primary" onClick={() => start(false)}>
                  Devam et ({Object.keys(saved.choices).length} cevap, kalan{' '}
                  {fmt(remaining)})
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => confirm('Yarım kalan deneme silinip yeniden başlansın mı?') && start(true)}
                >
                  Baştan başla
                </button>
              </>
            ) : (
              <button type="button" className="btn btn-primary" onClick={() => start(true)}>
                Denemeyi başlat
              </button>
            )}
          </div>
        </article>
      </section>
    )
  }

  if (phase === 'result' && result) {
    return (
      <section className={styles.page}>
        <header className={styles.head}>
          <div>
            {back}
            <h1 className={styles.title}>Deneme sonucu</h1>
            <p className="muted" style={{ margin: 0 }}>
              {bundle.exam.title} · {fmt(result.durationSec)} sürdü
            </p>
          </div>
        </header>
        <article className={`card ${styles.scoreCard}`}>
          <div className={styles.scoreBig}>
            {result.score.toLocaleString('tr-TR')}
            <small>/ 100 puan</small>
          </div>
          <div className={styles.scoreStats}>
            <span className={styles.okText}>{result.correct} doğru</span>
            <span className={styles.badText}>{result.wrong} yanlış</span>
            <span className="muted">{result.empty} boş</span>
          </div>
          <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
            YDS'de yanlış doğruyu götürmez; boş bırakmak yerine tahmin etmek her zaman avantajlıdır.
          </p>
        </article>
        <article className="card">
          <h2 className={styles.blockTitle}>Soru tiplerine göre</h2>
          <ul className={styles.sectionList}>
            {YDS_SECTIONS.map((s) => {
              const [c, t] = result.sections[s.key] ?? [0, 0]
              const pct = t ? Math.round((c / t) * 100) : 0
              return (
                <li key={s.key} className={styles.sectionRowStatic}>
                  <span className={styles.sectionIcon}>{s.icon}</span>
                  <span className={styles.sectionName}>{s.label}</span>
                  <span className={styles.bar}>
                    <span
                      className={`${styles.barFill} ${styles[`tone_${pct >= 75 ? 'ok' : pct >= 50 ? 'mid' : 'bad'}`]}`}
                      style={{ width: `${pct}%` }}
                    />
                  </span>
                  <span className={styles.sectionPct}>
                    {c}/{t}
                  </span>
                </li>
              )
            })}
          </ul>
        </article>
        <div className={styles.actions}>
          <button type="button" className="btn btn-primary" onClick={() => setPhase('review')}>
            Çözümleri incele
          </button>
          <Link to="/yds-sorular" className="btn btn-secondary">
            Soru Merkezi’ne dön
          </Link>
        </div>
      </section>
    )
  }

  // running | review
  const review = phase === 'review'
  const q = bundle.exam.questions[idx]
  const choice = choices[q.no] ?? null

  return (
    <section className={styles.page}>
      <div className={styles.mockBar}>
        {review ? (
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setPhase('result')}>
              ← Sonuç
            </button>
            <span className={styles.spacer} />
            <span className="muted">Çözüm inceleme</span>
          </>
        ) : (
          <>
            <span className={`${styles.timer} ${remaining < 600 ? styles.timerLow : ''}`} aria-live="off">
              ⏱ {fmt(remaining)}
            </span>
            <span className="muted">
              {answeredCount}/{total} cevaplandı
            </span>
            <span className={styles.spacer} />
            <button type="button" className="btn btn-primary" onClick={askFinish}>
              Bitir
            </button>
          </>
        )}
      </div>

      <div className={styles.navigator} role="navigation" aria-label="Sorular">
        {bundle.exam.questions.map((x, i) => {
          const c = choices[x.no]
          const cls = review
            ? c
              ? c === x.answer
                ? styles.navOk
                : styles.navBad
              : ''
            : c
              ? styles.navPicked
              : ''
          return (
            <button
              key={x.no}
              type="button"
              className={`${styles.navBtn} ${i === idx ? styles.navCurrent : ''} ${cls}`}
              onClick={() => setIdx(i)}
            >
              {x.no}
            </button>
          )
        })}
      </div>

      <QuestionCard
        bundle={bundle}
        q={q}
        choice={choice}
        revealed={review}
        assist={review}
        onChoose={(l) => choose(q.no, l)}
      >
        <div className={styles.actions}>
          {review && (
            <span className={choice === q.answer ? styles.okText : choice ? styles.badText : 'muted'}>
              {choice === q.answer ? '✓ Doğru' : choice ? `✗ Yanlış — doğru cevap: ${q.answer}` : `Boş — doğru cevap: ${q.answer}`}
            </span>
          )}
          <span className={styles.spacer} />
          <button type="button" className="btn btn-ghost" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>
            ← Önceki
          </button>
          <button type="button" className="btn btn-secondary" disabled={idx === total - 1} onClick={() => setIdx(idx + 1)}>
            Sonraki →
          </button>
        </div>
      </QuestionCard>
    </section>
  )
}
