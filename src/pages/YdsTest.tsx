import { useEffect, useMemo, useState } from 'react'
import { Link, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import { YDS_DEMO, YDS_DEMO_HINTS } from '../data/ydsDemo'
import { ALL_SECTIONS, getSection, sectionOf, type SectionKey } from '../services/ydsSections'
import { useUserStore } from '../stores/user'
import { TranslationWorkshop } from './TranslationWorkshop'
import { QuestionCard } from './exam/QuestionCard'
import { QuickAnswerToggle, useQuestionNav, useQuickAnswer } from './exam/answerControls'
import type { ExamBundle } from './exam/examData'
import { listOzgunSets, loadOzgunSet, type OzgunSetMeta } from './exam/ozgunData'
import type { OzgunSet } from '../data/ozgunTypes'
import styles from './ExamStudy.module.css'

// Alıştırma Merkezi: tamamen özgün (telifsiz) sorular; yayında da çalışır, çevrimdışı da.
// Çıkmış soru çalışmasının aynı arayüzü: cümle çevirisi, kelimeye dokununca anlam, anında kontrol, şık şık açıklama.
// Set sonuçları kişisel kolaylık olarak tarayıcı deposunda tutulur.

type Progress = Record<string, { best: number; total: number; at: string }>
const progressKey = (userId: string) => `yds-ozgun:${userId}`
function readProgress(userId: string): Progress {
  try {
    return JSON.parse(localStorage.getItem(progressKey(userId)) || '{}') as Progress
  } catch {
    return {}
  }
}
function saveProgress(userId: string, setId: string, score: number, total: number) {
  const p = readProgress(userId)
  p[setId] = { best: Math.max(score, p[setId]?.best ?? 0), total, at: new Date().toISOString() }
  try {
    localStorage.setItem(progressKey(userId), JSON.stringify(p))
  } catch {
    // Depo kapalıysa sonuç yalnızca bu oturumda görünür
  }
}

const DEMO_ID = 'ornek'

function Hub() {
  const userId = useUserStore((s) => s.activeUserId)
  const navigate = useNavigate()
  const [sets, setSets] = useState<OzgunSetMeta[] | null>(null)
  const [type, setType] = useState<SectionKey | 'all'>('all')
  const [progress] = useState(() => readProgress(userId))

  useEffect(() => {
    void listOzgunSets().then(setSets)
  }, [])

  const types = useMemo(() => ALL_SECTIONS.filter((s) => sets?.some((x) => x.type === s.key)), [sets])
  const shown = (sets ?? []).filter((s) => type === 'all' || s.type === type)
  const totalQ = (sets ?? []).reduce((n, s) => n + s.count, 0)

  return (
    <section className={styles.page}>
      <header className={styles.head}>
        <div>
          <h1 className={styles.title}>📝 Alıştırma Merkezi</h1>
          <p className="muted" style={{ margin: 0 }}>
            ÖSYM düzeninde, tamamen özgün sorular{totalQ > 0 && ` (${totalQ} soru, ${sets?.length} set)`}. Her sorudan sonra tüm şıkların
            açıklaması görünür. Cümlenin başındaki 🌐 Türkçesini açar, bir kelimeye dokununca anlamı çıkar.
          </p>
        </div>
      </header>

      <article className="card" style={{ cursor: 'pointer' }} onClick={() => navigate(DEMO_ID)} role="button" tabIndex={0}>
        <strong>🚀 Başlangıç: 3 örnek soru</strong>
        <p className="muted" style={{ margin: '0.2rem 0 0' }}>
          Kelime, çeviri ve paragraf: sınavın nasıl işlediğini gör.
        </p>
      </article>

      <article className="card" style={{ cursor: 'pointer' }} onClick={() => navigate('ceviri')} role="button" tabIndex={0}>
        <strong>🔁 Çeviri Atölyesi</strong>
        <p className="muted" style={{ margin: '0.2rem 0 0' }}>
          Cümleyi kendin çevir, yapay zekâ puanlasın ve hatalarını söylesin.
        </p>
      </article>

      {!sets ? (
        <p className="muted">Hazırlanıyor…</p>
      ) : sets.length === 0 ? (
        <p className="muted">Alıştırma setleri yüklenemedi. Bağlantını kontrol edip sayfayı yenile.</p>
      ) : (
        <>
          <div className={styles.poolBar}>
            <button type="button" className={`${styles.poolChip} ${type === 'all' ? styles.poolOn : ''}`} onClick={() => setType('all')}>
              Tümü
            </button>
            {types.map((s) => (
              <button
                key={s.key}
                type="button"
                className={`${styles.poolChip} ${type === s.key ? styles.poolOn : ''}`}
                onClick={() => setType(s.key)}
              >
                {s.icon} {s.label}
              </button>
            ))}
          </div>
          <ul className={styles.examList}>
            {shown.map((s) => {
              const p = progress[s.id]
              const sec = getSection(s.type)
              return (
                <li key={s.id} className={styles.examRow}>
                  <span className={styles.examTitle}>
                    {sec.icon} {s.title}
                    <small className="muted"> · {s.count} soru</small>
                  </span>
                  <span className="muted">{p ? `${p.best}/${p.total}` : ''}</span>
                  <span className={styles.examActions}>
                    <button type="button" className="btn btn-secondary" onClick={() => navigate(s.id)}>
                      {p ? 'Tekrar çöz' : 'Çöz'}
                    </button>
                  </span>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}

interface RunnerProps {
  setId: string
  bundle: ExamBundle
  hints?: Record<number, string>
  set?: OzgunSet
  nextId?: string
}

function Runner({ setId, bundle, hints, set, nextId }: RunnerProps) {
  const userId = useUserStore((s) => s.activeUserId)
  const questions = bundle.exam.questions
  const [idx, setIdx] = useState(0)
  const [picks, setPicks] = useState<Record<number, string>>({})
  const [checked, setChecked] = useState<Record<number, boolean>>({})
  const [quick, setQuick] = useQuickAnswer()
  const swipe = useQuestionNav(
    () => setIdx((i) => Math.max(0, i - 1)),
    () => setIdx((i) => Math.min(questions.length - 1, i + 1)),
  )

  const q = questions[idx]
  const choice = picks[q.no] ?? null
  const revealed = Boolean(checked[q.no])
  const correct = questions.filter((x) => checked[x.no] && picks[x.no] === x.answer).length
  const done = questions.filter((x) => checked[x.no]).length
  const finished = done === questions.length

  useEffect(() => {
    if (finished) saveProgress(userId, setId, correct, questions.length)
    // Yalnızca set bittiğinde bir kez kaydet
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished])

  function choose(letter: string) {
    setPicks((p) => ({ ...p, [q.no]: letter }))
    if (quick) setChecked((c) => ({ ...c, [q.no]: true }))
  }

  const oq = set?.qs[idx]
  const letters = Object.keys(q.options)

  return (
    <section className={styles.page} {...swipe}>
      <header className={styles.head}>
        <div>
          <Link to="/yds-test" className={styles.backLink}>
            ← Alıştırma Merkezi
          </Link>
          <h1 className={styles.title}>{bundle.exam.title}</h1>
          <p className="muted" style={{ margin: 0, fontSize: '0.88rem' }}>
            {done}/{questions.length} cevaplandı · {correct} doğru
          </p>
        </div>
      </header>

      <div
        className={styles.navigator}
        role="navigation"
        aria-label="Sorular"
        style={questions.length <= 6 ? { gridTemplateColumns: `repeat(${questions.length}, minmax(0, 1fr))` } : undefined}
      >
        {questions.map((x, i) => {
          const ok = checked[x.no] && picks[x.no] === x.answer
          const bad = checked[x.no] && picks[x.no] !== x.answer
          return (
            <button
              key={x.no}
              type="button"
              className={`${styles.navBtn} ${i === idx ? styles.navCurrent : ''} ${ok ? styles.navOk : ''} ${bad ? styles.navBad : ''}`}
              onClick={() => setIdx(i)}
            >
              {setId === DEMO_ID ? `${sectionOf(x.no).icon} ${sectionOf(x.no).label}` : i + 1}
            </button>
          )
        })}
      </div>

      <QuestionCard key={q.no} bundle={bundle} q={q} choice={choice} revealed={revealed} onChoose={choose} ai={false}>
        <div className={styles.actions}>
          {!revealed ? (
            !quick && (
              <button type="button" className="btn btn-primary" disabled={!choice} onClick={() => setChecked((c) => ({ ...c, [q.no]: true }))}>
                Cevabı kontrol et
              </button>
            )
          ) : (
            <span className={choice === q.answer ? styles.okText : styles.badText}>
              {choice === q.answer ? '✓ Doğru' : `✗ Yanlış — doğru cevap: ${q.answer}`}
            </span>
          )}
          <span className={styles.spacer} />
          <button type="button" className="btn btn-ghost" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>
            ← Önceki
          </button>
          <button type="button" className="btn btn-secondary" disabled={idx === questions.length - 1} onClick={() => setIdx(idx + 1)}>
            Sonraki →
          </button>
        </div>
        <QuickAnswerToggle value={quick} onChange={setQuick} />
        {revealed && hints?.[q.no] && (
          <p className={styles.grammarLink} style={{ marginTop: '0.85rem' }}>
            💡 <strong>Nasıl çözülür?</strong> {hints[q.no]}
          </p>
        )}
        {revealed && oq && (
          <div className={styles.grammarLink} style={{ marginTop: '0.85rem', display: 'grid', gap: '0.3rem' }}>
            {oq.tip && (
              <span>
                💡 <strong>Nasıl çözülür?</strong> {oq.tip}
              </span>
            )}
            {oq.x.map((note, i) => (
              <span key={i} className={i === oq.a ? styles.okText : undefined}>
                <strong>{letters[i]})</strong> {note}
              </span>
            ))}
          </div>
        )}
      </QuestionCard>

      {finished && (
        <article className={`card ${styles.doneCard}`}>
          <div className={styles.doneEmoji}>{correct === questions.length ? '🎉' : '👏'}</div>
          <h2>
            {correct} / {questions.length} doğru
          </h2>
          <div className={styles.actions} style={{ marginTop: 0 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setPicks({})
                setChecked({})
                setIdx(0)
              }}
            >
              ↺ Baştan çöz
            </button>
            {nextId ? (
              <Link to={`/yds-test/${nextId}`} className="btn btn-primary">
                Sıradaki set →
              </Link>
            ) : (
              <Link to="/dilbilgisi" className="btn btn-primary">
                Dilbilgisi Rehberi →
              </Link>
            )}
          </div>
        </article>
      )}
    </section>
  )
}

function SetPage() {
  const { setId = '' } = useParams()
  // key: set değişince bileşen sıfırdan kurulur (yükleme durumu için efektte state sıfırlamaya gerek kalmaz)
  return <SetLoader key={setId} setId={setId} />
}

function SetLoader({ setId }: { setId: string }) {
  const [state, setState] = useState<{ bundle: ExamBundle; set: OzgunSet; nextId?: string } | 'missing' | null>(null)

  useEffect(() => {
    let alive = true
    void Promise.all([loadOzgunSet(setId), listOzgunSets()]).then(([r, all]) => {
      if (!alive) return
      if (!r) return setState('missing')
      const same = all.filter((s) => s.type === r.type)
      const next = same[same.findIndex((s) => s.id === setId) + 1]
      setState({ bundle: r.bundle, set: r.set, nextId: next?.id })
    })
    return () => {
      alive = false
    }
  }, [setId])

  if (state === null) return <p className="muted">Yükleniyor…</p>
  if (state === 'missing')
    return (
      <p className="muted">
        Set bulunamadı. <Link to="/yds-test">Alıştırma Merkezi’ne dön</Link>
      </p>
    )
  return <Runner key={setId} setId={setId} bundle={state.bundle} set={state.set} nextId={state.nextId} />
}

export function YdsTestPage() {
  return (
    <Routes>
      <Route index element={<Hub />} />
      <Route path={DEMO_ID} element={<Runner setId={DEMO_ID} bundle={YDS_DEMO} hints={YDS_DEMO_HINTS} />} />
      <Route path="ceviri" element={<TranslationWorkshop />} />
      <Route path=":setId" element={<SetPage />} />
    </Routes>
  )
}

export default YdsTestPage
