import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, Navigate, Route, Routes, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { db } from '../db'
import { stamp } from '../services/notebook'
import { getDoneUnits, markUnitDone, topicForUnit } from '../services/bookProgress'
import { useUserStore } from '../stores/user'
import styles from './Books.module.css'
import {
  buildFrames,
  imageUrl,
  listBooks,
  loadBook,
  readMode,
  readPos,
  saveMode,
  savePos,
  unitOf,
  type Book,
  type BookMeta,
  type Frame,
} from './books/bookData'
import { localFetch, useLocalUrl } from '../services/localContent'
import { PageView, PenPalette, type PageViewHandle, type Side } from './books/PageView'
import { clearPage, readPen, savePen, undoStroke, type Pen } from './books/ink'
import reading from './books/Reading.module.css'
import { TocPanel } from './books/TocPanel'
import { useGlobalFocus } from '../hooks/useGlobalFocus'

// Kitaptan çalış: kitabı sayfa sayfa (telefonda yarım sayfa yarım sayfa) oku; kaldığın yer hatırlanır.
// Sayfa notları sağ alttaki "📄 Bu sayfa" penceresinden (her sayfanın kendi notu), kitabın defteri bu sayfada toplanır.
// Odak modu (⛶): sayfa tüm ekranı kaplar; altta yalnızca sayfa numarası ve kalem (çizimler db.bookInk, bkz. books/PageView.tsx).
// Veri geliştirmede yerel sunucudan, yayında cihaza yüklenen kaynak paketinden gelir (bkz. App.tsx).

