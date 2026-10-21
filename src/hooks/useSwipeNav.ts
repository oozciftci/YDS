import { useCallback, useEffect, useRef, type CSSProperties } from 'react'
import { realStage } from '../services/focusStage'
import { startTurn, type Turn } from '../services/pageTurn'
import { useAppearance } from '../stores/appearance'

// Uygulama genelinde önceki/sonraki (soru, kart, cümle …) — kitap gibi sayfa çevirme.
// Kaydırırken çevrilecek alanın ([data-focus-stage], yoksa kapsayıcı) köşesi parmağı izleyerek katlanır (altında boş kâğıt);
// bırakınca yeni içerik yerleşir ve çevirme onu açarak tamamlanır, yarıda bırakılırsa sayfa geri kapanır (hiçbir şey değişmez). Yatay hareket başlayınca dikey kaydırma kilitlenir (kart oynamaz).
// Dikey kaydırma, yazı alanları, metin seçimi, açık balon/pencere ve yana kayan tablolar etkilenmez. Kitap okuyucunun
// kendi sayfa çevirmesi var (books/PageView).

export interface SwipeNavOptions {
  onPrev?: () => void
  onNext?: () => void
  /** Kenarda mıyız: geçilemeyen yöne çekince yaylanıp geri döner */
  canPrev?: boolean
  canNext?: boolean
  enabled?: boolean
}

function blocked(target: EventTarget | null, container: HTMLElement | null): boolean {
  if (!(target instanceof Element)) return false
  if (target.closest('input, textarea, select, [contenteditable="true"], [data-noswipe]')) return true
  // Üstte açık bir pencere (kelime balonu vb.); kaydırılan alanın kendisi pencereyse (Gece Modu) sorun değil
  const dlg = target.closest('[role="dialog"]')
  if (dlg && dlg !== container && !dlg.contains(container)) return true
  // Yana kayan bir alanın (tablo, şerit) içindeyse onun kaydırması bozulmasın. Ana alanın kendisi sayılmaz: odak modunda
  // dikey kayabilsin diye overflow-y verilince yatay da "auto" görünür ve birkaç piksellik taşma kaydırmayı kapatıyordu.
  for (let el: Element | null = target; el && el !== container && el !== document.body; el = el.parentElement) {
    if (el.hasAttribute('data-focus-stage')) break
    if (el.scrollWidth > el.clientWidth + 2) {
      const ox = getComputedStyle(el).overflowX
      if (ox === 'auto' || ox === 'scroll') return true
    }
  }
  return false
}

const reduced = () => useAppearance.getState().appearance.motion === 'reduce' || matchMedia('(prefers-reduced-motion: reduce)').matches
const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
// Sayfa çevirmenin kopyaları (aria-hidden) değil, gerçek ana alan
const stageOf = (el: HTMLElement) => realStage(el) ?? el

