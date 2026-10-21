// Sayfa katlama geometrisi (tek sayfa, kitap gibi çevirme). Sayfa W×H; C kaldırılan köşe, P köşenin parmakla geldiği yer.
// Katlama çizgisi C–P doğru parçasının orta dikmesidir: C tarafındaki parça kalkar ve çizgiye göre yansıyarak P tarafına
// katlanır (arka yüzü görünür), altta kalan yer bir sonraki sayfayı gösterir.

export interface Pt {
  x: number
  y: number
}

export interface Curl {
  /** Yerinde kalan kısım (sayfa koordinatında çokgen) */
  remainder: Pt[]
  /** Kalkan kısım (katlanmadan önceki yeri; kapak bu çokgenle kırpılıp yansıtılır) */
  lifted: Pt[]
  /** Yansıma: CSS matrix(a, b, c, d, e, f) değerleri (transform-origin 0 0) */
  matrix: [number, number, number, number, number, number]
  /** Katlama çizgisi: orta nokta ve C'den P'ye birim normal */
  mid: Pt
  normal: Pt
}

/** Çokgeni yarı düzlemle kırp (Sutherland–Hodgman): keep(p) ≥ 0 olan taraf kalır. */
export function clipPolygon(poly: Pt[], keep: (p: Pt) => number): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const fa = keep(a)
    const fb = keep(b)
    if (fa >= 0) out.push(a)
    if ((fa >= 0) !== (fb >= 0)) {
      const t = fa / (fa - fb)
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
    }
  }
  return out
}

/** P köşeyi sayfanın sırtından (sol kenar) koparmayacak yere sınırla: kâğıt esnemez. */
export function constrainCorner(P: Pt, C: Pt, W: number, H: number): Pt {
  // Kaldırılan köşeyle aynı yükseklikteki sırt noktası: uzaklık en fazla W
  const S = { x: 0, y: C.y }
  const S2 = { x: 0, y: H - C.y }
  let q = P
  const d1 = Math.hypot(q.x - S.x, q.y - S.y)
  if (d1 > W) q = { x: S.x + ((q.x - S.x) * W) / d1, y: S.y + ((q.y - S.y) * W) / d1 }
  const diag = Math.hypot(W, H)
  const d2 = Math.hypot(q.x - S2.x, q.y - S2.y)
  if (d2 > diag) q = { x: S2.x + ((q.x - S2.x) * diag) / d2, y: S2.y + ((q.y - S2.y) * diag) / d2 }
  return q
}

export function curl(P: Pt, C: Pt, W: number, H: number): Curl | null {
  const dx = P.x - C.x
  const dy = P.y - C.y
  const len = Math.hypot(dx, dy)
  if (len < 0.5) return null
  const n = { x: dx / len, y: dy / len }
  const m = { x: (P.x + C.x) / 2, y: (P.y + C.y) / 2 }
  const side = (p: Pt) => (p.x - m.x) * n.x + (p.y - m.y) * n.y
  const rect = [
    { x: 0, y: 0 },
    { x: W, y: 0 },
    { x: W, y: H },
    { x: 0, y: H },
  ]
  const k = 2 * (m.x * n.x + m.y * n.y)
  return {
    remainder: clipPolygon(rect, side),
    lifted: clipPolygon(rect, (p) => -side(p)),
    matrix: [1 - 2 * n.x * n.x, -2 * n.x * n.y, -2 * n.x * n.y, 1 - 2 * n.y * n.y, k * n.x, k * n.y],
    mid: m,
    normal: n,
  }
}

export const polygonCss = (poly: Pt[]) =>
  poly.length < 3 ? 'polygon(0 0, 0 0, 0 0)' : `polygon(${poly.map((p) => `${p.x.toFixed(1)}px ${p.y.toFixed(1)}px`).join(', ')})`
