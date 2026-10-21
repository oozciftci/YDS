import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { db } from '../../db'
import { recordAnswer, resetExamAnswers } from '../../services/examProgress'
import { getSection, type SectionKey } from '../../services/ydsSections'
import { useUserStore } from '../../stores/user'
import styles from '../ExamStudy.module.css'
import { imageUrl, loadBook, type Book } from '../books/bookData'
import { QuickAnswerToggle, useQuestionNav, useQuickAnswer } from './answerControls'
import { QuestionNav } from './QuestionNav'
import { localFetch, useLocalUrl } from '../../services/localContent'

// Görüntü tabanlı soru bankası (taranmış kitap): soru metni yok; her soru sayfadaki kutusuyla gösterilir,
// şıklar düğmelerle işaretlenir, cevap kitabın cevap anahtarından kontrol edilir. Veri yalnızca yerelde.

const STRATEJI3 = 'modadil-sinav-stratejileri-3'

interface ImgQuestion {
  n: number
  page: number | null
  /** Sayfadaki kutu (oran): x0, y0, x1, y1 */
  box: [number, number, number, number] | null
  answer: string
}
interface ImgTest {
  id: string
  section: string
  type: SectionKey
  no: number
  pages: number[]
  passage: boolean
  questions: ImgQuestion[]
}

let testsCache: Promise<{ title: string; tests: ImgTest[] }> | null = null
function loadTests(bookId: string) {
  testsCache ??= localFetch(`/local-api/kitap/${bookId}/testler`).then((r) => {
    if (!r.ok) {
      testsCache = null
      throw new Error(String(r.status))
    }
    return r.json()
  })
  return testsCache
}

/** Uygulamadaki sınav kimliği: banka-<tip>-… sayesinde istatistikte doğru soru tipine sayılır. */
const examIdOf = (t: ImgTest) => `banka-${t.type}-strateji3-${t.id}`

