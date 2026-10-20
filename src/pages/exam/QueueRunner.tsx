import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { recordAnswer, removeFromWrongBook, answerId } from '../../services/examProgress'
import { useUserStore } from '../../stores/user'
import styles from '../ExamStudy.module.css'
import { shortTitle, type ExamBundle, type Question } from './examData'
import { QuestionCard } from './QuestionCard'
import { ReasonPicker } from './ReasonPicker'
import { SimilarQuestion } from './SimilarQuestion'
import { QuickAnswerToggle, useQuestionNav, useQuickAnswer } from './answerControls'

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
  const [pos, setPos] = useState(0)
  // Bu turda verilen cevaplar (sıra -> seçim/sonuç): geri dönülen soru cevabıyla görünür
  const [done, setDone] = useState<Record<number, { choice: string; ok: boolean }>>({})
  const [picked, setPicked] = useState<{ pos: number; letter: string } | null>(null)
  const [quick, setQuick] = useQuickAnswer()
  const swipe = useQuestionNav(
    () => setPos((p) => Math.max(0, p - 1)),
    () => setPos((p) => Math.min(items.length, p + 1)),
  )
  const score = Object.values(done).reduce(
    (s, d) => (d.ok ? { ...s, correct: s.correct + 1 } : { ...s, wrong: s.wrong + 1 }),
    { correct: 0, wrong: 0 },
  )
  const result = done[pos]?.ok ?? null
  const choice = done[pos]?.choice ?? (picked?.pos === pos ? picked.letter : null)

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

  async function check(letter = choice) {
    if (!letter || !q.answer || done[pos]) return
    const ok = letter === q.answer
    await recordAnswer(userId, bundle.exam.id, q.no, letter, ok, { fromWrongBook: wrongBook })
    setDone((d) => ({ ...d, [pos]: { choice: letter, ok } }))
  }

  // Hızlı cevap modunda şıkka dokunmak doğrudan kontrol eder
  function choose(letter: string) {
    setPicked({ pos, letter })
    if (quick) void check(letter)
  }

  async function dropFromBook() {
    await removeFromWrongBook(answerId(userId, bundle.exam.id, q.no))
    setPos(pos + 1)
  }

  return (
    <section className={styles.page} {...swipe}>
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
        onChoose={choose}
        subtitle={shortTitle(bundle.exam.title)}
        onPrev={pos > 0 ? () => setPos(pos - 1) : undefined}
        onNext={() => setPos(pos + 1)}
        nextLabel={result === null ? 'Atla →' : 'Sonraki →'}
      >
        <div className={styles.actions}>
          {result === null ? (
            !quick && (
              <button type="button" className="btn btn-primary" disabled={!choice} onClick={() => void check()}>
                Cevabı kontrol et
              </button>
            )
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
          <button type="button" className="btn btn-ghost" disabled={pos === 0} onClick={() => setPos(pos - 1)}>
            ← Önceki
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setPos(pos + 1)}>
            {result === null ? 'Atla →' : 'Sonraki →'}
          </button>
        </div>
        {result === false && <ReasonPicker answerId={answerId(userId, bundle.exam.id, q.no)} />}
        {result === false && <SimilarQuestion key={`${bundle.exam.id}-${q.no}`} bundle={bundle} q={q} />}
        <QuickAnswerToggle value={quick} onChange={setQuick} />
      </QuestionCard>
    </section>
  )
}
