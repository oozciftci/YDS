import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../../db'
import { recordAnswer, answerId } from '../../services/examProgress'
import { ALL_SECTIONS, rangeIn, sectionOf, type SectionKey } from '../../services/ydsSections'
import { TARGET_SEC_PER_QUESTION } from '../../services/mockTime'
import { useUserStore } from '../../stores/user'
import styles from '../ExamStudy.module.css'
import { inPool, loadAllExams, POOLS, readPool, shortTitle, type ExamBundle, type Pool } from './examData'
import { useQuestionNav } from './answerControls'
import { QuestionCard } from './QuestionCard'
import { QuestionNav } from './QuestionNav'
import { ReasonPicker } from './ReasonPicker'
import type { QueueItem } from './QueueRunner'

const COUNTS = [10, 20, 40]

function fmt(sec: number) {
  const s = Math.max(0, Math.floor(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const t = a[i]
    a[i] = a[j]
    a[j] = t
  }
  return a
}

/**
 * Özel deneme: seçtiğin soru tipleri + havuzdan, istediğin sayıda soruyla süreli mini deneme.
 * Sonuç geçmişe yazılmaz (tam denemelerin grafiğini bozmasın) ama cevaplar ilerlemeye ve Yanlış Defteri’ne işlenir.
 */
export function CustomMock() {
  const userId = useUserStore((s) => s.activeUserId)
  const [bundles, setBundles] = useState<ExamBundle[] | null>(null)
  const [error, setError] = useState('')
  const [pool, setPool] = useState<Pool>(readPool)
  const [types, setTypes] = useState<Set<SectionKey>>(new Set<SectionKey>(['grammar', 'vocab', 'completion']))
  const [count, setCount] = useState(20)
  const [onlyNew, setOnlyNew] = useState(true)
  const [minutes, setMinutes] = useState<number | null>(null)
  const [solved, setSolved] = useState<Set<string>>(new Set())

  const [phase, setPhase] = useState<'setup' | 'running' | 'result' | 'review'>('setup')
  const [items, setItems] = useState<QueueItem[]>([])
  const [choices, setChoices] = useState<Record<number, string>>({})
  const [idx, setIdx] = useState(0)
  const [deadline, setDeadline] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const inQuestions = phase === 'running' || phase === 'review'
  const swipe = useQuestionNav(
    inQuestions ? () => setIdx((i) => Math.max(0, i - 1)) : undefined,
    inQuestions ? () => setIdx((i) => Math.min(items.length - 1, i + 1)) : undefined,
    { canPrev: idx > 0, canNext: idx < items.length - 1 },
  )

  useEffect(() => {
    Promise.all([loadAllExams(), db.examAnswers.where('userId').equals(userId).toArray()])
      .then(([b, a]) => {
        setBundles(b)
        setSolved(new Set(a.map((x) => `${x.examId}#${x.no}`)))
      })
      .catch((e) => setError('Sınavlar yüklenemedi: ' + e))
  }, [userId])

  const candidates = useMemo(() => {
    const out: QueueItem[] = []
    for (const bundle of bundles ?? []) {
      if (!inPool(bundle.exam, pool)) continue
      for (const q of bundle.exam.questions) {
        if (!q.answer) continue
        const key = sectionOf(q.no, bundle.exam.id).key
        if (!types.has(key)) continue
        const r = rangeIn(key, bundle.exam.id)
        if (!r || q.no < r[0] || q.no > r[1]) continue
        if (onlyNew && solved.has(`${bundle.exam.id}#${q.no}`)) continue
        out.push({ bundle, q })
      }
    }
    return out
  }, [bundles, pool, types, onlyNew, solved])

  const n = Math.min(count, candidates.length)
  const defaultMin = Math.max(1, Math.round((n * TARGET_SEC_PER_QUESTION) / 60))
  const dur = minutes ?? defaultMin

  const remaining = (deadline - now) / 1000
  useEffect(() => {
    if (phase !== 'running') return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [phase])

  async function finish() {
    // Cevaplar genel ilerlemeye ve Yanlış Defteri'ne de işlenir
    for (const [i, it] of items.entries()) {
      const c = choices[i]
      if (c && it.q.answer) await recordAnswer(userId, it.bundle.exam.id, it.q.no, c, c === it.q.answer)
    }
    setPhase('result')
    setIdx(0)
  }
  useEffect(() => {
    if (phase === 'running' && remaining <= 0) void finish()
    // finish her render yeni oluşur; süre bitişini yalnızca remaining/phase tetikler
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, remaining])

  function start() {
    const picked = shuffle(candidates).slice(0, n)
    setItems(picked)
    setChoices({})
    setIdx(0)
    const t = Date.now()
    setNow(t)
    setDeadline(t + dur * 60000)
    setPhase('running')
  }

  const back = (
    <Link to="/yds-sorular" className={styles.backLink}>
      ← Soru Merkezi
    </Link>
  )
  if (error) return <p className="muted">{error}</p>
  if (!bundles) return <p className="muted">Sorular hazırlanıyor…</p>

  if (phase === 'setup') {
    const toggle = (k: SectionKey) =>
      setTypes((s) => {
        const next = new Set(s)
        if (next.has(k)) next.delete(k)
        else next.add(k)
        return next
      })
    return (
      <section className={styles.page}>
        <header className={styles.head}>
          <div>
            {back}
            <h1 className={styles.title}>🎛️ Özel deneme</h1>
            <p className="muted" style={{ margin: 0, fontSize: '0.88rem' }}>
              İstediğin soru tiplerinden, istediğin sayıda süreli mini deneme.
            </p>
          </div>
        </header>
        <article className="card" style={{ display: 'grid', gap: '0.9rem' }}>
          <div>
            <strong>Havuz</strong>
            <div className={styles.poolBar} style={{ marginTop: '0.35rem' }}>
              {POOLS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  className={`${styles.poolChip} ${pool === p.key ? styles.poolOn : ''}`}
                  onClick={() => setPool(p.key)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <strong>Soru tipleri</strong>
            <div className={styles.poolBar} style={{ marginTop: '0.35rem' }}>
              {ALL_SECTIONS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  aria-pressed={types.has(s.key)}
                  className={`${styles.poolChip} ${types.has(s.key) ? styles.poolOn : ''}`}
                  onClick={() => toggle(s.key)}
                >
                  {s.icon} {s.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <strong>Soru sayısı</strong>
            <div className={styles.poolBar} style={{ marginTop: '0.35rem' }}>
              {COUNTS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`${styles.poolChip} ${count === c ? styles.poolOn : ''}`}
                  onClick={() => {
                    setCount(c)
                    setMinutes(null)
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input type="checkbox" checked={onlyNew} onChange={(e) => setOnlyNew(e.target.checked)} />
            Yalnızca daha önce çözmediğim sorular
          </label>
          <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            Süre (dk)
            <input
              type="number"
              min={1}
              max={180}
              value={dur}
              onChange={(e) => setMinutes(Math.max(1, Math.min(180, Number(e.target.value) || 1)))}
              style={{ width: '5rem' }}
            />
            <span className="muted">(sınav temposu: soru başı ≈ 2 dk 15 sn)</span>
          </label>
          <p className="muted" style={{ margin: 0 }}>
            Uygun soru: <strong>{candidates.length}</strong>
            {candidates.length < count && candidates.length > 0 && ` — ${candidates.length} soruyla başlayacak`}
          </p>
          <div className={styles.actions} style={{ marginTop: 0 }}>
            <button type="button" className="btn btn-primary" disabled={n === 0 || types.size === 0} onClick={start}>
              {n === 0 ? 'Uygun soru yok' : `${n} soruluk denemeyi başlat`}
            </button>
          </div>
        </article>
      </section>
    )
  }

  const answered = Object.keys(choices).length
  const correct = items.filter((it, i) => choices[i] && choices[i] === it.q.answer).length

  if (phase === 'result') {
    const wrong = items.filter((it, i) => choices[i] && choices[i] !== it.q.answer).length
    const bySection = new Map<SectionKey, [number, number]>()
    items.forEach((it, i) => {
      const k = sectionOf(it.q.no, it.bundle.exam.id).key
      const cur = bySection.get(k) ?? [0, 0]
      cur[1]++
      if (choices[i] === it.q.answer) cur[0]++
      bySection.set(k, cur)
    })
    const est = Math.round((correct / Math.max(1, items.length)) * 80)
    return (
      <section className={styles.page}>
        <header className={styles.head}>
          <div>
            {back}
            <h1 className={styles.title}>Özel deneme sonucu</h1>
          </div>
        </header>
        <article className={`card ${styles.scoreCard}`}>
          <div className={styles.scoreBig}>
            {correct}
            <small>/ {items.length} doğru</small>
          </div>
          <div className={styles.scoreStats}>
            <span className={styles.okText}>{correct} doğru</span>
            <span className={styles.badText}>{wrong} yanlış</span>
            <span className="muted">{items.length - correct - wrong} boş</span>
          </div>
          <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
            Bu oranla 80 soruda tahmini {est} doğru ≈ {(est * 1.25).toLocaleString('tr-TR')} puan (yalnızca seçtiğin tipler üzerinden bir
            tahmin).
          </p>
        </article>
        <article className="card">
          <h2 className={styles.blockTitle}>Soru tiplerine göre</h2>
          <ul className={styles.sectionList}>
            {[...bySection.entries()].map(([k, [c, t]]) => {
              const s = ALL_SECTIONS.find((x) => x.key === k)
              return (
                <li key={k} className={styles.sectionRowStatic}>
                  <span className={styles.sectionIcon}>{s?.icon}</span>
                  <span className={styles.sectionName}>{s?.label ?? k}</span>
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
          <button type="button" className="btn btn-secondary" onClick={() => setPhase('setup')}>
            Yeni özel deneme
          </button>
        </div>
      </section>
    )
  }

  const review = phase === 'review'
  const it = items[idx]
  const choice = choices[idx] ?? null

  return (
    <section className={styles.page} {...swipe.props}>
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
            <span className={`${styles.timer} ${remaining < 120 ? styles.timerLow : ''}`} data-focus-keep>⏱ {fmt(remaining)}</span>
            <span className="muted">
              {answered}/{items.length} cevaplandı
            </span>
            <span className={styles.spacer} />
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                const empty = items.length - answered
                const msg = empty > 0 ? `${empty} soru boş. Denemeyi bitirmek istiyor musun?` : 'Denemeyi bitirmek istiyor musun?'
                if (confirm(msg)) void finish()
              }}
            >
              Bitir
            </button>
          </>
        )}
      </div>

      <QuestionNav
        count={items.length}
        idx={idx}
        onPick={setIdx}
        stateClass={(i) => {
          const c = choices[i]
          return review ? (c ? (c === items[i].q.answer ? styles.navOk : styles.navBad) : '') : c ? styles.navPicked : ''
        }}
      />

      <QuestionCard
        key={`${it.bundle.exam.id}-${it.q.no}`}
        onPrev={idx > 0 ? () => void swipe.turn(-1) : undefined}
        onNext={idx < items.length - 1 ? () => void swipe.turn(1) : undefined}
        bundle={it.bundle}
        q={it.q}
        choice={choice}
        revealed={review}
        assist={review}
        subtitle={shortTitle(it.bundle.exam.title)}
        onChoose={(l) => {
          if (review) return
          setChoices((c) => {
            const next = { ...c }
            if (next[idx] === l) delete next[idx]
            else next[idx] = l
            return next
          })
        }}
      >
        <div className={styles.actions}>
          {review && (
            <span className={choice === it.q.answer ? styles.okText : choice ? styles.badText : 'muted'}>
              {choice === it.q.answer ? '✓ Doğru' : choice ? `✗ Yanlış — doğru cevap: ${it.q.answer}` : `Boş — doğru cevap: ${it.q.answer}`}
            </span>
          )}
          <span className={styles.spacer} />
          <button type="button" className="btn btn-ghost" disabled={idx === 0} onClick={() => void swipe.turn(-1)} data-focus-hide>
            ← Önceki
          </button>
          <button type="button" className="btn btn-secondary" disabled={idx === items.length - 1} onClick={() => void swipe.turn(1)} data-focus-hide>
            Sonraki →
          </button>
        </div>
        {review && choice && choice !== it.q.answer && <ReasonPicker answerId={answerId(userId, it.bundle.exam.id, it.q.no)} />}
      </QuestionCard>
    </section>
  )
}
