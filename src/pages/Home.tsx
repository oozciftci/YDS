import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { ALL_WORD_PACKS } from '../data/wordPacks'
import { speakWord } from '../services/tts'
import { createWord } from '../services/words'
import { useUserStore } from '../stores/user'
import { useSyncStatus } from '../services/sync'
import { useSettings } from '../stores/settings'
import styles from './Home.module.css'

export function HomePage() {
  const navigate = useNavigate()
  const activeUser = useUserStore((s) => s.activeUser)
  const activeUserId = activeUser?.id || 'user_ozgur'
  const sync = useSyncStatus()
  const exam = useSettings((s) => s.exam)

  // Sınava kalan gün
  const daysToExam = useMemo(() => {
    if (!exam?.targetExamDate) return null
    const target = new Date(exam.targetExamDate).getTime()
    const now = new Date(nowTimestamp).getTime()
    const diff = Math.ceil((target - now) / (1000 * 60 * 60 * 24))
    return Math.max(0, diff)
  }, [exam?.targetExamDate, nowTimestamp])

  // Kullanıcının kayıtlı aktif kelimeleri
  const words = useLiveQuery(
    () => db.words.where('userId').equals(activeUserId).filter((w) => !w.isDeleted).toArray(),
    [activeUserId],
    [],
  )

  // Kart durumları
  const cardStates = useLiveQuery(
    () => db.cardStates.where('userId').equals(activeUserId).toArray(),
    [activeUserId],
    [],
  )

  const [nowTimestamp] = useState(() => Date.now())

  // Tekrar kayıtları (Bugünkü tekrarlar & seri için)
  const reviewLogs = useLiveQuery(
    () => db.reviewLogs.where('userId').equals(activeUserId).toArray(),
    [activeUserId],
    [],
  )

  // Metrikler
  const { dueCount, todayReviewsCount, streakDays, masteryCounts, dailyGoal } = useMemo(() => {
    const nowIso = new Date(nowTimestamp).toISOString()
    const todayPrefix = nowIso.slice(0, 10)

    // Tekrarı gelen kart sayısı
    const due = cardStates.filter((c) => c.due <= nowIso).length

    // Bugünkü yapılan tekrar sayısı
    const todayReviews = reviewLogs.filter((r) => r.reviewedAt.startsWith(todayPrefix)).length

    // Seri (Streak) hesaplama: ardışık gün sayısı
    const daysWithReview = new Set<string>()
    for (const r of reviewLogs) {
      daysWithReview.add(r.reviewedAt.slice(0, 10))
    }

    let streak = 0
    const cursor = new Date(nowTimestamp)
    // Bugün henüz çalışılmadıysa dünden itibaren seriye bak
    if (!daysWithReview.has(cursor.toISOString().slice(0, 10))) {
      cursor.setDate(cursor.getDate() - 1)
    }

    while (daysWithReview.has(cursor.toISOString().slice(0, 10))) {
      streak++
      cursor.setDate(cursor.getDate() - 1)
    }

    // Hakimiyet dağılımı (1-5)
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    for (const c of cardStates) {
      const s = (c.masteryScore as 1 | 2 | 3 | 4 | 5) || 1
      if (counts[s] !== undefined) counts[s]++
      else counts[1]++
    }

    return {
      dueCount: due,
      todayReviewsCount: todayReviews,
      streakDays: streak,
      masteryCounts: counts,
      dailyGoal: exam?.dailyGoal || 20,
    }
  }, [cardStates, reviewLogs, nowTimestamp, exam?.dailyGoal])

  // Günün YDS Kelimesi (Word of the Day)
  const wordOfTheDay = useMemo(() => {
    const allAcademicWords = ALL_WORD_PACKS[0]?.words || []
    if (allAcademicWords.length === 0) return null

    // Günün tarihine göre deterministik seçim
    const now = new Date(nowTimestamp)
    const startOfYear = new Date(now.getFullYear(), 0, 0)
    const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24))
    const index = dayOfYear % allAcademicWords.length
    return allAcademicWords[index]
  }, [nowTimestamp])

  // Günün kelimesi kullanıcının destesinde var mı?
  const isWotdInDeck = useMemo(() => {
    if (!wordOfTheDay) return false
    return words.some((w) => w.term.toLowerCase() === wordOfTheDay.term.toLowerCase())
  }, [wordOfTheDay, words])

  const [addedWotd, setAddedWotd] = useState(false)
  const [showWotdTr, setShowWotdTr] = useState(false)

  async function handleAddWotd() {
    if (!wordOfTheDay || isWotdInDeck || addedWotd) return
    await createWord(activeUserId, wordOfTheDay)
    setAddedWotd(true)
  }

  // İlerleme yüzdesi
  const goalPercent = Math.min(100, Math.round((todayReviewsCount / dailyGoal) * 100))
  const totalCards = words.length

  const totalPending = sync.pendingOutboxCount + sync.pendingLogsCount

  return (
    <div className={styles.container}>
      {/* 1. ÜST KARŞILAMA, SINAV GERİ SAYIMI VE SERİ */}
      <section className={styles.welcomeSection}>
        <div className={styles.greeting}>
          <span className={styles.avatarBadge} style={{ backgroundColor: activeUser?.avatarColor || '#6366f1' }}>
            {activeUser?.displayName?.charAt(0) || 'Ö'}
          </span>
          <div>
            <h1 className={styles.userName}>Merhaba, {activeUser?.displayName || 'Öğrenci'} 👋</h1>
            <p className={styles.userSub}>
              {dueCount > 0
                ? `Bugün hafızanı tazelemek için ${dueCount} kelime tekrar bekliyor.`
                : 'Harika gidiyorsun! Günlük tekrarlarını tamamladın.'}
            </p>
          </div>
        </div>

        <div className={styles.badgesRight}>
          {/* Sınav Geri Sayımı Rozeti */}
          {daysToExam !== null && (
            <Link to="/settings#exam" className={styles.examBadge} title="Hedef Sınav Ayarlarını Düzenle">
              <span className={styles.examIcon}>🎯</span>
              <div className={styles.examText}>
                <strong>{daysToExam} Gün Kaldı</strong>
                <span>{exam?.targetExamName || 'YDS'} (Hedef: {exam?.targetScore || 80})</span>
              </div>
            </Link>
          )}

          {/* Seri Rozeti */}
          <div className={styles.streakBadge} title="Ardışık gün serisi">
            <span className={styles.streakFlame}>🔥</span>
            <div className={styles.streakText}>
              <strong>{streakDays} Gün</strong>
              <span>Seri</span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. GÜNLÜK ODAK HERO KARTI (ANA ÇALIŞMA BUTONU) */}
      <section className={styles.heroCard}>
        <div className={styles.heroContent}>
          <div className={styles.heroBadge}>
            {dueCount > 0 ? '⚡ FSRS Tekrar Zamanı' : '🎯 Yeni Bilgi Keşfi'}
          </div>
          <h2 className={styles.heroTitle}>
            {dueCount > 0
              ? `${dueCount} Kelime Tekrar Edilmeyi Bekliyor`
              : 'Bugünkü Tekrarlarını Bitirdin!'}
          </h2>
          <p className={styles.heroDesc}>
            {dueCount > 0
              ? 'Aralıklı tekrar algoritması, kelimeleri unutulmaya yüz tuttuğu anda önüne getirir. 5 dakikanı ayır ve pekiştir.'
              : 'Harika bir disiplin! Dilersen öğrenme aşamasındaki kelimeleri çalışabilir veya yeni kelime paketleri ekleyebilirsin.'}
          </p>

          <div className={styles.heroActions}>
            {dueCount > 0 ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => navigate('/study?preset=due&auto=1')}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" />
                </svg>
                Tekrarları Başlat ({dueCount} Kelime)
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => navigate('/study?preset=learning&auto=1')}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <circle cx="12" cy="12" r="10" />
                  <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" />
                </svg>
                Öğrenilenleri Pekiştir
              </button>
            )}
            <Link to="/words" className="btn btn-ghost">
              Kelime Havuzuna Git ({totalCards}) →
            </Link>
          </div>
        </div>

        {/* Günlük Hedef Göstergesi */}
        <div className={styles.goalBox}>
          <div className={styles.goalHeader}>
            <span className={styles.goalLabel}>Günlük Tekrar Hedefi</span>
            <span className={styles.goalCount}>
              <strong>{todayReviewsCount}</strong> / {dailyGoal}
            </span>
          </div>
          <div className={styles.progressBarBg}>
            <div className={styles.progressBarFill} style={{ width: `${goalPercent}%` }} />
          </div>
          <span className={styles.goalPercentText}>%{goalPercent} tamamlandı</span>
        </div>
      </section>

      {/* 3. HIZLI ÇALIŞMA MODLARI (4 KART) */}
      <section className={styles.modesSection}>
        <div className={styles.sectionHeader}>
          <h2>Hızlı Çalışma Modları</h2>
          <span className="muted">Sınav hedefine göre odaklan</span>
        </div>

        <div className={styles.modesGrid}>
          {/* Mod 1: FSRS Akıllı Tekrar */}
          <div
            className={styles.modeCard}
            onClick={() => navigate('/study?preset=due&auto=1')}
            role="button"
            tabIndex={0}
          >
            <div className={`${styles.modeIcon} ${styles.iconPurple}`}>⚡</div>
            <div className={styles.modeInfo}>
              <h3>FSRS Akıllı Tekrar</h3>
              <p>Unutma eğrisine göre zamanı gelen kelimeleri tazele.</p>
            </div>
            <span className={styles.modeAction}>Başla →</span>
          </div>

          {/* Mod 2: Eş Anlamlı Eşleştirmece (YENİ OYUN MODU) */}
          <div
            className={styles.modeCard}
            onClick={() => navigate('/match')}
            role="button"
            tabIndex={0}
          >
            <div className={`${styles.modeIcon} ${styles.iconTeal}`}>🎮</div>
            <div className={styles.modeInfo}>
              <h3>Eş Anlamlı Eşleştirmece</h3>
              <p>İngilizce eş anlamlıları hızlıca eşleştir, kombo yap.</p>
            </div>
            <span className={styles.modeAction}>Oyna →</span>
          </div>

          {/* Mod 3: 10 Soruluk Mini YDS Denemesi (YENİ ÖSYM TESTİ) */}
          <div
            className={styles.modeCard}
            onClick={() => navigate('/quiz')}
            role="button"
            tabIndex={0}
          >
            <div className={`${styles.modeIcon} ${styles.iconBlue}`}>📝</div>
            <div className={styles.modeInfo}>
              <h3>Mini YDS Denemesi</h3>
              <p>ÖSYM formatında 10 soruluk süreli kelime testi çöz.</p>
            </div>
            <span className={styles.modeAction}>Test Çöz →</span>
          </div>

          {/* Mod 4: Cümle İçi Boşluk Doldurma (Cloze) */}
          <div
            className={styles.modeCard}
            onClick={() => navigate('/study?mode=cloze&auto=1')}
            role="button"
            tabIndex={0}
          >
            <div className={`${styles.modeIcon} ${styles.iconAmber}`}>🧩</div>
            <div className={styles.modeInfo}>
              <h3>Cümle İçi Cloze Test</h3>
              <p>Akademik cümle bağlamında doğru kelimeyi bul.</p>
            </div>
            <span className={styles.modeAction}>Başla →</span>
          </div>
        </div>
      </section>

      {/* 4. GÜNÜN YDS KELİMESİ & SEVİYE ÖZETİ */}
      <div className={styles.bottomSplit}>
        {/* Günün Kelimesi */}
        {wordOfTheDay && (
          <section className={styles.wotdCard}>
            <div className={styles.wotdHeader}>
              <span className={styles.wotdTag}>💡 Günün YDS Kelimesi</span>
              <button
                type="button"
                className={styles.speakBtn}
                onClick={() => speakWord(wordOfTheDay.term)}
                title="Telaffuzu Dinle"
                aria-label="Sesli telaffuz"
              >
                🔊
              </button>
            </div>

            <div className={styles.wotdBody}>
              <div className={styles.wotdTermRow}>
                <h3 className={styles.wotdTerm}>{wordOfTheDay.term}</h3>
                <span className={styles.wotdPos}>{wordOfTheDay.partOfSpeech}</span>
              </div>

              <p className={styles.wotdDef}>{wordOfTheDay.definition}</p>

              {wordOfTheDay.synonyms && wordOfTheDay.synonyms.length > 0 && (
                <div className={styles.synonymsRow}>
                  <span className={styles.synLabel}>Eş anlamlılar:</span>
                  <div className={styles.synChips}>
                    {wordOfTheDay.synonyms.slice(0, 4).map((s: string) => (
                      <span key={s} className={styles.synChip}>
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {wordOfTheDay.sentences && wordOfTheDay.sentences[0] && (
                <div className={styles.exampleSentence}>
                  <p className={styles.enSentence}>“{wordOfTheDay.sentences[0].en}”</p>
                  {showWotdTr ? (
                    <p className={styles.trSentence}>{wordOfTheDay.sentences[0].tr}</p>
                  ) : (
                    <button
                      type="button"
                      className={styles.showTransBtn}
                      onClick={() => setShowWotdTr(true)}
                    >
                      Çeviriyi göster ↓
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className={styles.wotdFooter}>
              {isWotdInDeck || addedWotd ? (
                <span className={styles.inDeckLabel}>✓ Havuzunda Kayıtlı</span>
              ) : (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => void handleAddWotd()}
                >
                  + Havuzuma Ekle
                </button>
              )}
            </div>
          </section>
        )}

        {/* Hakimiyet Seviyesi Dağılımı */}
        <section className={styles.masteryCard}>
          <div className={styles.masteryHeader}>
            <h3>Kelime Hakimiyeti Dağılımın</h3>
            <Link to="/stats" className={styles.statsLink}>
              Detaylı İstatistikler →
            </Link>
          </div>

          <div className={styles.masteryBars}>
            <MasteryRow level={5} label="Tamamen Öğrendim" count={masteryCounts[5]} total={totalCards} color="#10b981" />
            <MasteryRow level={4} label="Baya Öğrendim" count={masteryCounts[4]} total={totalCards} color="#3b82f6" />
            <MasteryRow level={3} label="Geliştirmeye Muhtaç" count={masteryCounts[3]} total={totalCards} color="#eab308" />
            <MasteryRow level={2} label="Biraz Öğrendim" count={masteryCounts[2]} total={totalCards} color="#f97316" />
            <MasteryRow level={1} label="Hiç Bilmiyorum" count={masteryCounts[1]} total={totalCards} color="#ef4444" />
          </div>

          <div className={styles.totalWordsFoot}>
            <span>Toplam Aktif Kelime: <strong>{totalCards}</strong></span>
          </div>
        </section>
      </div>

      {/* 5. MİNİMAL SİSTEM DURUM BİLGİSİ (DİKKAT DAĞITMAYAN FOOTER) */}
      <footer className={styles.systemFooter}>
        <div className={styles.systemStatus}>
          <span className={styles.statusDot} />
          <span>Çevrimdışı Çalışmaya Hazır</span>
          {totalPending > 0 ? (
            <span className={styles.pendingText}>• {totalPending} eşitlenmeyi bekleyen veri</span>
          ) : (
            <span className={styles.syncedText}>• Eşitlendi ✓</span>
          )}
        </div>
        <Link to="/settings" className={styles.settingsLink}>
          Sistem ve Senkronizasyon Ayarları
        </Link>
      </footer>
    </div>
  )
}

function MasteryRow(props: {
  level: number
  label: string
  count: number
  total: number
  color: string
}) {
  const pct = props.total > 0 ? Math.round((props.count / props.total) * 100) : 0
  return (
    <div className={styles.masteryRow}>
      <div className={styles.masteryLabelCol}>
        <span className={styles.levelBadge} style={{ backgroundColor: `${props.color}22`, color: props.color }}>
          {props.level}
        </span>
        <span className={styles.masteryName}>{props.label}</span>
      </div>
      <div className={styles.barTrack}>
        <div
          className={styles.barFill}
          style={{ width: `${pct}%`, backgroundColor: props.color }}
        />
      </div>
      <span className={styles.masteryCount}>{props.count}</span>
    </div>
  )
}
