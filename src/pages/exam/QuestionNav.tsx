import { useState, type ReactNode } from 'react'
import styles from '../ExamStudy.module.css'

interface Props {
  count: number
  idx: number
  onPick: (i: number) => void
  /** Düğmenin sınıfı (doğru/yanlış/işaretli). */
  stateClass: (i: number) => string
  /** Düğme yazısı (varsayılan: sıra numarası). */
  label?: (i: number) => ReactNode
  /** Kapalı çubukta gösterilecek özet (örn. "30 cevaplandı"). */
  summary?: ReactNode
}

/**
 * Soru numaraları: az soruda hep açık; çok soruda tek satırlık çubuk, tıklayınca tüm numaralar açılır
 * ve bir numara seçilince yeniden kapanır (sorunun üstünde yer kaplamasın).
 */
export function QuestionNav({ count, idx, onPick, stateClass, label = (i) => i + 1, summary }: Props) {
  const [open, setOpen] = useState(false)
  const small = count <= 12

  const grid = (
    <div
      className={styles.navigator}
      role="navigation"
      aria-label="Sorular"
      style={count <= 6 ? { gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` } : undefined}
    >
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          type="button"
          className={`${styles.navBtn} ${i === idx ? styles.navCurrent : ''} ${stateClass(i)}`}
          onClick={() => {
            onPick(i)
            setOpen(false)
          }}
        >
          {label(i)}
        </button>
      ))}
    </div>
  )

  if (small) return grid

  return (
    <div className={styles.qnav}>
      <button type="button" className={styles.qnavBar} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span>
          ▦ Soru <strong>{label(idx)}</strong> / {count}
        </span>
        {summary && <span className="muted">{summary}</span>}
        <span className={styles.qnavHint}>{open ? 'Numaraları gizle ▴' : 'Tüm sorular ▾'}</span>
      </button>
      {open && grid}
    </div>
  )
}
