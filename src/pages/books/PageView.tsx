import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { db } from '../../db'
import type { BookPage, Frame } from './bookData'
import { PEN_COLORS, addStroke, inkId, type Pen } from './ink'
import styles from './Reading.module.css'

// Kitap sayfası görünümü: görüntü + kalem katmanı + sayfa çevirme hissi.
// Çizimler sayfa görüntüsünün piksel biriminde saklanır (db.bookInk), bu yüzden yarım/tam görünümde ve odak modunda aynı yerde durur.

const toPoints = (d: number[]) => {
  let s = ''
  for (let i = 0; i < d.length; i += 2) s += `${d[i]},${d[i + 1]} `
  return s
}

function InkLayer({ userId, bookId, page, pen }: { userId: string; bookId: string; page: BookPage; pen: Pen }) {
  const ink = useLiveQuery(() => db.bookInk.get(inkId(userId, bookId, page.n)), [userId, bookId, page.n])
  const [cur, setCur] = useState<number[] | null>(null)
  const pts = useRef<number[] | null>(null)
  const svg = useRef<SVGSVGElement>(null)

  const width = pen.kind === 'marker' ? page.w * 0.016 : page.w * 0.0035
  const opacity = pen.kind === 'marker' ? 0.38 : 1
  const at = (e: ReactPointerEvent) => {
    const r = svg.current!.getBoundingClientRect()
    return [Math.round(((e.clientX - r.left) / r.width) * page.w), Math.round(((e.clientY - r.top) / r.height) * page.h)]
  }

  return (
    <svg
      ref={svg}
      className={`${styles.ink} ${pen.on ? styles.inkOn : ''}`}
      viewBox={`0 0 ${page.w} ${page.h}`}
      preserveAspectRatio="none"
      onPointerDown={(e) => {
        if (!pen.on) return
        e.preventDefault()
        e.stopPropagation()
        e.currentTarget.setPointerCapture(e.pointerId)
        pts.current = at(e)
        setCur(pts.current)
      }}
      onPointerMove={(e) => {
        const d = pts.current
        if (!pen.on || !d) return
        const [x, y] = at(e)
        // Çok sık noktaları atla (kayıt küçük kalsın)
        if (Math.hypot(x - d[d.length - 2], y - d[d.length - 1]) < page.w * 0.003) return
        pts.current = [...d, x, y]
        setCur(pts.current)
      }}
      onPointerUp={() => {
        const d = pts.current
        pts.current = null
        setCur(null)
        if (!d) return
        // Tek dokunuş: küçük nokta
        const stroke = { c: pen.color, w: Math.round(width * 10) / 10, o: opacity, d: d.length === 2 ? [...d, d[0] + 1, d[1]] : d }
        void addStroke(userId, bookId, page.n, stroke)
      }}
      onPointerCancel={() => {
        pts.current = null
        setCur(null)
      }}
      onClick={(e) => pen.on && e.stopPropagation()}
    >
      {ink?.strokes.map((s, i) => (
        <polyline key={i} points={toPoints(s.d)} stroke={s.c} strokeWidth={s.w} strokeOpacity={s.o} className={s.o < 1 ? styles.marker : undefined} />
      ))}
      {cur && <polyline points={toPoints(cur)} stroke={pen.color} strokeWidth={width} strokeOpacity={opacity} className={opacity < 1 ? styles.marker : undefined} />}
    </svg>
  )
}

// ---- Sayfa görünümü ----

/**
 * Bir kare (yarım ya da tam sayfa). `turn`: yeni kare hangi yönden geldi (1 sonraki, -1 önceki, 0 efektsiz).
 * Kalem kapalıyken parmağı izler (sayfa çevirme hissi), bırakınca `onSwipe` ile geçer; dokunma bölgeleri `onTap`.
 */
