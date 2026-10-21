import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Book } from './bookData'
import styles from './Reading.module.css'

/**
 * İçindekiler: ünite listesi (sağda başladığı sayfa) ve “Sayfaya git”. Okuyucuda ve odak modunda aynı panel.
 * Sayfa numaraları okuyucudaki “s. N” ile aynıdır (kitap dosyasındaki sayfa sırası).
 */
export function TocPanel({
  book,
  currentPage,
  currentUnit,
  onGo,
  onClose,
}: {
  book: Book
  currentPage: number
  currentUnit: number | null
  onGo: (page: number) => void
  onClose: () => void
}) {
  const [value, setValue] = useState('')
  const list = useRef<HTMLOListElement>(null)
  const n = Number(value)
  const valid = Number.isInteger(n) && n >= 1 && n <= book.pageCount

  // Açılınca bulunduğun ünite görünsün
  useEffect(() => {
    list.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'center' })
  }, [])

  // Esc kapatır (okuyucunun Esc'i odak modundan çıkmasın diye yakalanır)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopImmediatePropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return createPortal(
    <div className={styles.tocBackdrop} onClick={onClose}>
      <div className={styles.toc} role="dialog" aria-label="İçindekiler" onClick={(e) => e.stopPropagation()}>
        <div className={styles.tocHead}>
          <strong>{book.short} · İçindekiler</strong>
          <button type="button" className={styles.tocClose} onClick={onClose} aria-label="Kapat">
            ✕
          </button>
        </div>
        <form
          className={styles.tocGo}
          onSubmit={(e) => {
            e.preventDefault()
            if (valid) onGo(n)
          }}
        >
          <label htmlFor="toc-page">Sayfaya git</label>
          <input
            id="toc-page"
            className="input"
            type="number"
            inputMode="numeric"
            min={1}
            max={book.pageCount}
            placeholder={`1–${book.pageCount} (şu an ${currentPage})`}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <button type="submit" className="btn btn-primary" disabled={!valid}>
            Git
          </button>
        </form>
        <ol ref={list} className={styles.tocList}>
          {book.units.map((u) => (
            <li key={u.no}>
              <button type="button" aria-current={u.no === currentUnit} onClick={() => onGo(u.page)}>
                <span className={styles.tocTitle}>
                  {u.no}. {u.title}
                </span>
                <span className={styles.tocPage}>s. {u.page}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
    </div>,
    document.body,
  )
}
