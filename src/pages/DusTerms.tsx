import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { DusTerm } from '../services/dus'
import styles from './ExamStudy.module.css'

// DUS terim sözlüğü: soru/şık metnindeki terimlerin altı çizilir, dokununca sade Türkçe açıklama balonu açılır.
// Yalnızca şıklarda geçen terimler cevap verilmeden önce "kilitli"dir: açıklaması cevabı ele verebilir (tanım
// sorularında şıkkı tanımlamak soruyu çözmek demektir), kullanıcı isterse yine de açar.

export interface OpenTerm {
  term: DusTerm
  el: HTMLElement
  locked: boolean
}

const LETTER = /[\p{L}\p{N}]/u

/** Metni terimlere böler: uzun terim önce, örtüşme yok, kelimenin ortasından başlayan eşleşme yok (ek alabilir). */
function split(text: string, terms: DusTerm[]): (string | DusTerm)[] {
  const hits: [number, number, DusTerm][] = []
  for (const t of [...terms].sort((a, b) => b.metin.length - a.metin.length)) {
    for (let i = text.indexOf(t.metin); i !== -1; i = text.indexOf(t.metin, i + 1)) {
      const end = i + t.metin.length
      if (i > 0 && LETTER.test(text[i - 1]) && LETTER.test(t.metin[0])) continue
      if (hits.some(([s, e]) => i < e && end > s)) continue
      hits.push([i, end, t])
    }
  }
  hits.sort((a, b) => a[0] - b[0])
  const out: (string | DusTerm)[] = []
  let at = 0
  for (const [s, e, t] of hits) {
    if (s > at) out.push(text.slice(at, s))
    out.push(t)
    at = e
  }
  if (at < text.length) out.push(text.slice(at))
  return out
}

/** Terimleri dokunulabilir yapan metin parçası. Şık düğmesinin içinde de çalışır (span; tıklama şıkkı seçmez). */
export function TermText({
  text,
  terms,
  isLocked,
  onOpen,
}: {
  text: string
  terms: DusTerm[]
  isLocked: (t: DusTerm) => boolean
  onOpen: (o: OpenTerm) => void
}): ReactNode {
  if (!terms.length) return text
  return split(text, terms).map((p, i) =>
    typeof p === 'string' ? (
      p
    ) : (
      <span
        key={i}
        role="button"
        tabIndex={0}
        className={styles.dusTerm}
        onClick={(e) => {
          e.stopPropagation()
          e.preventDefault()
          onOpen({ term: p, el: e.currentTarget, locked: isLocked(p) })
        }}
        onKeyDown={(e) => {
          if (e.key !== 'Enter' && e.key !== ' ') return
          e.stopPropagation()
          e.preventDefault()
          onOpen({ term: p, el: e.currentTarget, locked: isLocked(p) })
        }}
      >
        {p.metin}
      </span>
    ),
  )
}

/** Terimin altında (yer yoksa üstünde) açılan balon. */
export function TermBubble({ open, onClose }: { open: OpenTerm; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  // Her terim için yeniden kurulur (key), kilit durumu baştan okunur
  const [locked, setLocked] = useState(open.locked)

  // Terimin altına (yer yoksa üstüne) yerleşir; kaydırınca terimi izler (iOS'ta adres çubuğu da kaydırma olayı
  // üretir, kapatmak balonu dokunur dokunmaz kaybettirirdi), terim ekrandan çıkınca kapanır.
  const place = useCallback(() => {
    const b = box.current
    if (!b) return
    const r = open.el.getBoundingClientRect()
    if (!open.el.isConnected || r.bottom < 0 || r.top > window.innerHeight) return onClose()
    const w = b.offsetWidth
    const h = b.offsetHeight
    const left = Math.max(8, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - 8))
    const below = r.bottom + 8
    const top = below + h <= window.innerHeight - 8 || r.top - h - 8 < 8 ? below : r.top - h - 8
    setPos({ left, top: Math.max(8, top) })
  }, [open, onClose])
  useLayoutEffect(place, [place, locked])

  useEffect(() => {
    const down = (e: PointerEvent) => {
      const t = e.target as Node
      if (box.current?.contains(t) || open.el.contains(t)) return
      onClose()
    }
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('pointerdown', down, true)
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('pointerdown', down, true)
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
      document.removeEventListener('keydown', key)
    }
  }, [open, onClose, place])

  const t = open.term
  const showTerm = t.terim.toLocaleLowerCase('tr') !== t.metin.toLocaleLowerCase('tr')
  return createPortal(
    <div
      ref={box}
      className={`${styles.pop} ${styles.termPop}`}
      style={pos ? { left: pos.left, top: pos.top } : { left: 8, top: -9999 }}
      role="dialog"
      aria-label={`${t.metin}: açıklama`}
      data-noswipe
    >
      <div className={styles.popHead}>
        <strong>{t.metin}</strong>
        <button type="button" className={styles.popIcon} onClick={onClose} aria-label="Kapat">
          ✕
        </button>
      </div>
      {locked ? (
        <>
          <p className={styles.popStatus}>
            Bu terim bir şıkta geçiyor. Açıklaması cevabı ele verebilir; cevapladıktan sonra serbestçe açılır.
          </p>
          <div className={styles.popActions}>
            <button type="button" className="btn btn-ghost" onClick={() => setLocked(false)}>
              Yine de göster
            </button>
          </div>
        </>
      ) : (
        <>
          <p className={styles.popMeaning}>
            {t.kisa}
            {showTerm && <span className={styles.termBase}> · {t.terim}</span>}
          </p>
          <p className={styles.termText}>{t.aciklama}</p>
          {t.koken && <p className={styles.popStatus}>🔤 {t.koken}</p>}
        </>
      )}
    </div>,
    document.body,
  )
}

/** "Bu soru ne soruyor?" — sorunun sade Türkçe hâli (açılır/kapanır). */
export function AskLine({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={styles.dusAsk}>
      <button type="button" className={styles.dusAskBtn} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        💬 {open ? 'Ne soruyor:' : 'Bu soru ne soruyor?'}
      </button>
      {open && <span className={styles.dusAskText}> {text}</span>}
    </div>
  )
}