export function useSwipeNav({ onPrev, onNext, canPrev = true, canNext = true, enabled = true }: SwipeNavOptions) {
  const ref = useRef<HTMLElement | null>(null)
  const opts = useRef({ onPrev, onNext, canPrev, canNext, enabled })
  useEffect(() => {
    opts.current = { onPrev, onNext, canPrev, canNext, enabled }
  })
  const busy = useRef(false)
  // Süren çevirme (düğme, ok tuşu ya da bırakılmış kaydırma): yeni dokunuşta beklemeden bitirilir
  const active = useRef<Turn | null>(null)

  /** Düğme / ok tuşu: sayfa çevirme animasyonuyla geç */
  const turn = useCallback(async (dir: 1 | -1) => {
    const o = opts.current
    const h = dir === 1 ? o.onNext : o.onPrev
    if (busy.current || !h || !(dir === 1 ? o.canNext : o.canPrev)) return
    const el = ref.current
    const t = el && !reduced() ? startTurn(stageOf(el), dir, 'bottom') : null
    if (!t) {
      h()
      return
    }
    busy.current = true
    active.current = t
    try {
      h()
      await t.animate(1, 620)
    } finally {
      t.remove()
      if (active.current === t) active.current = null
      busy.current = false
    }
  }, [])

  // Dokunma: yerli dinleyiciler (touchmove pasif değil: yatay harekette dikey kaydırmayı durdurmak için)
  const attach = useCallback((el: HTMLElement) => {
    type Drag = { x: number; y: number; t: number; horizontal: boolean | null; turn: Turn | null; dir: 1 | -1; rubber: number; last: { x: number; y: number } }
    let d: Drag | null = null
    const handler = (dir: 1 | -1) => (dir === 1 ? opts.current.onNext : opts.current.onPrev)
    const allowed = (dir: 1 | -1) => Boolean(handler(dir)) && (dir === 1 ? opts.current.canNext : opts.current.canPrev)

    const rubber = (dx: number, animate: boolean) => {
      const s = stageOf(el)
      s.style.transition = animate ? 'transform 0.18s ease-out' : 'none'
      s.style.transform = dx ? `translateX(${dx}px)` : ''
    }

    const finish = (s: Drag) => {
      const dx = s.last.x - s.x
      const fast = Math.abs(dx) / Math.max(1, Date.now() - s.t) > 0.45 && Math.abs(dx) > 30
      if (s.turn) {
        const t = s.turn
        const commit = t.progress > 0.18 || fast
        busy.current = true
        active.current = t
        const from = { x: t.corner.x + 2 * dx, y: t.corner.y + (s.last.y - s.y) * 0.5 }
        void (async () => {
          try {
            if (commit) {
              // Bırakınca geçilir: yeni içerik altta yerleşir, kâğıt kalkar, çevirme onu açarak tamamlanır
              handler(s.dir)?.()
              await nextFrame()
              t.uncover()
            }
            await t.animate(commit ? 1 : 0, commit ? 260 + 300 * (1 - t.progress) : 220, from)
          } finally {
            // Ne olursa olsun kopya ekranda kalmasın
            t.remove()
            if (active.current === t) active.current = null
            busy.current = false
          }
        })()
        return
      }
      if (s.rubber) rubber(0, true)
      // Hareketi azalt açıkken: animasyonsuz geç
      if (reduced() && allowed(s.dir) && (Math.abs(dx) > 50 || fast)) handler(s.dir)!()
    }

    // Parmak olayları dokunulan öğeden dinlenir: kaydırma başlayınca yeni içerik hazırlandığında o öğe sayfadan kalkabilir;
    // iPhone Safari sonraki olayları yalnızca o (artık sayfada olmayan) öğeye gönderir, kapsayıcıya ulaşmaz. Önceden bu
    // yüzden parmak kalkınca çevirme bitmiyor, kopya ekranda takılı kalıyordu.
    let target: EventTarget | null = null
    const unbind = () => {
      if (!target) return
      target.removeEventListener('touchmove', onMove as EventListener)
      target.removeEventListener('touchend', onEnd)
      target.removeEventListener('touchcancel', onEnd)
      target = null
    }

    const onStart = (e: TouchEvent) => {
      // Bitmemiş bir önceki sürükleme kaldıysa (olay kaybı): kopyasını kaldır (sayfa değişmemişti)
      if (d) {
        d.turn?.remove()
        if (d.rubber) rubber(0, false)
        d = null
        unbind()
      }
      // Önceki çevirme hâlâ oynuyorsa hemen bitir: hızlı art arda kaydırmada hiçbir hareket boşa gitmesin
      active.current?.skip()
      if (!opts.current.enabled || e.touches.length !== 1 || blocked(e.target, el) || window.getSelection()?.toString()) return
      const p = e.touches[0]
      d = { x: p.clientX, y: p.clientY, t: Date.now(), horizontal: null, turn: null, dir: 1, rubber: 0, last: { x: p.clientX, y: p.clientY } }
      target = e.target
      target?.addEventListener('touchmove', onMove as EventListener, { passive: false })
      target?.addEventListener('touchend', onEnd)
      target?.addEventListener('touchcancel', onEnd)
    }

    function onMove(e: TouchEvent) {
      if (!d) return
      if (e.touches.length !== 1) {
        // İkinci parmak (yakınlaştırma): çevirmeyi geri al
        const s = d
        d = null
        unbind()
        if (s.turn) {
          s.last = { x: s.x, y: s.y }
          finish(s)
        } else if (s.rubber) rubber(0, true)
        return
      }
      const p = e.touches[0]
      const dx = p.clientX - d.x
      const dy = p.clientY - d.y
      if (d.horizontal === null) {
        if (Math.hypot(dx, dy) < 7) return
        d.horizontal = Math.abs(dx) > Math.abs(dy) * 1.2
        if (!d.horizontal) {
          d = null
          unbind()
          return
        }
        d.dir = dx < 0 ? 1 : -1
        // Önceki çevirme (bir kare önce bitirildi) henüz temizlenmediyse bu hareket yalnızca yaylanır
        if (allowed(d.dir) && !reduced() && !busy.current) {
          const s = stageOf(el)
          const r = s.getBoundingClientRect()
          // Sürüklerken sayfa değiştirilmez (parmağın altındaki öğe yerinde kalsın; aksi hâlde iPhone parmak olaylarını
          // kaybediyordu): kalkan sayfanın altında boş kâğıt, geçiş bırakınca
          d.turn = startTurn(s, d.dir, d.y - r.top > r.height / 2 ? 'bottom' : 'top', { cover: true })
        }
      }
      // Yatay hareket: sayfa yukarı-aşağı oynamasın
      if (e.cancelable) e.preventDefault()
      d.last = { x: p.clientX, y: p.clientY }
      if (d.turn) {
        const t = d.turn
        const P = { x: t.corner.x + 2 * dx, y: t.corner.y + dy * 0.5 }
        const u = d.dir === 1 ? (t.W - P.x) / (2 * t.W) : P.x / (2 * t.W)
        t.paint(Math.max(0, Math.min(1, u)), P)
      } else if (!allowed(d.dir)) {
        // Kenarda: yay gibi direnç
        d.rubber = reduced() ? 0 : dx * 0.15
        rubber(d.rubber, false)
      }
    }

    function onEnd() {
      const s = d
      d = null
      unbind()
      if (s?.horizontal) finish(s)
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onStart)
      unbind()
      d?.turn?.remove()
      d = null
    }
  }, [])

  const detach = useRef<(() => void) | null>(null)
  const setRef = useCallback(
    (el: HTMLElement | null) => {
      detach.current?.()
      detach.current = null
      ref.current = el
      if (el) detach.current = attach(el)
    },
    [attach],
  )

  return {
    /** Kaydırmanın algılanacağı kapsayıcıya yayılır: <section {...swipe.props}> */
    props: { ref: setRef, style: { touchAction: 'pan-y pinch-zoom' } as CSSProperties },
    /** Önceki/sonraki düğmeleri ve ok tuşları için: sayfa çevirerek geç */
    turn,
  }
}
