import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { cleanToken, findDeckWord, lookupWordInSentence, type WordLookupResult } from '../../services/dictionary'
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
 * `glossFor`: metnin kendi kelime anlamları (Okuma Kütüphanesi) — varsa genel sözlük yerine bağlama uygun anlam anında gösterilir.
 */
export function useWordPopover(
  note: string,
  glossFor?: (word: string) => string | undefined,
): { onWord: OnWord; close: () => void; popover: ReactNode; lookedUp: string[] } {
  const activeUserId = useUserStore((s) => s.activeUserId)
  const [pop, setPop] = useState<PopoverState | null>(null)
  const [lookup, setLookup] = useState<WordLookupResult | null>(null)
  const [lookingUp, setLookingUp] = useState(false)
  const [added, setAdded] = useState(false)
  const [lookedUp, setLookedUp] = useState<string[]>([])
  const glossRef = useRef(glossFor)
  useEffect(() => {
    glossRef.current = glossFor
  })

  const close = useCallback(() => setPop(null), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPop(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Balonun dışına dokununca kapanır; ama dokunuş yutulmaz: başka bir kelimeye ya da çeviri düğmesine
  // dokunmak tek seferde o işi yapar (önceden görünmez bir katman ilk dokunuşu alıp yalnızca kapatıyordu)
  const popRef = useRef<HTMLDivElement>(null)
  const isOpen = pop !== null
  useEffect(() => {
    if (!isOpen) return
    const onDown = (e: PointerEvent) => {
      if (!popRef.current?.contains(e.target as Node)) setPop(null)
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [isOpen])

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
        const gloss = glossRef.current?.(term)
        if (gloss) {
          // Metnin kendi anlamı: ağa gitmeden; havuzda varsa "Topladıklarıma ekle" doğru çalışsın diye yalnızca havuza bakılır
          const deck = await findDeckWord(term, activeUserId)
          setLookup(
            deck
              ? { term: deck.word.term, meaning: gloss, source: 'sentence_gloss', existingWord: deck.word, cardState: deck.cardState, isNewWord: false }
              : { term, meaning: gloss, source: 'sentence_gloss', isNewWord: true },
          )
        } else {
          setLookup(await lookupWordInSentence(term, undefined, activeUserId))
        }
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
      <div ref={popRef} className={styles.pop} style={{ top: pop.top, left: pop.left }} role="dialog">
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
        {lookup?.source === 'sentence_gloss' && lookup.existingWord && lookup.existingWord.definition !== lookup.meaning && (
          <p className="muted" style={{ margin: 0, fontSize: '0.78rem' }}>
            Havuzundaki anlamı: {lookup.existingWord.definition}
          </p>
        )}
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
