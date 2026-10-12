import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { speakWord } from '../services/tts'
import { useUserStore } from '../stores/user'
import {
  MASTERY_CONFIG,
  type MasteryLevel,
  type PartOfSpeech,
} from '../types/database'
import styles from './Stats.module.css'

const POS_LABELS: Record<PartOfSpeech, string> = {
  verb: 'Fiil',
  noun: 'İsim',
  adjective: 'Sıfat',
  adverb: 'Zarf',
  phrasal_verb: 'Phrasal Verb',
  conjunction: 'Bağlaç',
  preposition: 'Edat',
  idiom: 'Deyim',
  other: 'Diğer',
}

export function StatsPage() {
  const activeUser = useUserStore((s) => s.activeUser)
  const activeUserId = activeUser?.id || 'user_osman'

  // Canlı Veritabanı Sorguları
  const words = useLiveQuery(
    () => db.words.where('userId').equals(activeUserId).filter((w) => !w.isDeleted).toArray(),
    [activeUserId],
    [],
  )

  const cardStates = useLiveQuery(
    () => db.cardStates.where('userId').equals(activeUserId).toArray(),
    [activeUserId],
    [],
  )

  const reviewLogs = useLiveQuery(
    () => db.reviewLogs.where('userId').equals(activeUserId).toArray(),
    [activeUserId],
    [],
  )

  const [nowTimestamp] = useState(() => Date.now())

  // Metrik Hesaplamaları
  const stats = useMemo(() => {
    const todayPrefix = new Date(nowTimestamp).toISOString().slice(0, 10)
    const weekAgo = new Date(nowTimestamp - 7 * 24 * 60 * 60 * 1000).toISOString()

    const totalReviews = reviewLogs.length
    const todayReviews = reviewLogs.filter((r) => r.reviewedAt.startsWith(todayPrefix)).length
    const weekReviews = reviewLogs.filter((r) => r.reviewedAt >= weekAgo).length

    // Başarı oranı (Puan 3, 4, 5 olanların oranı)
    const successReviews = reviewLogs.filter((r) => r.rating >= 3).length
    const successRate = totalReviews > 0 ? Math.round((successReviews / totalReviews) * 100) : 0

    // Toplam çalışma süresi
    const totalMs = reviewLogs.reduce((acc, r) => acc + (r.durationMs || 0), 0)
    const totalMinutes = Math.round(totalMs / 60000)

    // 1-5 Seviye Dağılımı
    const levelCounts: Record<MasteryLevel, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    for (const c of cardStates) {
      const score = (c.masteryScore as MasteryLevel) || 1
      if (levelCounts[score] !== undefined) {
        levelCounts[score]++
      } else {
        levelCounts[1]++
      }
    }

    // Gelecek Tekrar Takvimi (Horizons)
    const nowIso = new Date(nowTimestamp).toISOString()
    const tomorrowIso = new Date(nowTimestamp + 24 * 60 * 60 * 1000).toISOString()
    const threeDaysIso = new Date(nowTimestamp + 3 * 24 * 60 * 60 * 1000).toISOString()
    const sevenDaysIso = new Date(nowTimestamp + 7 * 24 * 60 * 60 * 1000).toISOString()

    let dueNow = 0
    let dueTomorrow = 0
    let dueThreeDays = 0
    let dueSevenDays = 0
    let dueLater = 0

    for (const c of cardStates) {
      if (c.due <= nowIso) {
        dueNow++
      } else if (c.due <= tomorrowIso) {
        dueTomorrow++
      } else if (c.due <= threeDaysIso) {
        dueThreeDays++
      } else if (c.due <= sevenDaysIso) {
        dueSevenDays++
      } else {
        dueLater++
      }
    }

    // En çok yanılınan kelimeler (Zorlananlar)
    const wordMap = new Map(words.map((w) => [w.id, w]))
    const troubleCards = cardStates
      .filter((c) => (c.lapses || 0) > 0 || (c.masteryScore || 1) <= 2)
      .sort((a, b) => (b.lapses || 0) - (a.lapses || 0) || (a.masteryScore || 1) - (b.masteryScore || 1))
      .slice(0, 8)
      .map((c) => ({
        card: c,
        word: wordMap.get(c.wordId),
      }))
      .filter((item) => item.word !== undefined)

    // Tür Dağılımı
    const posCounts: Record<string, number> = {}
    for (const w of words) {
      posCounts[w.partOfSpeech] = (posCounts[w.partOfSpeech] || 0) + 1
    }

    // Etiket Dağılımı
    const tagCounts: Record<string, number> = {}
    for (const w of words) {
      if (w.tags) {
        for (const t of w.tags) {
          tagCounts[t] = (tagCounts[t] || 0) + 1
        }
      }
    }

    return {
      totalWords: words.length,
      totalReviews,
      todayReviews,
      weekReviews,
      successRate,
      totalMinutes,
      levelCounts,
      schedule: { dueNow, dueTomorrow, dueThreeDays, dueSevenDays, dueLater },
      troubleCards,
      posCounts,
      tagCounts,
    }
  }, [words, cardStates, reviewLogs, nowTimestamp])

  const totalCards = cardStates.length || 1

  return (
    <section className={styles.container}>
      <header className={styles.header}>
        <h1>Gelişim ve İstatistikler</h1>
        <p className="muted">
          {activeUser?.displayName || 'Kullanıcı'} için kelime öğrenme performansı ve aralıklı tekrar analizi.
        </p>
      </header>

      {/* 1. ÖZET METRİKLER */}
      <div className={styles.overviewGrid}>
        <div className={styles.metricCard}>
          <span className={styles.metricVal}>{stats.todayReviews}</span>
          <span className={styles.metricLbl}>Bugün Çözülen</span>
          <span className={styles.metricSub}>Bu hafta: {stats.weekReviews} soru</span>
        </div>
        <div className={styles.metricCard}>
          <span className={styles.metricVal}>%{stats.successRate}</span>
          <span className={styles.metricLbl}>Başarı Oranı</span>
          <span className={styles.metricSub}>{stats.totalReviews} toplam tekrar</span>
        </div>
        <div className={styles.metricCard}>
          <span className={styles.metricVal}>{stats.totalWords}</span>
          <span className={styles.metricLbl}>Kelime Havuzu</span>
          <span className={styles.metricSub}>Kayıtlı kelime sayısı</span>
        </div>
        <div className={styles.metricCard}>
          <span className={styles.metricVal}>{stats.totalMinutes} dk</span>
          <span className={styles.metricLbl}>Çalışma Süresi</span>
          <span className={styles.metricSub}>Aktif pratik zamanı</span>
        </div>
      </div>

      {/* 2. ÖĞRENME SEVİYESİ DAĞILIMI (1-5 PUAN ÇUBUĞU) */}
      <section className={styles.sectionCard}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Öğrenme Seviyesi Dağılımı (1 - 5 Puan)</h2>
          <span className="muted" style={{ fontSize: '0.85rem' }}>
            {stats.totalWords} kelimenin ustalık derecesi
          </span>
        </div>

        {/* Çok Renkli Yığılmış İlerleme Çubuğu */}
        <div className={styles.stackedBar} role="progressbar" aria-label="Öğrenme seviyeleri">
          {([1, 2, 3, 4, 5] as MasteryLevel[]).map((score) => {
            const count = stats.levelCounts[score]
            const pct = (count / totalCards) * 100
            if (pct === 0) return null
            return (
              <div
                key={score}
                className={styles.stackedSegment}
                style={{
                  width: `${pct}%`,
                  backgroundColor: MASTERY_CONFIG[score].color,
                }}
                title={`${MASTERY_CONFIG[score].label}: ${count} kelime (%${Math.round(pct)})`}
              />
            )
          })}
        </div>

        {/* Seviye Detay Açıklamaları */}
        <div className={styles.legendGrid}>
          {([1, 2, 3, 4, 5] as MasteryLevel[]).map((score) => {
            const conf = MASTERY_CONFIG[score]
            const count = stats.levelCounts[score]
            const pct = Math.round((count / totalCards) * 100)
            return (
              <div key={score} className={styles.legendItem}>
                <span className={styles.legendDot} style={{ backgroundColor: conf.color }} />
                <div className={styles.legendInfo}>
                  <span className={styles.legendLabel}>
                    {conf.badge} {conf.label}
                  </span>
                  <span className={styles.legendCount}>
                    {count} kelime (%{pct})
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* 3. FSRS GELECEK TEKRAR TAKVİMİ */}
      <section className={styles.sectionCard}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Aralıklı Tekrar Takvimi (FSRS)</h2>
          <Link to="/study" className="btn btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
            Şimdi Tekrar Et →
          </Link>
        </div>
        <p className="muted" style={{ fontSize: '0.85rem', margin: 0 }}>
          Hafıza eğrisine göre önümüzdeki günlerde tekrar edilmesi planlanan kelime sayıları:
        </p>

        <div className={styles.calendarRow}>
          <div className={styles.calendarBlock}>
            <span className={`${styles.calendarNum} ${stats.schedule.dueNow > 0 ? styles.calendarNumActive : ''}`}>
              {stats.schedule.dueNow}
            </span>
            <span className={styles.calendarLbl}>Bugün / Günü Geçen</span>
          </div>
          <div className={styles.calendarBlock}>
            <span className={styles.calendarNum}>{stats.schedule.dueTomorrow}</span>
            <span className={styles.calendarLbl}>Yarın</span>
          </div>
          <div className={styles.calendarBlock}>
            <span className={styles.calendarNum}>{stats.schedule.dueThreeDays}</span>
            <span className={styles.calendarLbl}>3 Gün İçinde</span>
          </div>
          <div className={styles.calendarBlock}>
            <span className={styles.calendarNum}>{stats.schedule.dueSevenDays}</span>
            <span className={styles.calendarLbl}>7 Gün İçinde</span>
          </div>
          <div className={styles.calendarBlock}>
            <span className={styles.calendarNum}>{stats.schedule.dueLater}</span>
            <span className={styles.calendarLbl}>Daha Sonra</span>
          </div>
        </div>
      </section>

      {/* 4. EN ÇOK ZORLANILAN KELİMELER */}
      {stats.troubleCards.length > 0 && (
        <section className={styles.sectionCard}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>En Çok Yanıldıklarım & Zorlananlar</h2>
            <span className="muted" style={{ fontSize: '0.85rem' }}>
              En çok hata yapılan kelimeler
            </span>
          </div>

          <div className={styles.tableWrapper}>
            <table className={styles.troubleTable}>
              <thead>
                <tr>
                  <th>Kelime</th>
                  <th>Türkçe Anlamı</th>
                  <th>Hata Sayısı</th>
                  <th>Mevcut Puan</th>
                  <th style={{ textAlign: 'right' }}>Ses</th>
                </tr>
              </thead>
              <tbody>
                {stats.troubleCards.map(({ card, word }) => {
                  if (!word) return null
                  const score = (card.masteryScore as MasteryLevel) || 1
                  return (
                    <tr key={card.id}>
                      <td>
                        <strong>{word.term}</strong>
                      </td>
                      <td>{word.definition}</td>
                      <td>
                        <span style={{ color: 'var(--danger)', fontWeight: 700 }}>
                          {card.lapses || 0} kez
                        </span>
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            padding: '0.15rem 0.45rem',
                            borderRadius: '4px',
                            backgroundColor: 'color-mix(in srgb, var(--input-bg) 80%, transparent)',
                            border: '1px solid var(--border)',
                          }}
                        >
                          {MASTERY_CONFIG[score].badge}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{ padding: '0.2rem 0.5rem' }}
                          onClick={() => speakWord(word.term)}
                          title="Dinle"
                        >
                          🔊
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 5. TÜR VE KATEGORİ DAĞILIMI */}
      <section className={styles.sectionCard}>
        <h2 className={styles.sectionTitle}>Kelime Türleri ve Kategoriler</h2>

        <div>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>
            Kelime Türleri:
          </span>
          <div className={styles.pillGrid}>
            {Object.entries(stats.posCounts).map(([pos, count]) => (
              <span key={pos} className={styles.pillItem}>
                <span>{POS_LABELS[pos as PartOfSpeech] || pos}</span>
                <span className={styles.pillCount}>{count}</span>
              </span>
            ))}
          </div>
        </div>

        {Object.keys(stats.tagCounts).length > 0 && (
          <div style={{ marginTop: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>
              Etiketler & Alanlar:
            </span>
            <div className={styles.pillGrid}>
              {Object.entries(stats.tagCounts).map(([tag, count]) => (
                <span key={tag} className={styles.pillItem}>
                  <span>#{tag}</span>
                  <span className={styles.pillCount}>{count}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </section>
    </section>
  )
}
