import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { Link, Route, Routes, useNavigate } from 'react-router-dom'
import { db } from '../db'
import { migrateLegacyExamProgress, summarizeBySection } from '../services/examProgress'
import { EXAM_COLLECTED_TAG } from '../services/groups'
import { ALL_SECTIONS, rangeIn } from '../services/ydsSections'
import { useUserStore } from '../stores/user'
import styles from './ExamStudy.module.css'
import { inPool, listExams, POOLS, readPool, savePool, type ExamMeta, type Pool } from './exam/examData'
import { BankList } from './exam/BankList'
import { ImageTestList, ImageTestRunner } from './exam/ImageTests'
import { CustomMock } from './exam/CustomMock'
import { MockExam } from './exam/MockExam'
import { MockHistory } from './exam/MockHistory'
import { TargetPlanner } from './exam/TargetPlanner'
import { PracticeExam } from './exam/PracticeExam'
import { TacticsBookPage } from './exam/TacticsBookPage'
import { MistakeAnalysis } from './exam/MistakeAnalysis'
import { ReadingList, ReadingPassage, ReadingQuestions } from './exam/ReadingMode'
import { TopicPractice } from './exam/TopicPractice'
import { WrongBook } from './exam/WrongBook'

// YDS Soru Merkezi. Veri yalnızca yerel geliştirme sunucusundan gelir (/local-api/yds);
// yayın derlemesinde bu sayfa hiç bulunmaz (bkz. App.tsx).

const QUESTIONS_PER_EXAM = 80

function Bar({ value, tone }: { value: number; tone?: 'ok' | 'mid' | 'bad' }) {
  return (
    <span className={styles.bar} aria-hidden="true">
      <span className={`${styles.barFill} ${tone ? styles[`tone_${tone}`] : ''}`} style={{ width: `${value}%` }} />
    </span>
  )
}

function toneOf(percent: number | null): 'ok' | 'mid' | 'bad' | undefined {
  if (percent === null) return undefined
  return percent >= 75 ? 'ok' : percent >= 50 ? 'mid' : 'bad'
}

