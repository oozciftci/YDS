import { useState, useMemo, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { ALL_WORD_PACKS } from '../data/wordPacks'
import { speakWord } from '../services/tts'
import { useUserStore } from '../stores/user'
import styles from './SynonymMatch.module.css'

interface MatchCard {
  id: string // benzersiz kart id'si
  pairId: string // eşleşen çiftin ortak kimliği
  text: string
  isTerm: boolean // terim mi yoksa eş anlamlı mı
  matched: boolean
  /** Çiftin Türkçe anlamı (eşleşince iki kartta da görünür) */
  meaning: string
}

/** "kötüleşmek; bozulmak (tıp)" → "kötüleşmek; bozulmak" — kartta kısa görünsün */
function shortMeaning(def: string): string {
  return def.split('\n')[0].replace(/\([^)]*\)/g, '').trim().slice(0, 60)
}

const PAIRS_PER_ROUND = 5

export function SynonymMatchPage() {
  const activeUser = useUserStore((s) => s.activeUser)
  const activeUserId = activeUser?.id || 'user_ozgur'

  // Kullanıcı kelimeleri
  const userWords = useLiveQuery(
    () => db.words.where('userId').equals(activeUserId).filter((w) => !w.isDeleted).toArray(),
    [activeUserId],
    [],
  )

  // Eş anlamlısı olan tüm kelime havuzu (kullanıcı + akademik hazır paketler)
  const availablePool = useMemo(() => {
    const list: Array<{ term: string; synonym: string; meaning: string }> = []
    const seen = new Set<string>()

    // Önce kullanıcının kendi kelimeleri
    for (const w of userWords) {
      if (w.synonyms && w.synonyms.length > 0) {
        const syn = w.synonyms[0].trim()
        const key = `${w.term.toLowerCase()}__${syn.toLowerCase()}`
        if (!seen.has(key)) {
          seen.add(key)
          list.push({ term: w.term, synonym: syn, meaning: shortMeaning(w.definition || '') })
        }
      }
    }

    // Yetersizse hazır YDS paketlerinden ekle
    for (const pack of ALL_WORD_PACKS) {
      for (const w of pack.words) {
        if (w.synonyms && w.synonyms.length > 0) {
          const syn = w.synonyms[0].trim()
          const key = `${w.term.toLowerCase()}__${syn.toLowerCase()}`
          if (!seen.has(key)) {
            seen.add(key)
            list.push({ term: w.term, synonym: syn, meaning: shortMeaning(w.definition || '') })
          }
        }
      }
    }

    return list
  }, [userWords])

  // Oyun Durumları
  const [round, setRound] = useState(1)
  const [cards, setCards] = useState<MatchCard[]>([])
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const [wrongPairIds, setWrongPairIds] = useState<string[]>([])
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(0)
  const [moves, setMoves] = useState(0)
  const [startTime, setStartTime] = useState(() => Date.now())
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [isGameOver, setIsGameOver] = useState(false)

  // Zamanlayıcı
  useEffect(() => {
    if (isGameOver) return
    const timer = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)
    return () => clearInterval(timer)
  }, [startTime, isGameOver])

  // Yeni Tur Kartlarını Başlatma
  const setupRound = useCallback(() => {
    if (availablePool.length < PAIRS_PER_ROUND) return

    // Havuzdan rastgele 5 çift seç
    const shuffledPool = [...availablePool].sort(() => 0.5 - Math.random())
    const selectedPairs = shuffledPool.slice(0, PAIRS_PER_ROUND)

    const newCards: MatchCard[] = []
    selectedPairs.forEach((pair, idx) => {
      const pairId = `pair_${idx}_${pair.term}`
      // 1. Kart: Terim
      newCards.push({
        id: `term_${pairId}`,
        pairId,
        text: pair.term,
        isTerm: true,
        matched: false,
        meaning: pair.meaning,
      })
      // 2. Kart: Eş Anlamlısı
      newCards.push({
        id: `syn_${pairId}`,
        pairId,
        text: pair.synonym,
        isTerm: false,
        matched: false,
        meaning: pair.meaning,
      })
    })

    // Kartları masaya rastgele karıştırarak dağıt
    setCards(newCards.sort(() => 0.5 - Math.random()))
    setSelectedCardId(null)
    setWrongPairIds([])
    setIsGameOver(false)
  }, [availablePool])

  // İlk yüklemede turu başlat
  useEffect(() => {
    if (availablePool.length >= PAIRS_PER_ROUND && cards.length === 0) {
      setupRound()
    }
  }, [availablePool, cards.length, setupRound])

  // Kart Tıklaması
  function handleCardClick(card: MatchCard) {
    if (card.matched || isGameOver) return
    if (selectedCardId === card.id) return // aynı karta tekrar tıklama

    // İlk kart seçimi
    if (!selectedCardId) {
      setSelectedCardId(card.id)
      if (card.isTerm) speakWord(card.text)
      return
    }

    // İkinci kart seçimi
    const firstCard = cards.find((c) => c.id === selectedCardId)
    if (!firstCard) {
      setSelectedCardId(card.id)
      return
    }

    setMoves((m) => m + 1)

    // Eşleşme Kontrolü
    if (firstCard.pairId === card.pairId) {
      // Doğru Eşleşme!
      speakWord(card.text)
      const newCombo = combo + 1
      const points = 100 * newCombo
      setCombo(newCombo)
      setScore((s) => s + points)

      // Kartları eşleşti olarak işaretle
      const updatedCards = cards.map((c) =>
        c.pairId === card.pairId ? { ...c, matched: true } : c,
      )
      setCards(updatedCards)
      setSelectedCardId(null)

      // Tüm kartlar eşleşti mi?
      const remaining = updatedCards.filter((c) => !c.matched)
      if (remaining.length === 0) {
        setTimeout(() => {
          setIsGameOver(true)
        }, 500)
      }
    } else {
      // Yanlış Eşleşme
      setCombo(0)
      setWrongPairIds([firstCard.id, card.id])
      setTimeout(() => {
        setWrongPairIds([])
        setSelectedCardId(null)
      }, 700)
    }
  }

  function handleNextRound() {
    setRound((r) => r + 1)
    setupRound()
  }

  function handleRestartGame() {
    setRound(1)
    setScore(0)
    setCombo(0)
    setMoves(0)
    setStartTime(Date.now())
    setElapsedSeconds(0)
    setupRound()
  }

  return (
    <div className={styles.container}>
      {/* Üst Bilgi Barı */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <Link to="/calis" className={styles.backLink}>
            ← Çalış
          </Link>
          <h1 className={styles.title}>Eş Anlamlı Eşleştirmece</h1>
          <span className={styles.subTitle}>
            YDS kelimelerinin İngilizce eş anlamlılarını hızlıca eşleştir.
          </span>
        </div>

        {/* Skor & İstatistik Barı */}
        <div className={styles.statsBar}>
          <div className={styles.statBox}>
            <span className={styles.statLabel}>Skor</span>
            <span className={styles.statVal}>{score}</span>
          </div>

          <div className={styles.statBox}>
            <span className={styles.statLabel}>Kombo</span>
            <span className={`${styles.statVal} ${combo > 1 ? styles.fireCombo : ''}`}>
              {combo > 1 ? `🔥 x${combo}` : '—'}
            </span>
          </div>

          <div className={styles.statBox}>
            <span className={styles.statLabel}>Süre</span>
            <span className={styles.statVal}>
              {Math.floor(elapsedSeconds / 60)}:
              {(elapsedSeconds % 60).toString().padStart(2, '0')}
            </span>
          </div>

          <div className={styles.statBox}>
            <span className={styles.statLabel}>Tur</span>
            <span className={styles.statVal}>{round}</span>
          </div>
        </div>
      </header>

      {/* Oyun Alanı */}
      {!isGameOver ? (
        <main className={styles.gameBoard}>
          <div className={styles.grid}>
            {cards.map((card) => {
              const isSelected = selectedCardId === card.id
              const isWrong = wrongPairIds.includes(card.id)
              const isMatched = card.matched

              return (
                <button
                  key={card.id}
                  type="button"
                  className={`${styles.card} ${
                    isSelected ? styles.cardSelected : ''
                  } ${isWrong ? styles.cardWrong : ''} ${
                    isMatched ? styles.cardMatched : ''
                  } ${card.isTerm ? styles.cardTerm : styles.cardSynonym}`}
                  onClick={() => handleCardClick(card)}
                  disabled={isMatched}
                >
                  <span className={styles.cardTypeBadge}>
                    {card.isTerm ? 'Kelime' : 'Eş Anlam'}
                  </span>
                  <span className={styles.cardText}>{card.text}</span>
                  {isMatched && card.meaning && <span className={styles.cardMeaning}>{card.meaning}</span>}
                </button>
              );
            })}
          </div>
        </main>
      ) : (
        /* Tur Bitiş Ekranı */
        <section className={styles.congratsCard}>
          <div className={styles.congratsBadge}>🎉 Harika İş!</div>
          <h2>{round}. Turu Başarıyla Tamamladın</h2>
          <p className="muted">
            {PAIRS_PER_ROUND} akademik kelime çiftini {moves} hamlede ve {elapsedSeconds} saniyede eşleştirdin.
          </p>

          <div className={styles.summaryStats}>
            <div className={styles.summaryStatItem}>
              <span>Toplam Puan</span>
              <strong>{score}</strong>
            </div>
            <div className={styles.summaryStatItem}>
              <span>Hamle Sayısı</span>
              <strong>{moves}</strong>
            </div>
            <div className={styles.summaryStatItem}>
              <span>Toplam Süre</span>
              <strong>{elapsedSeconds} sn</strong>
            </div>
          </div>

          <ul className={styles.pairList}>
            {cards
              .filter((c) => c.isTerm)
              .map((c) => (
                <li key={c.pairId}>
                  <strong>{c.text}</strong> = {cards.find((x) => x.pairId === c.pairId && !x.isTerm)?.text}
                  {c.meaning && <span className="muted"> · {c.meaning}</span>}
                </li>
              ))}
          </ul>

          <div className={styles.congratsActions}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleNextRound}
            >
              Sonraki Tur ({round + 1}) →
            </button>
            <button
              type="button"
              className="btn"
              onClick={handleRestartGame}
            >
              Yeniden Başlat
            </button>
            <Link to="/" className="btn btn-ghost">
              Ana Sayfaya Dön
            </Link>
          </div>
        </section>
      )}
    </div>
  )
}
