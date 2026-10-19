import { useState } from 'react'
import { Link, Route, Routes, useParams } from 'react-router-dom'
import { GRAMMAR_TOPICS, getGrammarTopic, type GrammarTopic } from '../data/grammar'
import { useUserStore } from '../stores/user'
import styles from './Grammar.module.css'

// Dilbilgisi rehberi: konu listesi (/dilbilgisi) ve konu sayfası (/dilbilgisi/:topicId).
// Alıştırma sonuçları kişisel bir kolaylık olarak tarayıcı deposunda tutulur.

type Progress = Record<string, { best: number; total: number; at: string }>

function storageKey(userId: string) {
  return `yds-grammar:${userId}`
}
function readProgress(userId: string): Progress {
  try {
    return JSON.parse(localStorage.getItem(storageKey(userId)) || '{}') as Progress
  } catch {
    return {}
  }
}
function saveScore(userId: string, topicId: string, score: number, total: number) {
  const p = readProgress(userId)
  const prev = p[topicId]
  p[topicId] = { best: Math.max(score, prev?.best ?? 0), total, at: new Date().toISOString() }
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(p))
  } catch {
    // Depo kapalıysa sonuç yalnızca bu oturumda görünür
  }
}

function TopicList() {
  const userId = useUserStore((s) => s.activeUserId)
  const [progress] = useState(() => readProgress(userId))
  const done = GRAMMAR_TOPICS.filter((t) => {
    const p = progress[t.id]
    return p !== undefined && p.best === p.total
  }).length

  return (
    <section className={styles.page}>
      <header>
        <h1 className={styles.title}>📘 Dilbilgisi Rehberi</h1>
        <p className="muted" style={{ margin: 0 }}>
          YDS’de sorulan {GRAMMAR_TOPICS.length} konu: kısa anlatım, örnekler, sınav ipucu ve 5 soruluk alıştırma.
          {done > 0 && ` ${done} konunun alıştırmasını eksiksiz çözdün.`}
        </p>
      </header>
      <ul className={styles.topicGrid}>
        {GRAMMAR_TOPICS.map((t) => {
          const p = progress[t.id]
          const perfect = p && p.best === p.total
          return (
            <li key={t.id}>
              <Link to={t.id} className={`card ${styles.topicCard}`}>
                <span className={styles.topicIcon}>{t.icon}</span>
                <span className={styles.topicBody}>
                  <strong>{t.title}</strong>
                  <span>{t.summary}</span>
                </span>
                {p && (
                  <span className={`${styles.scorePill} ${perfect ? styles.scorePerfect : ''}`}>
                    {perfect ? '✓ ' : ''}
                    {p.best}/{p.total}
                  </span>
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function Exercises({ topic }: { topic: GrammarTopic }) {
  const userId = useUserStore((s) => s.activeUserId)
  const [picks, setPicks] = useState<(number | null)[]>(() => topic.exercises.map(() => null))
  const answered = picks.filter((p) => p !== null).length
  const correct = picks.filter((p, i) => p === topic.exercises[i].answer).length

  function pick(i: number, opt: number) {
    if (picks[i] !== null) return
    const next = picks.map((p, j) => (j === i ? opt : p))
    setPicks(next)
    if (next.every((p) => p !== null)) {
      saveScore(userId, topic.id, next.filter((p, j) => p === topic.exercises[j].answer).length, next.length)
    }
  }

  return (
    <section className={styles.block}>
      <h2 className={styles.blockTitle}>✏️ Alıştırma</h2>
      <p className="muted" style={{ margin: '0 0 0.75rem', fontSize: '0.86rem' }}>
        Bir şık seçtiğinde doğru cevap ve kısa açıklaması hemen görünür.
      </p>
      <ol className={styles.exList}>
        {topic.exercises.map((x, i) => {
          const p = picks[i]
          return (
            <li key={i} className={`card ${styles.exCard}`}>
              <p className={styles.exQ}>{x.q}</p>
              <div className={styles.exOptions}>
                {x.options.map((o, k) => {
                  const state =
                    p === null ? '' : k === x.answer ? styles.optOk : k === p ? styles.optBad : styles.optDim
                  return (
                    <button
                      key={k}
                      type="button"
                      className={`${styles.exOpt} ${state}`}
                      onClick={() => pick(i, k)}
                      disabled={p !== null}
                    >
                      <span className={styles.exLetter}>{'ABCDE'[k]}</span>
                      {o}
                    </button>
                  )
                })}
              </div>
              {p !== null && (
                <p className={p === x.answer ? styles.whyOk : styles.whyBad}>
                  {p === x.answer ? '✓ Doğru. ' : `✗ Doğru cevap ${'ABCDE'[x.answer]}. `}
                  {x.why}
                </p>
              )}
            </li>
          )
        })}
      </ol>
      {answered === topic.exercises.length && (
        <div className={`card ${styles.result}`}>
          <strong>
            {correct} / {topic.exercises.length} doğru
          </strong>
          <span className="muted">
            {correct === topic.exercises.length
              ? 'Harika, bu konu tamam!'
              : 'Yanlış yaptığın soruların açıklamalarını oku, sonra yeniden dene.'}
          </span>
          <button type="button" className="btn btn-secondary" onClick={() => setPicks(topic.exercises.map(() => null))}>
            ↺ Yeniden çöz
          </button>
        </div>
      )}
    </section>
  )
}

function TopicPage() {
  const { topicId = '' } = useParams()
  const topic = getGrammarTopic(topicId)
  if (!topic) {
    return (
      <section className={styles.page}>
        <p>Konu bulunamadı.</p>
        <Link to="/dilbilgisi">← Dilbilgisi Rehberi</Link>
      </section>
    )
  }
  const idx = GRAMMAR_TOPICS.indexOf(topic)
  const next = GRAMMAR_TOPICS[idx + 1]

  return (
    <section className={styles.page}>
      <header>
        <Link to="/dilbilgisi" className={styles.back}>
          ← Dilbilgisi Rehberi
        </Link>
        <h1 className={styles.title}>
          {topic.icon} {topic.title}
        </h1>
        <p className="muted" style={{ margin: 0 }}>
          {topic.summary}
        </p>
      </header>

      <aside className={styles.tip}>
        <strong>🎯 Sınavda nasıl tanırsın?</strong>
        <p>{topic.ydsTip}</p>
      </aside>

      {topic.sections.map((s) => (
        <section key={s.heading} className={`card ${styles.block}`}>
          <h2 className={styles.blockTitle}>{s.heading}</h2>
          <ul className={styles.points}>
            {s.points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          {s.examples && (
            <ul className={styles.examples}>
              {s.examples.map((e) => (
                <li key={e.en}>
                  <span className={styles.exEn}>{e.en}</span>
                  <span className={styles.exTr}>{e.tr}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      {topic.traps.length > 0 && (
        <aside className={styles.traps}>
          <strong>⚠️ Sık yapılan hatalar</strong>
          <ul>
            {topic.traps.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </aside>
      )}

      <Exercises key={topic.id} topic={topic} />

      {next && (
        <Link to={`/dilbilgisi/${next.id}`} className={`card ${styles.nextCard}`}>
          Sonraki konu: {next.icon} <strong>{next.title}</strong> →
        </Link>
      )}
    </section>
  )
}

export default function GrammarPage() {
  return (
    <Routes>
      <Route index element={<TopicList />} />
      <Route path=":topicId" element={<TopicPage />} />
    </Routes>
  )
}
