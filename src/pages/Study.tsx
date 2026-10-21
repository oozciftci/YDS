import { useState, useMemo, useEffect, useCallback, useRef, lazy, Suspense } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { previewIntervals, processCardReview } from '../services/fsrs'
import {
  buildQuestion,
  type QuestionMode,
  type StudyQuestion,
} from '../services/studySession'
import {
  BUILT_IN_GROUPS,
  addWordToGroupAtPosition,
  calculateGroupStats,
  chunkIntoSubLevels,
  createCustomGroup,
  formatLevelStudyTitle,
  getRecentCustomGroupIds,
  getWordsForGroup,
  markLevelCompleted,
  markLevelInProgress,
  saveRecentCustomGroupId,
  saveStudySessionLog,
  type SubLevel,
} from '../services/groups'
import { canSpeak, speakWord } from '../services/tts'
import { useUserStore } from '../stores/user'
import { dismiss, useDismissed } from '../services/dismissed'
import {
  MASTERY_CONFIG,
  type MasteryLevel,
  type WordItem,
} from '../types/database'
import { InteractiveSentence } from '../components/InteractiveSentence'
import { LeechHelp } from '../components/LeechHelp'
import { MemoryHook } from '../components/MemoryHook'
import { WriteAnswer } from '../components/WriteAnswer'
import { WordFamilyBlock } from '../components/WordFamilyBlock'
import styles from './Study.module.css'
import { hasLocalContent } from '../services/localContent'
import { useSwipeNav } from '../hooks/useSwipeNav'

// Çıkmış soru bağlamı yalnızca yerelde (npm run dev) vardır; yayın derlemesine girmez (bkz. App.tsx).
const ExamContext = hasLocalContent() ? lazy(() => import('./exam/ExamContext')) : null

