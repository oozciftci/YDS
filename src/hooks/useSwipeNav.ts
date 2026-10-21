import { useCallback, useEffect, useRef, type CSSProperties, type TouchEvent } from 'react'
import { useAppearance } from '../stores/appearance'

// Uygulama genelinde kaydırarak önceki/sonraki (soru, kart, cümle, paragraf …).
// İçerik parmağı izler; bırakınca yeterince kaydırıldıysa kayarak geçer, değilse yerine döner. Dikey kaydırma, yazı
// alanları, metin seçimi, açık pencereler ve yana kayan tablolar etkilenmez. Kitap okuyucunun kendi sayfa çevirmesi var.

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
  // Yana kayan bir alanın (tablo, şerit) içindeyse onun kaydırması bozulmasın
  for (let el: Element | null = target; el && el !== document.body; el = el.parentElement) {
    if (el.scrollWidth > el.clientWidth + 2) {
      const ox = getComputedStyle(el).overflowX
      if (ox === 'auto' || ox === 'scroll') return true
    }
  }
  return false
}

const reduced = () => useAppearance.getState().appearance.motion === 'reduce' || matchMedia('(prefers-reduced-motion: reduce)').matches
const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

export function useSwipeNav({ onPrev, onNext, canPrev = true, canNext = true, enabled = true }: SwipeNavOptions) {
  const ref = useRef<HTMLElement | null>(null)
  // Geri çağırmalı ref: hangi öğeye (section, div …) yayılırsa yayılsın tür uyar
  const setRef = useCallback((el: HTMLElement | null) => {
    ref.current = el
  }, [])
  const opts = useRef({ onPrev, onNext, canPrev, canNext })
  useEffect(() => {
    opts.current = { onPrev, onNext, canPrev, canNext }
  })
  const drag = useRef<{ x: number; y: number; t: number; dx: number; horizontal: boolean | null } | null>(null)
  const busy = useRef(false)

  const set = (dx: number) => {
    const el = ref.current
    if (!el) return
    const w = el.offsetWidth || 1
    el.style.transform = dx ? `translateX(${dx}px)` : ''
    el.style.opacity = dx ? String(1 - Math.min(0.35, (Math.abs(dx) / w) * 0.5)) : ''
  }

  async function go(dir: 1 | -1, from: number) {
    const el = ref.current
    const handler = dir === 1 ? opts.current.onNext : opts.current.onPrev
    if (!el || !handler) return
    if (reduced()) {
      set(0)
      handler()
      return
    }
    busy.current = true
    const w = el.offsetWidth || 1
    await el.animate([{ transform: `translateX(${from}px)`, opacity: el.style.opacity || '1' }, { transform: `translateX(${-dir * w * 0.35}px)`, opacity: 0 }], {
      duration: 130,
      easing: 'ease-in',
    }).finished
    el.style.transform = ''
    el.style.opacity = '0'
    handler()
    await nextFrame()
    el.style.opacity = ''
    await el.animate([{ transform: `translateX(${dir * w * 0.35}px)`, opacity: 0 }, { transform: 'translateX(0)', opacity: 1 }], {
      duration: 200,
      easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
    }).finished
    busy.current = false
  }

  function back(from: number) {
    const el = ref.current
    if (!el) return
    set(0)
    if (!reduced()) el.animate([{ transform: `translateX(${from}px)` }, { transform: 'translateX(0)' }], { duration: 180, easing: 'ease-out' })
  }

  return {
    ref: setRef,
    style: { touchAction: 'pan-y pinch-zoom' } as CSSProperties,
    onTouchStart(e: TouchEvent) {
      if (!enabled || busy.current || e.touches.length !== 1 || blocked(e.target, ref.current) || window.getSelection()?.toString()) {
        drag.current = null
        return
      }
      const t = e.touches[0]
      drag.current = { x: t.clientX, y: t.clientY, t: Date.now(), dx: 0, horizontal: null }
    },
    onTouchMove(e: TouchEvent) {
      const d = drag.current
      if (!d || e.touches.length !== 1) return
      const t = e.touches[0]
      const dx = t.clientX - d.x
      const dy = t.clientY - d.y
      if (d.horizontal === null && Math.hypot(dx, dy) > 10) d.horizontal = Math.abs(dx) > Math.abs(dy) * 1.3
      if (!d.horizontal) return
      // Geçilemeyen yöne yay gibi direnç
      const allowed = dx < 0 ? opts.current.canNext && opts.current.onNext : opts.current.canPrev && opts.current.onPrev
      d.dx = allowed ? dx * 0.6 : dx * 0.15
      set(d.dx)
    },
    onTouchEnd() {
      const d = drag.current
      drag.current = null
      if (!d?.horizontal) return
      const el = ref.current
      const w = el?.offsetWidth || 1
      const raw = d.dx / 0.6
      const fast = Math.abs(raw) / Math.max(1, Date.now() - d.t) > 0.45 && Math.abs(raw) > 30
      const dir: 1 | -1 = raw < 0 ? 1 : -1
      const allowed = dir === 1 ? opts.current.canNext && opts.current.onNext : opts.current.canPrev && opts.current.onPrev
      if (allowed && (Math.abs(raw) > Math.max(50, w * 0.18) || fast)) void go(dir, d.dx)
      else back(d.dx)
    },
    onTouchCancel() {
      const d = drag.current
      drag.current = null
      if (d?.horizontal) back(d.dx)
    },
  }
}
