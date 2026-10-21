import { describe, expect, it } from 'vitest'
import { clipPolygon, constrainCorner, curl } from './pageCurl'

describe('sayfa katlama geometrisi', () => {
  it('köşe yerindeyken katlama yok', () => {
    expect(curl({ x: 100, y: 200 }, { x: 100, y: 200 }, 100, 200)).toBeNull()
  })

  it('köşe tam sola gelince sayfanın tamamı kalkar, yansıyan kapak sırtın soluna düşer', () => {
    const c = curl({ x: -100, y: 200 }, { x: 100, y: 200 }, 100, 200)!
    // Katlama çizgisi x = 0: yerinde kalan kısım yok denecek kadar ince
    const xs = c.remainder.map((p) => p.x)
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(1e-9)
    // Yansıma: (100, 50) → (-100, 50)
    const [a, b, cc, d, e, f] = c.matrix
    expect(a * 100 + cc * 50 + e).toBeCloseTo(-100)
    expect(b * 100 + d * 50 + f).toBeCloseTo(50)
  })

  it('yarı yolda sağ yarı kalkar, sol yarı yerinde kalır', () => {
    const c = curl({ x: 0, y: 200 }, { x: 100, y: 200 }, 100, 200)!
    expect(Math.max(...c.remainder.map((p) => p.x))).toBeCloseTo(50)
    expect(Math.min(...c.lifted.map((p) => p.x))).toBeCloseTo(50)
  })

  it('kırpma yarı düzlemi doğru keser', () => {
    const sq = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ]
    const left = clipPolygon(sq, (p) => 4 - p.x)
    expect(Math.max(...left.map((p) => p.x))).toBe(4)
  })

  it('köşe sırttan sayfa genişliğinden fazla uzaklaşamaz', () => {
    const q = constrainCorner({ x: -300, y: 200 }, { x: 100, y: 200 }, 100, 200)
    expect(Math.hypot(q.x, q.y - 200)).toBeCloseTo(100)
  })
})
