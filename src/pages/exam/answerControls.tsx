import { useEffect, useRef, useState } from 'react'
import { useSwipeNav } from '../../hooks/useSwipeNav'
import styles from '../ExamStudy.module.css'

// Soru ekranlarında ortak kontroller: hızlı cevap modu ve önceki/sonraki gezinme (klavye okları, kaydırma).

const QUICK_KEY = 'yds-quick-answer'

/** Hızlı cevap modu: şıkka dokunmak doğrudan cevabı kontrol eder. Tercih bu cihazda hatırlanır. */
export function useQuickAnswer(): [boolean, (v: boolean) => void] {
  const [on, setOn] = useState(() => {
    try {
      return localStorage.getItem(QUICK_KEY) === '1'
    } catch {
      return false
    }
  })
  function set(v: boolean) {
    setOn(v)
    try {
      localStorage.setItem(QUICK_KEY, v ? '1' : '0')
    } catch {
      // yoksay
    }
  }
  return [on, set]
}

export function QuickAnswerToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={styles.quickToggle} title="Şıkka dokunduğun anda cevap kontrol edilir" data-focus-hide>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
      Hızlı cevap modu
      <small>şıkka dokununca cevap hemen kontrol edilir · ← → tuşları ya da kaydırma ile soru değiştir</small>
    </label>
  )
}

/** Yazı yazılan ya da seçim yapılan bir alanda mıyız (o zaman gezinme tetiklenmez)? */
function isEditable(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || Boolean(el.closest('[data-noswipe]'))
}

/**
 * ← / → tuşları ve yatay kaydırma ile önceki / sonraki soru (kaydırma: src/hooks/useSwipeNav.ts — içerik parmağı izler).
 * Sola kaydırma (parmak sağdan sola) sonraki soruya, sağa kaydırma önceki soruya geçer.
 * Dönen `props` kaydırmanın algılanacağı kapsayıcıya yayılır (<section {...swipe.props}>); `turn(±1)` düğmeler için.
 * `edges`: ilk/son sorudaysa o yöne çekince yaylanıp geri döner.
 */
export function useQuestionNav(onPrev?: () => void, onNext?: () => void, edges?: { canPrev?: boolean; canNext?: boolean }) {
  const swipe = useSwipeNav({ onPrev, onNext, canPrev: edges?.canPrev, canNext: edges?.canNext })
  const handlers = useRef({ onPrev, onNext })
  const turnRef = useRef(swipe.turn)
  useEffect(() => {
    handlers.current = { onPrev, onNext }
    turnRef.current = swipe.turn
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || isEditable(e.target)) return
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return
      if (e.key === 'ArrowLeft' && handlers.current.onPrev) {
        e.preventDefault()
        void turnRef.current(-1)
      } else if (e.key === 'ArrowRight' && handlers.current.onNext) {
        e.preventDefault()
        void turnRef.current(1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return swipe
}