function BookList() {
  const userId = useUserStore((s) => s.activeUserId)
  const [books, setBooks] = useState<BookMeta[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    listBooks()
      // Temel seviye önce (A1–A2, sonra B1–B2)
      .then((list) => setBooks([...list].sort((a, b) => a.level.localeCompare(b.level, 'tr'))))
      .catch(() => setError('Kitaplar okunamadı. Bu sayfa yalnızca yerelde (npm run dev) çalışır.'))
  }, [])

  if (error) return <p className="muted">{error}</p>
  if (!books) return <p className="muted">Yükleniyor…</p>

  return (
    <section className={styles.page}>
      <header>
        <Link to="/calis" className={styles.back}>
          ← Çalış
        </Link>
        <h1 className={styles.title}>📖 Kitaptan çalış</h1>
        <p className="muted" style={{ margin: 0 }}>
          Kitabı ünite ünite, sayfa sayfa ilerle. Kaldığın yer hatırlanır; her sayfaya not alabilirsin.
        </p>
      </header>
      {books.length === 0 && (
        <p className="muted">
          Henüz kitap yok. PDF’i <code>kaynaklar/</code> klasörüne koyup <code>python scripts/buildBooks.py</code> çalıştır.
        </p>
      )}
      <div className={styles.grid}>
        {books.map((b) => {
          const pos = readPos(userId, b.id)
          return (
            <article key={b.id} className={`card ${styles.bookCard}`}>
              <div>
                <h2>{b.short}</h2>
                <p className="muted">
                  {b.level} · {b.unitCount} ünite · {b.pageCount} sayfa
                </p>
                {pos && <p className={styles.lastPos}>Kaldığın yer: s. {pos.page}{pos.half ? (pos.half === 1 ? ' (üst yarı)' : ' (alt yarı)') : ''} · {stamp(pos.at)}</p>}
              </div>
              <div className={styles.cardActions}>
                <Link to={b.id} className="btn btn-primary">
                  {pos ? 'Devam et →' : 'Başla →'}
                </Link>
                <Link to={`${b.id}/notlar`} className="btn btn-ghost">
                  📓 Kitap defteri
                </Link>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

/** /kitap/:bookId → kaldığın yere (yoksa ilk üniteye) yönlendir. */
function ResumeBook() {
  const { bookId = '' } = useParams()
  const userId = useUserStore((s) => s.activeUserId)
  const [book, setBook] = useState<Book | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    loadBook(bookId)
      .then(setBook)
      .catch(() => setError('Kitap bulunamadı.'))
  }, [bookId])
  if (error) return <p className="muted">{error}</p>
  if (!book) return <p className="muted">Yükleniyor…</p>
  const pos = readPos(userId, bookId)
  const page = pos?.page ?? book.firstUnitPage
  return <Navigate to={`s/${page}${pos?.half ? `?yarim=${pos.half}` : ''}`} replace />
}

const FOCUS_KEY = 'yds-book-focus'

function Reader() {
  const { bookId = '', page: pageParam = '1' } = useParams()
  const [search] = useSearchParams()
  const navigate = useNavigate()
  const userId = useUserStore((s) => s.activeUserId)
  const [book, setBook] = useState<Book | null>(null)
  const [error, setError] = useState('')
  const [mode, setModeState] = useState<'half' | 'full'>(readMode)
  const view = useRef<PageViewHandle>(null)
  const [tocOpen, setTocOpen] = useState(false)
  const [pen, setPenState] = useState<Pen>(readPen)
  const [focusLocal, setFocusState] = useState(() => {
    try {
      return localStorage.getItem(FOCUS_KEY) === '1'
    } catch {
      return false
    }
  })
  // Üst çubuktaki genel “⛶ Odak” da kitabı tam ekran açar
  const globalFocus = useGlobalFocus()
  const focus = focusLocal || globalFocus

  useEffect(() => {
    loadBook(bookId)
      .then(setBook)
      .catch(() => setError('Kitap bulunamadı.'))
  }, [bookId])

  const frames = useMemo(() => (book ? buildFrames(book, mode) : []), [book, mode])
  const pageNo = Number(pageParam) || 1
  const halfParam = Number(search.get('yarim') || 0)
  // Bu sayfa ve yarım için kare; tam sayfa modunda (ya da bölünmeyen sayfada) yarım yok sayılır
  const idx = useMemo(() => {
    const exact = frames.findIndex((f) => f.page === pageNo && f.half === halfParam)
    if (exact !== -1) return exact
    return frames.findIndex((f) => f.page === pageNo)
  }, [frames, pageNo, halfParam])
  const frame: Frame | undefined = frames[idx]
  const src = useLocalUrl(frame ? imageUrl(bookId, frame.page) : null)
  // Komşu kareler: çevirirken altta/üstte görünürler (görüntüleri de böylece önceden yüklenir)
  const prevFrame: Frame | undefined = frames[idx - 1]
  const nextFrame: Frame | undefined = frames[idx + 1]
  const prevSrc = useLocalUrl(prevFrame ? imageUrl(bookId, prevFrame.page) : null)
  const nextSrc = useLocalUrl(nextFrame ? imageUrl(bookId, nextFrame.page) : null)

  // Kaldığın yeri kaydet; bir üniteyi ileri doğru geçince o ünite bitmiş sayılır (günlük plan için)
  const prevPage = useRef<number | null>(null)
  const [doneVersion, setDoneVersion] = useState(0)
  useEffect(() => {
    if (!frame || !book) return
    savePos(userId, bookId, frame.page, frame.half)
    const prev = prevPage.current
    prevPage.current = frame.page
    if (prev !== null && frame.page > prev) {
      const u = unitOf(book, prev)
      if (u && frame.page > u.page + 1) {
        markUnitDone(userId, bookId, u.no)
        setDoneVersion((v) => v + 1)
      }
    }
  }, [userId, bookId, frame, book])


  function goTo(i: number) {
    const j = Math.max(0, Math.min(frames.length - 1, i))
    const f = frames[j]
    if (!f || j === idx) return
    navigate(`/kitap/${bookId}/s/${f.page}${f.half ? `?yarim=${f.half}` : ''}`, { replace: true })
    if (!focus) window.scrollTo({ top: 0 })
  }

  /** Bir önceki/sonraki kareye sayfa çevirme animasyonuyla; uzak atlamalar (ünite seçimi) doğrudan. */
  function go(i: number) {
    if (Math.abs(i - idx) === 1 && view.current?.flip(i > idx ? 1 : -1)) return
    goTo(i)
  }

  function setPen(p: Pen) {
    savePen(p)
    setPenState(p)
  }

  function setFocus(on: boolean) {
    try {
      localStorage.setItem(FOCUS_KEY, on ? '1' : '0')
    } catch {
      // yoksay
    }
    setFocusState(on)
    if (!on) {
      setPen({ ...pen, on: false })
      window.dispatchEvent(new Event('yds-focus-off'))
    }
    // Destekleyen tarayıcılarda gerçek tam ekran (iPhone Safari desteklemez; orada ana ekrana eklemek gerekir)
    try {
      if (on && !document.fullscreenElement) void document.documentElement.requestFullscreen?.().catch(() => undefined)
      if (!on && document.fullscreenElement) void document.exitFullscreen().catch(() => undefined)
    } catch {
      // yoksay
    }
  }

  // Odak modunda arkadaki sayfa kaymasın
  useEffect(() => {
    if (!focus) return
    const old = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = old
    }
  }, [focus])

  // Klavye: ← → (yazı yazarken değil)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target
      if (t instanceof Element && t.closest('input, textarea, select, [contenteditable]')) return
      if (e.key === 'ArrowRight') go(idx + 1)
      if (e.key === 'ArrowLeft') go(idx - 1)
      if (e.key === 'Escape' && focus) setFocus(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (error) return <p className="muted">{error}</p>
  if (!book || !frame) return <p className="muted">Yükleniyor…</p>

  const page = book.pages[frame.page - 1]
  const lastUnit = book.units[book.units.length - 1]
  const unit = frame.page <= lastUnit.page + 1 ? unitOf(book, frame.page) : null
  const span = frame.end - frame.start
  const unitDone = unit ? Boolean(getDoneUnits(userId, bookId)[unit.no]) : false
  void doneVersion
  const topic = unit ? topicForUnit(unit.title) : null

  function setMode(m: 'half' | 'full') {
    saveMode(m)
    setModeState(m)
  }

  /** İçindekilerden ya da “Sayfaya git”ten: o sayfanın ilk karesine (komşuysa çevirerek) */
  function goToPage(p: number) {
    setTocOpen(false)
    const i = frames.findIndex((f) => f.page === p)
    if (i !== -1) go(i)
  }
  const toc = tocOpen && (
    <TocPanel book={book} currentPage={frame.page} currentUnit={unit?.no ?? null} onGo={goToPage} onClose={() => setTocOpen(false)} />
  )

  const where = `s. ${frame.page} / ${book.pageCount}${frame.half === 1 ? ' · üst' : frame.half === 2 ? ' · alt' : ''}`
  const side = (f: Frame | undefined, s: string | undefined): Side | undefined => (f ? { frame: f, page: book.pages[f.page - 1], src: s } : undefined)
  const pageProps = {
    userId,
    bookId,
    cur: { frame, page, src },
    prev: side(prevFrame, prevSrc),
    next: side(nextFrame, nextSrc),
    alt: `${book.short} sayfa ${frame.page}`,
    pen,
    handle: view,
    onTap: (s: -1 | 0 | 1) => {
      if (s) go(idx + s)
    },
    onTurned: (dir: -1 | 1) => goTo(idx + dir),
  }

  if (focus) {
    // Görünür kare ekrana sığdırılır: en-boy oranı korunarak genişlik ya da yükseklik doldurulur
    const ratio = page.w / (page.h * span)
    return createPortal(
      <div className={reading.focus}>
        <button type="button" className={reading.focusExit} onClick={() => setFocus(false)} aria-label="Odak modundan çık" title="Odak modundan çık (Esc)">
          ✕ Odak
        </button>
        <PageView {...pageProps} className={reading.focusFrame} style={{ width: `min(100vw, calc(100dvh * ${ratio}))` }} />
        <div className={reading.pill}>
          <button type="button" className={reading.pageNoBtn} onClick={() => setTocOpen(true)} title="İçindekiler / sayfaya git">
            {where}
          </button>
          <button
            type="button"
            className={pen.on ? reading.penOn : undefined}
            onClick={() => setPen({ ...pen, on: !pen.on })}
            aria-pressed={pen.on}
            aria-label="Kalem"
            title="Kalem: altını çiz, işaretle"
          >
            ✏️
          </button>
        </div>
        {pen.on && (
          <PenPalette
            pen={pen}
            onChange={setPen}
            onUndo={() => void undoStroke(userId, bookId, frame.page)}
            onClear={() => {
              if (confirm('Bu sayfadaki çizimler silinsin mi?')) void clearPage(userId, bookId, frame.page)
            }}
          />
        )}
        {toc}
      </div>,
      document.body,
    )
  }

  return (
    <section className={styles.reader}>
      <div className={styles.bar}>
        <Link to="/kitap" className={styles.back}>
          ← Kitaplar
        </Link>
        <strong className={styles.barTitle}>{book.short}</strong>
        <button type="button" className={styles.unitSelect} onClick={() => setTocOpen(true)} aria-label="İçindekiler: üniteye ya da sayfaya git">
          <span className={styles.unitSelectText}>{unit ? `${unit.no}. ${unit.title}` : 'İçindekiler…'}</span>
          <span aria-hidden="true">▾</span>
        </button>
        {toc}
        <span className={styles.modeToggle} role="group" aria-label="Görünüm">
          <button type="button" className={mode === 'half' ? styles.on : ''} onClick={() => setMode('half')} title="Telefonda rahat okuma için sayfayı ikiye böler">
            ½ Yarım
          </button>
          <button type="button" className={mode === 'full' ? styles.on : ''} onClick={() => setMode('full')}>
            Tam sayfa
          </button>
        </span>
        <Link to={`/kitap/${bookId}/notlar`} className={styles.notesLink}>
          📓 Defter
        </Link>

      </div>

      <div className={styles.progress} aria-hidden="true">
        <span style={{ width: `${((idx + 1) / frames.length) * 100}%` }} />
      </div>

      <p className={styles.where}>
        s. {frame.page} / {book.pageCount}
        {frame.half === 1 && ' · üst yarı'}
        {frame.half === 2 && ' · alt yarı'}
        {unit && ` · Ünite ${unit.no}: ${unit.title}`}
      </p>

      {/* Sağ üçte bire dokununca ileri, sol üçte bire dokununca geri; kaydırınca sayfa parmağı izler */}
      <PageView {...pageProps} className={styles.frame} />

      {unit && (frame.page === unit.page + 1 || unitDone) && (
        <div className={styles.unitEnd}>
          {unitDone ? (
            <span>✓ Ünite {unit.no} bitti.</span>
          ) : (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                markUnitDone(userId, bookId, unit.no)
                setDoneVersion((v) => v + 1)
              }}
            >
              ✓ Üniteyi bitirdim
            </button>
          )}
          {topic && <TestSuggestion topic={topic} />}
        </div>
      )}

      <div className={styles.nav}>
        <button type="button" className="btn btn-ghost" disabled={idx === 0} onClick={() => go(idx - 1)}>
          ← Önceki
        </button>
        <span className="muted" style={{ fontSize: '0.8rem' }}>
          {idx + 1} / {frames.length}
        </span>
        <button type="button" className="btn btn-primary" disabled={idx === frames.length - 1} onClick={() => go(idx + 1)}>
          Sonraki →
        </button>
      </div>
      <p className={styles.hint}>
        Telefonda sola/sağa kaydır, bilgisayarda ← → tuşları. Tam ekran ve kalem için sağ üstteki <strong>⛶ Odak</strong>; not için sağ alttaki <strong>📄 Bu sayfa</strong>.
      </p>
    </section>
  )
}

/** Kitap defteri: bu kitabın sayfalarında alınan tüm notlar (sayfa notları + Defterim girdileri). */
function BookNotes() {
  const { bookId = '' } = useParams()
  const userId = useUserStore((s) => s.activeUserId)
  const [book, setBook] = useState<Book | null>(null)
  useEffect(() => {
    void loadBook(bookId).then(setBook)
  }, [bookId])
  const prefix = `/kitap/${bookId}/s/`
  const notes = useLiveQuery(
    () =>
      db.notebook
        .where('userId')
        .equals(userId)
        .filter((n) => n.pageKey.startsWith(prefix))
        .toArray(),
    [userId, prefix],
  )
  const sorted = useMemo(
    () =>
      [...(notes ?? [])].sort(
        (a, b) => Number(a.pageKey.slice(prefix.length)) - Number(b.pageKey.slice(prefix.length)) || a.createdAt.localeCompare(b.createdAt),
      ),
    [notes, prefix],
  )
  if (!book || !notes) return <p className="muted">Yükleniyor…</p>

  return (
    <section className={styles.page}>
      <header>
        <Link to="/kitap" className={styles.back}>
          ← Kitaplar
        </Link>
        <h1 className={styles.title}>📓 {book.short} · Defter</h1>
        <p className="muted" style={{ margin: 0 }}>
          Bu kitabın sayfalarında aldığın notlar, sayfa sırasıyla. Not almak için kitabı açıp sağ alttaki pencereleri kullan.
        </p>
      </header>
      {sorted.length === 0 ? (
        <p className="muted">Henüz not yok.</p>
      ) : (
        <ul className={styles.noteList}>
          {sorted.map((n) => {
            const p = Number(n.pageKey.slice(prefix.length))
            const u = unitOf(book, p)
            return (
              <li key={n.id} className="card">
                <div className={styles.noteHead}>
                  <Link to={`/kitap/${bookId}/s/${p}`}>
                    s. {p}
                    {u ? ` · Ünite ${u.no}` : ''}
                  </Link>
                  <span className="muted">
                    {n.scope === 'page' ? '📄 Sayfa notu' : '📓 Defter'} · {stamp(n.updatedAt)}
                  </span>
                </div>
                {n.kind === 'text' && <p className={styles.noteText}>{n.text}</p>}
                {n.kind === 'audio' && <p className="muted">🎤 Sesli not (sayfada dinleyebilirsin)</p>}
                {n.kind === 'image' && <p className="muted">🖼️ Ekran görüntüsü (sayfada görebilirsin)</p>}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export default function BooksPage() {
  return (
    <Routes>
      <Route index element={<BookList />} />
      <Route path=":bookId" element={<ResumeBook />} />
      <Route path=":bookId/s/:page" element={<Reader />} />
      <Route path=":bookId/notlar" element={<BookNotes />} />
    </Routes>
  )
}

/** Ünitenin konusuna uygun, sıradaki çözülmemiş Sınav Stratejileri 3 testi. */
function TestSuggestion({ topic }: { topic: string }) {
  const userId = useUserStore((s) => s.activeUserId)
  const [tests, setTests] = useState<{ id: string; section: string; no: number; type: string; questions: unknown[] }[] | null>(null)
  useEffect(() => {
    localFetch('/local-api/kitap/modadil-sinav-stratejileri-3/testler')
      .then((r) => (r.ok ? r.json() : { tests: [] }))
      .then((d) => setTests(d.tests))
      .catch(() => setTests([]))
  }, [])
  const answers = useLiveQuery(
    () => db.examAnswers.where('userId').equals(userId).filter((a) => a.examId.includes('-strateji3-')).toArray(),
    [userId],
  )
  if (!tests || !answers) return null
  const list = tests.filter((t) => t.section === topic)
  if (!list.length) return null
  const count = (t: { id: string; type: string }) => answers.filter((a) => a.examId === `banka-${t.type}-strateji3-${t.id}`).length
  const next = list.find((t) => count(t) < t.questions.length) ?? list[0]
  return (
    <Link to={`/yds-sorular/bankalar/strateji-3/${next.id}`} className="btn btn-primary">
      📗 Bu konunun testi: {next.section} · Test {next.no} →
    </Link>
  )
}
