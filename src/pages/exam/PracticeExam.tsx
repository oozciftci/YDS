import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { db } from '../../db'
import { recordAnswer, resetExamAnswers } from '../../services/examProgress'
import { useUserStore } from '../../stores/user'
import styles from '../ExamStudy.module.css'
import { loadExam, type ExamBundle } from './examData'
import { QuestionCard } from './QuestionCard'
import { QuestionNav } from './QuestionNav'
import { ReasonPicker } from './ReasonPicker'
import { SimilarQuestion } from './SimilarQuestion'
import { QuickAnswerToggle, useQuestionNav, useQuickAnswer } from './answerControls'

/** Bir sınavı sırayla çözme: her sorudan sonra cevap kontrol edilir. */
export function PracticeExam() {
  const { examId = '' } = useParams()
  const userId = useUserStore((s) => s.activeUserId)
  const [bundle, setBundle] = useState<ExamBundle | null>(null)
  const [error, setError] = useState('')
  const [idx, setIdx] = useState<number | null>(null)
  const [choice, setChoice] = useState<string | null>(null)
  const [quick, setQuick] = useQuickAnswer()
  const count = bundle?.exam.questions.length ?? 0
  const swipe = useQuestionNav(
    () => setIdx((i) => (i !== null && i > 0 ? i - 1 : i)),
    () => setIdx((i) => (i !== null && i < count - 1 ? i + 1 : i)),
    { canPrev: idx !== null && idx > 0, canNext: idx !== null && idx < count - 1 },
  )

  const answers = useLiveQuery(
    () => db.examAnswers.where('[userId+examId]').equals([userId, examId]).toArray(),
    [userId, examId],
  )
  const byNo = useMemo(() => new Map((answers ?? []).map((a) => [a.no, a])), [answers])

  useEffect(() => {
    setBundle(null)
    setIdx(null)
    try {
      localStorage.setItem('yds-exam-last', examId)
    } catch {
      // yoksay
    }
    loadExam(examId)
      .then(setBundle)
      .catch((e) => setError('Sınav yüklenemedi: ' + e))
  }, [examId])

  // İlk açılışta ilk çözülmemiş soruya git
  useEffect(() => {
    if (!bundle || !answers || idx !== null) return
    const first = bundle.exam.questions.findIndex((q) => !byNo.has(q.no))
    setIdx(first === -1 ? 0 : first)
  }, [bundle, answers, byNo, idx])

  const q = bundle && idx !== null ? bundle.exam.questions[idx] : undefined
  const saved = q ? byNo.get(q.no) : undefined
  const revealed = Boolean(saved)

  useEffect(() => {
    setChoice(saved?.choice ?? null)
    // Yalnızca soru değişince eşitle
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q?.no, examId, revealed])

  if (error) return <p className="muted">{error}</p>
  if (!bundle || !q || idx === null || !answers) return <p className="muted">Yükleniyor…</p>

  const total = bundle.exam.questions.length
  const correct = answers.filter((a) => a.correct).length
  const noKey = !q.answer

  async function check(letter = choice) {
    if (!q || !letter || !q.answer) return
    await recordAnswer(userId, examId, q.no, letter, letter === q.answer)
  }

  // Hızlı cevap modunda şıkka dokunmak doğrudan kontrol eder
  function choose(letter: string) {
    setChoice(letter)
    if (quick && !noKey) void check(letter)
  }

  async function reset() {
    if (!confirm('Bu sınavdaki tüm cevapların silinsin mi? (Yanlış Defteri’ndeki soruları da kaldırır.)')) return
    await resetExamAnswers(userId, examId)
    setIdx(0)
  }

  return (
    <section className={styles.page} {...swipe.props}>
      <header className={styles.compactHead}>
        {examId.startsWith('banka-') ? (
          <Link to="/yds-sorular/bankalar" className={styles.backLink}>
            ← Soru bankaları
          </Link>
        ) : (
          <Link to="/yds-sorular" className={styles.backLink}>
            ← Soru Merkezi
          </Link>
        )}
        <h1>{bundle.exam.title}</h1>
        <span className="muted" style={{ fontSize: '0.85rem' }}>
          Çözülen {answers.length}/{total} · Doğru {correct}
          {noKey && ' · Cevap anahtarı yok'}
        </span>
        <span className={styles.spacer} />
        {answers.length > 0 && (
          <button type="button" className="btn btn-ghost" onClick={() => void reset()}>
            ↺ Baştan çöz
          </button>
        )}
      </header>

      <QuestionNav
        count={total}
        idx={idx}
        onPick={setIdx}
        label={(i) => bundle.exam.questions[i].no}
        stateClass={(i) => {
          const a = byNo.get(bundle.exam.questions[i].no)
          return a ? (a.correct ? styles.navOk : styles.navBad) : ''
        }}
      />

      <QuestionCard
        bundle={bundle}
        q={q}
        choice={choice}
        revealed={revealed}
        onChoose={choose}
        onPrev={idx > 0 ? () => void swipe.turn(-1) : undefined}
        onNext={idx < total - 1 ? () => void swipe.turn(1) : undefined}
      >
        <div className={styles.actions}>
          {noKey ? (
            <span className="muted">Cevap anahtarı olmadığı için kontrol edilemiyor.</span>
          ) : !revealed ? (
            !quick && (
              <button type="button" className="btn btn-primary" disabled={!choice} onClick={() => void check()}>
                Cevabı kontrol et
              </button>
            )
          ) : (
            <span className={saved?.correct ? styles.okText : styles.badText}>
              {saved?.correct ? '✓ Doğru' : `✗ Yanlış — doğru cevap: ${q.answer}. Soru Yanlış Defteri’ne eklendi.`}
            </span>
          )}
          <span className={styles.spacer} />
          <button type="button" className="btn btn-ghost" disabled={idx === 0} onClick={() => void swipe.turn(-1)} data-focus-hide>
            ← Önceki
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={idx === total - 1}
            onClick={() => void swipe.turn(1)}
            data-focus-hide
          >
            Sonraki →
          </button>
        </div>
        {revealed && saved && !saved.correct && <ReasonPicker answerId={saved.id} />}
        {revealed && saved && !saved.correct && <SimilarQuestion key={q.no} bundle={bundle} q={q} />}
        {!noKey && <QuickAnswerToggle value={quick} onChange={setQuick} />}
      </QuestionCard>
    </section>
  )
}