function Hub() {
  const navigate = useNavigate()
  const userId = useUserStore((s) => s.activeUserId)
  const [allExams, setAllExams] = useState<ExamMeta[] | null>(null)
  const [pool, setPoolState] = useState<Pool>(readPool)
  const [error, setError] = useState('')

  useEffect(() => {
    listExams()
      .then(setAllExams)
      .catch(() => setError('Sınav verisi okunamadı. Bu sayfa yalnızca yerelde (npm run dev) çalışır.'))
  }, [])

  const answers = useLiveQuery(() => db.examAnswers.where('userId').equals(userId).toArray(), [userId])
  const collectedCount = useLiveQuery(
    () => db.words.where('tags').equals(EXAM_COLLECTED_TAG).filter((w) => w.userId === userId && !w.isDeleted).count(),
    [userId],
  )
  const exams = useMemo(() => (allExams ?? []).filter((e) => inPool(e, pool)), [allExams, pool])
  const sectionStats = useMemo(() => {
    const ids = new Set(exams.map((e) => e.id))
    return summarizeBySection((answers ?? []).filter((a) => ids.has(a.examId)))
  }, [answers, exams])
  const perExam = useMemo(() => {
    const m = new Map<string, { answered: number; correct: number }>()
    for (const a of answers ?? []) {
      const s = m.get(a.examId) ?? { answered: 0, correct: 0 }
      s.answered++
      if (a.correct) s.correct++
      m.set(a.examId, s)
    }
    return m
  }, [answers])

  if (error) {
    return (
      <section className="card">
        <p>{error}</p>
        <Link to="/" className="btn btn-secondary">
          ← Ana sayfa
        </Link>
      </section>
    )
  }
  if (!allExams || !answers) return <p className="muted">Yükleniyor…</p>
  const setPool = (p: Pool) => {
    savePool(p)
    setPoolState(p)
  }
  const hasYokdil = allExams.some((e) => e.kind === 'yokdil')

  const examIds = new Set(exams.map((e) => e.id))
  const poolAnswers = answers.filter((a) => examIds.has(a.examId))
  const wrongCount = poolAnswers.filter((a) => a.inWrongBook).length
  const totalAnswered = poolAnswers.length
  const totalCorrect = poolAnswers.filter((a) => a.correct).length
  const totalQuestions = exams.length * QUESTIONS_PER_EXAM
  let lastId = ''
  try {
    lastId = localStorage.getItem('yds-exam-last') || ''
  } catch {
    // yoksay
  }
  const last = exams.find((e) => e.id === lastId)
  const lastStat = last ? perExam.get(last.id) : undefined
  const weakest = sectionStats
    .filter((s) => s.answered >= 5 && s.percent !== null)
    .sort((a, b) => (a.percent ?? 0) - (b.percent ?? 0))[0]

  return (
    <section className={styles.page}>
      <header className={styles.head}>
        <div>
          <h1 className={styles.title}>📖 {hasYokdil ? 'YDS / YÖKDİL Soru Merkezi' : 'YDS Soru Merkezi'}</h1>
          <p className="muted" style={{ margin: 0 }}>
            {exams.length} çıkmış sınav · {totalQuestions.toLocaleString('tr-TR')} soru · Çözülen{' '}
            {totalAnswered.toLocaleString('tr-TR')}
            {totalAnswered > 0 && ` · Başarı %${Math.round((totalCorrect / totalAnswered) * 100)}`}
          </p>
          <Link to="/yds-test" className={styles.collectedLink} style={{ marginRight: '1rem' }}>
            📝 Alıştırma Merkezi
          </Link>
          <Link to="analiz" className={styles.collectedLink} style={{ marginRight: '1rem' }}>
            🔍 Hatalarımı analiz et
          </Link>
          <Link to="taktik" className={styles.collectedLink} style={{ marginRight: '1rem' }}>
            📒 Taktik Kitabı
          </Link>
          {Boolean(collectedCount) && (
            <Link to="/study?group=yds_collected" className={styles.collectedLink}>
              📥 Sorulardan topladığın {collectedCount} kelimeyi çalış →
            </Link>
          )}
        </div>
      </header>

      {hasYokdil && (
        <div className={styles.poolBar} role="group" aria-label="Sınav havuzu">
          {POOLS.map((p) => (
            <button key={p.key} type="button" className={`${styles.poolChip} ${pool === p.key ? styles.poolOn : ''}`} onClick={() => setPool(p.key)}>
              {p.label}
            </button>
          ))}
        </div>
      )}

      {/* Hızlı başlangıç: en fazla iki kart */}
      <div className={styles.quickGrid}>
        <button
          type="button"
          className={`card ${styles.quickCard} ${styles.quickPrimary}`}
          disabled={exams.length === 0}
          onClick={() => navigate(`sinav/${last?.id ?? exams[exams.length - 1].id}`)}
        >
          <span className={styles.quickIcon}>▶</span>
          <span className={styles.quickBody}>
            <strong>{last ? 'Kaldığın yerden devam et' : 'Çözmeye başla'}</strong>
            <span>
              {last
                ? `${last.title} · ${lastStat?.answered ?? 0}/${QUESTIONS_PER_EXAM} çözüldü`
                : exams.length ? `${exams[exams.length - 1].title} — en yeni sınav` : 'Bu havuzda sınav yok'}
            </span>
          </span>
        </button>
        <button
          type="button"
          className={`card ${styles.quickCard}`}
          onClick={() => navigate('yanlislar')}
          disabled={wrongCount === 0}
          title={wrongCount === 0 ? 'Yanlış yaptığın sorular burada toplanır.' : undefined}
        >
          <span className={styles.quickIcon}>📕</span>
          <span className={styles.quickBody}>
            <strong>Yanlış Defteri {wrongCount > 0 && <span className={styles.countPill}>{wrongCount}</span>}</strong>
            <span>
              {wrongCount === 0
                ? 'Yanlış yaptığın sorular burada toplanır; doğru çözene kadar tekrar sorulur.'
                : 'Yanlış yaptığın soruları doğru çözene kadar tekrar et.'}
            </span>
          </span>
        </button>
        <button type="button" className={`card ${styles.quickCard}`} onClick={() => navigate('ozel')}>
          <span className={styles.quickIcon}>🎛️</span>
          <span className={styles.quickBody}>
            <strong>Özel Deneme</strong>
            <span>İstediğin soru tipleri ve sayıda, süreli mini deneme kur.</span>
          </span>
        </button>
        <button type="button" className={`card ${styles.quickCard}`} onClick={() => navigate('bankalar')}>
          <span className={styles.quickIcon}>📚</span>
          <span className={styles.quickBody}>
            <strong>Soru bankaları</strong>
            <span>MODADİL gramer bankası (500 soru, çözümlü) ve Sınav Stratejileri 3 (193 test, konulara göre).</span>
          </span>
        </button>
        <button type="button" className={`card ${styles.quickCard}`} onClick={() => navigate('okuma')}>
          <span className={styles.quickIcon}>📚</span>
          <span className={styles.quickBody}>
            <strong>Okuma Modu</strong>
            <span>Paragrafları soru baskısı olmadan oku ya da dinle, okuma hızını ölç, sonra sorularını çöz.</span>
          </span>
        </button>
      </div>

      <MockHistory />
      <TargetPlanner answers={answers} />

      {/* Konuya göre çalış + tip bazlı başarı */}
      <article className="card">
        <h2 className={styles.blockTitle}>Konuya göre çalış</h2>
        <p className={styles.blockDesc}>
          Bir soru tipini seç; tüm sınavlardan o tipteki çözmediğin sorular sırayla gelir. Çubuk, o tipteki başarını gösterir.
          {weakest && (
            <>
              {' '}
              En çok zorlandığın tip: <strong>{ALL_SECTIONS.find((s) => s.key === weakest.key)?.label}</strong>.
            </>
          )}
        </p>
        <ul className={styles.sectionList}>
          {ALL_SECTIONS.map((s) => {
            const st = sectionStats.find((x) => x.key === s.key)!
            const sectionPool = exams.reduce((n, e) => {
              const r = e.hasKey ? rangeIn(s.key, e.kind === 'yokdil' ? 'yokdil-' : '') : null
              return n + (r ? r[1] - r[0] + 1 : 0)
            }, 0)
            if (sectionPool === 0) return null
            return (
              <li key={s.key}>
                <button type="button" className={styles.sectionRow} onClick={() => navigate(`konu/${s.key}`)} title={s.hint}>
                  <span className={styles.sectionIcon}>{s.icon}</span>
                  <span className={styles.sectionName}>
                    {s.label}
                    <small>
                      {st.answered}/{sectionPool} çözüldü
                    </small>
                  </span>
                  <Bar value={st.percent ?? 0} tone={toneOf(st.percent)} />
                  <span className={styles.sectionPct}>{st.percent === null ? '—' : `%${st.percent}`}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </article>

      {/* Sınav listesi */}
      <article className="card">
        <h2 className={styles.blockTitle}>Sınavlar</h2>
        <p className={styles.blockDesc}>
          <strong>Çöz:</strong> sırayla çöz, her sorudan sonra cevabı gör. <strong>Deneme:</strong> 180 dakikalık gerçek
          sınav provası; cevaplar sonda açıklanır.
        </p>
        <ul className={styles.examList}>
          {[...exams].reverse().map((e) => {
            const st = perExam.get(e.id)
            const answered = st?.answered ?? 0
            const noKey = !e.hasKey
            return (
              <li key={e.id} className={styles.examRow}>
                <span className={styles.examName}>
                  {e.title}
                  <small>
                    {answered === 0
                      ? 'Henüz başlanmadı'
                      : `${answered}/${QUESTIONS_PER_EXAM} çözüldü · ${st!.correct} doğru`}
                    {noKey && ' · cevap anahtarı yok'}
                  </small>
                </span>
                <Bar value={(answered / QUESTIONS_PER_EXAM) * 100} />
                <span className={styles.examActions}>
                  <button type="button" className="btn btn-secondary" onClick={() => navigate(`sinav/${e.id}`)}>
                    Çöz
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={noKey}
                    onClick={() => navigate(`deneme/${e.id}`)}
                  >
                    Deneme
                  </button>
                </span>
              </li>
            )
          })}
        </ul>
      </article>
    </section>
  )
}

export function ExamStudyPage() {
  const userId = useUserStore((s) => s.activeUserId)
  const [ready, setReady] = useState(false)

  // Eski sürümde tarayıcı deposunda tutulan cevapları bir kez veritabanına taşı
  useEffect(() => {
    void migrateLegacyExamProgress(userId).finally(() => setReady(true))
  }, [userId])

  if (!ready) return <p className="muted">Yükleniyor…</p>
  return (
    <Routes>
      <Route index element={<Hub />} />
      <Route path="sinav/:examId" element={<PracticeExam />} />
      <Route path="konu/:section" element={<TopicPractice />} />
      <Route path="yanlislar" element={<WrongBook />} />
      <Route path="bankalar" element={<BankList />} />
      <Route path="bankalar/strateji-3" element={<ImageTestList />} />
      <Route path="bankalar/strateji-3/:testId" element={<ImageTestRunner />} />
      <Route path="deneme/:examId" element={<MockExam />} />
      <Route path="ozel" element={<CustomMock />} />
      <Route path="taktik" element={<TacticsBookPage />} />
      <Route path="analiz" element={<MistakeAnalysis />} />
      <Route path="okuma" element={<ReadingList />} />
      <Route path="okuma/:examId/:passageId" element={<ReadingPassage />} />
      <Route path="okuma/:examId/:passageId/sorular" element={<ReadingQuestions />} />
    </Routes>
  )
}

export default ExamStudyPage
