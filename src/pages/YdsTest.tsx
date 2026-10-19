import { useState } from 'react'
import { Link } from 'react-router-dom'
import { YDS_DEMO, YDS_DEMO_HINTS } from '../data/ydsDemo'
import { sectionOf } from '../services/ydsSections'
import { QuestionCard } from './exam/QuestionCard'
import { QuickAnswerToggle, useQuestionNav, useQuickAnswer } from './exam/answerControls'
import styles from './ExamStudy.module.css'

// YDS TEST: üç özgün örnek soru (kelime, çeviri, paragraf). Çıkmış sınav içeriği yoktur; yayında da çalışır ve
// çıkmış soru çalışmasının aynı arayüzünü (cümle çevirisi, kelimeye dokununca anlam, anında kontrol) gösterir.

const questions = YDS_DEMO.exam.questions

export function YdsTestPage() {
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

  function choose(letter: string) {
    setPicks((p) => ({ ...p, [q.no]: letter }))
    if (quick) setChecked((c) => ({ ...c, [q.no]: true }))
  }

  return (
    <section className={styles.page} {...swipe}>
      <header className={styles.head}>
        <div>
          <h1 className={styles.title}>📝 YDS TEST</h1>
          <p className="muted" style={{ margin: 0 }}>
            ÖSYM düzeninde üç örnek soru: kelime, çeviri ve paragraf. Cümlenin başındaki 🌐 Türkçesini açar, bir kelimeye
            dokununca anlamı çıkar ve kelimeyi havuzuna ekleyebilirsin.
          </p>
        </div>
      </header>

      <div className={styles.navigator} role="navigation" aria-label="Sorular" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
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
              {sectionOf(x.no).icon} {sectionOf(x.no).label}
            </button>
          )
        })}
      </div>

      <QuestionCard bundle={YDS_DEMO} q={q} choice={choice} revealed={revealed} onChoose={choose} ai={false}>
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
        {revealed && (
          <p className={styles.grammarLink} style={{ marginTop: '0.85rem' }}>
            💡 <strong>Nasıl çözülür?</strong> {YDS_DEMO_HINTS[q.no]}
          </p>
        )}
      </QuestionCard>

      {done === questions.length && (
        <article className={`card ${styles.doneCard}`}>
          <div className={styles.doneEmoji}>{correct === questions.length ? '🎉' : '👏'}</div>
          <h2>
            {correct} / {questions.length} doğru
          </h2>
          <p className="muted">YDS’nin 80 sorusu bu üç tipin (ve diğerlerinin) farklı oranlardaki karışımıdır.</p>
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
            <Link to="/dilbilgisi" className="btn btn-primary">
              Dilbilgisi Rehberi →
            </Link>
          </div>
        </article>
      )}
    </section>
  )
}

export default YdsTestPage
