import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import styles from './CardActions.module.css'

// Kart çalışırken düğmeler hep aynı yerde dursun: ekranın altına (telefonda alt menünün hemen üstüne) sabitlenen çubuk.
// Soru ya da cevap ne kadar uzun olursa olsun düğmelerin yeri değişmez. Çubuğun yüksekliği --card-actions-h olarak
// body'ye yazılır; sağ alttaki not düğmeleri (NotesDock) bu kadar yukarı kayar, sayfa da altta o kadar boşluk bırakır.

export function CardActions({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const set = () => document.body.style.setProperty('--card-actions-h', `${el.offsetHeight}px`)
    set()
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(set)
    ro?.observe(el)
    return () => {
      ro?.disconnect()
      document.body.style.removeProperty('--card-actions-h')
    }
  }, [])

  return (
    <>
      {/* Sabit çubuğun kapattığı yer kadar boşluk: kartın sonu çubuğun altında kalmasın */}
      <div className={styles.spacer} aria-hidden="true" />
      {/* body'ye taşınır: sayfa kapsayıcılarındaki transform/animasyon "fixed"i bozmasın */}
      {createPortal(
        <div className={styles.wrap}>
          <div className={styles.bar} ref={ref}>
            {children}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}

export type CardFx = 'ok' | 'no' | 'skip'

const FX_MS = 280

/**
 * Kart geçiş animasyonu: bildim → yeşil, bilemedim → kırmızımsı zeminle solup gider; sonra `after` çalışır.
 * `fxClass` kartın kapsayıcısına verilir; `busy` iken düğmeler kapatılır (çift dokunma iki kart atlamasın).
 */
export function useCardFx() {
  const [fx, setFx] = useState<CardFx | null>(null)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  function run(kind: CardFx, after: () => void) {
    if (fx) return
    const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      after()
      return
    }
    setFx(kind)
    timer.current = window.setTimeout(() => {
      after()
      setFx(null)
    }, FX_MS)
  }

  const fxClass = fx === 'ok' ? styles.fxOk : fx === 'no' ? styles.fxNo : fx === 'skip' ? styles.fxSkip : styles.fxIn
  return { run, busy: fx !== null, fxClass }
}

export { styles as cardActionStyles }
