import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { ALL_WORD_PACKS } from '../data/wordPacks'
import { speakWord } from '../services/tts'
import { createWord } from '../services/words'
import { formatLevelStudyTitle } from '../services/groups'
import { useUserStore } from '../stores/user'
import { useSettings } from '../stores/settings'
import { buildDailyPlan, planPercent } from '../services/dailyPlan'
import { dayKey, daysUntil, streakFromDays } from '../services/dates'
import { summarizeBySection } from '../services/examProgress'
import { getSection, isYokdil } from '../services/ydsSections'
import { buildTargetPlan } from '../services/targetPlan'
import { STUDY_CATEGORIES } from '../services/studyMap'
import { QuickLinks } from '../components/QuickLinks'
import { DailyStory } from '../components/DailyStory'
import { getDoneUnits, unitsDoneToday } from '../services/bookProgress'
import { dismiss, useDismissed } from '../services/dismissed'
import type { CardState, ReviewLog } from '../types/database'
import styles from './Home.module.css'
import { hasLocalContent } from '../services/localContent'
import { Avatar } from '../components/Avatar'

const NO_CARDS: CardState[] = []
const NO_LOGS: ReviewLog[] = []

export function HomePage() {
  const navigate = useNavigate()
  const activeUser = useUserStore((s) => s.activeUser)
  const activeUserId = activeUser?.id || 'user_ozgur'
  const exam = useSettings((s) => s.exam)

  // Zaman damgası (bağımlılık sırası için en başta)
  const [nowTimestamp] = useState(() => Date.now())

  // Sınava kalan gün
  const daysToExam = useMemo(
    () => daysUntil(exam?.targetExamDate ?? '', nowTimestamp),
    [exam?.targetExamDate, nowTimestamp],
  )

  // Kullanıcının kayıtlı aktif kelimeleri
  const words = useLiveQuery(
    () => db.words.where('userId').equals(activeUserId).filter((w) => !w.isDeleted).toArray(),
    [activeUserId],
    [],
  )

  // Kart durumları ve tekrar kayıtları tek sorguda: yüklenene kadar undefined kalır, böylece
  // plan boş listeyle bir an "tamamlandı" görünmez
  const studyData = useLiveQuery(
    async () => ({
      cards: await db.cardStates.where('userId').equals(activeUserId).toArray(),
      logs: await db.reviewLogs.where('userId').equals(activeUserId).toArray(),
    }),
    [activeUserId],
  )
  const cardStates = studyData?.cards ?? NO_CARDS
  const reviewLogs = studyData?.logs ?? NO_LOGS

  // Çıkmış soru cevapları (yalnızca soru kimliği; plan ve seri için)
  const examAnswers = useLiveQuery(
    () => db.examAnswers.where('userId').equals(activeUserId).toArray(),
    [activeUserId],
    [],
  )

  // 20'şer kelimelik seviye ilerleme kayıtları
  const levelProgressList = useLiveQuery(
    () => db.levelProgress.where('userId').equals(activeUserId).toArray(),
    [activeUserId],
    [],
  )

  // × ile kaldırılanlar (Kelime çalışmasındaki "Son çalışılanlar" ile ortak liste)
  const isDismissed = useDismissed(activeUserId, 'recent-levels')
  const inProgressLevels = useMemo(() => {
    return levelProgressList
      .filter((p) => p.status === 'in_progress')
      .sort((a, b) => b.lastStudiedAt.localeCompare(a.lastStudiedAt))
  }, [levelProgressList])

  // Metrikler
  const streakDays = useMemo(() => {
    const days = new Set(reviewLogs.map((r) => dayKey(r.reviewedAt)))
    for (const a of examAnswers) days.add(dayKey(a.answeredAt))
    return streakFromDays(days, nowTimestamp)
  }, [reviewLogs, examAnswers, nowTimestamp])

  // Çıkmış soru havuzu yalnızca yerelde bilinir (telifli veri yayına girmez)
  const [questionPool, setQuestionPool] = useState<number | undefined>(undefined)
  useEffect(() => {
    if (!hasLocalContent()) return
    import('./exam/examData')
      .then((m) => m.listExams())
      .then((list) => setQuestionPool(list.filter((e) => e.hasKey).length * 80))
      .catch(() => setQuestionPool(undefined))
  }, [])

  // Kitaptan çalış (yalnızca yerelde): en son okunan kitabın sıradaki ünitesi
  const [bookTask, setBookTask] = useState<{ short: string; unitNo: number; unitTitle: string; to: string; doneToday: number } | undefined>(undefined)
  useEffect(() => {
    if (!hasLocalContent()) return
    let alive = true
    import('./books/bookData')
      .then(async (m) => {
        const books = await m.listBooks()
        // En son okunan kitap; hiç okunmadıysa temel kitap
        const withPos = books
          .map((b) => ({ b, pos: m.readPos(activeUserId, b.id) }))
          .filter((x) => x.pos)
          .sort((a, b) => (b.pos?.at ?? '').localeCompare(a.pos?.at ?? ''))
        const pick = withPos[0]?.b ?? books.find((b) => b.id === 'essential-grammar-in-use')
        if (!pick) return
        const book = await m.loadBook(pick.id)
        const done = getDoneUnits(activeUserId, pick.id)
        const unit = book.units.find((u) => !done[u.no])
        if (!unit || !alive) return
        setBookTask({
          short: pick.short,
          unitNo: unit.no,
          unitTitle: unit.title,
          to: `/kitap/${pick.id}/s/${unit.page}`,
          doneToday: unitsDoneToday(activeUserId, pick.id),
        })
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [activeUserId])

  const plan = useMemo(
    () =>
      buildDailyPlan({
        cards: cardStates,
        logs: reviewLogs,
        answers: examAnswers,
        daysLeft: daysToExam,
        newWordCap: exam?.dailyGoal || 20,
        unansweredQuestions: questionPool === undefined ? undefined : Math.max(0, questionPool - examAnswers.length),
        book: bookTask,
        now: nowTimestamp,
      }),
    [cardStates, reviewLogs, examAnswers, daysToExam, exam?.dailyGoal, questionPool, bookTask, nowTimestamp],
  )
  const planPct = planPercent(plan)
  const nextTask = plan.find((t) => t.target > 0 && t.done < t.target)
  const weakest = useMemo(() => {
    if (examAnswers.length < 20) return null
    const s = summarizeBySection(examAnswers)
      .filter((x) => x.answered >= 5 && x.percent !== null)
      .sort((a, b) => (a.percent ?? 0) - (b.percent ?? 0))[0]
    return s && (s.percent ?? 100) < 75 ? s : null
  }, [examAnswers])

  // Hedef puana göre en çok kazandıracak tip (yeterli YDS cevabı varsa)
  const targetTip = useMemo(() => {
    const tp = buildTargetPlan(exam?.targetScore ?? 0, summarizeBySection(examAnswers.filter((a) => !isYokdil(a.examId))))
    const g = tp && tp.gap > 0 ? tp.gains[0] : null
    return tp && g && g.gain >= 0.5 ? { gap: Math.ceil(tp.gap), key: g.key } : null
  }, [examAnswers, exam?.targetScore])

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


  return (
    <div className={styles.container}>
      {/* 1. ÜST BİLGİ & KARŞILAMA BARI */}
      <header className={styles.topBar}>
        <div className={styles.userProfile}>
          <Link to="/settings#users" title="Profil resmi ve rengi" style={{ display: 'inline-flex' }}>
            <Avatar user={activeUser} size={44} style={{ boxShadow: '0 2px 8px rgb(0 0 0 / 0.2)' }} />
          </Link>
          <div className={styles.userMeta}>
            <h1 className={styles.title}>Merhaba, {activeUser?.displayName || 'Öğrenci'} 👋</h1>
            <p className={styles.subtitle}>
              {nextTask
                ? `Bugünkü planının %${planPct}'i tamam. Sıradaki: ${nextTask.label.toLowerCase()}.`
                : 'Tebrikler! Bugünkü planını tamamladın.'}
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

      <QuickLinks />

      {/* 2. BUGÜNKÜ PLAN: tekrar + yeni kelime + (yerelde) soru */}
      {studyData === undefined ? (
        <section className={styles.planCard} aria-busy="true">
          <p className="muted" style={{ margin: 0 }}>Plan hazırlanıyor…</p>
        </section>
      ) : (
      <section className={styles.planCard}>
        <div className={styles.planHead}>
          <div>
            <span className={styles.heroBadge}>📅 Bugünkü Planın · %{planPct}</span>
            <h2 className={styles.heroHeading}>
              {nextTask ? `Sıradaki: ${nextTask.label} (${nextTask.target - nextTask.done} kaldı)` : 'Bugünkü planı tamamladın! 🎉'}
            </h2>
            <p className={styles.heroParagraph}>
              {daysToExam !== null
                ? `Sınava ${daysToExam} gün var; yeni kelime${questionPool !== undefined ? ' ve soru' : ''} hedefleri kalan güne göre eşit dağıtıldı.`
                : 'Ayarlar’dan sınav tarihini girersen hedefler kalan güne göre dağıtılır.'}
            </p>
          </div>
          <div className={styles.planRing} style={{ ['--pct' as string]: `${planPct}%` }} aria-label={`Plan %${planPct} tamam`}>
            <span>%{planPct}</span>
          </div>
        </div>

        <ul className={styles.planList}>
          {plan.map((t) => {
            const finished = t.target === 0 || t.done >= t.target
            const pct = t.target ? Math.min(100, Math.round((t.done / t.target) * 100)) : 100
            return (
              <li key={t.key} className={`${styles.planRow} ${finished ? styles.planDone : ''}`}>
                <span className={styles.planIcon}>{finished ? '✅' : t.icon}</span>
                <span className={styles.planBody}>
                  <span className={styles.planTop}>
                    <strong>{t.label}</strong>
                    <span className={styles.planCount}>
                      {t.done} / {t.target}
                    </span>
                  </span>
                  <span className={styles.progressTrack}>
                    <span className={styles.progressThumb} style={{ width: `${pct}%`, display: 'block' }} />
                  </span>
                  <small className={styles.planHint}>{t.hint}</small>
                </span>
                {!finished && (
                  <button
                    type="button"
                    className={`btn ${t === nextTask ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => navigate(t.to)}
                  >
                    Başla
                  </button>
                )}
              </li>
            )
          })}
        </ul>

        {targetTip ? (
          <Link to={`/yds-sorular/konu/${targetTip.key}`} className={styles.planTip}>
            🎯 Hedef puana ~{targetTip.gap} doğru eksik; en çok kazanç: <strong>{getSection(targetTip.key).label}</strong>. Bu tipten çalış →
          </Link>
        ) : (
          weakest && (
          <Link to={`/yds-sorular/konu/${weakest.key}`} className={styles.planTip}>
            💡 En zayıf soru tipin: <strong>{getSection(weakest.key).label}</strong> (%{weakest.percent}). Bu tipten çalış →
          </Link>
          )
        )}
      </section>
      )}

      <DailyStory userId={activeUserId} />

      {/* 3. KALDIĞIN YERDEN DEVAM (yalnızca yarıda bırakılan varsa) */}
      {inProgressLevels.some((p) => !isDismissed(p.subGroupId, p.lastStudiedAt)) && (
        <section className={styles.sectionBlock}>
          <h2 className={styles.sectionTitle}>⏳ Kaldığın yerden devam et</h2>
          <ul className={styles.resumeList}>
            {inProgressLevels.filter((p) => !isDismissed(p.subGroupId, p.lastStudiedAt)).slice(0, 3).map((p) => (
              <li key={p.subGroupId} style={{ position: 'relative' }}>
                <button
                  type="button"
                  className={styles.resumeRow}
                  onClick={() => navigate(`/study?subLevel=${p.subGroupId}&resume=1&auto=1`)}
                >
                  <strong>{formatLevelStudyTitle(p.categoryGroupId, p.levelNumber, p.mode)}</strong>
                  <span className="muted">
                    {p.completedQuestions}/{p.totalQuestions}
                  </span>
                  <span className={styles.resumeGo}>Devam →</span>
                </button>
                <button
                  type="button"
                  className="dismiss-x"
                  style={{ top: '50%', transform: 'translateY(-50%)' }}
                  onClick={() => dismiss(activeUserId, 'recent-levels', p.subGroupId)}
                  title="Listeden kaldır (ilerleme silinmez)"
                  aria-label="Listeden kaldır"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 4. NE ÇALIŞMAK İSTİYORSUN? (Çalış menüsünün kategorileri) */}
      <section className={styles.sectionBlock}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Ne çalışmak istiyorsun?</h2>
          <Link to="/calis" className="btn btn-ghost" style={{ fontSize: '0.82rem' }}>
            Tümü →
          </Link>
        </div>
        <div className={styles.catGrid}>
          {STUDY_CATEGORIES.map((c) => (
            <Link key={c.id} to={`/calis#${c.id}`} className={styles.catTile}>
              <span className={styles.catIcon}>{c.icon}</span>
              <strong>{c.title}</strong>
              <small>{c.desc}</small>
            </Link>
          ))}
        </div>
      </section>

      {/* 5. GÜNÜN KELİMESİ */}
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

      </div>

    </div>
  )
}
