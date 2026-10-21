import { useState, useMemo, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { ALL_WORD_PACKS } from '../data/wordPacks'
import { createWord, type CreateWordInput } from '../services/words'
import { useUserStore } from '../stores/user'
import styles from './ExamQuiz.module.css'
import { useSwipeNav } from '../hooks/useSwipeNav'

interface ExamQuestion {
  id: number
  targetWord: CreateWordInput
  sentenceWithBlank: string
  sentenceTranslation?: string
  options: string[] // 5 seçenek
  correctOptionIndex: number
}

const TOTAL_QUESTIONS = 10
const EXAM_DURATION_SECONDS = 10 * 60 // 10 dakika

export function ExamQuizPage() {
  const activeUser = useUserStore((s) => s.activeUser)
  const activeUserId = activeUser?.id || 'user_ozgur'

  // Kullanıcı kelimeleri
  const userWords = useLiveQuery(
    () => db.words.where('userId').equals(activeUserId).filter((w) => !w.isDeleted).toArray(),
    [activeUserId],
    [],
  )

  // Cümlesi olan tüm uygun kelimeler
  const eligibleWords = useMemo<CreateWordInput[]>(() => {
    const map = new Map<string, CreateWordInput>()

    // Kullanıcı kelimeleri
    for (const w of userWords) {
      if (w.sentences && w.sentences.length > 0 && w.sentences[0].en) {
        map.set(w.term.toLowerCase(), w)
      }
    }

    // Akademik paketler
    for (const pack of ALL_WORD_PACKS) {
      for (const w of pack.words) {
        if (w.sentences && w.sentences.length > 0 && w.sentences[0].en) {
          if (!map.has(w.term.toLowerCase())) {
            map.set(w.term.toLowerCase(), w)
          }
        }
      }
    }

    return Array.from(map.values())
  }, [userWords])

  // Sınav Durumları
  const [questions, setQuestions] = useState<ExamQuestion[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [userAnswers, setUserAnswers] = useState<Record<number, number>>({}) // questionId -> optionIndex
  const [timeLeft, setTimeLeft] = useState(EXAM_DURATION_SECONDS)
  const [isFinished, setIsFinished] = useState(false)
  const [addedWordTerms, setAddedWordTerms] = useState<string[]>([])

  // Sınavı Oluştur
  const generateExam = useCallback(() => {
    if (eligibleWords.length < 10) return

    // Kelimeleri karıştır ve 10 tanesini seç
    const shuffled = [...eligibleWords].sort(() => 0.5 - Math.random())
    const selectedTargets = shuffled.slice(0, TOTAL_QUESTIONS)
    const allTerms = eligibleWords.map((w) => w.term)

    const generated: ExamQuestion[] = selectedTargets.map((target, idx) => {
      const sentenceObj = target.sentences![0]
      const rawEn = sentenceObj.en

      // Cümledeki kelimeyi büyük/küçük harf duyarsız boşluğa çevir
      const escapedTerm = target.term.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
      const regex = new RegExp(`\\b${escapedTerm}\\b`, 'gi')
      const blankSentence = rawEn.replace(regex, '________')

      // 4 çeldirici bul
      const distractors = allTerms
        .filter((t) => t.toLowerCase() !== target.term.toLowerCase())
        .sort(() => 0.5 - Math.random())
        .slice(0, 4)

      // 5 seçeneği karıştır
      const rawOptions = [target.term, ...distractors]
      const shuffledOptions = [...rawOptions].sort(() => 0.5 - Math.random())
      const correctIdx = shuffledOptions.findIndex(
        (opt) => opt.toLowerCase() === target.term.toLowerCase(),
      )

      return {
        id: idx + 1,
        targetWord: target,
        sentenceWithBlank: blankSentence,
        sentenceTranslation: sentenceObj.tr,
        options: shuffledOptions,
        correctOptionIndex: correctIdx,
      }
    })

    setQuestions(generated)
    setCurrentIndex(0)
    setUserAnswers({})
    setTimeLeft(EXAM_DURATION_SECONDS)
    setIsFinished(false)
  }, [eligibleWords])

  useEffect(() => {
    if (eligibleWords.length >= 10 && questions.length === 0) {
      generateExam()
    }
  }, [eligibleWords, questions.length, generateExam])

  // Geri Sayım Sayacı
  useEffect(() => {
    if (isFinished || questions.length === 0) return

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          setIsFinished(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [isFinished, questions.length])

  // Şık Seçme
  function handleSelectOption(qId: number, optIdx: number) {
    if (isFinished) return
    setUserAnswers((prev) => ({ ...prev, [qId]: optIdx }))
  }

  // Yanlış kelimeyi tek tıkla desteye ekleme
  async function handleAddWordToDeck(word: CreateWordInput) {
    await createWord(activeUserId, word)
    setAddedWordTerms((prev) => [...prev, word.term])
  }

  // Sonuç Hesaplama
  const results = useMemo(() => {
    let correct = 0
    let wrong = 0
    let empty = 0

    for (const q of questions) {
      const ans = userAnswers[q.id]
      if (ans === undefined) {
        empty++
      } else if (ans === q.correctOptionIndex) {
        correct++
      } else {
        wrong++
      }
    }

    const score = Math.round((correct / TOTAL_QUESTIONS) * 100)
    return { correct, wrong, empty, score }
  }, [questions, userAnswers])

  const currentQ = questions[currentIndex]
  // Kaydırarak önceki / sonraki soru
  const swipe = useSwipeNav({
    onPrev: () => setCurrentIndex((i) => Math.max(0, i - 1)),
    onNext: () => setCurrentIndex((i) => Math.min(TOTAL_QUESTIONS - 1, i + 1)),
    canPrev: currentIndex > 0,
    canNext: currentIndex + 1 < Math.min(TOTAL_QUESTIONS, questions.length),
    enabled: !isFinished,
  })

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  if (questions.length === 0) {
    return (
      <div className={styles.loadingBox}>
        <p>Mini YDS Denemesi hazırlanıyor…</p>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      {/* Üst Bar */}
      <header className={styles.header}>
        <div>
          <Link to="/" className={styles.backLink}>
            ← Ana Sayfa
          </Link>
          <h1 className={styles.title}>Mini YDS Kelime Denemesi</h1>
          <span className={styles.subTitle}>
            ÖSYM sınav formatında 10 soruluk süreli akademik kelime testi
          </span>
        </div>

        {!isFinished && (
          <div className={`${styles.timerBox} ${timeLeft < 120 ? styles.timerWarning : ''}`}>
            <span className={styles.timerLabel}>Kalan Süre</span>
            <span className={styles.timerVal}>{formatTime(timeLeft)}</span>
          </div>
        )}
      </header>

      {!isFinished ? (
        /* AKTİF SINAV ALANI */
        <main className={styles.examArea} {...swipe.props}>
          {/* Soru Gezinim Numaraları (1 - 10) */}
          <nav className={styles.questionNav} aria-label="Soru gezinimi">
            {questions.map((q, idx) => {
              const isAnswered = userAnswers[q.id] !== undefined
              const isCurrent = idx === currentIndex
              return (
                <button
                  key={q.id}
                  type="button"
                  className={`${styles.navNumBtn} ${
                    isCurrent ? styles.navNumActive : ''
                  } ${isAnswered ? styles.navNumAnswered : ''}`}
                  onClick={() => setCurrentIndex(idx)}
                >
                  {q.id}
                </button>
              )
            })}
          </nav>

          {/* Aktif Soru Kartı */}
          {currentQ && (
            <article className={styles.questionCard} data-focus-stage>
              <div className={styles.questionMeta}>
                <span className={styles.qBadge}>Soru {currentQ.id} / 10</span>
                <span className={styles.typeBadge}>
                  {currentQ.targetWord.partOfSpeech || 'Kelime'}
                </span>
              </div>

              {/* Soru Cümlesi */}
              <p className={styles.sentenceText}>
                {currentQ.sentenceWithBlank}
              </p>

              {/* 5 Seçenek (A, B, C, D, E) */}
              <div className={styles.optionsList}>
                {currentQ.options.map((opt, optIdx) => {
                  const letter = String.fromCharCode(65 + optIdx)
                  const isSelected = userAnswers[currentQ.id] === optIdx

                  return (
                    <button
                      key={opt}
                      type="button"
                      className={`${styles.optionBtn} ${
                        isSelected ? styles.optionSelected : ''
                      }`}
                      onClick={() => handleSelectOption(currentQ.id, optIdx)}
                    >
                      <span className={styles.optLetter}>{letter}</span>
                      <span className={styles.optText}>{opt}</span>
                    </button>
                  )
                })}
              </div>

              {/* Sınav Kontrol Butonları */}
              <div className={styles.examActions}>
                <button
                  type="button"
                  className="btn"
                  disabled={currentIndex === 0}
                  onClick={() => void swipe.turn(-1)}
                  data-focus-hide
                >
                  ← Önceki Soru
                </button>

                {currentIndex + 1 < TOTAL_QUESTIONS ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => void swipe.turn(1)}
                    data-focus-hide
                  >
                    Sonraki Soru →
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setIsFinished(true)}
                  >
                    Sınavı Tamamla ✓
                  </button>
                )}

                <button
                  type="button"
                  className={styles.finishLinkBtn}
                  onClick={() => setIsFinished(true)}
                >
                  Sınavı Erken Bitir
                </button>
              </div>
            </article>
          )}
        </main>
      ) : (
        /* SINAV SONUÇ VE ANALİZ RAPORU */
        <section className={styles.resultReport}>
          <div className={styles.scoreHero}>
            <div className={styles.scoreCircle}>
              <span className={styles.scoreNumber}>{results.score}</span>
              <span className={styles.scoreLabel}>Puan</span>
            </div>
            <div className={styles.scoreMeta}>
              <h2>Sınav Sonuç Raporun</h2>
              <p className="muted">
                10 soruluk denemeyi tamamladın. Aşağıda doğru/yanlış analizini ve kelime çözümlerini inceleyebilirsin.
              </p>
              <div className={styles.badgeRow}>
                <span className={styles.badgeSuccess}>✓ {results.correct} Doğru</span>
                <span className={styles.badgeDanger}>✗ {results.wrong} Yanlış</span>
                <span className={styles.badgeMuted}>○ {results.empty} Boş</span>
              </div>
            </div>
          </div>

          <div className={styles.reportActions}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={generateExam}
            >
              Yeni Mini Deneme Çöz 🚀
            </button>
            <Link to="/" className="btn btn-ghost">
              Ana Sayfaya Dön
            </Link>
          </div>

          {/* Soru Soru Detaylı Çözümler */}
          <div className={styles.reviewList}>
            <h3>Soru Çözümleri ve Kelime Analizleri</h3>

            {questions.map((q) => {
              const userAnsIdx = userAnswers[q.id]
              const isCorrect = userAnsIdx === q.correctOptionIndex
              const isUnanswered = userAnsIdx === undefined
              const alreadyInDeck =
                userWords.some((w) => w.term.toLowerCase() === q.targetWord.term.toLowerCase()) ||
                addedWordTerms.includes(q.targetWord.term)

              return (
                <article
                  key={q.id}
                  className={`${styles.reviewCard} ${
                    isCorrect
                      ? styles.reviewCorrect
                      : isUnanswered
                      ? styles.reviewEmpty
                      : styles.reviewWrong
                  }`}
                >
                  <div className={styles.reviewHeader}>
                    <span className={styles.reviewNum}>Soru {q.id}</span>
                    <span
                      className={`${styles.statusBadge} ${
                        isCorrect
                          ? styles.statusCorrect
                          : isUnanswered
                          ? styles.statusEmpty
                          : styles.statusWrong
                      }`}
                    >
                      {isCorrect ? '✓ Doğru' : isUnanswered ? '○ Boş' : '✗ Yanlış'}
                    </span>
                  </div>

                  <p className={styles.reviewSentence}>{q.sentenceWithBlank}</p>
                  {q.sentenceTranslation && (
                    <p className={styles.reviewTranslation}>
                      <strong>Türkçesi:</strong> {q.sentenceTranslation}
                    </p>
                  )}

                  <div className={styles.answerComparison}>
                    <div>
                      <span className={styles.answerLabel}>Doğru Cevap:</span>
                      <strong className={styles.correctTerm}>
                        {q.options[q.correctOptionIndex]} ({q.targetWord.definition})
                      </strong>
                    </div>

                    {!isCorrect && !isUnanswered && (
                      <div>
                        <span className={styles.answerLabel}>Senin Cevabın:</span>
                        <strong className={styles.wrongTerm}>
                          {q.options[userAnsIdx]}
                        </strong>
                      </div>
                    )}
                  </div>

                  {/* Kelimeyi Desteye Ekleme Butonu */}
                  {!alreadyInDeck && (
                    <div className={styles.addDeckRow}>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => void handleAddWordToDeck(q.targetWord)}
                      >
                        + "{q.targetWord.term}" Kelimesini Havuzuma Ekle
                      </button>
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
