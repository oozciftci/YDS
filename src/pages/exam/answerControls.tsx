import { useEffect, useRef, useState, type TouchEvent } from 'react'
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
    <label className={styles.quickToggle} title="Şıkka dokunduğun anda cevap kontrol edilir">
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
 * ← / → tuşları ve yatay kaydırma ile önceki / sonraki soru.
 * Sola kaydırma (parmak sağdan sola) sonraki soruya, sağa kaydırma önceki soruya geçer.
 * Dönen nesne, kaydırmanın algılanacağı kapsayıcıya yayılır: <section {...swipe}>.
 */
export function useQuestionNav(onPrev?: () => void, onNext?: () => void) {
  const handlers = useRef({ onPrev, onNext })
  useEffect(() => {
    handlers.current = { onPrev, onNext }
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || isEditable(e.target)) return
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return
      if (e.key === 'ArrowLeft' && handlers.current.onPrev) {
        e.preventDefault()
        handlers.current.onPrev()
      } else if (e.key === 'ArrowRight' && handlers.current.onNext) {
        e.preventDefault()
        handlers.current.onNext()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const start = useRef<{ x: number; y: number; t: number } | null>(null)
  return {
    onTouchStart(e: TouchEvent) {
      const t = e.touches[0]
      start.current = e.touches.length === 1 && !isEditable(e.target) ? { x: t.clientX, y: t.clientY, t: Date.now() } : null
    },
    onTouchEnd(e: TouchEvent) {
      const s = start.current
      start.current = null
      if (!s) return
      const t = e.changedTouches[0]
      const dx = t.clientX - s.x
      const dy = t.clientY - s.y
      // Kısa, belirgin ve yatay bir hareket olmalı; dikey kaydırma ve metin seçimi soru değiştirmez
      if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 2 || Date.now() - s.t > 800) return
      if (window.getSelection()?.toString()) return
      if (dx < 0) handlers.current.onNext?.()
      else handlers.current.onPrev?.()
    },
  }
}
