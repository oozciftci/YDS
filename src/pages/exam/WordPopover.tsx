import { useCallback, useEffect, useMemo, useState, type MouseEvent, type ReactNode } from 'react'
import { cleanToken, lookupWordInSentence, type WordLookupResult } from '../../services/dictionary'
import { EXAM_COLLECTED_TAG } from '../../services/groups'
import { speakWord } from '../../services/tts'
import { createWord, updateWord } from '../../services/words'
import { useUserStore } from '../../stores/user'
import styles from '../ExamStudy.module.css'
import type { Seg } from './examData'

// Çıkmış soru metinlerinde ortak parçalar: tıklanabilir cümle ve kelime anlam balonu.

const WORD_RE = /([A-Za-zÇĞİÖŞÜçğıöşü0-9]+(?:['’][A-Za-z]+)?|[^\sA-Za-zÇĞİÖŞÜçğıöşü0-9]+|\s+)/g

export type OnWord = (word: string, e: MouseEvent<HTMLButtonElement>) => void

/** Bir cümleyi tıklanabilir kelimelere böler; başındaki rozet cümle çevirisini açar/kapatır. */
export function SentenceView({
  seg,
  tr,
  forceShow,
  onWord,
  assist,
  active = false,
}: {
  seg: Seg
  tr?: string
  forceShow: boolean
  onWord: OnWord
  assist: boolean
  /** Seslendirme sırasında o an okunan cümle. */
  active?: boolean
}) {
  const [open, setOpen] = useState(false)
  const show = assist && (open || forceShow)
  const tokens = useMemo(() => seg.en.match(WORD_RE) || [seg.en], [seg.en])
  const cls = `${styles.sentence} ${active ? styles.sentenceActive : ''}`
  // Çeviri sorularında Türkçe cümleler olur; yardım kapalıyken (deneme) düz metin gösterilir
  if (!assist || (seg.en.match(/[çğıöşüÇĞİÖŞÜ]/g) || []).length >= 2) {
    return <span className={cls}>{seg.en} </span>
  }
  return (
    <span className={cls}>
      <button
        type="button"
        className={`${styles.badge} ${show ? styles.badgeOn : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={show}
        title="Cümlenin Türkçesini göster/gizle"
      >
        🌐
      </button>
      {tokens.map((t, i) =>
        /^[A-Za-zÇĞİÖŞÜçğıöşü0-9]/.test(t) ? (
          <button key={i} type="button" className={styles.word} onClick={(e) => onWord(t, e)}>
            {t}
          </button>
        ) : (
          <span key={i}>{t}</span>
        ),
      )}
      {show && <span className={styles.trLine}>{tr || <em className={styles.noTr}>Çeviri henüz eklenmedi</em>}</span>}
    </span>
  )
}

interface PopoverState {
  word: string
  top: number
  left: number
}

/**
 * Kelime anlam balonu. `note` eklenen kelimenin notuna yazılır (örn. "yds-2024-ilkbahar / Soru 12").
 * `lookedUp`: bu ekranda anlamına bakılan kelimeler (okuma özetinde gösterilir).
 */
export function useWordPopover(note: string): { onWord: OnWord; close: () => void; popover: ReactNode; lookedUp: string[] } {
  const activeUserId = useUserStore((s) => s.activeUserId)
  const [pop, setPop] = useState<PopoverState | null>(null)
  const [lookup, setLookup] = useState<WordLookupResult | null>(null)
  const [lookingUp, setLookingUp] = useState(false)
  const [added, setAdded] = useState(false)
  const [lookedUp, setLookedUp] = useState<string[]>([])

  const close = useCallback(() => setPop(null), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPop(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const onWord: OnWord = useCallback(
    async (word, e) => {
      e.stopPropagation()
      const rect = e.currentTarget.getBoundingClientRect()
      const width = Math.min(300, window.innerWidth - 16)
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))
      const term = cleanToken(word) || word
      setPop({ word, top: rect.bottom + 6, left })
      setLookup(null)
      setAdded(false)
      setLookingUp(true)
      setLookedUp((l) => (l.includes(term.toLowerCase()) ? l : [...l, term.toLowerCase()]))
      try {
        setLookup(await lookupWordInSentence(term, undefined, activeUserId))
      } finally {
        setLookingUp(false)
      }
    },
    [activeUserId],
  )

  async function addToDeck() {
    if (!lookup) return
    await createWord(activeUserId, {
      term: lookup.term,
      definition: lookup.meaning,
      partOfSpeech: 'noun',
      tags: [EXAM_COLLECTED_TAG],
      notes: note,
    })
    setAdded(true)
  }

  /** Havuzda zaten olan kelimeyi "Sınavdan Topladıklarım" destesine alır (etiket ekler). */
  async function collectExisting() {
    const w = lookup?.existingWord
    if (!w) return
    await updateWord(w.id, activeUserId, { tags: [...(w.tags || []), EXAM_COLLECTED_TAG] })
    setAdded(true)
  }

  const popover = pop && (
    <>
      <div className={styles.popBackdrop} onClick={() => setPop(null)} aria-hidden="true" />
      <div className={styles.pop} style={{ top: pop.top, left: pop.left }} role="dialog">
        <div className={styles.popHead}>
          <strong>{lookup?.term || cleanToken(pop.word)}</strong>
          <button type="button" className={styles.popIcon} onClick={() => speakWord(lookup?.term || pop.word)} aria-label="Dinle">
            🔊
          </button>
          <button type="button" className={styles.popIcon} onClick={() => setPop(null)} aria-label="Kapat">
            ×
          </button>
        </div>
        <p className={styles.popMeaning}>{lookingUp ? 'Anlam aranıyor…' : lookup?.meaning || 'Anlam bulunamadı.'}</p>
        {lookup?.existingWord &&
          (added || (lookup.existingWord.tags || []).includes(EXAM_COLLECTED_TAG) ? (
            <p className="muted" style={{ margin: 0, fontSize: '0.78rem' }}>
              ✓ Havuzunda ve "Sınavdan Topladıklarım" destesinde
            </p>
          ) : (
            <button type="button" className="btn btn-secondary" onClick={() => void collectExisting()}>
              📥 Topladıklarıma ekle
            </button>
          ))}
        {lookup?.isNewWord && lookup.meaning && (
          <button type="button" className="btn btn-secondary" disabled={added} onClick={() => void addToDeck()}>
            {added ? '✓ Eklendi' : '➕ Havuzuma ekle'}
          </button>
        )}
        {(lookup?.isNewWord || lookup?.existingWord) && (
          <p className="muted" style={{ margin: 0, fontSize: '0.74rem' }}>
            Toplanan kelimeler Çalış ekranında "📥 Sınavdan Topladıklarım" destesinde çıkar.
          </p>
        )}
      </div>
    </>
  )

  return { onWord, close, popover, lookedUp }
}
