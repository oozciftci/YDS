import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { loadBook, paginate, readProgress, saveProgress, sentenceEn, type Book, type BookPage } from '../services/readingBooks'
import { glossFor } from '../services/readingLibrary'
import { useUserStore } from '../stores/user'
import { useQuestionNav } from './exam/answerControls'
import type { Seg } from './exam/examData'
import { ReaderBody } from './exam/ReaderBody'
import ex from './ExamStudy.module.css'
import { Quiz } from './ReadingLibrary'
import styles from './ReadingLibrary.module.css'

// Kitap okuyucu (services/readingBooks): kitap ~320 kelimelik sayfalara bölünür; yana kaydırınca / ← → ile sayfa çevrilir,
// kaldığın yer kaydedilir. Okuyucu ReaderBody (kelimeye dokun, 🌐 cümle çevirisi — veride hazır, internetsiz; dinle, süre).
// Bölüm sonunda (özgün uyarlamalarda) anlama soruları.

export function ReadingBookPage() {
  const { bookId = '', page } = useParams()
  const navigate = useNavigate()
  const userId = useUserStore((s) => s.activeUserId)
  const [book, setBook] = useState<Book | null | undefined>(undefined)

  useEffect(() => {
    void loadBook(bookId).then(setBook)
  }, [bookId])

  const pages = useMemo(() => (book ? paginate(book) : []), [book])
  const n = Number(page) - 1
  const go = (i: number) => navigate(`/okuma/kitap/${bookId}/${i + 1}`, { replace: true })
  const swipe = useQuestionNav(
    () => go(n - 1),
    () => go(n + 1),
    { canPrev: n > 0, canNext: n + 1 < pages.length },
  )

  // Sayfa verilmemişse kaldığın yerden
  if (book && page === undefined) {
    const saved = readProgress(userId)[bookId]?.page ?? 0
    return <Navigate to={`/okuma/kitap/${bookId}/${Math.min(saved, pages.length - 1) + 1}`} replace />
  }

  return (
    <section className={ex.page} {...swipe.props}>
      {book === undefined ? (
        <p className="muted">Kitap açılıyor…</p>
      ) : !book || !pages[n] ? (
        <p className="muted">
          Kitap bulunamadı. <Link to="/okuma">Kütüphaneye dön</Link>
        </p>
      ) : (
        <BookPageReader key={`${bookId}/${n}`} book={book} pages={pages} n={n} onGo={go} onNext={() => void swipe.turn(1)} />
      )}
    </section>
  )
}

function BookPageReader({ book, pages, n, onGo, onNext }: { book: Book; pages: BookPage[]; n: number; onGo: (i: number) => void; onNext: () => void }) {
  const userId = useUserStore((s) => s.activeUserId)
  const pg = pages[n]
  const chapter = book.chapters[pg.chapter]

  useEffect(() => {
    saveProgress(userId, book.id, n, pages.length)
  }, [userId, book.id, n, pages.length])

  const { sentences, tr, paras, words } = useMemo(() => {
    const sentences: Seg[] = []
    const tr: Record<string, string> = {}
    const paras: (number | { h: string })[] = []
    chapter.paras.slice(pg.from, pg.to).forEach((p, pi) => {
      if (!Array.isArray(p)) return paras.push(p)
      p.forEach((s, si) => {
        const id = `c${pg.chapter}p${pg.from + pi}s${si}`
        sentences.push({ id, en: sentenceEn(s) })
        if (typeof s !== 'string') tr[id] = s.tr
      })
      paras.push(p.length)
    })
    return { sentences, tr, paras, words: pg.words }
  }, [chapter, pg])

  // Bölümlerin ilk sayfaları (içindekiler)
  const chapterStarts = useMemo(() => book.chapters.map((_, ci) => pages.findIndex((p) => p.chapter === ci)), [book, pages])
  const last = n + 1 >= pages.length

  return (
    <ReaderBody
      back={{ to: '/okuma', label: '← Okuma Kütüphanesi' }}
      title={chapter.title}
      info={
        <>
          <span className={styles.level}>{book.level}</span> {book.title} · Bölüm {pg.chapter + 1}/{book.chapters.length} · Sayfa {n + 1}/{pages.length}
          {chapter.titleTr ? ` · ${chapter.titleTr}` : ''} · Yana kaydırınca sayfa çevrilir; 🌐 cümlenin Türkçesi.
        </>
      }
      before={
        <div className={styles.bookBar}>
          <select
            className={ex.rateSelect}
            value={pg.chapter}
            onChange={(e) => onGo(chapterStarts[Number(e.target.value)])}
            aria-label="Bölüme git"
          >
            {book.chapters.map((c, ci) => (
              <option key={ci} value={ci}>
                {ci + 1}. {c.title}
              </option>
            ))}
          </select>
          <div className={styles.progress} title={`Sayfa ${n + 1}/${pages.length}`}>
            <span style={{ width: `${((n + 1) / pages.length) * 100}%` }} />
          </div>
        </div>
      }
      sentences={sentences}
      tr={tr}
      paras={paras}
      words={words}
      logId={`kitap/${book.id}/${n + 1}`}
      note={`Okuma: ${book.title}`}
      glossFor={book.glosses ? (w) => glossFor(book.glosses!, w) : undefined}
      after={
        <>
          {pg.lastOfChapter && chapter.qs && chapter.qs.length > 0 && <Quiz qs={chapter.qs} onDone={() => undefined} />}
          <div className={ex.actions} style={{ marginTop: 0 }}>
            {last ? (
              <>
                <strong>🎉 Kitabı bitirdin.</strong>
                <Link to="/okuma" className="btn btn-secondary">
                  Kütüphaneye dön
                </Link>
              </>
            ) : (
              <button type="button" className="btn btn-primary" onClick={onNext}>
                {pg.lastOfChapter ? `Sonraki bölüm: ${book.chapters[pg.chapter + 1]?.title} →` : 'Sonraki sayfa →'}
              </button>
            )}
          </div>
        </>
      }
    />
  )
}
