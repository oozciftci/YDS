import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { ALL_WORD_PACKS } from '../data/wordPacks'
import { speakWord } from '../services/tts'
import { createWord } from '../services/words'
import { formatLevelStudyTitle } from '../services/groups'
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

  // Zaman damgası (bağımlılık sırası için en başta)
  const [nowTimestamp] = useState(() => Date.now())

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

  // Tekrar kayıtları (Bugünkü tekrarlar & seri için)
  const reviewLogs = useLiveQuery(
    () => db.reviewLogs.where('userId').equals(activeUserId).toArray(),
    [activeUserId],
    [],
  )

  // Oturum logları (Grup bazlı çalışma geçmişi)
  const sessionLogs = useLiveQuery(
    () => db.sessionLogs.where('userId').equals(activeUserId).toArray(),
    [activeUserId],
    [],
  )

  // 20'şer kelimelik seviye ilerleme kayıtları
  const levelProgressList = useLiveQuery(
    () => db.levelProgress.where('userId').equals(activeUserId).toArray(),
    [activeUserId],
    [],
  )

  const inProgressLevels = useMemo(() => {
    return levelProgressList
      .filter((p) => p.status === 'in_progress')
      .sort((a, b) => b.lastStudiedAt.localeCompare(a.lastStudiedAt))
  }, [levelProgressList])

  const todayCompletedLevels = useMemo(() => {
    const todayPrefix = new Date(nowTimestamp).toISOString().slice(0, 10)
    return levelProgressList
      .filter((p) => p.status === 'completed' && p.lastStudiedAt.startsWith(todayPrefix))
      .sort((a, b) => b.lastStudiedAt.localeCompare(a.lastStudiedAt))
  }, [levelProgressList, nowTimestamp])

  const todaySessions = useMemo(() => {
    const todayPrefix = new Date(nowTimestamp).toISOString().slice(0, 10)
    return sessionLogs
      .filter((s) => s.startedAt.startsWith(todayPrefix))
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  }, [sessionLogs, nowTimestamp])

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

  // Günün YDS Kelimesi
  const wordOfTheDay = useMemo(() => {
    const allAcademicWords = ALL_WORD_PACKS[0]?.words || []
    if (allAcademicWords.length === 0) return null

    const now = new Date(nowTimestamp)
    const startOfYear = new Date(now.getFullYear(), 0, 0)
    const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24))
    const index = dayOfYear % allAcademicWords.length
    return allAcademicWords[index]
  }, [nowTimestamp])

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

  const goalPercent = Math.min(100, Math.round((todayReviewsCount / dailyGoal) * 100))
  const totalCards = words.length
  const totalPending = sync.pendingOutboxCount + sync.pendingLogsCount

  return (
    <div className={styles.container}>
      {/* 1. ÜST BİLGİ & KARŞILAMA BARI */}
      <header className={styles.topBar}>
        <div className={styles.userProfile}>
          <span
            className={styles.avatar}
            style={{ backgroundColor: activeUser?.avatarColor || 'var(--primary)' }}
          >
            {activeUser?.displayName?.charAt(0) || 'Ö'}
          </span>
          <div className={styles.userMeta}>
            <h1 className={styles.title}>Merhaba, {activeUser?.displayName || 'Öğrenci'} 👋</h1>
            <p className={styles.subtitle}>
              {dueCount > 0
                ? `Bugün ${dueCount} kelime tekrar edilmeyi bekliyor.`
                : 'Tebrikler! Bugünkü tekrarlarını tamamladın.'}
            </p>
          </div>
        </div>

        <div className={styles.badgeGroup}>
          {daysToExam !== null && (
            <Link to="/settings#exam" className={styles.examBadge} title="Hedef Sınav Ayarlarını Düzenle">
              <span className={styles.badgeIcon}>🎯</span>
              <div className={styles.badgeInfo}>
                <span className={styles.badgeValue}>{daysToExam} Gün</span>
                <span className={styles.badgeLabel}>{exam?.targetExamName || 'YDS'}</span>
              </div>
            </Link>
          )}

          <div className={styles.streakBadge} title="Ardışık çalışma serisi">
            <span className={styles.badgeIcon}>🔥</span>
            <div className={styles.badgeInfo}>
              <span className={styles.badgeValue}>{streakDays} Gün</span>
              <span className={styles.badgeLabel}>Seri</span>
            </div>
          </div>
        </div>
      </header>

      {/* 2. GÜNLÜK KOMUTA & ODAK KARTI */}
      <section className={styles.heroCard}>
        <div className={styles.heroLeft}>
          <span className={styles.heroBadge}>
            {dueCount > 0 ? '⚡ FSRS Aralıklı Tekrar' : '✨ Günlük Görev Tamam'}
          </span>
          <h2 className={styles.heroHeading}>
            {dueCount > 0
              ? `${dueCount} Kelime Hafızanı Tazelemeyi Bekliyor`
              : 'Bugünkü Tekrarlarını Tamamladın!'}
          </h2>
          <p className={styles.heroParagraph}>
            {dueCount > 0
              ? 'Aralıklı tekrar algoritması, kelimeleri unutulma eşiğinde önüne getirir. 5 dakikanı ayır ve pekiştir.'
              : 'Disiplinini koruyorsun! Yeni kelimeler keşfedebilir veya mini sınavla kendini test edebilirsin.'}
          </p>

          <div className={styles.heroActions}>
            {dueCount > 0 ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => navigate('/study?preset=due&auto=1')}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4">
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
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" />
                </svg>
                Öğrenilenleri Pekiştir
              </button>
            )}
            <Link to="/words" className="btn btn-secondary">
              Kelime Havuzu ({totalCards}) →
            </Link>
            {import.meta.env.DEV && (
              <Link to="/yds-sorular" className="btn btn-ghost" title="Yalnızca yerelde görünür">
                📖 YDS Soru Merkezi
              </Link>
            )}
          </div>
        </div>

        <div className={styles.heroRight}>
          <div className={styles.goalCard}>
            <div className={styles.goalTop}>
              <span className={styles.goalLabel}>Günlük Tekrar Hedefi</span>
              <span className={styles.goalRatio}>
                <strong>{todayReviewsCount}</strong> / {dailyGoal}
              </span>
            </div>
            <div className={styles.progressTrack}>
              <div className={styles.progressThumb} style={{ width: `${goalPercent}%` }} />
            </div>
            <span className={styles.goalPercent}>%{goalPercent} tamamlandı</span>
          </div>
        </div>
      </section>

      {/* 2.5. YARIDA BIRAKILANLAR, BUGÜN ÇALIŞILAN SEVİYELER & HIZLI ERİŞİM */}
      <section className={styles.sectionBlock}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>
              {inProgressLevels.length > 0
                ? '⚠️ Yarıda Bırakılan ve Bugün Çalışılan Seviyeler'
                : 'Bugün Çalışılan Seviyeler ve Gruplar'}
            </h2>
            <p className={styles.sectionDesc}>
              {inProgressLevels.length > 0
                ? `${inProgressLevels.length} seviye yarıda bırakıldı. Kaldığın yerden tek tıkla devam edebilirsin:`
                : todaySessions.length > 0
                ? `Bugün ${todaySessions.length} çalışma oturumu tamamladın. Detaylar ve doğru/yanlış oranların:`
                : "Her kategori 20'şer kelimelik seviyelere ayrıldı. Bir seviye seçip çalışmaya başla:"}
            </p>
          </div>

          <Link to="/study" className="btn btn-ghost" style={{ fontSize: '0.82rem' }}>
            Tüm Seviyeleri Gör →
          </Link>
        </div>

        {/* YARIDA BIRAKILAN SEVİYELER UYARISI & DEVAM BUTONU */}
        {inProgressLevels.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '0.85rem',
              marginBottom: '1rem',
            }}
          >
            {inProgressLevels.map((p) => (
              <div
                key={p.subGroupId}
                style={{
                  background: 'color-mix(in srgb, var(--warning) 8%, var(--surface))',
                  border: '1.5px solid var(--warning)',
                  borderRadius: 'var(--radius)',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      color: 'var(--warning)',
                      background: 'color-mix(in srgb, var(--warning) 20%, transparent)',
                      padding: '0.2rem 0.55rem',
                      borderRadius: '999px',
                    }}
                  >
                    ⏳ Yarıda Bırakıldı ({p.completedQuestions}/{p.totalQuestions})
                  </span>
                  <span className="muted" style={{ fontSize: '0.75rem' }}>
                    {new Date(p.lastStudiedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <strong style={{ fontSize: '1rem', color: 'var(--text)' }}>
                  {formatLevelStudyTitle(p.categoryGroupId, p.levelNumber, p.mode)}
                </strong>

                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ width: '100%', fontSize: '0.825rem', padding: '0.45rem 0.75rem' }}
                  onClick={() => navigate(`/study?subLevel=${p.subGroupId}&resume=1&auto=1`)}
                >
                  ▶ Kaldığın Yerden Devam Et ({p.completedQuestions + 1}. Soru) →
                </button>
              </div>
            ))}
          </div>
        )}

        {/* BUGÜN TAMAMLANAN 20'ŞERLİK SEVİYELER */}
        {todayCompletedLevels.length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--success)', marginBottom: '0.45rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span>✅ Bugün Tamamlanan Seviyeler ({todayCompletedLevels.length}):</span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {todayCompletedLevels.map((lvl) => (
                <div
                  key={lvl.subGroupId}
                  style={{
                    background: 'var(--surface-strong)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.4rem 0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    fontSize: '0.82rem',
                  }}
                >
                  <strong style={{ color: 'var(--text)' }}>
                    {formatLevelStudyTitle(lvl.categoryGroupId, lvl.levelNumber, lvl.mode)}
                  </strong>
                  <span style={{ color: 'var(--success)', fontWeight: 700 }}>%{lvl.accuracyPercent} Başarı</span>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ padding: '0.1rem 0.4rem', fontSize: '0.78rem' }}
                    onClick={() => navigate(`/study?subLevel=${lvl.subGroupId}&auto=1`)}
                    title="Tekrar Çalış"
                  >
                    🔄
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {todaySessions.length > 0 ? (
          <div className={styles.todaySessionsGrid}>
            {todaySessions.map((s) => (
              <div key={s.id} className={styles.todaySessionCard}>
                <div className={styles.sessionTopRow}>
                  <h3 className={styles.sessionTitle}>{s.groupName}</h3>
                  <span className={styles.sessionTime}>
                    {new Date(s.completedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div className={styles.sessionStatRow}>
                  <span><strong>{s.totalQuestions}</strong> soru</span>
                  <span style={{ color: 'var(--success)' }}>✓ {s.correctCount} doğru</span>
                  {s.wrongCount > 0 && <span style={{ color: 'var(--error)' }}>✕ {s.wrongCount} yanlış</span>}
                  <span
                    className={styles.accuracyBadge}
                    style={{
                      background: s.accuracyPercent >= 70 ? 'color-mix(in srgb, var(--success) 16%, transparent)' : 'color-mix(in srgb, var(--warning) 16%, transparent)',
                      color: s.accuracyPercent >= 70 ? 'var(--success)' : 'var(--warning)',
                    }}
                  >
                    %{s.accuracyPercent} Başarı
                  </span>
                </div>

                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ width: '100%', fontSize: '0.8rem', padding: '0.4rem 0.6rem' }}
                  onClick={() => {
                    if (s.subGroupId) {
                      navigate(`/study?subLevel=${s.subGroupId}&auto=1`)
                    } else {
                      navigate(`/study?group=${s.groupId}&auto=1`)
                    }
                  }}
                >
                  Bu Seviyeyi Tekrar Çalış →
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.levelPillsRow}>
            <button
              type="button"
              className={styles.levelPillBtn}
              onClick={() => navigate('/study?group=level_c1_c2')}
            >
              <span>🎯</span>
              <span>C1-C2 İleri Düzey (45 Level)</span>
            </button>
            <button
              type="button"
              className={styles.levelPillBtn}
              onClick={() => navigate('/study?group=level_b1_b2')}
            >
              <span>📘</span>
              <span>B1-B2 Orta Düzey (92 Level)</span>
            </button>
            <button
              type="button"
              className={styles.levelPillBtn}
              onClick={() => navigate('/study?group=level_a1_a2')}
            >
              <span>🌱</span>
              <span>A1-A2 Başlangıç (71 Level)</span>
            </button>
            <button
              type="button"
              className={styles.levelPillBtn}
              onClick={() => navigate('/study?group=yds_phrasal')}
            >
              <span>⚡</span>
              <span>Phrasal Verbs (7 Level)</span>
            </button>
            <button
              type="button"
              className={styles.levelPillBtn}
              onClick={() => navigate('/study?group=yds_conjunction')}
            >
              <span>🔗</span>
              <span>Bağlaçlar (3 Level)</span>
            </button>
            <button
              type="button"
              className={styles.levelPillBtn}
              onClick={() => navigate('/study?preset=due&auto=1')}
            >
              <span>🧠</span>
              <span>FSRS Günün Tekrarları</span>
            </button>
          </div>
        )}
      </section>

      {/* 3. ÇALIŞMA & SINAV MODLARI MERKEZİ (DENGELİ 4 KART) */}
      <section className={styles.sectionBlock}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>Çalışma & Sınav Modları</h2>
            <p className={styles.sectionDesc}>YDS soru tiplerine ve ihtiyacına göre pratik yap</p>
          </div>
        </div>

        <div className={styles.modesGrid}>
          {/* Mod 1: FSRS Akıllı Tekrar */}
          <div
            className={styles.modeCard}
            onClick={() => navigate('/study?preset=due&auto=1')}
            role="button"
            tabIndex={0}
          >
            <div className={`${styles.modeIcon} ${styles.iconIndigo}`}>⚡</div>
            <div className={styles.modeBody}>
              <div className={styles.modeHeadRow}>
                <h3>FSRS Akıllı Tekrar</h3>
                <span className={styles.modePill}>Hafıza</span>
              </div>
              <p>Unutma eğrisine göre zamanı gelen kelimeleri tazele.</p>
            </div>
            <span className={styles.modeArrow}>→</span>
          </div>

          {/* Mod 2: Eş Anlamlı Eşleştirmece */}
          <div
            className={styles.modeCard}
            onClick={() => navigate('/match')}
            role="button"
            tabIndex={0}
          >
            <div className={`${styles.modeIcon} ${styles.iconTeal}`}>🎮</div>
            <div className={styles.modeBody}>
              <div className={styles.modeHeadRow}>
                <h3>Eş Anlamlı Eşleştirme</h3>
                <span className={styles.modePill}>Oyunlaştırma</span>
              </div>
              <p>Sınavda en çok çıkan akademik eş anlamlıları hızlıca eşleştir.</p>
            </div>
            <span className={styles.modeArrow}>→</span>
          </div>

          {/* Mod 3: Mini YDS Denemesi */}
          <div
            className={styles.modeCard}
            onClick={() => navigate('/quiz')}
            role="button"
            tabIndex={0}
          >
            <div className={`${styles.modeIcon} ${styles.iconSky}`}>📝</div>
            <div className={styles.modeBody}>
              <div className={styles.modeHeadRow}>
                <h3>Mini YDS Denemesi</h3>
                <span className={styles.modePill}>10 Soru • ÖSYM</span>
              </div>
              <p>ÖSYM formatında 10 soruluk süreli kelime denemesi çöz.</p>
            </div>
            <span className={styles.modeArrow}>→</span>
          </div>

          {/* Mod 4: Cümle İçi Cloze Test */}
          <div
            className={styles.modeCard}
            onClick={() => navigate('/study?mode=cloze&auto=1')}
            role="button"
            tabIndex={0}
          >
            <div className={`${styles.modeIcon} ${styles.iconAmber}`}>🧩</div>
            <div className={styles.modeBody}>
              <div className={styles.modeHeadRow}>
                <h3>Cümle İçi Boşluk</h3>
                <span className={styles.modePill}>Bağlam</span>
              </div>
              <p>Akademik cümle bağlamında doğru kelimeyi tamamla.</p>
            </div>
            <span className={styles.modeArrow}>→</span>
          </div>
        </div>
      </section>

      {/* 4. ALT 2 SÜTUN: GÜNÜN KELİMESİ & HAKİMİYET DAĞILIMI */}
      <div className={styles.splitGrid}>
        {/* Sol Sütun: Günün Kelimesi */}
        {wordOfTheDay && (
          <section className={styles.wotdCard}>
            <div className={styles.wotdTop}>
              <span className={styles.wotdBadge}>💡 Günün YDS Kelimesi</span>
              <button
                type="button"
                className={styles.soundButton}
                onClick={() => speakWord(wordOfTheDay.term)}
                title="Telaffuzu Dinle"
                aria-label="Sesli telaffuz"
              >
                🔊
              </button>
            </div>

            <div className={styles.wotdMain}>
              <div className={styles.wotdWordLine}>
                <h3 className={styles.wotdWord}>{wordOfTheDay.term}</h3>
                <span className={styles.wotdPos}>{wordOfTheDay.partOfSpeech}</span>
              </div>

              <p className={styles.wotdDefinition}>{wordOfTheDay.definition}</p>

              {wordOfTheDay.synonyms && wordOfTheDay.synonyms.length > 0 && (
                <div className={styles.synonymsList}>
                  <span className={styles.synonymsLabel}>Eş anlamlılar:</span>
                  <div className={styles.synonymsTags}>
                    {wordOfTheDay.synonyms.slice(0, 4).map((s: string) => (
                      <span key={s} className={styles.synonymChip}>
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {wordOfTheDay.sentences && wordOfTheDay.sentences[0] && (
                <div className={styles.sentenceBlock}>
                  <p className={styles.enSentence}>“{wordOfTheDay.sentences[0].en}”</p>
                  {showWotdTr ? (
                    <p className={styles.trSentence}>{wordOfTheDay.sentences[0].tr}</p>
                  ) : (
                    <button
                      type="button"
                      className={styles.revealButton}
                      onClick={() => setShowWotdTr(true)}
                    >
                      Türkçe çeviriyi göster ↓
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className={styles.wotdBottom}>
              {isWotdInDeck || addedWotd ? (
                <span className={styles.savedLabel}>✓ Havuzunda Kayıtlı</span>
              ) : (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => void handleAddWotd()}
                >
                  + Havuzuma Ekle
                </button>
              )}
            </div>
          </section>
        )}

        {/* Sağ Sütun: Kelime Hakimiyeti Dağılımı */}
        <section className={styles.masteryCard}>
          <div className={styles.masteryTop}>
            <div>
              <h3 className={styles.masteryHeading}>Kelime Hakimiyeti</h3>
              <p className={styles.masterySub}>Hafızandaki kalıcılık seviyeleri</p>
            </div>
            <Link to="/stats" className={styles.detailLink}>
              Detaylar →
            </Link>
          </div>

          <div className={styles.masteryList}>
            <MasteryItem level={5} label="Tamamen Öğrendim" count={masteryCounts[5]} total={totalCards} color="var(--success)" />
            <MasteryItem level={4} label="İyi Biliyorum" count={masteryCounts[4]} total={totalCards} color="var(--info)" />
            <MasteryItem level={3} label="Geliştirilmeli" count={masteryCounts[3]} total={totalCards} color="var(--yellow)" />
            <MasteryItem level={2} label="Yeni Başlandı" count={masteryCounts[2]} total={totalCards} color="var(--orange)" />
            <MasteryItem level={1} label="Hiç Bilmiyorum" count={masteryCounts[1]} total={totalCards} color="var(--danger)" />
          </div>

          <div className={styles.masteryFooter}>
            <span>Toplam Kayıtlı Kelime:</span>
            <strong>{totalCards} Kelime</strong>
          </div>
        </section>
      </div>

      {/* 5. SİSTEM DURUM BİLGİSİ (KOMPAKT ŞERİT) */}
      <footer className={styles.statusBar}>
        <div className={styles.statusLeft}>
          <span className={styles.statusIndicator} />
          <span>Çevrimdışı Çalışmaya Hazır</span>
          {totalPending > 0 ? (
            <span className={styles.pendingBadge}>• {totalPending} eşitlenmeyi bekleyen işlem</span>
          ) : (
            <span className={styles.syncedBadge}>• Eşitlendi ✓</span>
          )}
        </div>
        <Link to="/settings" className={styles.settingsLink}>
          Ayarlar ve Yedekleme →
        </Link>
      </footer>
    </div>
  )
}

function MasteryItem(props: {
  level: number
  label: string
  count: number
  total: number
  color: string
}) {
  const pct = props.total > 0 ? Math.round((props.count / props.total) * 100) : 0
  return (
    <div className={styles.masteryRow}>
      <div className={styles.masteryLabelGroup}>
        <span
          className={styles.levelTag}
          style={{ backgroundColor: `${props.color}20`, color: props.color }}
        >
          L{props.level}
        </span>
        <span className={styles.masteryName}>{props.label}</span>
      </div>
      <div className={styles.barBackground}>
        <div
          className={styles.barProgress}
          style={{ width: `${pct}%`, backgroundColor: props.color }}
        />
      </div>
      <span className={styles.masteryNumber}>{props.count}</span>
    </div>
  )
}
