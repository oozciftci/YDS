import { useEffect, useMemo, useState, type MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { cleanToken, lookupWordInSentence, type WordLookupResult } from '../services/dictionary'
import { createWord } from '../services/words'
import { speakWord } from '../services/tts'
import { useUserStore } from '../stores/user'
import styles from './ExamStudy.module.css'

// YDS soru çalışma sayfası. Veri yalnızca yerel geliştirme sunucusundan gelir (/local-api/yds);
// yayın derlemesinde bu sayfa hiç bulunmaz (bkz. App.tsx).

interface Seg {
  id: string
  en: string
}
interface Passage {
  id: string
  page?: number
  kind: 'cloze' | 'reading'
  text: string
  sentences: Seg[]
}
interface Question {
  no: number
  page?: number
  passage: string | null
  stem: Seg[]
  options: Record<string, Seg>
  answer: string | null
}
interface Exam {
  id: string
  pdf?: string
  pageFrom?: number
  pageTo?: number
  title: string
  passages: Passage[]
  questions: Question[]
}
type Progress = Record<number, { choice: string; correct: boolean }>

const WORD_RE = /([A-Za-zÇĞİÖŞÜçğıöşü0-9]+(?:['’][A-Za-z]+)?|[^\sA-Za-zÇĞİÖŞÜçğıöşü0-9]+|\s+)/g

interface PopoverState {
  word: string
  top: number
  left: number
}

/** Bir cümleyi tıklanabilir kelimelere böler; başındaki rozet cümle çevirisini açar/kapatır. */
function SentenceView({
  seg,
  tr,
  forceShow,
  onWord,
  badge,
}: {
  seg: Seg
  tr?: string
  forceShow: boolean
  onWord: (word: string, e: MouseEvent<HTMLButtonElement>) => void
  badge?: string
}) {
  const [open, setOpen] = useState(false)
  const show = open || forceShow
  const tokens = useMemo(() => seg.en.match(WORD_RE) || [seg.en], [seg.en])
  // Çeviri sorularında Türkçe cümleler olur: çevirisi/sözlük tıklaması gerekmez, düz metin gösterilir
  if ((seg.en.match(/[çğıöşüÇĞİÖŞÜ]/g) || []).length >= 2) {
    return <span className={styles.sentence}>{seg.en} </span>
  }
  return (
    <span className={styles.sentence}>
      <button
        type="button"
        className={`${styles.badge} ${show ? styles.badgeOn : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={show}
        title="Cümlenin Türkçesini göster/gizle"
      >
        {badge ?? '🌐'}
      </button>
      {tokens.map((t, i) =>
        /^[A-Za-zÇĞİÖŞÜçğıöşü0-9]/.test(t) ? (
          <button key={i} type="button" className={styles.word} onClick={(e) => onWord(t, e)}>
            {t}
          </button>
        ) : (
          <span key={i}>{t}</span>
        ),
      )}
      {show && (
        <span className={styles.trLine}>{tr || <em className={styles.noTr}>Çeviri henüz eklenmedi</em>}</span>
      )}
    </span>
  )
}

export function ExamStudyPage() {
  const activeUserId = useUserStore((s) => s.activeUserId)
  const [exams, setExams] = useState<string[]>([])
  const [examId, setExamId] = useState<string>(() => localStorage.getItem('yds-exam-last') || '')
  const [data, setData] = useState<{ exam: Exam; tr: Record<string, string> } | null>(null)
  const [error, setError] = useState('')
  const [idx, setIdx] = useState(0)
  const [choice, setChoice] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [showAllTr, setShowAllTr] = useState(false)
  const [progress, setProgress] = useState<Progress>({})
  const [pop, setPop] = useState<PopoverState | null>(null)
  const [lookup, setLookup] = useState<WordLookupResult | null>(null)
  const [lookingUp, setLookingUp] = useState(false)
  const [added, setAdded] = useState(false)
  const [pdfPage, setPdfPage] = useState<number | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPop(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    fetch('/local-api/yds/')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((list: string[]) => {
        setExams(list)
        setExamId((cur) => (cur && list.includes(cur) ? cur : list[0] || ''))
      })
      .catch(() => setError('Sınav verisi okunamadı. Bu sayfa yalnızca yerelde (npm run dev) çalışır.'))
  }, [])

  useEffect(() => {
    if (!examId) return
    localStorage.setItem('yds-exam-last', examId)
    setData(null)
    fetch(`/local-api/yds/${examId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        setData(d)
        setIdx(0)
        try {
          setProgress(JSON.parse(localStorage.getItem(`yds-exam-progress:${examId}`) || '{}'))
        } catch {
          setProgress({})
        }
      })
      .catch((e) => setError('Sınav yüklenemedi: ' + e))
  }, [examId])

  const q = data?.exam.questions[idx]
  const passage = q?.passage ? data?.exam.passages.find((p) => p.id === q.passage) : undefined
  const tr = data?.tr || {}

  useEffect(() => {
    setChoice(progress[q?.no ?? -1]?.choice ?? null)
    setRevealed(Boolean(progress[q?.no ?? -1]))
    setPop(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q?.no, examId])

  function saveProgress(next: Progress) {
    setProgress(next)
    try {
      localStorage.setItem(`yds-exam-progress:${examId}`, JSON.stringify(next))
    } catch {
      // yoksay
    }
  }

  function check() {
    if (!q || !choice) return
    setRevealed(true)
    saveProgress({ ...progress, [q.no]: { choice, correct: choice === q.answer } })
  }

  async function onWord(word: string, e: MouseEvent<HTMLButtonElement>) {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    const width = Math.min(300, window.innerWidth - 16)
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))
    setPop({ word, top: rect.bottom + 6, left })
    setLookup(null)
    setAdded(false)
    setLookingUp(true)
    try {
      setLookup(await lookupWordInSentence(cleanToken(word) || word, undefined, activeUserId))
    } finally {
      setLookingUp(false)
    }
  }

  async function addToDeck() {
    if (!lookup) return
    await createWord(activeUserId, {
      term: lookup.term,
      definition: lookup.meaning,
      partOfSpeech: 'noun',
      tags: ['YDS-Sınav-Sorusu'],
      notes: examId + ' / Soru ' + q?.no,
    })
    setAdded(true)
  }

  if (error) {
    return (
      <section className="card">
        <p>{error}</p>
        <Link to="/" className="btn btn-secondary">
          ← Ana sayfa
        </Link>
      </section>
    )
  }
  if (!data || !q) return <p className="muted">Yükleniyor…</p>

  const stats = Object.values(progress)
  const correct = stats.filter((p) => p.correct).length
  const letters = Object.keys(q.options)
  const stemTr = q.stem.map((s) => tr[s.id]).filter(Boolean)
  const optionTrCount = letters.filter((l) => tr[q.options[l].id]).length

  return (
    <section className={styles.page}>
      <header className={styles.head}>
        <div>
          <h1 className={styles.title}>📖 YDS Soru Çalışması</h1>
          <p className="muted" style={{ margin: 0 }}>
            Yalnızca yerelde çalışır · Cümlenin başındaki 🌐 çeviriyi açar, kelimeye dokununca anlamı çıkar.
          </p>
        </div>
        <select
          className={styles.examSelect}
          value={examId}
          onChange={(e) => setExamId(e.target.value)}
          aria-label="Sınav seç"
        >
          {exams.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
      </header>

      {/* Soru gezgini */}
      <div className={styles.navigator} role="navigation" aria-label="Sorular">
        {data.exam.questions.map((x, i) => {
          const p = progress[x.no]
          return (
            <button
              key={x.no}
              type="button"
              className={`${styles.navBtn} ${i === idx ? styles.navCurrent : ''} ${
                p ? (p.correct ? styles.navOk : styles.navBad) : ''
              }`}
              onClick={() => setIdx(i)}
            >
              {x.no}
            </button>
          )
        })}
      </div>
      <p className="muted" style={{ margin: 0, fontSize: '0.82rem' }}>
        Çözülen: {stats.length}/{data.exam.questions.length} · Doğru: {correct}
      </p>

      <div className={styles.toolbar}>
        <label className={styles.toggle}>
          <input type="checkbox" checked={showAllTr} onChange={(e) => setShowAllTr(e.target.checked)} />
          Tüm cümle çevirilerini aç
        </label>
      </div>

      {/* Paragraf */}
      {passage && (
        <article className={`card ${styles.passage}`}>
          <h2 className={styles.sectionTitle}>
            {passage.kind === 'cloze' ? 'Boşluk doldurma paragrafı' : 'Okuma paragrafı'}
            {data.exam.pdf && passage.page ? (
              <button type="button" className={styles.pdfBtn} onClick={() => setPdfPage(passage.page ?? 1)}>
                📄 Orijinal sayfa {passage.page}
              </button>
            ) : null}
          </h2>
          <p className={styles.text}>
            {passage.sentences.map((s) => (
              <SentenceView key={s.id} seg={s} tr={tr[s.id]} forceShow={showAllTr} onWord={onWord} />
            ))}
          </p>
        </article>
      )}

      {/* Soru */}
      <article className={`card ${styles.question}`}>
        <h2 className={styles.sectionTitle}>
          Soru {q.no}
          {data.exam.pdf && q.page ? (
            <button type="button" className={styles.pdfBtn} onClick={() => setPdfPage(q.page ?? 1)}>
              📄 Orijinal sayfa {q.page}
            </button>
          ) : null}
        </h2>
        {q.stem.length > 0 && (
          <p className={styles.text}>
            {q.stem.map((s) => (
              <SentenceView key={s.id} seg={s} tr={tr[s.id]} forceShow={showAllTr} onWord={onWord} />
            ))}
          </p>
        )}
        {passage?.kind === 'cloze' && q.stem.length === 0 && (
          <p className="muted">Paragraftaki ({q.no})---- boşluğu için doğru seçeneği işaretleyin.</p>
        )}

        <ul className={styles.options}>
          {letters.map((l) => {
            const opt = q.options[l]
            const state = revealed
              ? l === q.answer
                ? styles.optCorrect
                : l === choice
                  ? styles.optWrong
                  : ''
              : l === choice
                ? styles.optPicked
                : ''
            return (
              <li key={l} className={`${styles.option} ${state}`}>
                <button type="button" className={styles.optPick} onClick={() => !revealed && setChoice(l)}>
                  <span className={styles.optLetter}>{l}</span>
                </button>
                <span className={styles.optBody}>
                  <SentenceView seg={opt} tr={tr[opt.id]} forceShow={showAllTr} onWord={onWord} badge="🌐" />
                </span>
              </li>
            )
          })}
        </ul>

        <div className={styles.actions}>
          {!revealed ? (
            <button type="button" className="btn btn-primary" disabled={!choice} onClick={check}>
              Cevabı kontrol et
            </button>
          ) : (
            <span className={choice === q.answer ? styles.okText : styles.badText}>
              {choice === q.answer ? '✓ Doğru' : `✗ Yanlış — doğru cevap: ${q.answer ?? '?'}`}
            </span>
          )}
          <span className={styles.spacer} />
          <button type="button" className="btn btn-ghost" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>
            ← Önceki
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={idx === data.exam.questions.length - 1}
            onClick={() => setIdx(idx + 1)}
          >
            Sonraki →
          </button>
        </div>
      </article>

      {/* Çeviriler */}
      <article className={`card ${styles.translations}`}>
        <h2 className={styles.sectionTitle}>Çeviriler</h2>
        {passage && (
          <details className={styles.details}>
            <summary>Paragrafın tam çevirisi</summary>
            {passage.sentences.every((s) => tr[s.id]) ? (
              <p className={styles.trBlock}>{passage.sentences.map((s) => tr[s.id]).join(' ')}</p>
            ) : (
              <p className={styles.noTr}>
                {passage.sentences.filter((s) => tr[s.id]).length === 0
                  ? 'Bu paragrafın çevirisi henüz eklenmedi.'
                  : passage.sentences.map((s) => tr[s.id] || '[çeviri eksik]').join(' ')}
              </p>
            )}
          </details>
        )}
        <details className={styles.details}>
          <summary>Soru cümlesinin çevirisi</summary>
          {stemTr.length ? <p className={styles.trBlock}>{stemTr.join(' ')}</p> : <p className={styles.noTr}>Çeviri henüz eklenmedi.</p>}
        </details>
        <details className={styles.details}>
          <summary>Şıkların çevirisi ({optionTrCount}/{letters.length})</summary>
          <ul className={styles.optTrList}>
            {letters.map((l) => (
              <li key={l}>
                <strong>{l})</strong> {q.options[l].en}
                <div className={styles.trBlock}>{tr[q.options[l].id] || <em className={styles.noTr}>Çeviri henüz eklenmedi</em>}</div>
              </li>
            ))}
          </ul>
        </details>
      </article>

      {/* Kelime balonu */}
      {pop && (
        <>
          <div className={styles.popBackdrop} onClick={() => setPop(null)} aria-hidden="true" />
          <div className={styles.pop} style={{ top: pop.top, left: pop.left }} role="dialog">
            <div className={styles.popHead}>
              <strong>{lookup?.term || cleanToken(pop.word)}</strong>
              <button type="button" className={styles.popIcon} onClick={() => speakWord(lookup?.term || pop.word)} aria-label="Dinle">
                🔊
              </button>
              <button type="button" className={styles.popIcon} onClick={() => setPop(null)} aria-label="Kapat">
                ×
              </button>
            </div>
            <p className={styles.popMeaning}>
              {lookingUp ? 'Anlam aranıyor…' : lookup?.meaning || 'Anlam bulunamadı.'}
            </p>
            {lookup?.existingWord && <p className="muted" style={{ margin: 0, fontSize: '0.78rem' }}>Havuzunuzda mevcut</p>}
            {lookup?.isNewWord && lookup.meaning && (
              <button type="button" className="btn btn-secondary" disabled={added} onClick={() => void addToDeck()}>
                {added ? '✓ Eklendi' : '➕ Havuzuma ekle'}
              </button>
            )}
          </div>
        </>
      )}

      {/* Orijinal PDF sayfası: kelime/cümle doğrulaması için */}
      {pdfPage !== null && data.exam.pdf && (
        <div className={styles.pdfBackdrop} onClick={() => setPdfPage(null)} role="dialog" aria-modal="true">
          <div className={styles.pdfModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.pdfHead}>
              <strong>{data.exam.title} — PDF sayfa {pdfPage}</strong>
              <span className={styles.spacer} />
              <button type="button" className="btn btn-ghost" disabled={pdfPage <= 1} onClick={() => setPdfPage(pdfPage - 1)}>
                ←
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setPdfPage(pdfPage + 1)}>
                →
              </button>
              <a
                className="btn btn-secondary"
                href={`/local-api/pdf/${data.exam.pdf}#page=${pdfPage}`}
                target="_blank"
                rel="noreferrer"
              >
                Yeni sekmede aç
              </a>
              <button type="button" className="btn btn-ghost" onClick={() => setPdfPage(null)} aria-label="Kapat">
                ✕
              </button>
            </div>
            <iframe
              key={pdfPage}
              className={styles.pdfFrame}
              title="Orijinal PDF sayfası"
              src={`/local-api/pdf/${data.exam.pdf}#page=${pdfPage}&zoom=page-width`}
            />
          </div>
        </div>
      )}
    </section>
  )
}

export default ExamStudyPage