export function PageView({
  userId,
  bookId,
  page,
  frame,
  src,
  alt,
  pen,
  turn,
  onTap,
  onSwipe,
  className,
  style,
}: {
  userId: string
  bookId: string
  page: BookPage
  frame: Frame
  src: string | undefined
  alt: string
  pen: Pen
  turn: number
  onTap: (side: -1 | 0 | 1) => void
  onSwipe: (dir: -1 | 1) => void
  className: string
  style?: CSSProperties
}) {
  const span = frame.end - frame.start
  const layer = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; dx: number; horizontal: boolean | null } | null>(null)

  const setTransform = (dx: number, animate: boolean) => {
    const el = layer.current
    if (!el) return
    const w = el.offsetWidth || 1
    el.style.transition = animate ? 'transform 0.2s ease-out' : 'none'
    el.style.transformOrigin = dx < 0 ? 'left center' : 'right center'
    el.style.transform = dx ? `perspective(1400px) translateX(${dx}px) rotateY(${(dx / w) * 30}deg)` : ''
  }

  return (
    <div
      className={className}
      style={{ aspectRatio: `${page.w} / ${page.h * span}`, ...style }}
      onClick={(e) => {
        if (pen.on) return
        const r = e.currentTarget.getBoundingClientRect()
        const x = (e.clientX - r.left) / r.width
        onTap(x > 0.67 ? 1 : x < 0.33 ? -1 : 0)
      }}
      onTouchStart={(e) => {
        if (pen.on || e.touches.length !== 1) return
        drag.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, dx: 0, horizontal: null }
      }}
      onTouchMove={(e) => {
        const d = drag.current
        if (!d || e.touches.length !== 1) return
        const dx = e.touches[0].clientX - d.x
        const dy = e.touches[0].clientY - d.y
        if (d.horizontal === null && Math.hypot(dx, dy) > 8) d.horizontal = Math.abs(dx) > Math.abs(dy) * 1.3
        if (!d.horizontal) return
        d.dx = dx
        setTransform(dx, false)
      }}
      onTouchEnd={() => {
        const d = drag.current
        drag.current = null
        if (!d?.horizontal) return
        if (Math.abs(d.dx) > 60) {
          setTransform(0, false)
          onSwipe(d.dx < 0 ? 1 : -1)
        } else setTransform(0, true)
      }}
    >
      <div
        ref={layer}
        key={`${frame.page}-${frame.half}`}
        className={`${styles.layer} ${turn > 0 ? styles.turnNext : turn < 0 ? styles.turnPrev : ''}`}
        style={{ top: `${(-frame.start / span) * 100}%`, height: `${100 / span}%` }}
      >
        <img src={src} alt={alt} draggable={false} />
        <InkLayer userId={userId} bookId={bookId} page={page} pen={pen} />
      </div>
    </div>
  )
}

// ---- Yüzen kalem paleti (sürüklenebilir) ----

const POS_KEY = 'yds-book-palette-pos'

export function PenPalette({ pen, onChange, onUndo, onClear }: { pen: Pen; onChange: (p: Pen) => void; onUndo: () => void; onClear: () => void }) {
  const box = useRef<HTMLDivElement>(null)
  const start = useRef<{ px: number; py: number; x: number; y: number } | null>(null)
  const [p, setPos] = useState<{ x: number; y: number }>(() => {
    try {
      const v = JSON.parse(localStorage.getItem(POS_KEY) || 'null') as { x: number; y: number } | null
      if (v) return v
    } catch {
      // varsayılan konum
    }
    return { x: 12, y: 12 }
  })
  // Ekran dışına taşmasın (paletin boyutu ancak çizildikten sonra bilinir)
  const clamp = (x: number, y: number) => {
    const w = box.current?.offsetWidth ?? 200
    const h = box.current?.offsetHeight ?? 60
    return { x: Math.max(4, Math.min(window.innerWidth - w - 4, x)), y: Math.max(4, Math.min(window.innerHeight - h - 4, y)) }
  }
  useEffect(() => {
    const fit = () => setPos((q) => clamp(q.x, q.y))
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])

  return (
    <div ref={box} className={styles.palette} style={{ left: p.x, top: p.y }} onClick={(e) => e.stopPropagation()}>
      <span
        className={styles.handle}
        title="Sürükle"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          start.current = { px: e.clientX, py: e.clientY, x: p.x, y: p.y }
        }}
        onPointerMove={(e) => {
          const s = start.current
          if (s) setPos(clamp(s.x + e.clientX - s.px, s.y + e.clientY - s.py))
        }}
        onPointerUp={() => {
          start.current = null
          try {
            localStorage.setItem(POS_KEY, JSON.stringify(p))
          } catch {
            // yoksay
          }
        }}
      >
        ⠿
      </span>
      {PEN_COLORS.map((c) => (
        <button
          key={c.c}
          type="button"
          className={`${styles.color} ${pen.color === c.c ? styles.colorOn : ''}`}
          style={{ background: c.c }}
          aria-label={c.name}
          aria-pressed={pen.color === c.c}
          onClick={() => onChange({ ...pen, color: c.c })}
        />
      ))}
      <span className={styles.sep} />
      <button type="button" className={`${styles.tool} ${pen.kind === 'pen' ? styles.toolOn : ''}`} onClick={() => onChange({ ...pen, kind: 'pen' })} title="Kalem">
        ✏️
      </button>
      <button type="button" className={`${styles.tool} ${pen.kind === 'marker' ? styles.toolOn : ''}`} onClick={() => onChange({ ...pen, kind: 'marker' })} title="Fosforlu kalem">
        🖍️
      </button>
      <button type="button" className={styles.tool} onClick={onUndo} title="Geri al">
        ↶
      </button>
      <button type="button" className={styles.tool} onClick={onClear} title="Bu sayfadaki çizimleri sil">
        🗑️
      </button>
    </div>
  )
}
