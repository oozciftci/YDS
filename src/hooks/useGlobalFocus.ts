import { useEffect, useState } from 'react'

/** Genel odak modu açık mı (Layout, <html class="app-focus">)? Sayfalar kendi tam ekran görünümlerini buna bağlar. */
export function useGlobalFocus(): boolean {
  const read = () => document.documentElement.classList.contains('app-focus')
  const [on, setOn] = useState(read)
  useEffect(() => {
    const obs = new MutationObserver(() => setOn(read()))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])
  return on
}
