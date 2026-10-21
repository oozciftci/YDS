import { useEffect, useState } from 'react'
import { getSourceMode, setSourceMode, tacticsAvailable, type SourceMode } from '../services/tactics'
import styles from './SourceModeToggle.module.css'
import { hasLocalContent } from '../services/localContent'

// Yapay zekâ yanıtının kaynağı: "Koç" (Taktik Kitabı'na dayalı) ya da "Saf Gemini". Taktik Kitabı yalnızca
// yerelde olduğundan seçim de yalnızca yerelde görünür; kitap boşken Koç seçilemez.

/** Seçili mod ve Koç modunun kullanılabilirliği (seçim cihazda hatırlanır). */
export function useSourceMode(): { mode: SourceMode; available: boolean; effective: SourceMode; setMode: (m: SourceMode) => void } {
  const [mode, setModeState] = useState<SourceMode>(getSourceMode)
  const [available, setAvailable] = useState(false)
  useEffect(() => {
    let alive = true
    void tacticsAvailable().then((a) => alive && setAvailable(a))
    return () => {
      alive = false
    }
  }, [])
  function setMode(m: SourceMode) {
    setModeState(m)
    setSourceMode(m)
  }
  return { mode, available, effective: mode === 'koc' && available ? 'koc' : 'saf', setMode }
}

export const SOURCE_MODE_LABEL: Record<SourceMode, string> = {
  koc: '📒 Koç (kaynaklı)',
  saf: '✨ Saf Gemini',
}

export function SourceModeToggle({
  mode,
  available,
  onChange,
}: {
  mode: SourceMode
  available: boolean
  onChange: (m: SourceMode) => void
}) {
  if (!hasLocalContent()) return null
  return (
    <div className={styles.wrap} role="radiogroup" aria-label="Yanıt kaynağı">
      {(['koc', 'saf'] as SourceMode[]).map((m) => {
        const disabled = m === 'koc' && !available
        return (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m && !disabled}
            className={`${styles.opt} ${mode === m && !disabled ? styles.on : ''} ${!available && m === 'saf' ? styles.on : ''}`}
            disabled={disabled}
            title={
              m === 'koc'
                ? available
                  ? 'Hocaların taktiklerine dayalı, kaynak sayfası belirten yanıt'
                  : 'Henüz kaynak yok: Taktik Kitabı boş'
                : 'Kaynak göndermeden, Gemini’nin kendi bilgisiyle'
            }
            onClick={() => onChange(m)}
          >
            {SOURCE_MODE_LABEL[m]}
          </button>
        )
      })}
      {!available && <small className={styles.hint}>henüz kaynak yok</small>}
    </div>
  )
}