export function StudyPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const activeUser = useUserStore((s) => s.activeUser)
  const activeUserId = activeUser?.id || 'user_ozgur'

  // Veritabanı canlı sorguları
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

  const customGroups = useLiveQuery(
    () => db.wordGroups.where('userId').equals(activeUserId).toArray(),
    [activeUserId],
    [],
  )

  const allLevelProgress = useLiveQuery(
    () => db.levelProgress.where('userId').equals(activeUserId).toArray(),
    [activeUserId],
    [],
  )

  const cardMap = useMemo(() => {
    return new Map(allCardStates.map((c) => [c.wordId, c]))
  }, [allCardStates])

  const levelProgressMap = useMemo(() => {
    return new Map(allLevelProgress.map((p) => [p.subGroupId, p]))
  }, [allLevelProgress])

  // Oturum Durumu ('setup' | 'studying' | 'summary')
  const [phase, setPhase] = useState<'setup' | 'studying' | 'summary'>('setup')

  // Seçili Kategori ve Aktif Seviye
  const [activeCategoryId, setActiveCategoryId] = useState<string>('all_words')
  const [activeCategoryName, setActiveCategoryName] = useState<string>('C1 - C2 İleri Düzey')
  const [activeSubLevel, setActiveSubLevel] = useState<SubLevel | null>(null)

  // Seviye Filtreleri
  const [levelFilter, setLevelFilter] = useState<'all' | 'not_started' | 'in_progress' | 'completed'>('all')
  const [levelSearch, setLevelSearch] = useState('')

  // Çalışma Modu (Flaşkart / Test)
  // ?mode=cloze gibi bağlantılar çalışma türünü önceden seçer
  // Tersten çalış: kartın ön yüzünde Türkçe, arkasında İngilizce
  const [reverseMode, setReverseMode] = useState(() => {
    try {
      return localStorage.getItem('yds-study-reverse') === '1'
    } catch {
      return false
    }
  })
  function toggleReverse(on: boolean) {
    setReverseMode(on)
    try {
      localStorage.setItem('yds-study-reverse', on ? '1' : '0')
    } catch {
      // yoksay
    }
  }
  // Son çalışılanlar: × ile gizleme ve süzgeç
  const isDismissed = useDismissed(activeUserId, 'recent-levels')
  const [recentStatus, setRecentStatus] = useState<'all' | 'in_progress' | 'completed'>('all')
  const [recentCat, setRecentCat] = useState('all')
  const [recentAll, setRecentAll] = useState(false)
  // Son çalışılanlar bölümü açık mı (tercih hatırlanır)
  const [recentOpen, setRecentOpen] = useState(() => {
    try {
      return localStorage.getItem('yds-study-recent-open') !== '0'
    } catch {
      return true
    }
  })
  function toggleRecent() {
    setRecentOpen((o) => {
      try {
        localStorage.setItem('yds-study-recent-open', o ? '0' : '1')
      } catch {
        // yoksay
      }
      return !o
    })
  }
  const [mode, setMode] = useState<QuestionMode>(() => {
    const m = searchParams.get('mode')
    return m === 'multiple_choice' || m === 'synonym' || m === 'cloze' || m === 'write' || (m === 'listen' && canSpeak()) ? m : 'flashcard'
  })

  // Yeni grup oluşturma modalı
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupDesc, setNewGroupDesc] = useState('')

  // Aktif Oturum Soruları ve İlerleme
  const [questions, setQuestions] = useState<StudyQuestion[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const currentQ = questions[currentIndex]
  // Her puanın kartı ne zaman yeniden getireceği (düğmelerde gösterilir)
  const intervals = useMemo(() => (currentQ ? previewIntervals(currentQ.cardState) : null), [currentQ])

  // Dinleme sorusu açılınca kelimeyi kendiliğinden seslendir
  useEffect(() => {
    if (currentQ?.type === 'listen') speakWord(currentQ.word.term)
  }, [currentQ])
  const [isFlipped, setIsFlipped] = useState(false)
  const [selectedOption, setSelectedOption] = useState<number | null>(null)
  const [questionStartTime, setQuestionStartTime] = useState(() => Date.now())
  const [sessionStartTime, setSessionStartTime] = useState(() => new Date().toISOString())
  const [sessionResults, setSessionResults] = useState<Array<{ word: WordItem; score: MasteryLevel }>>([])
  const autoStartedRef = useRef(false)
  const summarySavedRef = useRef(false)

  const [nowTimestamp] = useState(() => Date.now())
  const nowIso = useMemo(() => new Date(nowTimestamp).toISOString(), [nowTimestamp])

  // Özel Gruba Ekleme Modalı ve Son Kullanılan 2 Grup
  const [showAddToGroupModal, setShowAddToGroupModal] = useState(false)
  const [targetGroupId, setTargetGroupId] = useState<string>('')
  const [targetPositionInput, setTargetPositionInput] = useState<string>('')
  const [isCreatingInGroupModal, setIsCreatingInGroupModal] = useState(false)
  const [modalNewGroupName, setModalNewGroupName] = useState('')
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [recentGroupIds, setRecentGroupIds] = useState<string[]>(() => getRecentCustomGroupIds())

  // ==========================================================
  // TÜM KATEGORİLER (Yerleşik + Kullanıcı Özel)
  // ==========================================================
  const allCategories = useMemo(() => {
    const builtIn = BUILT_IN_GROUPS.filter(
      (g) => !g.hideWhenEmpty || getWordsForGroup(g.id, allWords, cardMap, null, nowIso).length > 0,
    ).map((g) => {
      const words = getWordsForGroup(g.id, allWords, cardMap, null, nowIso)
      const stats = calculateGroupStats(words, cardMap, nowIso)
      return {
        id: g.id,
        name: g.name,
        shortName: g.shortName,
        description: g.description,
        icon: g.icon,
        color: g.color,
        badge: g.badge,
        isBuiltIn: true,
        words,
        stats,
      }
    })

    const customs = customGroups.map((g) => {
      const words = getWordsForGroup(g.id, allWords, cardMap, g, nowIso)
      const stats = calculateGroupStats(words, cardMap, nowIso)
      return {
        id: g.id,
        name: g.name,
        shortName: g.name,
        description: g.description || 'Özel kelime destesi',
        icon: g.icon || '📁',
        color: g.color || '#7c5cff',
        badge: 'Özel',
        isBuiltIn: false,
        words,
        stats,
      }
    })

    return [...builtIn, ...customs]
  }, [allWords, cardMap, nowIso, customGroups])

  // Aktif Kategorinin Kelimeleri ve 20'şerlik Seviyeleri (SubLevels)
  const activeCategoryObj = useMemo(() => {
    return allCategories.find((c) => c.id === activeCategoryId) || allCategories[0]
  }, [allCategories, activeCategoryId])

  const categorySubLevels = useMemo(() => {
    if (!activeCategoryObj) return []
    return chunkIntoSubLevels(activeCategoryObj.id, activeCategoryObj.name, activeCategoryObj.words, 20)
  }, [activeCategoryObj])

  // Filtrelenmiş Seviyeler
  const filteredSubLevels = useMemo(() => {
    return categorySubLevels.filter((lvl) => {
      const prog = levelProgressMap.get(lvl.id)
      const status = prog?.status || 'not_started'

      if (levelFilter === 'not_started' && status !== 'not_started') return false
      if (levelFilter === 'in_progress' && status !== 'in_progress') return false
      if (levelFilter === 'completed' && status !== 'completed') return false

      if (levelSearch.trim()) {
        const q = levelSearch.toLowerCase()
        const matchesTitle = lvl.title.toLowerCase().includes(q)
        const matchesWord = lvl.words.some((w) => w.term.toLowerCase().includes(q) || w.definition.toLowerCase().includes(q))
        if (!matchesTitle && !matchesWord) return false
      }

      return true
    })
  }, [categorySubLevels, levelProgressMap, levelFilter, levelSearch])

  // ==========================================================
  // 🕒 SON ÇALIŞILANLAR, GÜNÜN & HAFTANIN TEKRARLARI
  // ==========================================================
  const recentLevels = useMemo(() => {
    const todayPrefix = new Date().toISOString().slice(0, 10)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const withProgress = allLevelProgress.filter((p) => p.lastStudiedAt)
    withProgress.sort((a, b) => b.lastStudiedAt.localeCompare(a.lastStudiedAt))

    const inProgressList = withProgress.filter((p) => p.status === 'in_progress')
    const todayList = withProgress.filter((p) => p.lastStudiedAt.startsWith(todayPrefix))
    const weekList = withProgress.filter((p) => p.lastStudiedAt >= sevenDaysAgo)

    return {
      all: withProgress,
      allRecent: withProgress.slice(0, 6),
      inProgress: inProgressList,
      today: todayList,
      week: weekList,
    }
  }, [allLevelProgress])

  // Son eklenen / kullanılan 2 özel grup nesnesi
  const recentGroups = useMemo(() => {
    return recentGroupIds
      .map((id) => customGroups.find((g) => g.id === id))
      .filter((g): g is NonNullable<typeof g> => Boolean(g))
  }, [recentGroupIds, customGroups])

  // Kartın ön yüzünden son 2 gruba hızlı ekleme (tek tıkla)
  const handleQuickAddToGroup = useCallback(
    async (groupId: string, groupName: string) => {
      if (!currentQ) return
      const res = await addWordToGroupAtPosition(groupId, currentQ.word.id, null)
      if (res.success) {
        const updated = saveRecentCustomGroupId(groupId)
        setRecentGroupIds(updated)
        setToastMessage(`"${currentQ.word.term}" kelimesi "${groupName}" grubuna eklendi ✓`)
        setTimeout(() => setToastMessage(null), 3000)
      }
    },
    [currentQ],
  )

  // Gruba Ekle modalından sırayla ekleme
  const handleModalAddToGroup = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!currentQ) return

      let finalGroupId = targetGroupId
      let finalGroupName = ''

      if (isCreatingInGroupModal) {
        if (!modalNewGroupName.trim()) return
        const created = await createCustomGroup(activeUserId, modalNewGroupName.trim())
        finalGroupId = created.id
        finalGroupName = created.name
      } else {
        const found = customGroups.find((g) => g.id === finalGroupId) || customGroups[0]
        if (!found) return
        finalGroupId = found.id
        finalGroupName = found.name
      }

      if (!finalGroupId) return

      const pos = targetPositionInput.trim() ? parseInt(targetPositionInput.trim(), 10) : null
      const res = await addWordToGroupAtPosition(finalGroupId, currentQ.word.id, pos)

      if (res.success) {
        const updated = saveRecentCustomGroupId(finalGroupId)
        setRecentGroupIds(updated)
        setToastMessage(
          `"${currentQ.word.term}" kelimesi "${finalGroupName}" grubuna ${res.finalPosition}. sıraya eklendi ✓`
        )
        setTimeout(() => setToastMessage(null), 3500)
        setShowAddToGroupModal(false)
        setTargetPositionInput('')
        setModalNewGroupName('')
        setIsCreatingInGroupModal(false)
      }
    },
    [currentQ, targetGroupId, isCreatingInGroupModal, modalNewGroupName, activeUserId, customGroups, targetPositionInput],
  )

  // ==========================================================
  // SEVİYE ÇALIŞMA OTURUMUNU BAŞLAT VEYA KALDIĞI YERDEN SÜRDÜR
  // ==========================================================
  const startLevelSession = useCallback(
    (targetSubLevel: SubLevel, resumeIndex = 0) => {
      if (targetSubLevel.words.length === 0) {
        alert('Bu seviyede henüz kelime bulunmuyor.')
        return
      }

      // Her seviye tam olarak kendi 20 kelimesini (veya son kalan kelimelerini) içerir
      const generated = targetSubLevel.words.map((w) => {
        const card = cardMap.get(w.id) || {
          id: `${w.id}_${activeUserId}`,
          wordId: w.id,
          userId: activeUserId,
          state: 0,
          due: new Date().toISOString(),
          stability: 0,
          difficulty: 0,
          elapsedDays: 0,
          scheduledDays: 0,
          reps: 0,
          lapses: 0,
          masteryScore: 1,
          updatedAt: new Date().toISOString(),
        }
        return buildQuestion({ word: w, cardState: card }, allWords, mode)
      })

      const safeStartIndex = Math.min(resumeIndex, generated.length - 1)

      setQuestions(generated)
      setCurrentIndex(safeStartIndex)
      setIsFlipped(false)
      setSelectedOption(null)
      setQuestionStartTime(Date.now())
      setSessionStartTime(new Date().toISOString())
      setSessionResults([])
      setActiveSubLevel(targetSubLevel)
      setActiveCategoryId(targetSubLevel.categoryGroupId)
      setActiveCategoryName(targetSubLevel.categoryName)
      summarySavedRef.current = false
      setPhase('studying')
    },
    [allWords, cardMap, activeUserId, mode],
  )

  // URL Parametresi Dinleyici (Home'dan veya doğrudan yönlendirmeler)
  useEffect(() => {
    const preset = searchParams.get('preset')
    const groupId = searchParams.get('group')
    const subLvlId = searchParams.get('subLevel')
    const resume = searchParams.get('resume') === '1'
    const auto = searchParams.get('auto') === '1'

    if (auto && !autoStartedRef.current && allWords.length > 0) {
      autoStartedRef.current = true

      if (subLvlId) {
        // Belirli bir alt seviye ID'si ile başlat
        for (const cat of allCategories) {
          const lvls = chunkIntoSubLevels(cat.id, cat.name, cat.words, 20)
          const target = lvls.find((l) => l.id === subLvlId)
          if (target) {
            const prog = levelProgressMap.get(subLvlId)
            const resumeIdx = resume && prog ? prog.completedQuestions : 0
            startLevelSession(target, resumeIdx)
            return
          }
        }
      } else if (preset === 'due') {
        const dueCat = allCategories.find((c) => c.id === 'fsrs_due')
        if (dueCat && dueCat.words.length > 0) {
          const lvls = chunkIntoSubLevels(dueCat.id, dueCat.name, dueCat.words, 20)
          if (lvls[0]) startLevelSession(lvls[0], 0)
        }
      } else if (groupId) {
        const targetCat = allCategories.find((c) => c.id === groupId)
        if (targetCat && targetCat.words.length > 0) {
          const lvls = chunkIntoSubLevels(targetCat.id, targetCat.name, targetCat.words, 20)
          if (lvls[0]) startLevelSession(lvls[0], 0)
        }
      }
    }
  }, [searchParams, allWords.length, allCategories, levelProgressMap, startLevelSession])

  // ?group=<id> (auto olmadan): o desteyi seçili aç (Ana Sayfa ve Soru Merkezi bağlantıları)
  const groupParamAppliedRef = useRef(false)
  useEffect(() => {
    const groupId = searchParams.get('group')
    if (!groupId || searchParams.get('auto') === '1' || groupParamAppliedRef.current) return
    const cat = allCategories.find((c) => c.id === groupId)
    if (!cat) return
    groupParamAppliedRef.current = true
    setActiveCategoryId(cat.id)
    setActiveCategoryName(cat.name)
  }, [searchParams, allCategories])

  // ==========================================================
  // PUANLAMA (Kullanıcı Talebi: Öğrendim / Öğrenmedim veya 1-5)
  // ==========================================================
  const handleScoreCard = useCallback(
    async (score: MasteryLevel) => {
      if (!currentQ || !activeSubLevel) return
      const durationMs = Date.now() - questionStartTime

      await processCardReview(currentQ.cardState, score, currentQ.type, durationMs)
      const nextResults = [...sessionResults, { word: currentQ.word, score }]
      setSessionResults(nextResults)

      const nextIndex = currentIndex + 1

      if (nextIndex < questions.length) {
        // İlerlemeyi 'yarıda bırakıldı' (in_progress) olarak veritabanına işle
        const correctCount = nextResults.filter((r) => r.score >= 4).length
        const wrongCount = nextResults.filter((r) => r.score <= 2).length

        void markLevelInProgress(
          activeUserId,
          activeSubLevel.categoryGroupId,
          activeSubLevel.id,
          activeSubLevel.levelNumber,
          activeSubLevel.title,
          nextIndex,
          questions.length,
          correctCount,
          wrongCount,
          mode,
        )

        setCurrentIndex(nextIndex)
        setIsFlipped(false)
        setSelectedOption(null)
        setQuestionStartTime(Date.now())
      } else {
        // Oturum 20/20 tamamlandı!
        const correctCount = nextResults.filter((r) => r.score >= 4).length
        const wrongCount = nextResults.filter((r) => r.score <= 2).length

        await markLevelCompleted(
          activeUserId,
          activeSubLevel.categoryGroupId,
          activeSubLevel.id,
          activeSubLevel.levelNumber,
          activeSubLevel.title,
          questions.length,
          correctCount,
          wrongCount,
          mode,
        )

        setPhase('summary')
      }
    },
    [currentQ, activeSubLevel, questionStartTime, sessionResults, currentIndex, questions.length, activeUserId, mode],
  )

  // Oturumdan erken çıkış yapıldığında 'yarıda bırakıldı' olarak işaretle
  const handleAbandonOrExit = useCallback(
    async (targetAction: () => void) => {
      if (activeSubLevel && currentIndex > 0 && currentIndex < questions.length) {
        const correctCount = sessionResults.filter((r) => r.score >= 4).length
        const wrongCount = sessionResults.filter((r) => r.score <= 2).length

        await markLevelInProgress(
          activeUserId,
          activeSubLevel.categoryGroupId,
          activeSubLevel.id,
          activeSubLevel.levelNumber,
          activeSubLevel.title,
          currentIndex,
          questions.length,
          correctCount,
          wrongCount,
          mode,
        )

        // Oturum logunu da 'yarıda bırakıldı' olarak kaydet
        await saveStudySessionLog({
          userId: activeUserId,
          groupId: activeSubLevel.categoryGroupId,
          subGroupId: activeSubLevel.id,
          groupName: formatLevelStudyTitle(activeSubLevel.categoryGroupId, activeSubLevel.levelNumber, mode),
          mode,
          startedAt: sessionStartTime,
          completedAt: new Date().toISOString(),
          totalQuestions: currentIndex,
          correctCount,
          wrongCount,
          learningCount: sessionResults.filter((r) => r.score === 3).length,
          accuracyPercent: Math.round((correctCount / Math.max(1, currentIndex)) * 100),
          wordIds: sessionResults.map((r) => r.word.id),
          isCompleted: false,
        })
      }
      targetAction()
    },
    [activeSubLevel, currentIndex, questions.length, sessionResults, activeUserId, mode, sessionStartTime],
  )

  // Önceki Karta Dönme
  const handlePrevCard = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1)
      setIsFlipped(false)
      setSelectedOption(null)
      setQuestionStartTime(Date.now())
    }
  }, [currentIndex])

  // Sonraki Karta Geçme
  const handleNextCard = useCallback(() => {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((i) => i + 1)
      setIsFlipped(false)
      setSelectedOption(null)
      setQuestionStartTime(Date.now())
    } else {
      setPhase('summary')
    }
  }, [currentIndex, questions.length])

  // Kaydırarak önceki / sonraki kart (← → tuşlarıyla aynı)
  const swipe = useSwipeNav({ onPrev: handlePrevCard, onNext: handleNextCard, canPrev: currentIndex > 0, canNext: currentIndex + 1 < questions.length, enabled: phase === 'studying' })

  // Çoktan Seçmeli Seçenek Tıklaması
  function handleSelectOption(optIdx: number) {
    if (selectedOption !== null || !currentQ) return
    setSelectedOption(optIdx)

    const isCorrect = optIdx === currentQ.correctOptionIndex
    setTimeout(() => {
      void handleScoreCard(isCorrect ? 4 : 1)
    }, 1200)
  }

  // Oturum Özeti Ekranına Gelindiğinde Logu Otomatik Kaydet
  useEffect(() => {
    if (phase === 'summary' && sessionResults.length > 0 && !summarySavedRef.current && activeSubLevel) {
      summarySavedRef.current = true

      const totalQuestions = sessionResults.length
      const correctCount = sessionResults.filter((r) => r.score >= 4).length
      const wrongCount = sessionResults.filter((r) => r.score <= 2).length
      const learningCount = sessionResults.filter((r) => r.score === 3).length
      const accuracyPercent = Math.round((correctCount / totalQuestions) * 100)

      void saveStudySessionLog({
        userId: activeUserId,
        groupId: activeSubLevel.categoryGroupId,
        subGroupId: activeSubLevel.id,
        groupName: `${activeSubLevel.categoryName} • ${activeSubLevel.title}`,
        mode,
        startedAt: sessionStartTime,
        completedAt: new Date().toISOString(),
        totalQuestions,
        correctCount,
        wrongCount,
        learningCount,
        accuracyPercent,
        wordIds: sessionResults.map((r) => r.word.id),
        isCompleted: true,
      })
    }
  }, [phase, sessionResults, activeUserId, activeSubLevel, mode, sessionStartTime])

  // Klavye Kısayolları (Boşluk Tuşu ile Ön/Arka Yüz, 1-5 Tuşları ile Puanlama)
  useEffect(() => {
    if (phase !== 'studying' || !currentQ) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      if (e.code === 'Space') {
        e.preventDefault()
        if (currentQ.type === 'flashcard') {
          setIsFlipped((f) => !f)
        } else {
          speakWord(currentQ.word.term)
        }
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        void swipe.turn(-1)
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault()
        void swipe.turn(1)
      }

      if (['1', '2', '3', '4', '5'].includes(e.key)) {
        const score = Number(e.key) as MasteryLevel
        void handleScoreCard(score)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [phase, currentQ, handleScoreCard, swipe])

  // Yeni Grup Oluşturma Formu
  async function handleCreateGroupSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!newGroupName.trim()) return

    const g = await createCustomGroup(activeUserId, newGroupName.trim(), newGroupDesc.trim())
    setNewGroupName('')
    setNewGroupDesc('')
    setShowCreateGroupModal(false)
    setActiveCategoryId(g.id)
    setActiveCategoryName(g.name)
  }

  // Güvenli Ana Sayfaya Dönüş
  function handleGoHome() {
    if (phase === 'studying') {
      void handleAbandonOrExit(() => navigate('/calis'))
    } else {
      navigate('/calis')
    }
  }

  // Puanlama düğmeleri: kartın iki yüzünde de görünür (çevirmeden de puanlanabilir)
  const grading = currentQ ? (
    <>
        {/* YENİLENMİŞ PUANLAMA BÖLÜMÜ (ÖĞRENDİM / ÖĞRENMEDİM + SADE 1-5 BARI) */}
        <div className={styles.gradingContainer}>
          {/* Hızlı İkili Butonlar */}
          <div className={styles.dualActionRow}>
            <button
              type="button"
              className={styles.actionBtnFail}
              onClick={() => void handleScoreCard(1)}
              id="btn-not-learned"
              title="Öğrenmedim (Tekrar karşıma çıksın - Kısayol: 1)"
            >
              <span>❌</span>
              <span>Öğrenmedim (1)</span>
              {intervals && <small className={styles.nextHint}>{intervals[1]} sonra</small>}
            </button>
    
            <button
              type="button"
              className={styles.actionBtnSuccess}
              onClick={() => void handleScoreCard(4)}
              id="btn-learned"
              title="Öğrendim (Biliyorum, pekiştirildi - Kısayol: 4)"
            >
              <span>✅</span>
              <span>Öğrendim (4)</span>
              {intervals && <small className={styles.nextHint}>{intervals[4]} sonra</small>}
            </button>
          </div>
    
          {/* Sade 1-5 Puan Barı */}
          <div className={styles.numericGradeRow}>
            <span className={styles.numericGradeLabel}>Öğrenme Düzeyi (1 - 5):</span>
            {([1, 2, 3, 4, 5] as MasteryLevel[]).map((score) => (
              <button
                key={score}
                type="button"
                className={`${styles.numericBtn} ${styles[`numericBtn_${score}` as keyof typeof styles]}`}
                onClick={() => void handleScoreCard(score)}
                id={`grade-btn-${score}`}
                title={`${score}: ${MASTERY_CONFIG[score].label}${intervals ? ` — sonraki tekrar ${intervals[score]} sonra` : ""}`}
              >
                {score}
              </button>
            ))}
          </div>
        </div>
    </>
  ) : null

  return (
    <section className={styles.container}>
      {/* ========================================================
          HER ZAMAN GÖRÜNÜR: ÜST DÖNÜŞ VE BREADCRUMB BARI
          ======================================================== */}
      <div className={styles.topNavRow}>
        <button
          type="button"
          onClick={handleGoHome}
          className={styles.backHomeBtn}
          id="study-btn-go-home"
          title="Çalış menüsüne dön"
        >
          <span>← Çalış</span>
        </button>

        <div className={styles.studyBreadcrumb}>
          <span>Kelime</span>
          {phase !== 'setup' && activeSubLevel && (
            <>
              <span>/</span>
              <span style={{ color: 'var(--text-muted)' }}>{activeSubLevel.categoryName}</span>
              <span>/</span>
              <strong style={{ color: 'var(--text)' }}>{activeSubLevel.title}</strong>
            </>
          )}
        </div>

        <label className={styles.reverseToggle} title="Kartın ön yüzünde Türkçe anlam, arkasında İngilizce kelime">
          <input type="checkbox" checked={reverseMode} onChange={(e) => toggleReverse(e.target.checked)} />
          Tersten çalış (TR → EN)
        </label>
      </div>

      {/* ========================================================
          AŞAMA 1: GRUPLAR & 20'ŞER KELİMELİK SEVİYE LİSTESİ MERKEZİ
          ======================================================== */}
      {phase === 'setup' && (
        <div className={styles.setupCard}>
          <div className={styles.setupHeadRow}>
            <div>
              <h1 className={styles.setupTitle}>Seviye ve 20'şer Kelimelik Gruplar</h1>
              <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
                Kelimeleri binlercesi bir arada karambole değil; 20'şer kelimelik seviyeler halinde adım adım bitir.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <label htmlFor="study-mode-select" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                  Mod:
                </label>
                <select
                  id="study-mode-select"
                  className="input"
                  value={mode}
                  onChange={(e) => setMode(e.target.value as QuestionMode)}
                  style={{ padding: '0.35rem 0.65rem', fontSize: '0.82rem' }}
                >
                  <option value="flashcard">🗂️ Flaşkart Modu (Önerilen)</option>
                  <option value="multiple_choice">🔠 Çoktan Seçmeli Test</option>
                  <option value="synonym">🔗 YDS Eş Anlamlı</option>
                  <option value="cloze">📝 Cümle İçi Boşluk</option>
                  {canSpeak() && <option value="listen">🎧 Dinleme (sesi duy, anlamını seç)</option>}
                  <option value="write">⌨️ Yazarak Cevap (Türkçesini gör, İngilizcesini yaz)</option>
                </select>
              </div>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowCreateGroupModal(true)}
                style={{ fontSize: '0.85rem' }}
              >
                + Yeni Özel Grup
              </button>
            </div>
          </div>

          {/* 🕒 BÖLÜM 1: SON ÇALIŞILANLAR & YARIDA BIRAKILANLAR */}
          {recentLevels.all.length > 0 && (() => {
            const visible = recentLevels.all.filter(
              (p) =>
                !isDismissed(p.subGroupId, p.lastStudiedAt) &&
                (recentStatus === 'all' || p.status === recentStatus) &&
                (recentCat === 'all' || p.categoryGroupId === recentCat),
            )
            const filtering = recentStatus !== 'all' || recentCat !== 'all'
            const shown = recentAll || filtering ? visible : visible.slice(0, 6)
            const cats = [...new Set(recentLevels.all.map((p) => p.categoryGroupId))]
            return (
            <div className={styles.recentSection}>
              <div className={styles.sectionHeaderRow}>
                <button type="button" className={styles.recentToggle} onClick={toggleRecent} aria-expanded={recentOpen}>
                  <span>{recentOpen ? '▾' : '▸'}</span>
                  <span>🕒 Son Çalışılanlar & Yarıda Bırakılanlar</span>
                  {!recentOpen && <small className="muted">({visible.length})</small>}
                </button>
                {recentOpen && <span className={styles.recentFilters}>
                  <select value={recentStatus} onChange={(e) => setRecentStatus(e.target.value as typeof recentStatus)} aria-label="Duruma göre süz">
                    <option value="all">Tümü</option>
                    <option value="in_progress">Yarıda kalanlar</option>
                    <option value="completed">Tamamlananlar</option>
                  </select>
                  <select value={recentCat} onChange={(e) => setRecentCat(e.target.value)} aria-label="Gruba göre süz">
                    <option value="all">Tüm gruplar</option>
                    {cats.map((id) => (
                      <option key={id} value={id}>
                        {allCategories.find((c) => c.id === id)?.name ?? id}
                      </option>
                    ))}
                  </select>
                </span>}
              </div>
              {recentOpen && <>
              {shown.length === 0 && <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>Bu süzgeçte çalışma yok.</p>
              }

              <div className={styles.recentGrid}>
                {shown.map((prog) => {
                  const isInProgress = prog.status === 'in_progress'
                  const cat = allCategories.find((c) => c.id === prog.categoryGroupId)

                  return (
                    <div
                      key={prog.subGroupId}
                      className={`${styles.recentCard} ${
                        isInProgress ? styles.recentCard_in_progress : styles.recentCard_completed
                      }`}
                    >
                      <button
                        type="button"
                        className="dismiss-x"
                        onClick={() => dismiss(activeUserId, 'recent-levels', prog.subGroupId)}
                        title="Bu listeden kaldır (ilerleme silinmez)"
                        aria-label="Listeden kaldır"
                      >
                        ×
                      </button>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                          <span
                            className={`${styles.statusTag} ${
                              isInProgress ? styles.statusTag_in_progress : styles.statusTag_completed
                            }`}
                          >
                            {isInProgress
                              ? `⏳ Yarıda Bırakıldı (${prog.completedQuestions}/${prog.totalQuestions})`
                              : `✅ Tamamlandı (%${prog.accuracyPercent} Başarı)`}
                          </span>
                          <span className="muted" style={{ fontSize: '0.75rem' }}>
                            {new Date(prog.lastStudiedAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                          </span>
                        </div>

                        <strong style={{ fontSize: '0.95rem', color: 'var(--text)', display: 'block' }}>
                          {formatLevelStudyTitle(prog.categoryGroupId, prog.levelNumber, prog.mode)}
                        </strong>
                      </div>

                      <button
                        type="button"
                        className={isInProgress ? 'btn btn-primary' : 'btn btn-secondary'}
                        style={{ fontSize: '0.8rem', padding: '0.45rem 0.75rem', width: '100%' }}
                        onClick={() => {
                          if (!cat) return
                          const lvls = chunkIntoSubLevels(cat.id, cat.name, cat.words, 20)
                          const target = lvls.find((l) => l.id === prog.subGroupId)
                          if (target) {
                            startLevelSession(target, isInProgress ? prog.completedQuestions : 0)
                          }
                        }}
                      >
                        {isInProgress ? `▶ Kaldığın Yerden Devam Et (${prog.completedQuestions + 1}. Soru) →` : '🔄 Bu Seviyeyi Tekrar Çalış'}
                      </button>
                    </div>
                  )
                })}
              </div>
              {!filtering && visible.length > 6 && (
                <button type="button" className="btn btn-ghost" style={{ fontSize: '0.82rem' }} onClick={() => setRecentAll((v) => !v)}>
                  {recentAll ? 'Daha az göster' : `Tümünü göster (${visible.length})`}
                </button>
              )}
              </>}
            </div>
            )
          })()}

          {/* 📅 BÖLÜM 2: GÜNÜN & HAFTANIN TEKRARLARI */}
          {(recentLevels.today.length > 0 || recentLevels.week.length > 0) && (
            <div
              style={{
                display: 'flex',
                gap: '0.75rem',
                flexWrap: 'wrap',
                padding: '0.85rem 1.15rem',
                background: 'var(--surface-strong)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text)' }}>
                  📅 Tekrar Zamanı Gelmiş Gruplar:
                </span>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Bugün: <strong>{recentLevels.today.length} seviye</strong> • Bu Hafta: <strong>{recentLevels.week.length} seviye</strong> çalışıldı.
                </span>
              </div>

              {recentLevels.today.length > 0 && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: '0.8rem', padding: '0.35rem 0.85rem' }}
                  onClick={() => {
                    const firstToday = recentLevels.today[0]
                    const cat = allCategories.find((c) => c.id === firstToday.categoryGroupId)
                    if (cat) {
                      const lvls = chunkIntoSubLevels(cat.id, cat.name, cat.words, 20)
                      const target = lvls.find((l) => l.id === firstToday.subGroupId)
                      if (target) startLevelSession(target, 0)
                    }
                  }}
                >
                  ⚡ Bugünün İlk Seviyesini Tekrar Et
                </button>
              )}
            </div>
          )}

          {/* BÖLÜM 3: KATEGORİ SEÇİCİ SEKMELERİ (C1-C2, B1-B2, A1-A2, Phrasal, Bağlaç, Özel) */}
          <div>
            <div className={styles.categoryTabsRow}>
              {allCategories.map((cat) => {
                const isActive = cat.id === activeCategoryId
                const lvlsCount = Math.ceil(cat.words.length / 20)

                return (
                  <button
                    key={cat.id}
                    type="button"
                    className={`${styles.categoryTabBtn} ${isActive ? styles.categoryTabBtnActive : ''}`}
                    onClick={() => {
                      setActiveCategoryId(cat.id)
                      setActiveCategoryName(cat.name)
                      setLevelFilter('all')
                      setLevelSearch('')
                    }}
                  >
                    <span>{cat.icon}</span>
                    <span>{cat.shortName}</span>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        padding: '0.1rem 0.45rem',
                        borderRadius: '999px',
                        background: isActive ? 'var(--primary)' : 'var(--input-bg)',
                        color: isActive ? 'var(--on-primary)' : 'var(--text-muted)',
                      }}
                    >
                      {lvlsCount} Seviye
                    </span>
                  </button>
                )
              })}
            </div>

            {/* AKTİF KATEGORİ BAŞLIK VE FİLTRELEME BARI */}
            {activeCategoryObj && (
              <div className={styles.categoryHeaderBox} style={{ marginTop: '0.85rem' }}>
                <div>
                  <h3 style={{ margin: '0 0 0.2rem', fontSize: '1.15rem', fontWeight: 800 }}>
                    {activeCategoryObj.icon} {activeCategoryObj.name}
                  </h3>
                  <p className="muted" style={{ margin: 0, fontSize: '0.82rem' }}>
                    {activeCategoryObj.words.length} kelime • 20'şer kelimelik {categorySubLevels.length} seviyeye ayrıldı.
                  </p>
                  {activeCategoryObj.description && (
                    <p className="muted" style={{ margin: '0.2rem 0 0', fontSize: '0.8rem' }}>
                      {activeCategoryObj.description}
                    </p>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  {/* Seviye Durum Filtreleri */}
                  <div className={styles.levelFilterRow}>
                    <button
                      type="button"
                      className={`${styles.filterPill} ${levelFilter === 'all' ? styles.filterPillActive : ''}`}
                      onClick={() => setLevelFilter('all')}
                    >
                      Tümü ({categorySubLevels.length})
                    </button>
                    <button
                      type="button"
                      className={`${styles.filterPill} ${levelFilter === 'not_started' ? styles.filterPillActive : ''}`}
                      onClick={() => setLevelFilter('not_started')}
                    >
                      Başlanmamış
                    </button>
                    <button
                      type="button"
                      className={`${styles.filterPill} ${levelFilter === 'in_progress' ? styles.filterPillActive : ''}`}
                      onClick={() => setLevelFilter('in_progress')}
                    >
                      Yarıda Kalan
                    </button>
                    <button
                      type="button"
                      className={`${styles.filterPill} ${levelFilter === 'completed' ? styles.filterPillActive : ''}`}
                      onClick={() => setLevelFilter('completed')}
                    >
                      Tamamlanan
                    </button>
                  </div>

                  {/* Hızlı Arama */}
                  <input
                    type="search"
                    className="input"
                    placeholder="Seviye veya kelime ara…"
                    value={levelSearch}
                    onChange={(e) => setLevelSearch(e.target.value)}
                    style={{ padding: '0.35rem 0.65rem', fontSize: '0.82rem', width: '180px' }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* BÖLÜM 4: 20'ŞER KELİMELİK SEVİYE KARTLARI IZGARASI */}
          <div>
            <div className={styles.levelsGrid}>
              {filteredSubLevels.map((lvl) => {
                const prog = levelProgressMap.get(lvl.id)
                const status = prog?.status || 'not_started'
                const isInProgress = status === 'in_progress'
                const isCompleted = status === 'completed'

                return (
                  <div
                    key={lvl.id}
                    className={`${styles.levelCard} ${
                      isInProgress ? styles.levelCard_in_progress : isCompleted ? styles.levelCard_completed : ''
                    }`}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                        <span
                          className={`${styles.statusTag} ${
                            isInProgress
                              ? styles.statusTag_in_progress
                              : isCompleted
                              ? styles.statusTag_completed
                              : styles.statusTag_not_started
                          }`}
                        >
                          {isInProgress
                            ? `⏳ Yarıda (${prog?.completedQuestions || 0}/20)`
                            : isCompleted
                            ? `✅ %${prog?.accuracyPercent} Başarı`
                            : '⚪ Başlanmadı'}
                        </span>
                        <span className="muted" style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                          #{lvl.levelNumber}
                        </span>
                      </div>

                      <h4 className={styles.levelCardTitle}>Level {lvl.levelNumber}</h4>
                      <p className={styles.levelCardRange}>
                        {lvl.title.replace(`Level ${lvl.levelNumber}`, '').trim()} • {lvl.wordCount} Kelime
                      </p>
                    </div>

                    <button
                      type="button"
                      className={`${styles.levelCardBtn} ${
                        isInProgress || !isCompleted ? styles.levelCardBtn_primary : ''
                      }`}
                      onClick={() => startLevelSession(lvl, isInProgress ? prog?.completedQuestions || 0 : 0)}
                    >
                      {isInProgress
                        ? `▶ Devam Et (${(prog?.completedQuestions || 0) + 1}. Soru)`
                        : isCompleted
                        ? '🔄 Tekrar Çalış'
                        : 'Çalış (20 Kelime) →'}
                    </button>
                  </div>
                )
              })}
            </div>

            {filteredSubLevels.length === 0 && (
              <div
                style={{
                  textAlign: 'center',
                  padding: '3rem 1rem',
                  background: 'var(--surface-strong)',
                  borderRadius: 'var(--radius)',
                  color: 'var(--text-muted)',
                }}
              >
                Bu filtreye uygun seviye bulunamadı.
              </div>
            )}
          </div>

          {/* YENİ ÖZEL GRUP OLUŞTURMA MODALI */}
          {showCreateGroupModal && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.65)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 100,
                padding: '1rem',
              }}
            >
              <form
                onSubmit={handleCreateGroupSubmit}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '1.5rem',
                  maxWidth: '440px',
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>Yeni Kelime Grubu Oluştur</h3>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setShowCreateGroupModal(false)}
                    style={{ padding: '0.2rem 0.5rem' }}
                  >
                    ✕
                  </button>
                </div>

                <div className="field">
                  <label htmlFor="group-name-input">Grup / Deste Adı</label>
                  <input
                    id="group-name-input"
                    className="input"
                    placeholder="Örn: Hafta 1 Kelimeleri, Paragraf Fiilleri…"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <div className="field">
                  <label htmlFor="group-desc-input">Açıklama (İsteğe Bağlı)</label>
                  <input
                    id="group-desc-input"
                    className="input"
                    placeholder="Örn: 2024 İlkbahar denemesinde çıkanlar"
                    value={newGroupDesc}
                    onChange={(e) => setNewGroupDesc(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setShowCreateGroupModal(false)}
                  >
                    İptal
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={!newGroupName.trim()}>
                    Grubu Oluştur ✓
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          AŞAMA 2: AKTİF ÇALIŞMA EKRANI (FLAŞKART & TEST)
          ======================================================== */}
      {phase === 'studying' && currentQ && (
        <div className={styles.activeArea} {...swipe.props}>
          {/* Üst Durum Çubuğu */}
          <div className={styles.statusBar}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ padding: '0.25rem 0.6rem', fontSize: '0.82rem' }}
                disabled={currentIndex === 0}
                onClick={() => void swipe.turn(-1)}
                title="Önceki Soru (Sol Ok Tuşu)"
              >
                ← Önceki Soru
              </button>
              <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text)' }}>
                Soru {currentIndex + 1} / {questions.length}
              </span>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ padding: '0.25rem 0.6rem', fontSize: '0.82rem' }}
                onClick={() => (currentIndex + 1 < questions.length ? void swipe.turn(1) : handleNextCard())}
                title="Sonraki Soru (Sağ Ok Tuşu)"
              >
                {currentIndex + 1 < questions.length ? 'Sonraki Soru →' : 'Sonuçları Gör 🏁'}
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ padding: '0.25rem 0.6rem', fontSize: '0.82rem' }}
                onClick={() => void handleAbandonOrExit(() => setPhase('setup'))}
                title="Farklı bir seviye seçmek için listeye dön (İlerlemen kaydedilir)"
              >
                Seviye Değiştir
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ padding: '0.25rem 0.6rem', fontSize: '0.82rem', color: 'var(--error)' }}
                onClick={() => void handleAbandonOrExit(() => setPhase('summary'))}
                title="Oturumu şimdi tamamla ve özeti gör"
              >
                ✕ Oturumu Bitir
              </button>
            </div>
          </div>

          {/* İlerleme Çubuğu */}
          <div className={styles.progressBar} aria-hidden="true">
            <div
              className={styles.progressFill}
              style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
            />
          </div>

          {/* Soru / Flaşkart Alanı */}
          <div className={styles.cardStage} data-focus-stage>
            <div className={styles.cardFlip}>
              {/* ÜST BİLGİ BARI */}
              <div className={styles.cardHeadRow}>
                <span className={styles.cardSubPrompt}>
                  Kelime Türü: <strong>{currentQ.word.partOfSpeech.toUpperCase()}</strong> •{' '}
                  {activeSubLevel ? activeSubLevel.title : activeCategoryName}
                </span>
                {/* Yazarak cevapta ses cevabı söyler: gizli */}
                {currentQ.type !== 'write' && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ padding: '0.2rem 0.55rem', fontSize: '0.85rem' }}
                  onClick={() => speakWord(currentQ.word.term)}
                  title="Sesli Telaffuz Dinle"
                >
                  🔊 Dinle
                </button>
                )}
              </div>

              {/* 1. FLAŞKART GÖRÜNÜMÜ (ÖN VE ARKA YÜZ SİMETRİSİ) */}
              {currentQ.type === 'flashcard' && (
                <div className={styles.faceContainer}>
                  {/* SİMETRİK VE SABİT YÜKSEKLİKLİ ORTAK ÜST ALAN */}
                  <div className={styles.topPromptBlock}>
                    <div className={styles.mainPromptCenter}>
                      {isFlipped === reverseMode ? (
                        <>
                          <h2 className={styles.promptMainWord}>{currentQ.word.term}</h2>
                          <div className={styles.promptSubWord}>
                            <button
                              type="button"
                              className="btn btn-ghost"
                              style={{ padding: '0.2rem 0.5rem', fontSize: '0.9rem' }}
                              onClick={() => speakWord(currentQ.word.term)}
                              title="Telaffuz"
                            >
                              🔊
                            </button>
                            <span
                              style={{
                                fontSize: '0.75rem',
                                textTransform: 'uppercase',
                                padding: '0.15rem 0.5rem',
                                borderRadius: '4px',
                                background: 'var(--input-bg)',
                                border: '1px solid var(--border)',
                              }}
                            >
                              {currentQ.word.partOfSpeech}
                            </span>
                          </div>
                        </>
                      ) : (
                        <>
                          <h2 className={styles.promptMainWord} style={{ color: 'var(--text)' }}>
                            {currentQ.word.definition}
                          </h2>
                          <div className={styles.promptSubWord}>
                            <span>{currentQ.word.term}</span>
                            <button
                              type="button"
                              className="btn btn-ghost"
                              style={{ padding: '0.15rem 0.45rem', fontSize: '0.85rem' }}
                              onClick={() => speakWord(currentQ.word.term)}
                              title="Telaffuz Dinle"
                            >
                              🔊
                            </button>
                            <span
                              style={{
                                fontSize: '0.72rem',
                                textTransform: 'uppercase',
                                padding: '0.1rem 0.45rem',
                                borderRadius: '4px',
                                background: 'var(--input-bg)',
                                border: '1px solid var(--border)',
                              }}
                            >
                              {currentQ.word.partOfSpeech}
                            </span>
                          </div>
                        </>
                      )}
                    </div>

                    {/* SİMETRİK ÇEVİRME BUTONU (ÖN VE ARKA YÜZDE BİREBİR AYNI SABİT KOORDİNATTA) */}
                    <div className={styles.centerFlipWrap}>
                      {!isFlipped ? (
                        <button
                          type="button"
                          className={styles.centerFlipBtn}
                          onClick={() => setIsFlipped(true)}
                          id="btn-flip-card"
                          title="Kartı Çevir (Boşluk Tuşu)"
                        >
                          🔄 Kartı Çevir (Boşluk Tuşu)
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={`${styles.centerFlipBtn} ${styles.centerFlipBtnBack}`}
                          onClick={() => setIsFlipped(false)}
                          id="btn-flip-back"
                          title="Ön Yüze Dön (Boşluk Tuşu)"
                        >
                          🔄 Ön Yüze Dön (Boşluk Tuşu)
                        </button>
                      )}
                    </div>
                  </div>

                  {/* ALT ALAN:
                      ÖN YÜZDE: "Gruba Ekle" Hızlı Butonları + İpucu
                      ARKA YÜZDE: Eş Anlamlılar + Örnek Cümle + Puanlama
                  */}
                  {!isFlipped ? (
                    <div className={styles.frontBottomBlock}>
                      {toastMessage && (
                        <div className={styles.toastBanner}>
                          <span>✓</span>
                          <span>{toastMessage}</span>
                        </div>
                      )}

                      {/* ➕ GRUBA EKLE VE SON 2 GRUP HIZLI BUTONLARI */}
                      <div className={styles.groupActionBar}>
                        <button
                          type="button"
                          className={styles.addGroupBtn}
                          onClick={() => {
                            setIsCreatingInGroupModal(customGroups.length === 0)
                            setTargetPositionInput('')
                            if (customGroups.length > 0) {
                              setTargetGroupId(customGroups[0].id)
                            }
                            setShowAddToGroupModal(true)
                          }}
                          id="btn-add-to-group"
                          title="Bu kelimeyi özel bir çalışma grubuna / desteye ekle"
                        >
                          <span>➕</span>
                          <span>Gruba Ekle</span>
                        </button>

                        {/* SON EKLENEN 2 GRUP (HIZLI TEK TIKLA EKLEME) */}
                        {recentGroups.map((rg) => {
                          const isAlreadyIn = (rg.wordIds || []).includes(currentQ.word.id)
                          return (
                            <button
                              key={rg.id}
                              type="button"
                              className={`${styles.quickGroupBtn} ${isAlreadyIn ? styles.quickGroupBtnActive : ''}`}
                              onClick={() => void handleQuickAddToGroup(rg.id, rg.name)}
                              title={isAlreadyIn ? `Bu kelime zaten "${rg.name}" grubunda yer alıyor` : `"${rg.name}" grubuna hızlı ekle`}
                            >
                              <span>{isAlreadyIn ? '✓' : '⚡'}</span>
                              <span>{rg.name}</span>
                            </button>
                          )
                        })}
                      </div>

                      {grading}

                      <span className={styles.flipHint} data-focus-hide>
                        İpucu: Klavyeden <strong>Boşluk</strong> ile kartı çevirebilir, doğrudan <strong>1-5</strong> tuşlarıyla puanlayabilirsiniz.
                      </span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                      {/* EŞ ANLAMLILAR & ÖRNEK CÜMLE */}
                      <div className={styles.subtleDetailsArea}>
                        <WordFamilyBlock key={`fam-${currentQ.word.id}`} word={currentQ.word} />

                        {currentQ.word.sentences && currentQ.word.sentences.length > 0 && currentQ.word.sentences[0] && (
                          <div style={{ marginTop: '0.35rem' }}>
                            <span className={styles.subtleLabel}>Örnek Cümle (Tıklanabilir Çeviri):</span>
                            <InteractiveSentence
                              sentence={
                                typeof currentQ.word.sentences[0] === 'string'
                                  ? { en: currentQ.word.sentences[0] }
                                  : currentQ.word.sentences[0]
                              }
                              activeUserId={activeUserId}
                              highlightTerm={currentQ.word.term}
                              showTranslationByDefault={true}
                            />
                          </div>
                        )}

                        <MemoryHook key={`hook-${currentQ.word.id}`} word={currentQ.word} />

                        <LeechHelp key={`leech-${currentQ.word.id}`} word={currentQ.word} card={currentQ.cardState} />

                        {ExamContext && (
                          <Suspense fallback={null}>
                            <ExamContext key={currentQ.word.term} term={currentQ.word.term} />
                          </Suspense>
                        )}
                      </div>

                      {grading}
                    </div>
                  )}
                </div>
              )}

              {/* 1b. YAZARAK CEVAP */}
              {currentQ.type === 'write' && (
                <WriteAnswer key={currentQ.id} q={currentQ} onDone={(s) => void handleScoreCard(s)} />
              )}

              {/* 2. ÇOKTAN SEÇMELİ MOD */}
              {currentQ.type !== 'flashcard' && currentQ.options && (
                <div style={{ margin: 'auto 0' }}>
                  {currentQ.type === 'listen' ? (
                    <div className={styles.listenPrompt}>
                      <button
                        type="button"
                        className={styles.listenBtn}
                        onClick={() => speakWord(currentQ.word.term)}
                        aria-label="Kelimeyi yeniden dinle"
                        title="Yeniden dinle"
                      >
                        🔊
                      </button>
                      <p className="muted" style={{ margin: 0 }}>
                        {selectedOption !== null ? (
                          <strong className={styles.listenWord}>{currentQ.word.term}</strong>
                        ) : (
                          currentQ.subPrompt
                        )}
                      </p>
                    </div>
                  ) : (
                    <h2 className={styles.promptMainWord} style={{ fontSize: '1.8rem', marginBottom: '1.25rem' }}>
                      {currentQ.prompt}
                    </h2>
                  )}

                  <div className={styles.optionsGrid}>
                    {currentQ.options.map((opt, idx) => {
                      let btnClass = styles.optionBtn
                      if (selectedOption !== null) {
                        if (idx === currentQ.correctOptionIndex) {
                          btnClass = `${styles.optionBtn} ${styles.optionCorrect}`
                        } else if (idx === selectedOption) {
                          btnClass = `${styles.optionBtn} ${styles.optionWrong}`
                        }
                      }
                      return (
                        <button
                          key={idx}
                          type="button"
                          className={btnClass}
                          disabled={selectedOption !== null}
                          onClick={() => handleSelectOption(idx)}
                        >
                          <span className={styles.optLetter}>
                            {String.fromCharCode(65 + idx)}
                          </span>
                          <span>{opt}</span>
                        </button>
                      )
                    })}
                  </div>

                  {selectedOption !== null && currentQ.explanation && (
                    <div className={styles.explanationBox}>
                      {currentQ.explanation}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ALT İLERİ - GERİ NAVİGASYON BARI */}
            <div className={styles.navRow} data-focus-hide>
              <button
                type="button"
                className={styles.navBtn}
                disabled={currentIndex === 0}
                onClick={() => void swipe.turn(-1)}
                title="Önceki Soru (Sol Ok Tuşu)"
              >
                ← Önceki Soru
              </button>

              <span className="muted" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                {currentIndex + 1} / {questions.length}
              </span>

              <button
                type="button"
                className={styles.navBtn}
                onClick={() => (currentIndex + 1 < questions.length ? void swipe.turn(1) : handleNextCard())}
                title="Sonraki Soru (Sağ Ok Tuşu)"
              >
                {currentIndex + 1 < questions.length ? 'Sonraki Soru →' : 'Sonuçları Gör 🏁'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          AŞAMA 3: OTURUM SONU RAPOR VE ÖZET EKRANI
          ======================================================== */}
      {phase === 'summary' && activeSubLevel && (
        <div className={styles.resultCard}>
          <div style={{ fontSize: '3rem' }}>🎉</div>
          <h1 className={styles.resultTitle}>Seviye Tamamlandı!</h1>
          <p className="muted" style={{ margin: '0 0 1rem' }}>
            <strong>{activeSubLevel.categoryName} • {activeSubLevel.title}</strong> seviyesindeki {sessionResults.length} kelime başarıyla tamamlandı.
            FSRS algoritması bu kelimelerin sonraki tekrar tarihlerini başarı durumuna göre ayarladı.
          </p>

          <div className={styles.resultScoreRow}>
            <div className={styles.scoreStat}>
              <span className={styles.scoreStatNum}>{sessionResults.length}</span>
              <span className={styles.scoreStatLbl}>Toplam Soru</span>
            </div>
            <div className={styles.scoreStat}>
              <span className={styles.scoreStatNum} style={{ color: 'var(--success)' }}>
                {sessionResults.filter((r) => r.score >= 4).length}
              </span>
              <span className={styles.scoreStatLbl}>Öğrenildi (4-5)</span>
            </div>
            <div className={styles.scoreStat}>
              <span className={styles.scoreStatNum} style={{ color: 'var(--error)' }}>
                {sessionResults.filter((r) => r.score <= 2).length}
              </span>
              <span className={styles.scoreStatLbl}>Öğrenilmedi (1-2)</span>
            </div>
            <div className={styles.scoreStat}>
              <span className={styles.scoreStatNum} style={{ color: 'var(--warning)' }}>
                {sessionResults.filter((r) => r.score === 3).length}
              </span>
              <span className={styles.scoreStatLbl}>Gelişmekte (3)</span>
            </div>
          </div>

          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '1.25rem 0 0.5rem', textAlign: 'left' }}>
            📋 Bu Seviyede Çalışılan Kelimeler
          </h3>

          <div className={styles.wordReviewList}>
            {sessionResults.map((r, i) => (
              <div key={i} className={styles.reviewItem}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <strong>{r.word.term}</strong>
                  <span className="muted" style={{ fontSize: '0.85rem' }}>
                    — {r.word.definition}
                  </span>
                </div>
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    color: MASTERY_CONFIG[r.score].color,
                    padding: '0.2rem 0.5rem',
                    borderRadius: '4px',
                    background: 'var(--surface-strong)',
                    border: '1px solid var(--border)',
                  }}
                >
                  {MASTERY_CONFIG[r.score].badge} {MASTERY_CONFIG[r.score].label}
                </span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '1.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => startLevelSession(activeSubLevel, 0)}
            >
              🔄 Aynı Seviyeyi Tekrar Çalış
            </button>

            {/* Sonraki Seviyeye Geç Butonu */}
            {categorySubLevels[activeSubLevel.levelNumber] && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => startLevelSession(categorySubLevels[activeSubLevel.levelNumber], 0)}
              >
                Sonraki Seviyeye Geç (Level {activeSubLevel.levelNumber + 1}) →
              </button>
            )}

            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setPhase('setup')}
            >
              🗂️ Seviye Listesine Dön
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => navigate('/')}
            >
              🏠 Ana Sayfaya Dön
            </button>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 1: KELİMEYİ GRUBA EKLEME VE SIRALAMA MODALI
          ======================================================== */}
      {showAddToGroupModal && currentQ && (
        <div
          className={styles.modalBackdrop}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowAddToGroupModal(false)
            }
          }}
        >
          <div className={styles.modalCard} role="dialog" aria-modal="true">
            <div className={styles.modalHead}>
              <div>
                <h3 className={styles.modalHeadTitle}>
                  <span>📁</span>
                  <span>Kelimeyi Gruba Ekle</span>
                </h3>
                <p className={styles.modalHeadSub}>
                  <strong>{currentQ.word.term}</strong> — {currentQ.word.definition}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setShowAddToGroupModal(false)}
                style={{ padding: '0.2rem 0.5rem', fontSize: '1.1rem' }}
                title="Kapat"
              >
                ✕
              </button>
            </div>

            {/* SEÇİM SEKMELERİ: Mevcut Grup vs Yeni Grup */}
            {customGroups.length > 0 && (
              <div className={styles.modalTabs}>
                <button
                  type="button"
                  className={`${styles.modalTabBtn} ${!isCreatingInGroupModal ? styles.modalTabBtnActive : ''}`}
                  onClick={() => setIsCreatingInGroupModal(false)}
                >
                  📋 Mevcut Gruplardan Seç
                </button>
                <button
                  type="button"
                  className={`${styles.modalTabBtn} ${isCreatingInGroupModal ? styles.modalTabBtnActive : ''}`}
                  onClick={() => setIsCreatingInGroupModal(true)}
                >
                  ➕ Yeni Grup Oluştur
                </button>
              </div>
            )}

            <form onSubmit={handleModalAddToGroup} className={styles.modalForm}>
              {!isCreatingInGroupModal && customGroups.length > 0 ? (
                <div className={styles.modalField}>
                  <label htmlFor="select-target-group" className={styles.modalLabel}>
                    Hedef Grup:
                  </label>
                  <select
                    id="select-target-group"
                    className={styles.modalInput}
                    value={targetGroupId || (customGroups[0]?.id ?? '')}
                    onChange={(e) => setTargetGroupId(e.target.value)}
                  >
                    {customGroups.map((g) => {
                      const count = (g.wordIds || []).length
                      const isMember = (g.wordIds || []).includes(currentQ.word.id)
                      return (
                        <option key={g.id} value={g.id}>
                          {g.name} ({count} kelime){isMember ? ' — Zaten bu grupta ✓' : ''}
                        </option>
                      )
                    })}
                  </select>
                </div>
              ) : (
                <div className={styles.modalField}>
                  <label htmlFor="input-new-group-name" className={styles.modalLabel}>
                    Yeni Grup Adı:
                  </label>
                  <input
                    id="input-new-group-name"
                    type="text"
                    required
                    className={styles.modalInput}
                    placeholder="Örn: Sınav Öncesi Hızlı Tekrar"
                    value={modalNewGroupName}
                    onChange={(e) => setModalNewGroupName(e.target.value)}
                    autoFocus
                  />
                  <p className={styles.modalHelp}>
                    Bu grup seviyelerden bağımsız olarak dilediğiniz kelimeleri toplamanızı sağlar.
                  </p>
                </div>
              )}

              {/* SIRALAMA / POZİSYON GİRİŞİ */}
              <div className={styles.modalField}>
                <label htmlFor="input-target-position" className={styles.modalLabel}>
                  Gruptaki Sırası (İsteğe Bağlı):
                </label>
                <input
                  id="input-target-position"
                  type="number"
                  min="1"
                  className={styles.modalInput}
                  placeholder="Boş bırakırsanız en sona eklenir (Örn: 4)"
                  value={targetPositionInput}
                  onChange={(e) => setTargetPositionInput(e.target.value)}
                />
                <p className={styles.modalHelp}>
                  💡 <strong>Nasıl çalışır?</strong> Boş bırakırsanız veya gruptaki toplam elemandan büyük yazarsanız kelime en sona eklenir. Eğer örneğin <strong>4</strong> yazarsanız, kelime 4. sıraya yerleşir ve 4. sıradan sonraki kelimeler birer sıra kaydırılır.
                </p>
              </div>

              <div className={styles.modalFoot}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setShowAddToGroupModal(false)}
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  id="btn-confirm-add-to-group"
                >
                  ✓ Gruba Ekle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 2: SEVİYE LİSTESİNDEN YENİ ÖZEL GRUP OLUŞTURMA
          ======================================================== */}
      {showCreateGroupModal && (
        <div
          className={styles.modalBackdrop}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCreateGroupModal(false)
          }}
        >
          <div className={styles.modalCard} role="dialog" aria-modal="true">
            <div className={styles.modalHead}>
              <div>
                <h3 className={styles.modalHeadTitle}>
                  <span>📁</span>
                  <span>Yeni Özel Çalışma Grubu</span>
                </h3>
                <p className={styles.modalHeadSub}>
                  Kendi kelime grubunuzu oluşturun ve seviyelerden bağımsız çalışın.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setShowCreateGroupModal(false)}
                style={{ padding: '0.2rem 0.5rem', fontSize: '1.1rem' }}
                title="Kapat"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateGroupSubmit} className={styles.modalForm}>
              <div className={styles.modalField}>
                <label htmlFor="create-group-name" className={styles.modalLabel}>
                  Grup Adı:
                </label>
                <input
                  id="create-group-name"
                  type="text"
                  required
                  className={styles.modalInput}
                  placeholder="Örn: YDS Phrasal Verbs"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  autoFocus
                />
              </div>

              <div className={styles.modalField}>
                <label htmlFor="create-group-desc" className={styles.modalLabel}>
                  Açıklama (İsteğe Bağlı):
                </label>
                <input
                  id="create-group-desc"
                  type="text"
                  className={styles.modalInput}
                  placeholder="Örn: Sık çıkan deyimsel fiiller"
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                />
              </div>

              <div className={styles.modalFoot}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setShowCreateGroupModal(false)}
                >
                  Vazgeç
                </button>
                <button type="submit" className="btn btn-primary">
                  Oluştur
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}

