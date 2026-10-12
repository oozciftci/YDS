import { useState, useRef, useEffect, useMemo, type MouseEvent } from 'react'
import type { SampleSentence } from '../types/database'
import { MASTERY_CONFIG, type MasteryLevel } from '../types/database'
import { speakWord } from '../services/tts'
import {
  cleanToken,
  lookupWordInSentence,
  type WordLookupResult,
} from '../services/dictionary'
import styles from './InteractiveSentence.module.css'

export interface InteractiveSentenceProps {
  sentence: SampleSentence
  activeUserId?: string
  showTranslationByDefault?: boolean
  highlightTerm?: string
  onAddWordToDeck?: (term: string, meaning: string) => void
}

interface ParsedToken {
  text: string
  isWord: boolean
  clean: string
}

export function InteractiveSentence({
  sentence,
  activeUserId,
  showTranslationByDefault = false,
  highlightTerm,
  onAddWordToDeck,
}: InteractiveSentenceProps) {
  const [selectedWord, setSelectedWord] = useState<string | null>(null)
  const [lookupResult, setLookupResult] = useState<WordLookupResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null)
  const [showFullTrans, setShowFullTrans] = useState(showTranslationByDefault)

  const containerRef = useRef<HTMLDivElement>(null)

  // Cümleyi kelime ve noktalama/boşluk token'larına ayırır
  const sentenceEn = sentence?.en || ''
  const tokens = useMemo<ParsedToken[]>(() => {
    if (!sentenceEn) return []
    // Kelimeleri (içinde apostrof veya tire barındıranlar dahil) ve aradaki karakterleri eşle
    const regex = /([a-zA-Z0-9çğıöşüÇĞİÖŞÜ]+(?:['’][a-zA-Z0-9çğıöşüÇĞİÖŞÜ]+)?|[^\s\w]+|\s+)/g
    const matches = sentenceEn.match(regex) || [sentenceEn]

    return matches.map((token) => {
      const clean = cleanToken(token)
      const isWord = clean.length > 0 && /^[a-zA-Z0-9çğıöşüÇĞİÖŞÜ]/.test(clean)
      return { text: token, isWord, clean }
    })
  }, [sentenceEn])

  // Dışarı tıklandığında veya ESC basıldığında balonu kapat
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setSelectedWord(null)
        setLookupResult(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Kelimeye tıklandığında popup konumu hesapla ve anlamını getir
  async function handleWordClick(token: ParsedToken, e: MouseEvent<HTMLButtonElement>) {
    e.stopPropagation()
    const rawWord = token.text
    setSelectedWord(rawWord)
    setLoading(true)

    // Tıklanan butonun koordinatlarına göre popup konumunu ayarla
    const rect = e.currentTarget.getBoundingClientRect()
    const containerRect = containerRef.current?.getBoundingClientRect() || { top: 0, left: 0 }

    const top = rect.bottom - containerRect.top + 6
    let left = rect.left - containerRect.left - 40

    // Ekran dışına taşmaması için sınırla
    if (left < 8) left = 8
    const maxLeft = (containerRef.current?.offsetWidth || 340) - 290
    if (left > maxLeft) left = Math.max(8, maxLeft)

    setPopoverPos({ top, left })

    try {
      const result = await lookupWordInSentence(token.clean || rawWord, sentence, activeUserId)
      setLookupResult(result)
    } finally {
      setLoading(false)
    }
  }

  function handleClosePopover() {
    setSelectedWord(null)
    setLookupResult(null)
    setPopoverPos(null)
  }

  const cleanHighlight = highlightTerm ? cleanToken(highlightTerm).toLowerCase() : ''

  return (
    <div className={styles.container} ref={containerRef}>
      {/* CÜMLE VE TIKLANABİLİR KELİMELER */}
      <div className={styles.sentenceBox}>
        <span className={styles.quoteMark}>“</span>
        {tokens.map((token, idx) => {
          if (!token.isWord) {
            return (
              <span key={idx} className={styles.nonWordToken}>
                {token.text}
              </span>
            )
          }

          const isSelected = selectedWord === token.text
          const isMainTerm = cleanHighlight && token.clean.toLowerCase() === cleanHighlight

          return (
            <button
              key={idx}
              type="button"
              className={`${styles.wordToken} ${isSelected ? styles.wordSelected : ''} ${
                isMainTerm ? styles.wordHighlight : ''
              }`}
              onClick={(e) => handleWordClick(token, e)}
              title={`Tıkla: "${token.clean}" kelimesinin Türkçe anlamı`}
              aria-label={`${token.clean} kelimesinin anlamını gör`}
            >
              {token.text}
            </button>
          )
        })}
        <span className={styles.quoteMark}>”</span>
      </div>

      {/* TÜRKÇE CÜMLE ÇEVİRİSİ ALANI */}
      {sentence.tr && (
        <div className={styles.translationRow}>
          <button
            type="button"
            className={styles.toggleTransBtn}
            onClick={() => setShowFullTrans((prev) => !prev)}
            aria-expanded={showFullTrans}
          >
            <span>{showFullTrans ? '🙈 Çeviriyi Gizle' : '👁️ Türkçe Çeviri'}</span>
          </button>
          {showFullTrans && <div className={styles.fullTranslation}>{sentence.tr}</div>}
        </div>
      )}

      {/* ========================================================
          KELİME DETAY POPUP (AÇILIR BALON)
          ======================================================== */}
      {selectedWord && popoverPos && (
        <>
          <div
            className={styles.popoverBackdrop}
            onClick={handleClosePopover}
            aria-hidden="true"
          />

          <div
            className={styles.popover}
            style={{ top: `${popoverPos.top}px`, left: `${popoverPos.left}px` }}
            role="dialog"
            aria-modal="false"
            aria-label={`${selectedWord} kelime kartı`}
          >
            {/* Popover Üst Başlık */}
            <div className={styles.popoverHead}>
              <div className={styles.popoverTermWrap}>
                <h4 className={styles.popoverTerm}>
                  {lookupResult?.term || cleanToken(selectedWord)}
                </h4>
                <button
                  type="button"
                  className={styles.audioBtn}
                  onClick={() => speakWord(lookupResult?.term || selectedWord)}
                  title="Dinle"
                  aria-label="Telaffuz dinle"
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              <button
                type="button"
                className={styles.closeBtn}
                onClick={handleClosePopover}
                aria-label="Kapat"
              >
                &times;
              </button>
            </div>

            {/* Anlam Alanı */}
            <div className={styles.meaningBox}>
              <span className={styles.meaningTitle}>Türkçe Anlamı</span>
              {loading ? (
                <span className={styles.meaningLoading}>Anlam aranıyor…</span>
              ) : lookupResult?.meaning ? (
                <p className={styles.meaningText}>{lookupResult.meaning}</p>
              ) : (
                <p className={styles.meaningLoading}>
                  Anlam bulunamadı.{' '}
                  {sentence.tr && <span style={{ display: 'block', fontSize: '0.78rem' }}>Cümle çevirisine bakınız.</span>}
                </p>
              )}
            </div>

            {/* Bilgi Kaynağı Rozeti */}
            {!loading && lookupResult && (
              <span className={styles.sourceBadge}>
                {lookupResult.source === 'sentence_gloss' && '✨ Cümle Sözlüğü'}
                {lookupResult.source === 'deck' && '📚 YDS Kelime Havuzunuz'}
                {lookupResult.source === 'offline_dict' && '📖 Temel Sözlük'}
                {lookupResult.source === 'cached' && '💾 Önbellek'}
                {lookupResult.source === 'online_api' && '🌐 Çeviri'}
                {lookupResult.source === 'not_found' && '❓'}
              </span>
            )}

            {/* Eğer kullanıcının havuzunda varsa: Puan ve eş anlamlılar */}
            {lookupResult?.existingWord && (
              <div className={styles.deckInfo}>
                <div className={styles.deckScoreRow}>
                  <span>Havuzunuzda Mevcut</span>
                  {lookupResult.cardState && (
                    <span style={{ fontWeight: 700 }}>
                      {MASTERY_CONFIG[(lookupResult.cardState.masteryScore as MasteryLevel) || 1].badge}
                    </span>
                  )}
                </div>
                {lookupResult.existingWord.synonyms && lookupResult.existingWord.synonyms.length > 0 && (
                  <div className={styles.synonymsText}>
                    <strong>Eş: </strong> {lookupResult.existingWord.synonyms.slice(0, 3).join(', ')}
                  </div>
                )}
              </div>
            )}

            {/* Yeni Kelime İse: "Kelime Havuzuma Ekle" Aksiyonu */}
            {lookupResult && lookupResult.isNewWord && lookupResult.meaning && onAddWordToDeck && (
              <div className={styles.actionRow}>
                <button
                  type="button"
                  className={styles.addBtn}
                  onClick={() => {
                    onAddWordToDeck(lookupResult.term, lookupResult.meaning)
                    handleClosePopover()
                  }}
                >
                  ➕ Havuzuma Ekle
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
