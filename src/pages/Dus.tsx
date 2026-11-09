import { useEffect, useMemo, useState } from 'react'
import { Link, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import {
  DUS_SUBJECTS,
  DUS_TESTS,
  answerKey,
  dusImageUrl,
  dusNet,
  listDusExams,
  loadDusExam,
  loadDusSolutions,
  readDusAnswers,
  resetDusTest,
  saveDusAnswer,
  solvable,
  subjectOf,
  subjectSummary,
  testSummary,
  wrongKeys,
  type DusAnswers,
  type DusExam,
  type DusExamMeta,
  type DusQuestion,
  type DusSolution,
  type DusSubject,
  type DusTestKey,
} from '../services/dus'
import { useLocalUrl } from '../services/localContent'
import { AiText } from '../components/AiText'
import { DusAiExplain } from './DusAi'
import { useUserStore } from '../stores/user'
import styles from './ExamStudy.module.css'
import { QuickAnswerToggle, useQuestionNav, useQuickAnswer } from './exam/answerControls'
import { QuestionNav } from './exam/QuestionNav'

// DUS çalışma bölümü: ÖSYM'nin çıkmış DUS kitapçıkları (görüntü tabanlı; soru metni sayfadan kırpılır).
// Yalnızca geliştirmede ya da şifreli kaynak paketi yüklüyken görünür.

const LETTERS = ['A', 'B', 'C', 'D', 'E']

function useAnswers(): [DusAnswers, (a: DusAnswers) => void] {
  const userId = useUserStore((s) => s.activeUserId)
  const [state, setState] = useState(() => ({ userId, all: readDusAnswers(userId) }))
  // Kullanıcı değişince o kullanıcının kayıtları
  if (state.userId !== userId) setState({ userId, all: readDusAnswers(userId) })
  return [state.all, (all) => setState({ userId, all })]
}

/** Sayfanın bir bölgesini kırparak gösterir (kutu yoksa tam sayfa). */
function PageCrop({ exam, page, box }: { exam: DusExam; page: number; box: DusQuestion['box'] | null }) {
  const p = exam.pages[page - 1]
  const [x0, y0, x1, y1] = box ?? [0, 0, 1, 1]
  const bw = x1 - x0
  const bh = y1 - y0
  const src = useLocalUrl(dusImageUrl(exam.id, page))
  return (
    <div className={styles.cropFrame} style={{ aspectRatio: `${p.w * bw} / ${p.h * bh}` }}>
      <img
        src={src}
        alt={`Sayfa ${page}`}
        draggable={false}
        style={{ width: `${100 / bw}%`, left: `${(-x0 / bw) * 100}%`, top: `${(-y0 / bh) * 100}%` }}
      />
    </div>
  )
}

/** Sınav listesi: her sınavda Temel ve Klinik test ayrı çözülür. */
function DusHome() {
  const navigate = useNavigate()
  const [exams, setExams] = useState<DusExamMeta[] | null>(null)
  const [all] = useAnswers()
  useEffect(() => {
    void listDusExams().then(setExams)
  }, [])

  if (!exams) return <p className="muted">Yükleniyor…</p>
  if (!exams.length)
    return (
      <section className={styles.page}>
        <h1 className={styles.title}>🦷 DUS</h1>
        <p className="muted">
          DUS soruları bu cihazda yok. Bilgisayarda <b>Ayarlar › 📦 Kaynak paketi</b>’nden “DUS çıkmış soruları”nı şifreyle
          indirip buraya yükle.
        </p>
      </section>
    )

  const answered = Object.keys(all).length
  const correct = Object.values(all).filter((a) => a.ok).length
  const wrong = wrongKeys(all).length
  const total = exams.reduce((n, e) => n + e.counts.tbt + e.counts.kbt, 0)

  return (
    <section className={styles.page}>
      <header className={styles.head}>
        <div>
          <h1 className={styles.title}>🦷 DUS Çıkmış Sorular</h1>
          <p className="muted" style={{ margin: 0 }}>
            {exams.length} sınav · {total} soru · Çözülen {answered} · Doğru {correct}. Her sınavın Temel (40) ve Klinik (80)
            testini ayrı çöz. Net = doğru − yanlış/4.
          </p>
        </div>
      </header>
      {wrong > 0 && (
        <article className="card">
          <button type="button" className="btn btn-primary" onClick={() => navigate('yanlislar')}>
            📕 Yanlışlarım ({wrong})
          </button>
          <p className="muted" style={{ margin: '0.5rem 0 0', fontSize: '0.85rem' }}>
            Son cevabı yanlış olan sorular; doğru çözünce listeden çıkar.
          </p>
        </article>
      )}
      {DUS_TESTS.map((t) => (
        <details key={t.key} className="card" open={t.key === 'kbt'}>
          <summary>
            <strong>Derse göre çöz · {t.title}</strong>
          </summary>
          <ul className={styles.examList} style={{ marginTop: '0.5rem' }}>
            {DUS_SUBJECTS.filter((x) => x.test === t.key).map((x) => {
              const n = exams.length * (x.to - x.from + 1)
              const st = subjectSummary(all, x)
              return (
                <li key={x.id} className={styles.examRow}>
                  <span className={styles.examName}>
                    {x.icon} {x.title}
                    <small>
                      {st.answered
                        ? `${st.answered}/${n} çözüldü · %${Math.round((st.correct / st.answered) * 100)} doğru`
                        : `${n} soru · sınav başına ${x.to - x.from + 1}`}
                    </small>
                  </span>
                  <span className={styles.bar} aria-hidden="true">
                    <span className={styles.barFill} style={{ width: `${(st.answered / n) * 100}%` }} />
                  </span>
                  <span className={styles.examActions}>
                    <button type="button" className="btn btn-secondary" onClick={() => navigate(`ders/${x.id}`)}>
                      {st.answered && st.answered < n ? 'Devam' : 'Çöz'}
                    </button>
                  </span>
                </li>
              )
            })}
          </ul>
        </details>
      ))}
      <h2 className={styles.sectionTitle} style={{ margin: '0.5rem 0 0' }}>
        Sınav sınav
      </h2>
      <ul className={styles.examList}>
        {exams.map((e) =>
          DUS_TESTS.map((t) => {
            const n = e.counts[t.key]
            const st = testSummary(all, e.id, t.key)
            const net = dusNet(st.correct, st.answered - st.correct)
            return (
              <li key={`${e.id}/${t.key}`} className={styles.examRow}>
                <span className={styles.examName}>
                  {e.title} · {t.short}
                  <small>{st.answered ? `${st.answered}/${n} çözüldü · ${st.correct} doğru · net ${net}` : `${n} soru`}</small>
                </span>
                <span className={styles.bar} aria-hidden="true">
                  <span className={styles.barFill} style={{ width: `${(st.answered / n) * 100}%` }} />
                </span>
                <span className={styles.examActions}>
                  <button type="button" className="btn btn-secondary" onClick={() => navigate(`${e.id}/${t.key}`)}>
                    {st.answered && st.answered < n ? 'Devam' : 'Çöz'}
                  </button>
                </span>
              </li>
            )
          }),
        )}
      </ul>
      <p className="muted" style={{ fontSize: '0.8rem' }}>
        Sorular ÖSYM’nin yayımladığı kitapçıklardan alınmıştır; telif hakkı ÖSYM’ye aittir. Yalnızca kişisel çalışma içindir,
        paylaşma. İptal edilen sorular listede yok.
      </p>
    </section>
  )
}

/** Soru kutusu + şıklar: çözme ve yanlışlar ekranında ortak. */
function QuestionCard({
  exam,
  test,
  q,
  title,
  chip,
  saved,
  onAnswer,
  quick,
  footer,
}: {
  exam: DusExam
  test: DusTestKey
  q: DusQuestion
  title: string
  chip?: DusSubject
  saved: { c: string; ok: boolean } | undefined
  onAnswer: (letter: string) => void
  quick: boolean
  footer: React.ReactNode
}) {
  const [choice, setChoice] = useState<string | null>(saved?.c ?? null)
  const [showPage, setShowPage] = useState(false)
  const [solution, setSolution] = useState<DusSolution | undefined>(undefined)
  useEffect(() => {
    let alive = true
    void loadDusSolutions(exam.id).then((all) => alive && setSolution(all[`${test}/${q.n}`]))
    return () => {
      alive = false
    }
  }, [exam.id, test, q.n])
  const revealed = Boolean(saved)
  function choose(l: string) {
    if (revealed) return
    setChoice(l)
    if (quick) onAnswer(l)
  }
  return (
    <article className={`card ${styles.question}`} data-focus-stage>
      <h2 className={styles.sectionTitle}>
        {title}
        {chip && (
          <span className={styles.sectionChip}>
            {chip.icon} {chip.title}
          </span>
        )}
        <button type="button" className={styles.pdfBtn} onClick={() => setShowPage((v) => !v)}>
          {showPage ? 'Yalnız soru' : '📄 Sayfanın tamamı'}
        </button>
      </h2>
      <PageCrop exam={exam} page={q.page} box={showPage ? null : q.box} />
      <div className={styles.letterRow} role="group" aria-label="Şıklar">
        {LETTERS.map((l) => {
          const state = revealed
            ? l === q.answer
              ? styles.letterOk
              : l === saved?.c
                ? styles.letterBad
                : ''
            : l === choice
              ? styles.letterPicked
              : ''
          return (
            <button
              key={l}
              type="button"
              className={`${styles.letterBtn} ${state}`}
              onClick={() => choose(l)}
              disabled={revealed && l !== q.answer && l !== saved?.c}
            >
              {l}
            </button>
          )
        })}
      </div>
      <div className={styles.actions}>
        {!revealed ? (
          !quick && (
            <button type="button" className="btn btn-primary" disabled={!choice} onClick={() => choice && onAnswer(choice)}>
              Cevabı kontrol et
            </button>
          )
        ) : (
          <span className={saved?.ok ? styles.okText : styles.badText}>
            {saved?.ok ? '✓ Doğru' : `✗ Yanlış — doğru cevap: ${q.answer}`}
          </span>
        )}
        <span className={styles.spacer} />
        {footer}
      </div>
      {solution?.terimler?.length ? (
        <details className={styles.aiBox} data-noswipe>
          <summary>📖 Bu sorudaki terimler ({solution.terimler.length})</summary>
          <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.2rem', display: 'grid', gap: '0.25rem' }}>
            {solution.terimler.map((x) => (
              <li key={x.t}>
                <strong>{x.t}</strong>: {x.a}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      {revealed && solution?.cozum && (
        <div className={styles.aiBox} data-noswipe>
          <strong>💡 Çözüm</strong>
          <AiText text={solution.cozum} />
          <small className="muted">Yapay zekâyla önceden hazırlandı, uzman kontrolünden geçmedi; ÖSYM cevap anahtarı esastır.</small>
        </div>
      )}
      {revealed && <DusAiExplain key={`${exam.id}/${test}/${q.n}`} exam={exam} test={test} q={q} choice={saved?.c} />}
    </article>
  )
}

/** Bir testi soru soru çöz. */
function DusRunner() {
  const { examId = '', test: testKey = 'tbt' } = useParams()
  const userId = useUserStore((s) => s.activeUserId)
  const [exam, setExam] = useState<DusExam | null>(null)
  const [error, setError] = useState('')
  const [idx, setIdx] = useState<number | null>(null)
  const [all, setAll] = useAnswers()
  const [quick, setQuick] = useQuickAnswer()

  useEffect(() => {
    loadDusExam(examId)
      .then(setExam)
      .catch(() => setError('Sınav bulunamadı.'))
  }, [examId])

  const test = exam?.tests.find((t) => t.key === testKey)
  const questions = useMemo(() => (test ? solvable(test) : []), [test])
  const key = (q: DusQuestion) => answerKey(examId, testKey as DusTestKey, q.n)

  // Açılışta ilk çözülmemiş soru
  if (idx === null && questions.length) {
    const first = questions.findIndex((q) => !all[key(q)])
    setIdx(first === -1 ? 0 : first)
  }
  const i = idx ?? 0
  const count = questions.length
  const swipe = useQuestionNav(
    () => setIdx(Math.max(0, i - 1)),
    () => setIdx(Math.min(count - 1, i + 1)),
    { canPrev: i > 0, canNext: i < count - 1 },
  )

  if (error) return <p className="muted">{error}</p>
  if (!exam || !test) return <p className="muted">Yükleniyor…</p>
  const q = questions[i]
  const st = testSummary(all, examId, test.key)

  function reset() {
    if (!confirm('Bu testteki cevapların silinsin mi?')) return
    setAll(resetDusTest(userId, examId, test!.key))
    setIdx(0)
  }

  return (
    <section className={styles.page} {...swipe.props}>
      <header className={styles.compactHead}>
        <Link to="/dus" className={styles.backLink}>
          ← DUS
        </Link>
        <h1>
          {exam.title} · {test.title}
        </h1>
        <span className="muted" style={{ fontSize: '0.85rem' }}>
          Çözülen {st.answered}/{count} · Doğru {st.correct} · Net {dusNet(st.correct, st.answered - st.correct)}
        </span>
        <span className={styles.spacer} />
        {st.answered > 0 && (
          <button type="button" className="btn btn-ghost" onClick={reset}>
            ↺ Baştan çöz
          </button>
        )}
      </header>

      <QuestionNav
        count={count}
        idx={i}
        onPick={setIdx}
        stateClass={(j) => {
          const a = all[key(questions[j])]
          return a ? (a.ok ? styles.navOk : styles.navBad) : ''
        }}
      />

      <QuestionCard
        key={`${examId}/${testKey}/${q.n}`}
        exam={exam}
        test={test.key}
        q={q}
        title={`Soru ${q.n}`}
        chip={subjectOf(test.key, q.n)}
        saved={all[key(q)]}
        quick={quick}
        onAnswer={(l) => setAll(saveDusAnswer(userId, key(q), l, l === q.answer))}
        footer={
          <>
            <button type="button" className="btn btn-ghost" disabled={i === 0} onClick={() => void swipe.turn(-1)} data-focus-hide>
              ← Önceki
            </button>
            <button type="button" className="btn btn-secondary" disabled={i === count - 1} onClick={() => void swipe.turn(1)} data-focus-hide>
              Sonraki →
            </button>
          </>
        }
      />
      <QuickAnswerToggle value={quick} onChange={setQuick} />
    </section>
  )
}

interface QueueItem {
  exam: DusExam
  test: DusTestKey
  q: DusQuestion
  key: string
}

/** Anahtarlardan (sınav/test/no) soru listesi kurar; sınavlar gerektiği kadar yüklenir. */
async function itemsOf(keys: string[]): Promise<QueueItem[]> {
  const ids = [...new Set(keys.map((k) => k.split('/')[0]))]
  const list = await Promise.all(ids.map((id) => loadDusExam(id).catch(() => null)))
  const byId = new Map(list.filter((e): e is DusExam => !!e).map((e) => [e.id, e]))
  const out: QueueItem[] = []
  for (const k of keys) {
    const [id, test, n] = k.split('/')
    const exam = byId.get(id)
    const q = exam?.tests.find((t) => t.key === test)?.questions.find((x) => x.n === Number(n))
    if (exam && q && q.answer !== 'X') out.push({ exam, test: test as DusTestKey, q, key: k })
  }
  return out
}

/**
 * Sınavlar arası soru kuyruğu: Yanlışlarım (son cevabı yanlış olanlar; bu ekranda verilen cevaplar ayrı tutulur ki
 * liste kaymasın) ya da bir ders (tüm sınavlardaki o dersin soruları, yeniden eskiye; kayıtlı cevaplar görünür).
 */
function DusQueue({ subject }: { subject?: DusSubject }) {
  const userId = useUserStore((s) => s.activeUserId)
  const [all, setAll] = useAnswers()
  const [items, setItems] = useState<QueueItem[] | null>(null)
  const [pos, setPos] = useState(0)
  const [quick, setQuick] = useQuickAnswer()
  const [session, setSession] = useState<Record<string, { c: string; ok: boolean }>>({})

  useEffect(() => {
    let alive = true
    const answers = readDusAnswers(userId)
    const load = subject
      ? listDusExams().then((exams) =>
          itemsOf(
            exams.flatMap((e) =>
              Array.from({ length: subject.to - subject.from + 1 }, (_, i) => answerKey(e.id, subject.test, subject.from + i)),
            ),
          ),
        )
      : itemsOf(wrongKeys(answers))
    void load.then((list) => {
      if (!alive) return
      setItems(list)
      // Derste ilk çözülmemiş sorudan başla
      if (subject) {
        const first = list.findIndex((it) => !answers[it.key])
        setPos(first === -1 ? 0 : first)
      }
    })
    return () => {
      alive = false
    }
  }, [userId, subject])

  const count = items?.length ?? 0
  const swipe = useQuestionNav(
    () => setPos((p) => Math.max(0, p - 1)),
    () => setPos((p) => Math.min(count - 1, p + 1)),
    { canPrev: pos > 0, canNext: pos < count - 1 },
  )

  if (!items) return <p className="muted">Hazırlanıyor…</p>
  if (!items.length)
    return (
      <section className={styles.page}>
        <Link to="/dus" className={styles.backLink}>
          ← DUS
        </Link>
        <p>{subject ? 'Bu derste soru bulunamadı.' : 'Yanlış soru yok. 🎉'}</p>
      </section>
    )
  const it = items[Math.min(pos, count - 1)]
  const t = DUS_TESTS.find((x) => x.key === it.test)!
  const saved = subject ? all[it.key] : session[it.key]
  const st = subject ? subjectSummary(all, subject) : null

  return (
    <section className={styles.page} {...swipe.props}>
      <header className={styles.compactHead}>
        <Link to="/dus" className={styles.backLink}>
          ← DUS
        </Link>
        <h1>{subject ? `${subject.icon} ${subject.title}` : '📕 Yanlışlarım'}</h1>
        <span className="muted" style={{ fontSize: '0.85rem' }}>
          {pos + 1} / {count}
          {st
            ? ` · Çözülen ${st.answered} · Doğru ${st.correct} · Net ${dusNet(st.correct, st.answered - st.correct)}`
            : ` · Kalan yanlış ${wrongKeys(all).length}`}
        </span>
      </header>
      {subject && (
        <QuestionNav
          count={count}
          idx={pos}
          onPick={setPos}
          stateClass={(j) => {
            const a = all[items[j].key]
            return a ? (a.ok ? styles.navOk : styles.navBad) : ''
          }}
        />
      )}
      <QuestionCard
        key={it.key}
        exam={it.exam}
        test={it.test}
        q={it.q}
        title={`${it.exam.title} · ${t.short} · Soru ${it.q.n}`}
        chip={subject ? undefined : subjectOf(it.test, it.q.n)}
        saved={saved}
        quick={quick}
        onAnswer={(l) => {
          const ok = l === it.q.answer
          setSession((s) => ({ ...s, [it.key]: { c: l, ok } }))
          setAll(saveDusAnswer(userId, it.key, l, ok))
        }}
        footer={
          <>
            <button type="button" className="btn btn-ghost" disabled={pos === 0} onClick={() => void swipe.turn(-1)} data-focus-hide>
              ← Önceki
            </button>
            <button type="button" className="btn btn-secondary" disabled={pos >= count - 1} onClick={() => void swipe.turn(1)} data-focus-hide>
              {saved ? 'Sonraki →' : 'Atla →'}
            </button>
          </>
        }
      />
      <QuickAnswerToggle value={quick} onChange={setQuick} />
    </section>
  )
}

function SubjectRoute() {
  const { subjectId } = useParams()
  const subject = DUS_SUBJECTS.find((x) => x.id === subjectId)
  if (!subject) return <p className="muted">Ders bulunamadı.</p>
  return <DusQueue key={subject.id} subject={subject} />
}

/** Test değişince çözme ekranı baştan kurulur (ilk çözülmemiş soruya gider). */
function RunnerRoute() {
  const { examId, test } = useParams()
  return <DusRunner key={`${examId}/${test}`} />
}

export default function DusPage() {
  return (
    <Routes>
      <Route index element={<DusHome />} />
      <Route path="yanlislar" element={<DusQueue />} />
      <Route path="ders/:subjectId" element={<SubjectRoute />} />
      <Route path=":examId/:test" element={<RunnerRoute />} />
    </Routes>
  )
}
