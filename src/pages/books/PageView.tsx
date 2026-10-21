import { useLiveQuery } from 'dexie-react-hooks'
import {
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type Ref,
} from 'react'
import { db } from '../../db'
import type { BookPage, Frame } from './bookData'
import { PEN_COLORS, addStroke, inkId, type Pen } from './ink'
import { constrainCorner, curl, polygonCss, type Pt } from './pageCurl'
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
  // İki parmak = yakınlaştırma: çizilen çizgi atılır, parmaklar kalkana kadar çizim yok (tarayıcı yakınlaştırır)
  const fingers = useRef(new Set<number>())
  const drawId = useRef<number | null>(null)
  const pinching = useRef(false)
  const drop = () => {
    pts.current = null
    drawId.current = null
    setCur(null)
  }
  const release = (id: number) => {
    fingers.current.delete(id)
    if (!fingers.current.size) pinching.current = false
  }

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
        e.stopPropagation()
        fingers.current.add(e.pointerId)
        if (fingers.current.size > 1 || pinching.current) {
          pinching.current = true
          drop()
          return
        }
        if (e.pointerType !== 'touch') e.preventDefault()
        drawId.current = e.pointerId
        pts.current = at(e)
        setCur(pts.current)
      }}
      onPointerMove={(e) => {
        const d = pts.current
        if (!pen.on || !d || e.pointerId !== drawId.current) return
        const [x, y] = at(e)
        // Çok sık noktaları atla (kayıt küçük kalsın)
        if (Math.hypot(x - d[d.length - 2], y - d[d.length - 1]) < page.w * 0.003) return
        pts.current = [...d, x, y]
        setCur(pts.current)
      }}
      onPointerUp={(e) => {
        release(e.pointerId)
        if (e.pointerId !== drawId.current) return
        const d = pts.current
        drop()
        if (!d) return
        // Tek dokunuş: küçük nokta
        const stroke = { c: pen.color, w: Math.round(width * 10) / 10, o: opacity, d: d.length === 2 ? [...d, d[0] + 1, d[1]] : d }
        void addStroke(userId, bookId, page.n, stroke)
      }}
      onPointerCancel={(e) => {
        // Tarayıcı yakınlaştırmayı devraldığında da gelir: yarım çizgi kaydedilmez
        release(e.pointerId)
        if (e.pointerId === drawId.current) drop()
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === 'touch') release(e.pointerId)
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

export interface Side {
  frame: Frame
  page: BookPage
  src: string | undefined
}

export interface PageViewHandle {
  /** Komşu kareye çevirme animasyonuyla geç; komşu yoksa ya da animasyon sürüyorsa false */
  flip: (dir: 1 | -1) => boolean
}

/** Bir karenin içeriği: tam sayfa görüntüsü + çizim; kare (yarım/tam) bunun bir dilimini gösterir. */
function SheetContent({ side, userId, bookId, pen, alt }: { side: Side; userId: string; bookId: string; pen: Pen; alt: string }) {
  const span = side.frame.end - side.frame.start
  return (
    <div className={styles.layer} style={{ top: `${(-side.frame.start / span) * 100}%`, height: `${100 / span}%` }}>
      <img src={side.src} alt={alt} draggable={false} />
      <InkLayer userId={userId} bookId={bookId} page={side.page} pen={pen} />
    </div>
  )
}

type Anim = { dir: 1 | -1; kind: 'curl' | 'slide'; corner: 'top' | 'bottom' }

/** Kalkan köşe: ileri çevirmede sağ, geri çevirmede sol (alt ya da üst). */
const cornerOf = (a: Anim, W: number, H: number) => ({ x: a.dir === 1 ? W : 0, y: a.corner === 'bottom' ? H : 0 })

/** Kâğıt esnemez: ileri çevirmede sırt sol kenar, geri çevirmede sağ kenar (aynalanarak aynı sınır). */
function constrainTurn(a: Anim, P: Pt, C: Pt, W: number, H: number): Pt {
  if (a.dir === 1) return constrainCorner(P, C, W, H)
  const q = constrainCorner({ x: W - P.x, y: P.y }, { x: W - C.x, y: C.y }, W, H)
  return { x: W - q.x, y: q.y }
}
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)