/** Konulara göre test listesi. */
export function ImageTestList() {
  const navigate = useNavigate()
  const userId = useUserStore((s) => s.activeUserId)
  const [data, setData] = useState<{ title: string; tests: ImgTest[] } | null>(null)
  const [error, setError] = useState('')
  const [open, setOpen] = useState<string | null>(null)

  useEffect(() => {
    loadTests(STRATEJI3)
      .then(setData)
      .catch(() => setError('Testler bulunamadı. python scripts/buildStrateji3.py ile üretilmeli (yalnızca yerelde).'))
  }, [])

  const answers = useLiveQuery(
    () => db.examAnswers.where('userId').equals(userId).filter((a) => a.examId.includes('-strateji3-')).toArray(),
    [userId],
  )
  const perExam = useMemo(() => {
    const m = new Map<string, { answered: number; correct: number }>()
    for (const a of answers ?? []) {
      const s = m.get(a.examId) ?? { answered: 0, correct: 0 }
      s.answered++
      if (a.correct) s.correct++
      m.set(a.examId, s)
    }
    return m
  }, [answers])

  if (error) return <p className="muted">{error}</p>
  if (!data || !answers) return <p className="muted">Yükleniyor…</p>

  const sections = [...new Set(data.tests.map((t) => t.section))]
  const total = data.tests.reduce((n, t) => n + t.questions.length, 0)

  return (
    <section className={styles.page}>
      <header className={styles.head}>
        <div>
          <Link to="/yds-sorular/bankalar" className={styles.backLink}>
            ← Soru bankaları
          </Link>
          <h1 className={styles.title}>📚 {data.title}</h1>
          <p className="muted" style={{ margin: 0 }}>
            {data.tests.length} test · {total} soru · Çözülen {answers.length}. Konuya tıkla, testi seç.
          </p>
        </div>
      </header>
      {sections.map((sec) => {
        const list = data.tests.filter((t) => t.section === sec)
        const kind = getSection(list[0].type)
        const done = list.reduce((n, t) => n + (perExam.get(examIdOf(t))?.answered ?? 0), 0)
        const count = list.reduce((n, t) => n + t.questions.length, 0)
        const isOpen = open === sec
        return (
          <article key={sec} className="card">
            <button type="button" className={styles.qnavBar} onClick={() => setOpen(isOpen ? null : sec)} aria-expanded={isOpen}>
              <span>
                {kind.icon} <strong>{sec}</strong>
              </span>
              <span className="muted">
                {list.length} test · {done}/{count} çözüldü
              </span>
              <span className={styles.qnavHint}>{isOpen ? '▴' : '▾'}</span>
            </button>
            {isOpen && (
              <ul className={styles.examList} style={{ marginTop: '0.5rem' }}>
                {list.map((t) => {
                  const st = perExam.get(examIdOf(t))
                  const n = t.questions.length
                  return (
                    <li key={t.id} className={styles.examRow}>
                      <span className={styles.examName}>
                        Test {t.no}
                        <small>{st ? `${st.answered}/${n} çözüldü · ${st.correct} doğru` : `${n} soru`}</small>
                      </span>
                      <span className={styles.bar} aria-hidden="true">
                        <span className={styles.barFill} style={{ width: `${((st?.answered ?? 0) / n) * 100}%` }} />
                      </span>
                      <span className={styles.examActions}>
                        <button type="button" className="btn btn-secondary" onClick={() => navigate(t.id)}>
                          {st && st.answered < n ? 'Devam' : 'Çöz'}
                        </button>
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </article>
        )
      })}
    </section>
  )
}

/** Sayfanın bir bölgesini kırparak gösterir (kutu yoksa tam sayfa). */
function PageCrop({ book, page, box }: { book: Book; page: number; box: [number, number, number, number] | null }) {
  const p = book.pages[page - 1]
  const [x0, y0, x1, y1] = box ?? [0, 0, 1, 1]
  const bw = x1 - x0
  const bh = y1 - y0
  const src = useLocalUrl(imageUrl(book.id, page))
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

/** Bir testi soru soru çöz. */
export function ImageTestRunner() {
  const { testId = '' } = useParams()
  const userId = useUserStore((s) => s.activeUserId)
  const [test, setTest] = useState<ImgTest | null>(null)
  const [book, setBook] = useState<Book | null>(null)
  const [error, setError] = useState('')
  const [idx, setIdx] = useState(0)
  const [choice, setChoice] = useState<string | null>(null)
  const [showPage, setShowPage] = useState(false)
  const [quick, setQuick] = useQuickAnswer()

  useEffect(() => {
    Promise.all([loadTests(STRATEJI3), loadBook(STRATEJI3)])
      .then(([d, b]) => {
        const t = d.tests.find((x) => x.id === testId)
        if (!t) throw new Error('yok')
        setTest(t)
        setBook(b)
      })
      .catch(() => setError('Test bulunamadı.'))
  }, [testId])

  const examId = test ? examIdOf(test) : ''
  const answers = useLiveQuery(() => db.examAnswers.where('[userId+examId]').equals([userId, examId]).toArray(), [userId, examId])
  const byNo = useMemo(() => new Map((answers ?? []).map((a) => [a.no, a])), [answers])

  const count = test?.questions.length ?? 0
  const swipe = useQuestionNav(
    () => setIdx((i) => Math.max(0, i - 1)),
    () => setIdx((i) => Math.min(count - 1, i + 1)),
    { canPrev: idx > 0, canNext: idx < count - 1 },
  )

  // Açılışta ilk çözülmemiş soruya git
  const [started, setStarted] = useState(false)
  if (!started && test && answers) {
    setStarted(true)
    const first = test.questions.findIndex((q) => !byNo.has(q.n))
    setIdx(first === -1 ? 0 : first)
  }

  const q = test?.questions[idx]
  const saved = q ? byNo.get(q.n) : undefined
  // Soru değişince seçimi kayda eşitle
  const [prevKey, setPrevKey] = useState('')
  const key = `${testId}:${idx}:${saved?.choice ?? ''}`
  if (key !== prevKey) {
    setPrevKey(key)
    setChoice(saved?.choice ?? null)
    setShowPage(false)
  }

  if (error) return <p className="muted">{error}</p>
  if (!test || !book || !answers || !q) return <p className="muted">Yükleniyor…</p>

  const revealed = Boolean(saved)
  const correct = answers.filter((a) => a.correct).length

  async function check(letter = choice) {
    if (!q || !letter) return
    await recordAnswer(userId, examId, q.n, letter, letter === q.answer)
  }
  function choose(l: string) {
    if (revealed) return
    setChoice(l)
    if (quick) void check(l)
  }
  async function reset() {
    if (!confirm('Bu testteki cevapların silinsin mi?')) return
    await resetExamAnswers(userId, examId)
    setIdx(0)
  }

  const kind = getSection(test.type)
  // Kutusu bulunamayan soruda ya da paragraflı tipte sayfanın tamamı önemli
  const pagesForQ = q.page ? [q.page] : test.pages

  return (
    <section className={styles.page} {...swipe.props}>
      <header className={styles.compactHead}>
        <Link to=".." relative="path" className={styles.backLink}>
          ← {test.section}
        </Link>
        <h1>
          {test.section} · Test {test.no}
        </h1>
        <span className="muted" style={{ fontSize: '0.85rem' }}>
          Çözülen {answers.length}/{count} · Doğru {correct}
        </span>
        <span className={styles.spacer} />
        {answers.length > 0 && (
          <button type="button" className="btn btn-ghost" onClick={() => void reset()}>
            ↺ Baştan çöz
          </button>
        )}
      </header>

      <QuestionNav
        count={count}
        idx={idx}
        onPick={setIdx}
        stateClass={(i) => {
          const a = byNo.get(test.questions[i].n)
          return a ? (a.correct ? styles.navOk : styles.navBad) : ''
        }}
      />

      <article className={`card ${styles.question}`} data-focus-stage>
        <h2 className={styles.sectionTitle}>
          Soru {q.n}
          <span className={styles.sectionChip}>
            {kind.icon} {kind.label}
          </span>
          <button type="button" className={styles.pdfBtn} onClick={() => setShowPage((v) => !v)}>
            {showPage ? 'Yalnız soru' : '📄 Sayfanın tamamı'}
          </button>
        </h2>
        {test.passage && !showPage && (
          <p className="muted" style={{ margin: '0 0 0.5rem', fontSize: '0.82rem' }}>
            Bu soru bir paragrafa bağlı; paragrafı görmek için “📄 Sayfanın tamamı”.
          </p>
        )}

        {showPage || !q.box
          ? pagesForQ.map((p) => <PageCrop key={p} book={book} page={p} box={null} />)
          : <PageCrop book={book} page={q.page ?? test.pages[0]} box={q.box} />}

        <div className={styles.letterRow} role="group" aria-label="Şıklar">
          {['A', 'B', 'C', 'D', 'E'].map((l) => {
            const state = revealed
              ? l === q.answer
                ? styles.letterOk
                : l === choice
                  ? styles.letterBad
                  : ''
              : l === choice
                ? styles.letterPicked
                : ''
            return (
              <button key={l} type="button" className={`${styles.letterBtn} ${state}`} onClick={() => choose(l)} disabled={revealed && l !== q.answer && l !== choice}>
                {l}
              </button>
            )
          })}
        </div>

        <div className={styles.actions}>
          {!revealed ? (
            !quick && (
              <button type="button" className="btn btn-primary" disabled={!choice} onClick={() => void check()}>
                Cevabı kontrol et
              </button>
            )
          ) : (
            <span className={saved?.correct ? styles.okText : styles.badText}>
              {saved?.correct ? '✓ Doğru' : `✗ Yanlış — doğru cevap: ${q.answer}`}
            </span>
          )}
          <span className={styles.spacer} />
          <button type="button" className="btn btn-ghost" disabled={idx === 0} onClick={() => void swipe.turn(-1)} data-focus-hide>
            ← Önceki
          </button>
          <button type="button" className="btn btn-secondary" disabled={idx === count - 1} onClick={() => void swipe.turn(1)} data-focus-hide>
            Sonraki →
          </button>
        </div>
        <QuickAnswerToggle value={quick} onChange={setQuick} />
      </article>
    </section>
  )
}

interface WrongItem {
  test: ImgTest
  q: ImgQuestion
}

/** Görüntü testlerindeki yanlışlar: en eski yanlıştan başlayarak; doğru çözülen defterden çıkar. */
export function ImageWrongBook() {
  const userId = useUserStore((s) => s.activeUserId)
  const [items, setItems] = useState<WrongItem[] | null>(null)
  const [book, setBook] = useState<Book | null>(null)
  const [pos, setPos] = useState(0)
  const [choice, setChoice] = useState<string | null>(null)
  const [result, setResult] = useState<boolean | null>(null)
  const [showPage, setShowPage] = useState(false)

  // Defter açılışta bir kez alınır (çözdükçe liste kaymasın)
  useEffect(() => {
    void Promise.all([
      loadTests(STRATEJI3),
      loadBook(STRATEJI3),
      db.examAnswers
        .where('userId')
        .equals(userId)
        .filter((a) => a.inWrongBook && a.examId.includes('-strateji3-'))
        .sortBy('answeredAt'),
    ]).then(([d, b, rows]) => {
      const byId = new Map(d.tests.map((t) => [examIdOf(t), t]))
      const out: WrongItem[] = []
      for (const r of rows) {
        const t = byId.get(r.examId)
        const q = t?.questions.find((x) => x.n === r.no)
        if (t && q) out.push({ test: t, q })
      }
      setBook(b)
      setItems(out)
    })
  }, [userId])

  const swipe = useQuestionNav(
    () => go(pos - 1),
    () => go(pos + 1),
    { canPrev: pos > 0, canNext: !!items && pos < items.length - 1 },
  )
  function go(i: number) {
    if (!items || i < 0 || i >= items.length) return
    setPos(i)
    setChoice(null)
    setResult(null)
    setShowPage(false)
  }

  if (!items || !book) return <p className="muted">Defter hazırlanıyor…</p>
  if (items.length === 0)
    return (
      <section className={styles.page}>
        <Link to="/yds-sorular/yanlislar" className={styles.backLink}>
          ← Yanlış Defteri
        </Link>
        <p>Sınav Stratejileri 3’te defterde soru yok. Yanlış yaptığın sorular burada toplanır.</p>
      </section>
    )
  if (pos >= items.length) return <p>Defterin sonuna geldin. 🎉</p>

  const { test, q } = items[pos]
  const kind = getSection(test.type)

  async function check(letter: string) {
    setChoice(letter)
    const ok = letter === q.answer
    setResult(ok)
    await recordAnswer(userId, examIdOf(test), q.n, letter, ok, { fromWrongBook: true })
  }

  return (
    <section className={styles.page} {...swipe.props}>
      <header className={styles.compactHead}>
        <Link to="/yds-sorular/yanlislar" className={styles.backLink}>
          ← Yanlış Defteri
        </Link>
        <h1>📕 Sınav Stratejileri 3 · Yanlışlar</h1>
        <span className="muted" style={{ fontSize: '0.85rem' }}>
          {pos + 1} / {items.length}
        </span>
      </header>
      <article className={`card ${styles.question}`} data-focus-stage>
        <h2 className={styles.sectionTitle}>
          {test.section} · Test {test.no} · Soru {q.n}
          <span className={styles.sectionChip}>
            {kind.icon} {kind.label}
          </span>
          <button type="button" className={styles.pdfBtn} onClick={() => setShowPage((v) => !v)}>
            {showPage ? 'Yalnız soru' : '📄 Sayfanın tamamı'}
          </button>
        </h2>
        {showPage || !q.box
          ? (q.page ? [q.page] : test.pages).map((p) => <PageCrop key={p} book={book} page={p} box={null} />)
          : <PageCrop book={book} page={q.page ?? test.pages[0]} box={q.box} />}
        <div className={styles.letterRow} role="group" aria-label="Şıklar">
          {['A', 'B', 'C', 'D', 'E'].map((l) => {
            const state =
              result === null ? '' : l === q.answer ? styles.letterOk : l === choice ? styles.letterBad : ''
            return (
              <button key={l} type="button" className={`${styles.letterBtn} ${state}`} disabled={result !== null} onClick={() => void check(l)}>
                {l}
              </button>
            )
          })}
        </div>
        <div className={styles.actions}>
          {result !== null && (
            <span className={result ? styles.okText : styles.badText}>
              {result ? '✓ Doğru — soru defterden çıkarıldı' : `✗ Yanlış — doğru cevap: ${q.answer}`}
            </span>
          )}
          <span className={styles.spacer} />
          <button type="button" className="btn btn-ghost" disabled={pos === 0} onClick={() => void swipe.turn(-1)} data-focus-hide>
            ← Önceki
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => void swipe.turn(1)} data-focus-hide>
            {result === null ? 'Atla →' : 'Sonraki →'}
          </button>
        </div>
      </article>
    </section>
  )
}
