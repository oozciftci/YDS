import { useState, useMemo, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { processCardReview } from '../services/fsrs'
import {
  buildQuestion,
  filterStudyCards,
  type QuestionMode,
  type StudyFilterOptions,
  type StudyQuestion,
} from '../services/studySession'
import { speakWord } from '../services/tts'
import { useUserStore } from '../stores/user'
import {
  MASTERY_CONFIG,
  type MasteryLevel,
  type PartOfSpeech,
  type WordItem,
} from '../types/database'
import { InteractiveSentence } from '../components/InteractiveSentence'
import styles from './Study.module.css'

const POS_FILTERS: Array<{ id: PartOfSpeech; label: string }> = [
  { id: 'verb', label: 'Fiiller' },
  { id: 'noun', label: 'İsimler' },
  { id: 'adjective', label: 'Sıfatlar' },
  { id: 'adverb', label: 'Zarflar' },
  { id: 'phrasal_verb', label: 'Phrasal Verbler' },
  { id: 'conjunction', label: 'Bağlaçlar' },
  { id: 'preposition', label: 'Edatlar' },
]

export function StudyPage() {
  const activeUser = useUserStore((s) => s.activeUser)
  const activeUserId = activeUser?.id || 'user_osman'

  // Veritabanı sorguları
  const allWords = useLiveQuery(
    () => db.words.where('userId').equals(activeUserId).filter((w) => !w.isDeleted).toArray(),
    [activeUserId],
    [],
  )

  const allCardStates = useLiveQuery(
    () => db.cardStates.where('userId').equals(activeUserId).toArray(),
    [activeUserId],
    [],
  )

  // Oturum Durumu ('setup' | 'studying' | 'summary')
  const [phase, setPhase] = useState<'setup' | 'studying' | 'summary'>('setup')

  // Filtreleme Ayarları
  const [selectedPos, setSelectedPos] = useState<PartOfSpeech[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedScores, setSelectedScores] = useState<number[]>([1, 2, 3]) // Varsayılan: Öğrenilmekte olanlar
  const [dueOnly, setDueOnly] = useState(false)
  const [lapsesOnly, setLapsesOnly] = useState(false)
  const [mode, setMode] = useState<QuestionMode>('mixed')
  const [limit, setLimit] = useState(15)

  // Aktif Oturum Soruları ve İlerleme
  const [questions, setQuestions] = useState<StudyQuestion[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [selectedOption, setSelectedOption] = useState<number | null>(null)
  const [questionStartTime, setQuestionStartTime] = useState(() => Date.now())
  const [sessionResults, setSessionResults] = useState<Array<{ word: WordItem; score: MasteryLevel }>>([])

  // Mevcut tüm etiketler
  const availableTags = useMemo(() => {
    const set = new Set<string>()
    for (const w of allWords) {
      if (w.tags) {
        for (const t of w.tags) set.add(t)
      }
    }
    return Array.from(set).sort()
  }, [allWords])

  // Filtrelere eşleşen kelime sayısı
  const matchedCards = useMemo(() => {
    const filterOptions: StudyFilterOptions = {
      posList: selectedPos,
      tags: selectedTags,
      masteryScores: selectedScores,
      dueOnly,
      lapsesOnly,
      limit: 0,
      mode,
    }
    return filterStudyCards(allWords, allCardStates, filterOptions)
  }, [allWords, allCardStates, selectedPos, selectedTags, selectedScores, dueOnly, lapsesOnly, mode])

  // Hazır Şablonlar (Presets)
  function applyPreset(name: 'learning' | 'hard' | 'due' | 'all') {
    if (name === 'learning') {
      setSelectedScores([1, 2, 3])
      setLapsesOnly(false)
      setDueOnly(false)
    } else if (name === 'hard') {
      setSelectedScores([])
      setLapsesOnly(true)
      setDueOnly(false)
    } else if (name === 'due') {
      setSelectedScores([])
      setLapsesOnly(false)
      setDueOnly(true)
    } else {
      setSelectedScores([])
      setSelectedPos([])
      setSelectedTags([])
      setLapsesOnly(false)
      setDueOnly(false)
    }
  }

  function togglePos(pos: PartOfSpeech) {
    setSelectedPos((prev) => (prev.includes(pos) ? prev.filter((p) => p !== pos) : [...prev, pos]))
  }

  function toggleTag(tag: string) {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
  }

  function toggleScore(score: number) {
    setSelectedScores((prev) => (prev.includes(score) ? prev.filter((s) => s !== score) : [...prev, score]))
  }

  // Oturumu Başlat
  function startSession() {
    if (matchedCards.length === 0) return

    const filterOptions: StudyFilterOptions = {
      posList: selectedPos,
      tags: selectedTags,
      masteryScores: selectedScores,
      dueOnly,
      lapsesOnly,
      limit,
      mode,
    }

    const cards = filterStudyCards(allWords, allCardStates, filterOptions)
    const generated = cards.map((c) => buildQuestion(c, allWords, mode))

    setQuestions(generated)
    setCurrentIndex(0)
    setIsFlipped(false)
    setSelectedOption(null)
    setQuestionStartTime(Date.now())
    setSessionResults([])
    setPhase('studying')
  }

  const currentQ = questions[currentIndex]

  // Puan Verme ve Sonraki Soruya Geçme
  const handleScoreCard = useCallback(
    async (score: MasteryLevel) => {
      if (!currentQ) return
      const durationMs = Date.now() - questionStartTime

      await processCardReview(currentQ.cardState, score, currentQ.type, durationMs)

      setSessionResults((prev) => [...prev, { word: currentQ.word, score }])

      if (currentIndex + 1 < questions.length) {
        setCurrentIndex((i) => i + 1)
        setIsFlipped(false)
        setSelectedOption(null)
        setQuestionStartTime(Date.now())
      } else {
        setPhase('summary')
      }
    },
    [currentQ, currentIndex, questions.length, questionStartTime],
  )

  // Çoktan Seçmeli Seçenek Tıklaması
  function handleSelectOption(optIdx: number) {
    if (selectedOption !== null || !currentQ) return
    setSelectedOption(optIdx)

    const isCorrect = optIdx === currentQ.correctOptionIndex

    // Doğruysa 4-5 puan, yanlışsa 1-2 puan otomatik uygula (veya 1.5 sn sonra geç)
    setTimeout(() => {
      void handleScoreCard(isCorrect ? 4 : 1)
    }, 1300)
  }

  // Klavye Kısayolları
  useEffect(() => {
    if (phase !== 'studying' || !currentQ) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      // Boşluk: Kartı çevir / telaffuz et
      if (e.code === 'Space') {
        e.preventDefault()
        if (currentQ.type === 'flashcard') {
          setIsFlipped((f) => !f)
        } else {
          speakWord(currentQ.word.term)
        }
      }

      // 1-5 tuşları ile doğrudan puan ver
      if (['1', '2', '3', '4', '5'].includes(e.key)) {
        const score = Number(e.key) as MasteryLevel
        void handleScoreCard(score)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [phase, currentQ, handleScoreCard])

  return (
    <section className={styles.container}>
      {/* ========================================================
          AŞAMA 1: OTURUM BAŞLATMA VE FİLTRE SEÇİMİ
          ======================================================== */}
      {phase === 'setup' && (
        <div className={styles.setupCard}>
          <div>
            <h1 className={styles.setupTitle}>Çalışma Oturumu</h1>
            <p className="muted">
              Kategori, tür veya öğrenme puanına (1-5) göre dilediğiniz kelime grubunu filtreleyip çalışın.
            </p>
          </div>

          {/* Hızlı Şablonlar */}
          <div className="field">
            <label>Hızlı Çalışma Şablonları</label>
            <div className={styles.presetsRow}>
              <button
                type="button"
                className={`${styles.presetBtn} ${
                  selectedScores.length === 3 &&
                  selectedScores.includes(1) &&
                  selectedScores.includes(2) &&
                  selectedScores.includes(3) &&
                  !dueOnly &&
                  !lapsesOnly
                    ? styles.presetBtnActive
                    : ''
                }`}
                onClick={() => applyPreset('learning')}
              >
                🎯 Öğrenme Aşamasındakiler (1, 2, 3)
              </button>
              <button
                type="button"
                className={`${styles.presetBtn} ${lapsesOnly ? styles.presetBtnActive : ''}`}
                onClick={() => applyPreset('hard')}
              >
                ⚠️ En Çok Yanıldıklarım
              </button>
              <button
                type="button"
                className={`${styles.presetBtn} ${dueOnly ? styles.presetBtnActive : ''}`}
                onClick={() => applyPreset('due')}
              >
                ⏰ Bugün Tekrarı Gelenler
              </button>
              <button
                type="button"
                className={styles.presetBtn}
                onClick={() => applyPreset('all')}
              >
                Tüm Kelimeler
              </button>
            </div>
          </div>

          {/* 1-5 PUAN FİLTRESİ (ÇOKLU SEÇİM) */}
          <div className="field">
            <label>Öğrenme Puanına Göre Seç (1 - 5 Puan)</label>
            <span className="hint">Birden fazla puan seçebilirsiniz (Örn: 1, 2 ve 3):</span>
            <div className={styles.scoreToggleRow}>
              {([1, 2, 3, 4, 5] as MasteryLevel[]).map((score) => {
                const conf = MASTERY_CONFIG[score]
                const active = selectedScores.includes(score)
                const selClass = active ? styles[`scoreSelected_${score}` as keyof typeof styles] : ''
                return (
                  <button
                    key={score}
                    type="button"
                    className={`${styles.scoreBtn} ${selClass}`}
                    onClick={() => toggleScore(score)}
                    aria-pressed={active}
                  >
                    <span className={styles.scoreNum} style={{ color: conf.color }}>
                      {score}
                    </span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>{conf.label}</span>
                    <span className={styles.scoreDesc}>{conf.desc}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* KELİME TÜRÜ FİLTRESİ */}
          <div className="field">
            <label>Kelime Türüne Göre Seç (İsteğe Bağlı)</label>
            <div className={styles.chipsRow}>
              {POS_FILTERS.map((p) => {
                const active = selectedPos.includes(p.id)
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={`${styles.chip} ${active ? styles.chipActive : ''}`}
                    onClick={() => togglePos(p.id)}
                  >
                    {p.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* ETİKET / KATEGORİ FİLTRESİ (HUKUK, SAĞLIK VB.) */}
          {availableTags.length > 0 && (
            <div className="field">
              <label>Kategori ve Etiketlere Göre Seç (Örn: Hukuk, Bilişim, Sağlık)</label>
              <div className={styles.chipsRow}>
                {availableTags.map((tag) => {
                  const active = selectedTags.includes(tag)
                  return (
                    <button
                      key={tag}
                      type="button"
                      className={`${styles.chip} ${active ? styles.chipActive : ''}`}
                      onClick={() => toggleTag(tag)}
                    >
                      #{tag}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* SORU TİPİ VE LİMİT */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="field">
              <label htmlFor="study-mode">Soru Türü</label>
              <select
                id="study-mode"
                className="input"
                value={mode}
                onChange={(e) => setMode(e.target.value as QuestionMode)}
              >
                <option value="mixed">🎲 Akıllı Karışık (Önerilen)</option>
                <option value="flashcard">🗂️ Yalnızca Flaşkartlar (Çevir & Puanla)</option>
                <option value="multiple_choice">🔠 Çoktan Seçmeli Test</option>
                <option value="synonym">🔗 YDS Eş Anlamlı Testi</option>
                <option value="cloze">📝 Cümlede Boşluk Doldurma</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="study-limit">Oturum Kelime Sayısı</label>
              <select
                id="study-limit"
                className="input"
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
              >
                <option value={10}>10 Kelime</option>
                <option value={15}>15 Kelime</option>
                <option value={20}>20 Kelime</option>
                <option value={30}>30 Kelime</option>
                <option value={0}>Filtredeki Tümü</option>
              </select>
            </div>
          </div>

          {/* EŞLEŞEN KELİME SAYISI VE BAŞLAT BUTONU */}
          <div className={styles.summaryRow}>
            <div>
              <span className="muted" style={{ fontSize: '0.8rem', display: 'block' }}>
                Filtre Sonucu:
              </span>
              <span className={styles.matchCount}>
                {matchedCards.length} kelime çalışmaya hazır
              </span>
            </div>

            <button
              id="start-study-btn"
              type="button"
              className="btn btn-primary"
              style={{ padding: '0.8rem 1.5rem', fontSize: '1rem' }}
              disabled={matchedCards.length === 0}
              onClick={startSession}
            >
              🚀 Çalışmayı Başlat
            </button>
          </div>
        </div>
      )}

      {/* ========================================================
          AŞAMA 2: AKTİF ÇALIŞMA EKRANI
          ======================================================== */}
      {phase === 'studying' && currentQ && (
        <div className={styles.activeArea}>
          {/* İlerleme Çubuğu */}
          <div className={styles.statusBar}>
            <span>
              Soru {currentIndex + 1} / {questions.length}
            </span>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}
              onClick={() => setPhase('setup')}
            >
              ✕ Oturumu Bitir
            </button>
          </div>
          <div className={styles.progressBar} aria-hidden="true">
            <div
              className={styles.progressFill}
              style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
            />
          </div>

          {/* Soru Alanı */}
          <div className={styles.cardStage}>
            <div className={styles.cardFlip}>
              {/* ÜST BİLGİ */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className={styles.cardSubPrompt}>{currentQ.subPrompt}</span>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => speakWord(currentQ.word.term)}
                  title="Dinle"
                >
                  🔊 Dinle
                </button>
              </div>

              {/* 1. FLAŞKART GÖRÜNÜMÜ */}
              {currentQ.type === 'flashcard' && (
                <>
                  {!isFlipped ? (
                    <div style={{ margin: 'auto 0' }}>
                      <h2 className={styles.cardPrompt}>{currentQ.prompt}</h2>
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ marginTop: '1.25rem' }}
                        onClick={() => setIsFlipped(true)}
                      >
                        Kartı Çevir (Boşluk Tuşu)
                      </button>
                      <div className={styles.flipHint}>veya doğrudan 1-5 tuşlarına basın</div>
                    </div>
                  ) : (
                    <div className={styles.backFace}>
                      <h2 className={styles.backDef}>{currentQ.word.definition}</h2>

                      {/* Eş anlamlılar */}
                      {currentQ.word.synonyms && currentQ.word.synonyms.length > 0 && (
                        <div style={{ fontSize: '0.95rem' }}>
                          <strong style={{ color: 'var(--primary)' }}>Eş Anlamlılar: </strong>
                          {currentQ.word.synonyms.join(', ')}
                        </div>
                      )}

                      {/* Kalıplar */}
                      {currentQ.word.collocations && currentQ.word.collocations.length > 0 && (
                        <div className="muted" style={{ fontSize: '0.85rem', fontStyle: 'italic' }}>
                          Kalıp: {currentQ.word.collocations.join(' • ')}
                        </div>
                      )}

                      {/* Örnek cümle (Kelimeye tıklayarak anlamını görme) */}
                      {currentQ.word.sentences && currentQ.word.sentences.length > 0 && currentQ.word.sentences[0] && (
                        <div style={{ marginTop: '0.4rem', width: '100%' }}>
                          <InteractiveSentence
                            sentence={
                              typeof currentQ.word.sentences[0] === 'string'
                                ? { en: currentQ.word.sentences[0] }
                                : currentQ.word.sentences[0]
                            }
                            activeUserId={currentQ.word.userId}
                            highlightTerm={currentQ.word.term}
                            showTranslationByDefault={true}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* 1-5 PUAN VERME BUTONLARI (KULLANICININ ÖZEL İSTEĞİ) */}
                  <div className={styles.scoreActionBox}>
                    <span className={styles.scoreActionTitle}>
                      {isFlipped ? 'Bu kelimeyi ne kadar öğrendiniz? (1-5 Puan verin)' : 'Puan Verip Geç:'}
                    </span>
                    <div className={styles.scoreButtonsGrid}>
                      {([1, 2, 3, 4, 5] as MasteryLevel[]).map((score) => {
                        const conf = MASTERY_CONFIG[score]
                        return (
                          <button
                            key={score}
                            type="button"
                            className={`${styles.rateBtn} ${styles[`rateBtn_${score}` as keyof typeof styles]}`}
                            onClick={() => void handleScoreCard(score)}
                          >
                            <span>{conf.badge}</span>
                            <span style={{ fontSize: '0.72rem' }}>{conf.label}</span>
                            <span className={styles.rateKbd}>[{score}]</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </>
              )}

              {/* 2. ÇOKTAN SEÇMELİ / EŞ ANLAMLI / CLOZE TEST */}
              {currentQ.type !== 'flashcard' && currentQ.options && (
                <div style={{ margin: 'auto 0' }}>
                  <h2 className={styles.cardPrompt} style={{ fontSize: '1.6rem' }}>
                    {currentQ.prompt}
                  </h2>

                  <div className={styles.optionsGrid}>
                    {currentQ.options.map((opt, idx) => {
                      const letters = ['A', 'B', 'C', 'D']
                      let optClass = styles.optionBtn
                      if (selectedOption !== null) {
                        if (idx === currentQ.correctOptionIndex) {
                          optClass = `${styles.optionBtn} ${styles.optionCorrect}`
                        } else if (idx === selectedOption) {
                          optClass = `${styles.optionBtn} ${styles.optionWrong}`
                        }
                      }

                      return (
                        <button
                          key={idx}
                          type="button"
                          className={optClass}
                          disabled={selectedOption !== null}
                          onClick={() => handleSelectOption(idx)}
                        >
                          <span className={styles.optionLetter}>{letters[idx]}</span>
                          <span>{opt}</span>
                        </button>
                      )
                    })}
                  </div>

                  {selectedOption !== null && currentQ.explanation && (
                    <div
                      role="status"
                      style={{
                        marginTop: '1rem',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        color:
                          selectedOption === currentQ.correctOptionIndex
                            ? 'var(--success)'
                            : 'var(--danger)',
                      }}
                    >
                      {currentQ.explanation}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          AŞAMA 3: OTURUM SONU RAPOR EKRANI
          ======================================================== */}
      {phase === 'summary' && (
        <div className={styles.resultCard}>
          <div style={{ fontSize: '3rem' }}>🎉</div>
          <h1 className={styles.resultTitle}>Oturum Tamamlandı!</h1>
          <p className="muted">
            Tebrikler! {sessionResults.length} kelime başarıyla tekrar edildi.
            FSRS algoritması bir sonraki tekrar zamanlarını güncelledi.
          </p>

          <div className={styles.resultScoreRow}>
            <div className={styles.scoreStat}>
              <span className={styles.scoreStatNum}>{sessionResults.length}</span>
              <span className={styles.scoreStatLbl}>Çalışılan Kelime</span>
            </div>
            <div className={styles.scoreStat}>
              <span className={styles.scoreStatNum}>
                {sessionResults.filter((r) => r.score >= 4).length}
              </span>
              <span className={styles.scoreStatLbl}>Öğrenilen (4-5 Puan)</span>
            </div>
            <div className={styles.scoreStat}>
              <span className={styles.scoreStatNum}>
                {sessionResults.filter((r) => r.score <= 2).length}
              </span>
              <span className={styles.scoreStatLbl}>Tekrar Gereken (1-2 Puan)</span>
            </div>
          </div>

          <div className={styles.wordReviewList}>
            {sessionResults.map((r, i) => (
              <div key={i} className={styles.reviewItem}>
                <div>
                  <strong>{r.word.term}</strong>
                  <span className="muted" style={{ marginLeft: '0.5rem', fontSize: '0.8rem' }}>
                    ({r.word.definition})
                  </span>
                </div>
                <span
                  style={{
                    fontWeight: 700,
                    color: MASTERY_CONFIG[r.score].color,
                  }}
                >
                  {MASTERY_CONFIG[r.score].badge} - {MASTERY_CONFIG[r.score].label}
                </span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '1rem' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setPhase('setup')}
            >
              🔄 Yeni Oturum Başlat
            </button>
            <Link to="/" className="btn btn-ghost">
              Ana Sayfaya Dön
            </Link>
          </div>
        </div>
      )}
    </section>
  )
}
