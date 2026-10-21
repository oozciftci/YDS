import { constrainCorner, curl, polygonCss, type Pt } from '../pages/books/pageCurl'

// Genel sayfa çevirme (kitap okuyucudaki katlanmanın her içerik için olanı). Çevrilecek alanın (soru, kelime kartı …)
// o anki görünümü kopyalanıp üstüne konur; kopya köşesinden katlanarak kalkar (arka yüzü ince kâğıt, gölgeli), altında
// zaten yeni içerik vardır. İleri: sağ köşe sola; geri: aynası, sol köşe sağa. Yalnızca clip-path + transform.

export interface Turn {
  /** t: 0 yerinde … 1 tamamen çevrildi; `at`: köşenin gideceği nokta (görünür alan koordinatı), yoksa yay yolu */
  paint(t: number, at?: Pt): void
  /** t'yi hedefe canlandır (parmak noktasından düz çizgiyle ya da yay yolundan) */
  animate(to: 0 | 1, ms: number, from?: Pt): Promise<void>
  remove(): void
  readonly W: number
  readonly H: number
  readonly left: number
  readonly top: number
  readonly corner: Pt
  progress: number
}

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)

function layer(css: string) {
  const d = document.createElement('div')
  d.style.cssText = `position:absolute;inset:0;${css}`
  return d
}

function cloneOf(stage: HTMLElement, x: number, y: number, w: number, h: number) {
  const c = stage.cloneNode(true) as HTMLElement
  c.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'))
  c.removeAttribute('id')
  c.setAttribute('aria-hidden', 'true')
  c.style.cssText += `;position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;margin:0;box-sizing:border-box;animation:none;transition:none;transform:none;opacity:1;`
  return c
}

/** Çevirmeyi başlat: kopya hazır, henüz katlanmamış (t = 0). Alan görünmüyorsa null. */
export function startTurn(stage: HTMLElement, dir: 1 | -1, cornerSide: 'top' | 'bottom'): Turn | null {
  const r = stage.getBoundingClientRect()
  const left = Math.max(0, r.left)
  const top = Math.max(0, r.top)
  const W = Math.min(innerWidth, r.right) - left
  const H = Math.min(innerHeight, r.bottom) - top
  const parent = stage.parentElement
  if (W < 40 || H < 40 || !parent) return null

  const bg = getComputedStyle(document.body).backgroundColor || '#fff'
  const wrap = document.createElement('div')
  wrap.setAttribute('aria-hidden', 'true')
  // Odak modunda gizlenmesin (index.css)
  wrap.setAttribute('data-focus-keep', '')
  wrap.style.cssText = `position:fixed;left:${left}px;top:${top}px;width:${W}px;height:${H}px;overflow:hidden;z-index:9;pointer-events:none;`

  const top_ = layer(`overflow:hidden;background:${bg};will-change:clip-path;`)
  const shadow = layer('inset:auto;transform-origin:center;visibility:hidden;background:linear-gradient(to bottom, rgb(0 0 0 / 0.32), rgb(0 0 0 / 0) 70%);')
  const flap = layer(`overflow:hidden;background:${bg};transform-origin:0 0;visibility:hidden;will-change:transform,clip-path;`)
  const paper = layer('background:rgb(251 249 244 / 0.9);')
  const shade = layer('inset:auto;transform-origin:center;background:linear-gradient(to bottom, rgb(0 0 0 / 0.22), rgb(0 0 0 / 0.05) 45%, rgb(255 255 255 / 0.25));')

  const ox = r.left - left
  const oy = r.top - top
  const c1 = cloneOf(stage, ox, oy, r.width, r.height)
  const c2 = cloneOf(stage, ox, oy, r.width, r.height)
  top_.appendChild(c1)
  flap.append(c2, paper, shade)
  wrap.append(shadow, top_, flap)
  // Aynı ebeveyne eklenir: kalıtılan yazı tipi/renk ve üst seçicili stiller kopyada da geçerli
  parent.insertBefore(wrap, stage.nextSibling)
  // İçeride kaydırılmış alanın kopyası da aynı yerde dursun
  c1.scrollTop = c2.scrollTop = stage.scrollTop

  const C: Pt = { x: dir === 1 ? W : 0, y: cornerSide === 'bottom' ? H : 0 }
  const lift = cornerSide === 'bottom' ? -1 : 1
  const constrain = (P: Pt): Pt => {
    if (dir === 1) return constrainCorner(P, C, W, H)
    const q = constrainCorner({ x: W - P.x, y: P.y }, { x: W - C.x, y: C.y }, W, H)
    return { x: W - q.x, y: q.y }
  }
  const endPoint: Pt = { x: dir === 1 ? -W : 2 * W, y: C.y }

  const turn: Turn = {
    W,
    H,
    left,
    top,
    corner: C,
    progress: 0,
    paint(t, at) {
      turn.progress = t
      let P = at ?? { x: dir === 1 ? W - 2 * W * t : 2 * W * t, y: C.y + lift * Math.sin(Math.PI * t) * 0.12 * H }
      P = constrain(P)
      const g = curl(P, C, W, H)
      if (!g) {
        top_.style.clipPath = ''
        flap.style.visibility = 'hidden'
        shadow.style.visibility = 'hidden'
        return
      }
      top_.style.clipPath = polygonCss(g.remainder)
      flap.style.visibility = 'visible'
      flap.style.clipPath = polygonCss(g.lifted)
      flap.style.transform = `matrix(${g.matrix.join(',')})`
      const L = 2 * Math.hypot(W, H)
      const sw = Math.max(24, W * 0.2)
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
    },
    animate(to, ms, from) {
      const t0 = turn.progress
      const end = to === 1 ? endPoint : C
      return new Promise((done) => {
        const start = performance.now()
        const step = (now: number) => {
          const k = Math.min(1, (now - start) / ms)
          const e = ease(k)
          if (from) turn.paint(t0 + (to - t0) * e, { x: from.x + (end.x - from.x) * e, y: from.y + (end.y - from.y) * e })
          else turn.paint(t0 + (to - t0) * e)
          if (k < 1) requestAnimationFrame(step)
          else done()
        }
        requestAnimationFrame(step)
      })
    },
    remove() {
      wrap.remove()
    },
  }
  return turn
}