/**
 * Kitap gibi sayfa çevirme. İleri: mevcut sayfanın köşesi katlanarak kalkar (arka yüzü gölgeli kâğıt), altından sonraki
 * sayfa açılır. Geri: önceki sayfa soldan katlanmış hâlden açılarak üstüne kapanır. Yarım sayfa görünümünde aynı sayfanın
 * yarıları arasında katlama yerine dikey kayma. Kalem açıkken çevirme yok. Yalnızca clip-path ve transform (ekran kartı).
 */
export function PageView({
  userId,
  bookId,
  cur,
  prev,
  next,
  alt,
  pen,
  onTap,
  onTurned,
  className,
  style,
  handle,
}: {
  userId: string
  bookId: string
  cur: Side
  prev?: Side
  next?: Side
  alt: string
  pen: Pen
  onTap: (side: -1 | 0 | 1) => void
  /** Animasyon bitti, kare değişmeli */
  onTurned: (dir: 1 | -1) => void
  className: string
  style?: CSSProperties
  handle?: Ref<PageViewHandle>
}) {
  const span = cur.frame.end - cur.frame.start
  const box = useRef<HTMLDivElement>(null)
  const topRef = useRef<HTMLDivElement>(null)
  const underRef = useRef<HTMLDivElement>(null)
  const flapRef = useRef<HTMLDivElement>(null)
  const shadowRef = useRef<HTMLDivElement>(null)
  const shadeRef = useRef<HTMLDivElement>(null)
  const [anim, setAnim] = useState<Anim | null>(null)
  const animRef = useRef<Anim | null>(null)
  const busy = useRef(false)
  const drag = useRef<{ x: number; y: number; horizontal: boolean | null; t: number; last: { x: number; y: number } } | null>(null)
  const pendingAuto = useRef(false)
  const raf = useRef(0)

  const size = () => ({ W: box.current?.offsetWidth || 1, H: box.current?.offsetHeight || 1 })

  /** Görünümü t ∈ [0, 1] ilerlemesine göre çiz (0: başlangıç, 1: geçiş tamam). `at`: parmak konumu (yoksa yay yolu). */
  function paint(a: Anim, t: number, at?: { x: number; y: number }) {
    const { W, H } = size()
    const top = topRef.current
    const under = underRef.current
    const flap = flapRef.current
    const shadow = shadowRef.current
    const shade = shadeRef.current
    if (!top || !under) return
    under.style.visibility = 'visible'
    if (a.kind === 'slide') {
      const s = a.dir
      top.style.transform = `translateY(${-s * t * H}px)`
      under.style.transform = `translateY(${s * (1 - t) * H}px)`
      return
    }
    if (!flap || !shadow || !shade) return
    // İleri: sağ köşe kalkıp sola katlanır (altta sonraki sayfa); geri: aynası — sol köşe kalkıp sağa katlanır (altta önceki)
    const C = cornerOf(a, W, H)
    const lift = a.corner === 'bottom' ? -1 : 1
    let P = at ? { ...at } : { x: a.dir === 1 ? W - 2 * W * t : 2 * W * t, y: C.y + lift * Math.sin(Math.PI * t) * 0.12 * H }
    P = constrainTurn(a, P, C, W, H)
    const g = curl(P, C, W, H)
    if (!g) {
      top.style.clipPath = ''
      flap.style.visibility = 'hidden'
      shadow.style.visibility = 'hidden'
      return
    }
    top.style.clipPath = polygonCss(g.remainder)
    flap.style.visibility = 'visible'
    flap.style.clipPath = polygonCss(g.lifted)
    flap.style.transform = `matrix(${g.matrix.join(',')})`
    // Katlama çizgisi boyunca gölge şeritleri (C tarafında; kapağınki yansıyınca katlamanın öbür yüzüne düşer)
    const L = 2 * Math.hypot(W, H)
    const sw = Math.max(24, W * 0.22)
    const n = g.normal
    const q = { x: g.mid.x - (n.x * sw) / 2, y: g.mid.y - (n.y * sw) / 2 }
    const phi = Math.atan2(n.x, -n.y)
    for (const el of [shadow, shade]) {
      el.style.width = `${L}px`
      el.style.height = `${sw}px`
      el.style.left = `${q.x - L / 2}px`
      el.style.top = `${q.y - sw / 2}px`
      el.style.transform = `rotate(${phi}rad)`
    }
    shadow.style.visibility = 'visible'
    const lifted = Math.min(1, Math.hypot(P.x - C.x, P.y - C.y) / (2 * W))
    shadow.style.opacity = String(Math.min(1, lifted * 5) * (1 - lifted * 0.6))
  }

  function rest() {
    for (const el of [topRef.current, underRef.current, flapRef.current]) {
      if (!el) continue
      el.style.clipPath = ''
      el.style.transform = ''
    }
    if (underRef.current) underRef.current.style.visibility = 'hidden'
    if (flapRef.current) flapRef.current.style.visibility = 'hidden'
    if (shadowRef.current) shadowRef.current.style.visibility = 'hidden'
  }

  /** t0'dan t1'e canlandır; parmak noktasından başlıyorsa düz çizgiyle hedefe gider. */
  function run(a: Anim, t0: number, t1: number, ms: number, from?: { x: number; y: number }, done?: () => void) {
    cancelAnimationFrame(raf.current)
    busy.current = true
    const { W, H } = size()
    const C = cornerOf(a, W, H)
    const end = a.kind === 'curl' ? (t1 >= 1 ? { x: a.dir === 1 ? -W : 2 * W, y: C.y } : C) : undefined
    const start = performance.now()
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / ms)
      const e = ease(k)
      if (from && end) paint(a, t0 + (t1 - t0) * e, { x: from.x + (end.x - from.x) * e, y: from.y + (end.y - from.y) * e })
      else paint(a, t0 + (t1 - t0) * e)
      if (k < 1) raf.current = requestAnimationFrame(step)
      else {
        busy.current = false
        done?.()
      }
    }
    raf.current = requestAnimationFrame(step)
  }

  function begin(dir: 1 | -1, corner: 'top' | 'bottom'): Anim | null {
    const target = dir === 1 ? next : prev
    if (!target || busy.current) return null
    const a: Anim = { dir, kind: target.frame.page === cur.frame.page ? 'slide' : 'curl', corner }
    animRef.current = a
    setAnim(a)
    return a
  }

  const finish = (a: Anim) => () => onTurned(a.dir)
  const cancel = () => () => {
    animRef.current = null
    setAnim(null)
    rest()
  }

  useImperativeHandle(handle, () => ({
    flip: (dir) => {
      if (!begin(dir, 'bottom')) return false
      pendingAuto.current = true
      return true
    },
  }))

  // Rol değişimi (hangi kare üstte/altta) çizildikten sonra: otomatik çevirmeyi başlat ya da ilk kareyi boya
  useLayoutEffect(() => {
    const a = animRef.current
    if (!a || !anim) return
    if (pendingAuto.current) {
      pendingAuto.current = false
      run(a, 0, 1, a.kind === 'curl' ? 620 : 320, undefined, finish(a))
    } else paint(a, drag.current?.t ?? 0, drag.current ? toPoint(a, drag.current.last) : undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anim])

  // Kare değişti (çevirme bitti ya da başka yoldan gidildi): dinlenme durumu
  const key = `${cur.frame.page}-${cur.frame.half}-${span}`
  useLayoutEffect(() => {
    cancelAnimationFrame(raf.current)
    busy.current = false
    animRef.current = null
    setAnim(null)
    rest()
  }, [key])

  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  /** Parmak konumu (ekran) → kutu koordinatı: kalkan köşe parmağı izler. */
  function toPoint(_a: Anim, client: { x: number; y: number }) {
    const r = box.current!.getBoundingClientRect()
    return { x: client.x - r.left, y: client.y - r.top }
  }
  function progressOf(a: Anim, client: { x: number; y: number }, startX: number) {
    const { W } = size()
    if (a.kind === 'slide') return Math.max(0, Math.min(1, (Math.abs(client.x - startX) / W) * 1.3))
    const P = toPoint(a, client)
    const u = a.dir === 1 ? (W - P.x) / (2 * W) : P.x / (2 * W)
    return Math.max(0, Math.min(1, u))
  }

  // Üstte hep mevcut sayfa kalkar; altta yöne göre sonraki ya da önceki
  const topSide = cur
  const underSide = anim ? (anim.dir === 1 ? next! : prev!) : null

  return (
    <div
      ref={box}
      className={className}
      style={{ aspectRatio: `${cur.page.w} / ${cur.page.h * span}`, ...style }}
      onClick={(e) => {
        if (pen.on || busy.current) return
        const r = e.currentTarget.getBoundingClientRect()
        const x = (e.clientX - r.left) / r.width
        onTap(x > 0.67 ? 1 : x < 0.33 ? -1 : 0)
      }}
      onTouchStart={(e) => {
        if (pen.on || busy.current || e.touches.length !== 1) return
        const t0 = e.touches[0]
        drag.current = { x: t0.clientX, y: t0.clientY, horizontal: null, t: 0, last: { x: t0.clientX, y: t0.clientY } }
      }}
      onTouchMove={(e) => {
        const d = drag.current
        if (!d || e.touches.length !== 1) return
        const p = { x: e.touches[0].clientX, y: e.touches[0].clientY }
        const dx = p.x - d.x
        const dy = p.y - d.y
        if (d.horizontal === null && Math.hypot(dx, dy) > 8) {
          d.horizontal = Math.abs(dx) > Math.abs(dy) * 1.2
          if (d.horizontal) {
            const r = box.current!.getBoundingClientRect()
            if (!begin(dx < 0 ? 1 : -1, d.y - r.top > r.height / 2 ? 'bottom' : 'top')) d.horizontal = false
          }
        }
        if (!d.horizontal) return
        const a = animRef.current
        if (!a) return
        d.last = p
        d.t = progressOf(a, p, d.x)
        if (anim) paint(a, d.t, a.kind === 'curl' ? toPoint(a, p) : undefined)
      }}
      onTouchEnd={() => {
        const d = drag.current
        drag.current = null
        const a = animRef.current
        if (!d?.horizontal || !a) return
        const go = d.t > 0.22
        const from = a.kind === 'curl' ? toPoint(a, d.last) : undefined
        run(a, d.t, go ? 1 : 0, 260 + 260 * (go ? 1 - d.t : d.t), from, go ? finish(a) : cancel())
      }}
    >
      {underSide && (
        <div ref={underRef} className={styles.sheet} style={{ visibility: 'hidden' }}>
          <SheetContent side={underSide} userId={userId} bookId={bookId} pen={pen} alt="" />
        </div>
      )}
      <div ref={shadowRef} className={styles.foldShadow} style={{ visibility: 'hidden' }} />
      <div ref={topRef} className={styles.sheet}>
        <SheetContent side={topSide} userId={userId} bookId={bookId} pen={pen} alt={alt} />
      </div>
      {anim?.kind === 'curl' && (
        <div ref={flapRef} className={`${styles.sheet} ${styles.flap}`} style={{ visibility: 'hidden' }}>
          <SheetContent side={topSide} userId={userId} bookId={bookId} pen={{ ...pen, on: false }} alt="" />
          <div className={styles.paper} />
          <div ref={shadeRef} className={styles.flapShade} />
        </div>
      )}
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
