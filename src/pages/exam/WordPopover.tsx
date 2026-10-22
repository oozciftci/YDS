import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { cleanToken, findDeckWord, lookupWordInSentence, type WordLookupResult } from '../../services/dictionary'
import { EXAM_COLLECTED_TAG, READING_COLLECTED_TAG } from '../../services/groups'
import { speakWord } from '../../services/tts'
import { createWord, updateWord } from '../../services/words'
import { useUserStore } from '../../stores/user'
import styles from '../ExamStudy.module.css'
import type { Seg } from './examData'
import { statusOf, useWordStatus, type StatusIndex, type WordStatus } from '../../services/wordStatus'
import type { WordMark } from '../../types/database'

// Çıkmış soru metinlerinde ortak parçalar: tıklanabilir cümle ve kelime anlam balonu.

const WORD_RE = /([A-Za-zÇĞİÖŞÜçğıöşü0-9]+(?:['’][A-Za-z]+)?|[^\sA-Za-zÇĞİÖŞÜçğıöşü0-9]+|\s+)/g

/** `ctx`: kelimenin geçtiği cümle (okurken "Öğrenmeye al" kartın arkasına yazar) */
export type OnWord = (word: string, e: MouseEvent<HTMLButtonElement>, ctx?: { en: string; tr?: string }) => void

const HL_CLASS: Record<WordStatus, string> = {
  new: styles.wNew,
  learning: styles.wLearning,
  known: '',
  ignored: '',
}

/** Bir cümleyi tıklanabilir kelimelere böler; başındaki rozet cümle çevirisini açar/kapatır. */
export function SentenceView({
  seg,
  tr,
  forceShow,
  onWord,
  assist,
  active = false,
  ix,
  ixVersion,
}: {
  seg: Seg
  tr?: string
  forceShow: boolean
  onWord: OnWord
  assist: boolean
  /** Seslendirme sırasında o an okunan cümle. */
  active?: boolean
  /** Kelime vurgusu (okuyucularda): verilirse yeni/öğrenilen kelimeler renklenir */
  ix?: StatusIndex
  /** Dizin değişince yeniden çizilsin diye */
  ixVersion?: number
}) {
  const [open, setOpen] = useState(false)
  const show = assist && (open || forceShow)
  const tokens = useMemo(() => seg.en.match(WORD_RE) || [seg.en], [seg.en])
  const firstWord = useMemo(() => tokens.findIndex((t) => /^[A-Za-z]/.test(t)), [tokens])
  void ixVersion
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
          <button
            key={i}
            type="button"
            className={`${styles.word} ${ix ? HL_CLASS[statusOf(ix, t, i !== firstWord && /^[A-Z]/.test(t) && t !== 'I')] : ''}`}
            onClick={(e) => onWord(t, e, { en: seg.en, tr })}
          >
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
  /** Toplanan kelimenin etiketi/destesi: okuyucularda "Okumadan", soru ekranlarında "Sınavdan" */
  collect: 'reading' | 'exam' = 'exam',
): { onWord: OnWord; close: () => void; popover: ReactNode; lookedUp: string[] } {
  const activeUserId = useUserStore((s) => s.activeUserId)
  const { ix, userId: ixUser, load: loadStatus, mark, notePool } = useWordStatus()
  useWordStatus((st) => st.version) // durum değişince balon yenilensin
  useEffect(() => {
    if (activeUserId && ixUser !== activeUserId) void loadStatus(activeUserId)
  }, [activeUserId, ixUser, loadStatus])
  const [ctx, setCtx] = useState<{ en: string; tr?: string } | undefined>(undefined)
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
    async (word, e, sentence) => {
      e.stopPropagation()
      setCtx(sentence)
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

  const tag = collect === 'reading' ? READING_COLLECTED_TAG : EXAM_COLLECTED_TAG
  const deckName = collect === 'reading' ? '📖 Okumadan Topladıklarım' : '📥 Sınavdan Topladıklarım'
  const surface = pop ? cleanToken(pop.word).toLowerCase() : ''
  /** İşaret hem metindeki biçime hem sözlük köküne yazılır (countries → countries, country) */
  const markTerms = () => [surface, (lookup?.term || '').toLowerCase()].filter((t) => t && !/\s/.test(t))
  const status: WordStatus | null = pop ? statusOf(ix, pop.word) : null

  /** Kelimeyi havuza alır ya da havuzdakini desteye ekler; okurken geçtiği cümle (ve Türkçesi) kartın arkasına yazılır. */
  async function learn() {
    if (!lookup) return
    const sentence = ctx && ctx.en.length <= 400 ? [{ en: ctx.en, ...(ctx.tr ? { tr: ctx.tr } : {}) }] : []
    const w = lookup.existingWord
    if (w) {
      const has = (w.sentences || []).some((x) => (typeof x === 'string' ? x : x.en) === ctx?.en)
      await updateWord(w.id, activeUserId, {
        tags: [...new Set([...(w.tags || []), tag])],
        ...(sentence.length && !has ? { sentences: [...sentence, ...(w.sentences || [])] } : {}),
      })
    } else {
      await createWord(activeUserId, {
        term: lookup.term,
        definition: lookup.meaning,
        partOfSpeech: 'noun',
        tags: [tag],
        notes: note,
        sentences: sentence,
      })
    }
    notePool(lookup.term, 'learning')
    // Daha önce "biliyorum / yok say" dendiyse işaret kalkar
    const marked = markTerms().filter((t) => ix.marks.get(t) && ix.marks.get(t) !== 'new')
    if (marked.length) await mark(activeUserId, marked, 'new')
    setAdded(true)
  }

  async function setMark(st: WordMark) {
    await mark(activeUserId, markTerms(), st)
    if (st !== 'new') setPop(null)
  }

  const inDeck = !!lookup?.existingWord && (lookup.existingWord.tags || []).includes(tag)

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
        {status && (
          <p className={styles.popStatus}>
            {status === 'known' ? '✓ Bildiğin kelime' : status === 'learning' ? '📚 Öğreniyorsun' : status === 'ignored' ? '🚫 Yok sayılıyor' : '🆕 Yeni kelime'}
          </p>
        )}
        <div className={styles.popActions}>
          {added || inDeck ? (
            <span className="muted" style={{ fontSize: '0.8rem' }}>
              ✓ {deckName} destesinde
            </span>
          ) : (
            lookup &&
            (lookup.existingWord || lookup.meaning) && (
              <button type="button" className="btn btn-primary" onClick={() => void learn()}>
                📚 Öğrenmeye al
              </button>
            )
          )}
          {status !== 'known' && (
            <button type="button" className="btn btn-secondary" onClick={() => void setMark('known')}>
              ✓ Biliyorum
            </button>
          )}
          {status !== 'ignored' && (
            <button type="button" className="btn btn-secondary" onClick={() => void setMark('ignored')} title="Özel ad ya da gereksiz kelime: vurgulanmaz, orana girmez">
              🚫 Yok say
            </button>
          )}
          {(status === 'known' || status === 'ignored') && markTerms().some((t) => ix.marks.get(t) && ix.marks.get(t) !== 'new') && (
            <button type="button" className="btn btn-secondary" onClick={() => void setMark('new')}>
              ↺ Yeniye döndür
            </button>
          )}
        </div>
        {!added && !inDeck && (
          <p className="muted" style={{ margin: 0, fontSize: '0.74rem' }}>
            Öğrenmeye aldığın kelimeler Çalış ekranında “{deckName}” destesinde{collect === 'reading' ? ', geçtiği cümleyle' : ''} çıkar.
          </p>
        )}
      </div>
    </>
  )

  return { onWord, close, popover, lookedUp }
}
