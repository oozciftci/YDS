// Odak modunda yalnızca sayfanın ana alanı ([data-focus-stage]) ve korunanlar ([data-focus-keep], açık balon/pencere
// role="dialog") görünsün. Önceden bu bir :has() CSS kuralıydı; büyük sayfalarda (kelimeleri tek tek düğme olan sınav
// paragrafı) sayfa çevirmenin her karesinde tüm ağacı yeniden taradığı için telefonu kilitliyordu. Şimdi gizlenecek
// kardeşler yalnızca içerik değişince bir kez işaretlenir (data-focus-off); CSS tek bir öznitelik seçicisidir.

const OFF = 'data-focus-off'
const ROOT_CLASS = 'focus-has-stage'

/** Gerçek ana alan (sayfa çevirmenin kopyaları aria-hidden taşır, onlar sayılmaz) */
export const realStage = (root: ParentNode) => root.querySelector<HTMLElement>('[data-focus-stage]:not([aria-hidden])')

function apply(main: HTMLElement) {
  main.querySelectorAll(`[${OFF}]`).forEach((e) => e.removeAttribute(OFF))
  const stage = realStage(main)
  document.documentElement.classList.toggle(ROOT_CLASS, !!stage)
  if (!stage) {
    document.documentElement.style.removeProperty('--focus-reserve')
    return
  }
  const keep = new Set<Element>([stage, ...main.querySelectorAll('[data-focus-keep], [role="dialog"]')])
  const insideKept = (e: Element) => {
    for (let p = e.parentElement; p && p !== main; p = p.parentElement) if (keep.has(p)) return true
    return false
  }
  // Korunanların ataları görünür kalır; her atanın öbür çocukları gizlenir
  const needed = new Set<Element>()
  for (const k of keep) {
    if (insideKept(k)) continue
    for (let e: Element | null = k; e && e !== main; e = e.parentElement) needed.add(e)
  }
  for (const n of [main, ...needed]) {
    if (keep.has(n)) continue
    for (const c of n.children) if (!needed.has(c)) c.setAttribute(OFF, '')
  }
  reserve(stage, keep, insideKept)
}

/** Ana alanın dışında görünür kalanların (süre, Bitir …) yüksekliği: alan ekrana onlarla birlikte sığsın (--focus-reserve) */
function reserve(stage: HTMLElement, keep: Set<Element>, insideKept: (e: Element) => boolean) {
  const rows: [number, number][] = []
  for (const k of keep) {
    if (k === stage || insideKept(k) || k.getAttribute('role') === 'dialog' || k.hasAttribute('data-page-turn')) continue
    const r = k.getBoundingClientRect()
    if (r.height > 0 && getComputedStyle(k).position !== 'fixed') rows.push([r.top, r.bottom])
  }
  // Aynı satırdakiler (süre ile Bitir yan yana) bir kez sayılır; satır arası boşluk için 12 px
  rows.sort((a, b) => a[0] - b[0])
  let px = 0
  let end = -Infinity
  for (const [t, b] of rows) {
    if (t >= end) {
      px += b - t + 12
      end = b
    } else if (b > end) {
      px += b - end
      end = b
    }
  }
  document.documentElement.style.setProperty('--focus-reserve', `${Math.round(px)}px`)
}

/** Odak modu açıkken çağrılır; içerik değiştikçe (sayfa, soru, balon) yeniden uygular. Kapatma işlevi döner. */
export function watchFocusStage(main: HTMLElement): () => void {
  apply(main)
  // Yalnızca öğe ekleme/çıkarma (bir işlemedeki değişiklikler tek seferde gelir); sayfa çevirmenin stil
  // değişiklikleri ve bizim işaretlerimiz (öznitelik) tetiklemez
  const obs = new MutationObserver(() => apply(main))
  obs.observe(main, { childList: true, subtree: true })
  return () => {
    obs.disconnect()
    main.querySelectorAll(`[${OFF}]`).forEach((e) => e.removeAttribute(OFF))
    document.documentElement.classList.remove(ROOT_CLASS)
    document.documentElement.style.removeProperty('--focus-reserve')
  }
}
