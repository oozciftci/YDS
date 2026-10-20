import { useEffect, useRef, useState } from 'react'
import { speakWord } from '../services/tts'
import { checkWritten, type StudyQuestion } from '../services/studySession'
import type { MasteryLevel } from '../types/database'
import styles from '../pages/Study.module.css'

/**
 * Yazarak cevap: Türkçe anlam gösterilir, İngilizcesi yazılır (üretici hatırlama; seçmeli testten daha kalıcı).
 * Puan: ipucusuz doğru 4 · ipuçlu ya da tek harf hatalı 3 · yanlış/bilmiyorum 1. Enter: kontrol et, sonra devam.
 */
export function WriteAnswer({ q, onDone }: { q: StudyQuestion; onDone: (score: MasteryLevel) => void }) {
  const [value, setValue] = useState('')
  const [hints, setHints] = useState(0)
  const [result, setResult] = useState<'correct' | 'almost' | 'wrong' | null>(null)
  const term = q.word.term

  const score: MasteryLevel = result === 'correct' ? (hints ? 3 : 4) : result === 'almost' ? 3 : 1

  const doneRef = useRef(onDone)
  useEffect(() => {
    doneRef.current = onDone
  })

  // Doğruysa 1 sn sonra kendiliğinden sonraki kelime; değilse Enter (her yerden) ile devam
  useEffect(() => {
    if (result === null) return
    if (result === 'correct') {
      const t = setTimeout(() => doneRef.current(score), 1000)
      return () => clearTimeout(t)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        doneRef.current(score)
      }
    }
    // Kontrol eden Enter'ın kendisi yakalanmasın diye bir sonraki turda dinlemeye başla
    const t = setTimeout(() => window.addEventListener('keydown', onKey), 0)
    return () => {
      clearTimeout(t)
      window.removeEventListener('keydown', onKey)
    }
  }, [result, score])

  function check(giveUp = false) {
    const r = giveUp ? 'wrong' : checkWritten(value, term)
    setResult(r)
    speakWord(term)
  }

  // İpucu: baştan bir harf daha (boşluklar hariç)
  const hintText = term
    .split('')
    .map((ch, i) => (ch === ' ' || i < hints ? ch : '·'))
    .join('')

  return (
    <div className={styles.writeBox}>
      <h2 className={styles.promptMainWord} style={{ fontSize: '1.7rem', margin: 0 }}>
        {q.prompt}
      </h2>
      <p className={styles.writeHint}>
        İngilizcesini yaz · <span className="muted">{q.subPrompt}</span> · {term.replace(/ /g, '').length} harf
      </p>
      {hints > 0 && result === null && <p className={styles.writeReveal}>{hintText}</p>}

      <div className={styles.writeField}>
      <input
        className={`input ${styles.writeInput} ${result === 'correct' ? styles.writeOk : result ? styles.writeBad : ''}`}
        value={value}
        autoFocus
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        disabled={result !== null}
        placeholder="kelimeyi yaz…"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && value.trim()) check()
        }}
        aria-label="İngilizce karşılığı"
      />
        {result === 'correct' && <span className={styles.writeTick} aria-label="Doğru">✓</span>}
      </div>

      {result === null ? (
        <div className={styles.writeActions}>
          <button type="button" className="btn btn-primary" disabled={!value.trim()} onClick={() => check()}>
            Kontrol et (Enter)
          </button>
          <button type="button" className="btn btn-ghost" disabled={hints >= term.length - 1} onClick={() => setHints((h) => h + 1)}>
            💡 Harf ver
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => check(true)}>
            Bilmiyorum
          </button>
        </div>
      ) : result === 'correct' ? null : (
        <div className={styles.writeResult}>
          <strong>
            {result === 'almost' ? '≈ Neredeyse — küçük bir yazım hatası' : '✗ Doğrusu'}:{' '}
            <span className={styles.writeTerm}>{term}</span>
          </strong>
          <button type="button" className="btn btn-primary" onClick={() => onDone(score)}>
            Devam (Enter) · puan {score}
          </button>
        </div>
      )}
    </div>
  )
}
