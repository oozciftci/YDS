import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef, useState } from 'react'
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
import { localFetch, preloadLocalImage, useLocalUrl } from '../services/localContent'

// Kitaptan çalış: kitabı sayfa sayfa (telefonda yarım sayfa yarım sayfa) oku; kaldığın yer hatırlanır.
// Sayfa notları sağ alttaki "📄 Bu sayfa" penceresinden (her sayfanın kendi notu), kitabın defteri bu sayfada toplanır.
// Veri yalnızca yerel geliştirme sunucusundan gelir; yayın derlemesinde bu sayfa yoktur (bkz. App.tsx).

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

function Reader() {
  const { bookId = '', page: pageParam = '1' } = useParams()
  const [search] = useSearchParams()
  const navigate = useNavigate()
  const userId = useUserStore((s) => s.activeUserId)
  const [book, setBook] = useState<Book | null>(null)
  const [error, setError] = useState('')
  const [mode, setModeState] = useState<'half' | 'full'>(readMode)
  const touch = useRef<{ x: number; y: number } | null>(null)

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

  // Sonraki sayfanın görüntüsünü önceden yükle
  useEffect(() => {
    const next = frames[idx + 1]
    if (next && next.page !== frame?.page) preloadLocalImage(imageUrl(bookId, next.page))
  }, [frames, idx, frame, bookId])

  function go(i: number) {
    const f = frames[Math.max(0, Math.min(frames.length - 1, i))]
    if (!f) return
    navigate(`/kitap/${bookId}/s/${f.page}${f.half ? `?yarim=${f.half}` : ''}`, { replace: true })
    window.scrollTo({ top: 0 })
  }

  // Klavye: ← → (yazı yazarken değil)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('input, textarea, select, [contenteditable]')) return
      if (e.key === 'ArrowRight') go(idx + 1)
      if (e.key === 'ArrowLeft') go(idx - 1)
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

  return (
    <section
      className={styles.reader}
      onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
      onTouchEnd={(e) => {
        const s = touch.current
        touch.current = null
        if (!s) return
        const dx = e.changedTouches[0].clientX - s.x
        const dy = e.changedTouches[0].clientY - s.y
        // Yatay kaydırma: sola kaydır → sonraki
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? idx + 1 : idx - 1)
      }}
    >
      <div className={styles.bar}>
        <Link to="/kitap" className={styles.back}>
          ← Kitaplar
        </Link>
        <strong className={styles.barTitle}>{book.short}</strong>
        <select
          className={styles.unitSelect}
          value={unit?.no ?? ''}
          onChange={(e) => {
            const u = book.units.find((x) => x.no === Number(e.target.value))
            if (u) go(frames.findIndex((f) => f.page === u.page))
          }}
          aria-label="Üniteye git"
        >
          {!unit && <option value="">Ünite seç…</option>}
          {book.units.map((u) => (
            <option key={u.no} value={u.no}>
              {u.no}. {u.title}
            </option>
          ))}
        </select>
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

      <div
        className={styles.frame}
        style={{ aspectRatio: `${page.w} / ${page.h * span}` }}
        onClick={(e) => {
          // Görüntünün sağ üçte birine dokununca ileri, sol üçte birine dokununca geri
          const r = e.currentTarget.getBoundingClientRect()
          const x = (e.clientX - r.left) / r.width
          if (x > 0.67) go(idx + 1)
          else if (x < 0.33) go(idx - 1)
        }}
      >
        <img
          src={src}
          alt={`${book.short} sayfa ${frame.page}`}
          style={{ top: `${(-frame.start / span) * 100}%` }}
          draggable={false}
        />
      </div>

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
        Telefonda sola/sağa kaydır, bilgisayarda ← → tuşları. Bu sayfaya not için sağ alttaki <strong>📄 Bu sayfa</strong>.
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
