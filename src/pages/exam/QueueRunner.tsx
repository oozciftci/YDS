import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { recordAnswer, removeFromWrongBook, answerId } from '../../services/examProgress'
import { useUserStore } from '../../stores/user'
import styles from '../ExamStudy.module.css'
import { shortTitle, type ExamBundle, type Question } from './examData'
import { QuestionCard } from './QuestionCard'

export interface QueueItem {
  bundle: ExamBundle
  q: Question
}

interface Props {
  title: string
  description: ReactNode
  items: QueueItem[]
  /** Yanlış Defteri modu: doğru cevap soruyu defterden çıkarır. */
  wrongBook?: boolean
  /** Kuyruk boşken gösterilecek içerik. */
  empty: ReactNode
}

/** Farklı sınavlardan gelen soruları tek tek çözdürür (konuya göre çalışma, Yanlış Defteri). */
export function QueueRunner({ title, description, items, wrongBook, empty }: Props) {
  const userId = useUserStore((s) => s.activeUserId)
  const [pos, setPosRaw] = useState(0)
  const [choice, setChoice] = useState<string | null>(null)
  const [result, setResult] = useState<boolean | null>(null)
  const [score, setScore] = useState({ correct: 0, wrong: 0 })

  function setPos(n: number) {
    setPosRaw(n)
    setChoice(null)
    setResult(null)
  }

  const head = (
    <header className={styles.head}>
      <div>
        <Link to="/yds-sorular" className={styles.backLink}>
          ← Soru Merkezi
        </Link>
        <h1 className={styles.title}>{title}</h1>
        <p className="muted" style={{ margin: 0, fontSize: '0.88rem' }}>
          {description}
        </p>
      </div>
    </header>
  )

  if (items.length === 0) {
    return (
      <section className={styles.page}>
        {head}
        <article className="card">{empty}</article>
      </section>
    )
  }

  if (pos >= items.length) {
    const total = score.correct + score.wrong
    return (
      <section className={styles.page}>
        {head}
        <article className={`card ${styles.doneCard}`}>
          <div className={styles.doneEmoji}>🎉</div>
          <h2>Bu tur bitti</h2>
          <p>
            {total} soru · <strong className={styles.okText}>{score.correct} doğru</strong> ·{' '}
            <strong className={styles.badText}>{score.wrong} yanlış</strong>
          </p>
          {score.wrong > 0 && !wrongBook && <p className="muted">Yanlışların Yanlış Defteri’ne eklendi.</p>}
          <Link to="/yds-sorular" className="btn btn-primary">
            Soru Merkezi’ne dön
          </Link>
        </article>
      </section>
    )
  }

  const { bundle, q } = items[pos]

  async function check() {
    if (!choice || !q.answer) return
    const ok = choice === q.answer
    await recordAnswer(userId, bundle.exam.id, q.no, choice, ok, { fromWrongBook: wrongBook })
    setResult(ok)
    setScore((s) => (ok ? { ...s, correct: s.correct + 1 } : { ...s, wrong: s.wrong + 1 }))
  }

  async function dropFromBook() {
    await removeFromWrongBook(answerId(userId, bundle.exam.id, q.no))
    setPos(pos + 1)
  }

  return (
    <section className={styles.page}>
      {head}
      <div className={styles.progressLine}>
        <span>
          Soru {pos + 1} / {items.length}
        </span>
        <span className={styles.bar}>
          <span className={styles.barFill} style={{ width: `${(pos / items.length) * 100}%` }} />
        </span>
        <span className={styles.okText}>{score.correct} ✓</span>
        <span className={styles.badText}>{score.wrong} ✗</span>
      </div>

      <QuestionCard
        key={`${bundle.exam.id}-${q.no}`}
        bundle={bundle}
        q={q}
        choice={choice}
        revealed={result !== null}
        onChoose={setChoice}
        subtitle={shortTitle(bundle.exam.title)}
      >
        <div className={styles.actions}>
          {result === null ? (
            <button type="button" className="btn btn-primary" disabled={!choice} onClick={() => void check()}>
              Cevabı kontrol et
            </button>
          ) : (
            <span className={result ? styles.okText : styles.badText}>
              {result
                ? wrongBook
                  ? '✓ Doğru — soru defterden çıkarıldı'
                  : '✓ Doğru'
                : `✗ Yanlış — doğru cevap: ${q.answer}`}
            </span>
          )}
          <span className={styles.spacer} />
          {wrongBook && result === null && (
            <button type="button" className="btn btn-ghost" onClick={() => void dropFromBook()} title="Bu soruyu artık sorma">
              Defterden çıkar
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={() => setPos(pos + 1)}>
            {result === null ? 'Atla →' : 'Sonraki →'}
          </button>
        </div>
      </QuestionCard>
    </section>
  )
}
