import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  DUS_TESTS,
  dusItemsOf,
  listDusExams,
  readDusAnswers,
  saveDusAnswer,
  subjectOf,
  type DusAnswers,
  type DusQueueItem,
} from '../services/dus'
import {
  DUS_GRADES,
  dueDusKeys,
  dusDeckCounts,
  dusDeckGrade,
  dusDeckRemove,
  dusTodayCounts,
  flagDusQuestion,
  pickDusNewKeys,
  previewDusGrades,
  readDusDeck,
  readDusGoal,
  recordDusAnswer,
  type DusGrade,
} from '../services/dusSrs'
import { useUserStore } from '../stores/user'
import { QuestionCard } from './Dus'
import styles from './ExamStudy.module.css'
import { QuickAnswerToggle, useQuestionNav, useQuickAnswer } from './exam/answerControls'

// DUS tekrar ekranı (/dus/tekrar) ve bugünün seti (/dus/bugun). Tekrar: vadesi gelen sorular sırayla; doğru cevaptan
// sonra Zor / İyi / Kolay seçilir, yanlışta otomatik "Tekrar" (ertesi gün). Bugünün seti: önce tekrarlar, sonra en
// zayıf dersten başlayarak çözülmemiş yeni sorular (dusSrs.ts › pickDusNewKeys). Kuyruk açılışta bir kez kurulur.

interface Item extends DusQueueItem {
  kind: 'tekrar' | 'yeni'
}
type Done = { c: string; ok: boolean; grade?: DusGrade }

async function buildQueue(userId: string, daily: boolean): Promise<Item[]> {
  const deck = readDusDeck(userId)
  const reviews = (await dusItemsOf(dueDusKeys(deck))).map((it) => ({ ...it, kind: 'tekrar' as const }))
  if (!daily) return reviews
  const answers = readDusAnswers(userId)
  const newLeft = Math.max(0, readDusGoal() - dusTodayCounts(answers).fresh)
  if (!newLeft) return reviews
  const exams = await listDusExams()
  // İptal edilen sorular yüklenirken elenir: birkaç fazla aday
  const fresh = await dusItemsOf(pickDusNewKeys(answers, exams.map((e) => e.id), newLeft + 10))
  return [...reviews, ...fresh.slice(0, newLeft).map((it) => ({ ...it, kind: 'yeni' as const }))]
}

function Review({ userId, daily }: { userId: string; daily: boolean }) {
  const [items, setItems] = useState<Item[] | null>(null)
  const [pos, setPos] = useState(0)
  const [done, setDone] = useState<Record<string, Done>>({})
  const [all, setAll] = useState<DusAnswers>(() => readDusAnswers(userId))
  const [deck, setDeck] = useState(() => readDusDeck(userId))
  const [quick, setQuick] = useQuickAnswer()

  useEffect(() => {
    let alive = true
    void buildQueue(userId, daily).then((list) => alive && setItems(list))
    return () => {
      alive = false
    }
  }, [userId, daily])

  const count = items?.length ?? 0
  const it = items && pos < count ? items[pos] : null
  const cur = it ? done[it.key] : undefined
  // Sonraki soruya geçmek için cevap (tekrar sorusunda doğruysa derece de) gerekir
  const canNext = !!cur && (it?.kind !== 'tekrar' || !!cur.grade)
  const swipe = useQuestionNav(
    () => setPos((p) => Math.max(0, p - 1)),
    () => canNext && setPos((p) => p + 1),
    { canPrev: pos > 0 && pos < count, canNext, note: it ? `/dus/${it.exam.id}/${it.test}#Soru ${it.q.n}` : null },
  )
  const intervals = useMemo(() => (it && cur?.ok && !cur.grade ? previewDusGrades(deck, it.key) : null), [it, cur, deck])

  const title = daily ? '📅 Bugünün seti' : '🔁 Tekrar'
  const back = (
    <Link to="/dus" className={styles.backLink}>
      ← DUS
    </Link>
  )

  if (!items) return <p className="muted">Hazırlanıyor…</p>
  if (!count)
    return (
      <section className={styles.page}>
        {back}
        <h1 className={styles.title}>{title}</h1>
        <p>
          {daily
            ? 'Bugünkü set tamam: tekrar yok, günlük yeni soru hedefine ulaştın. Hedefi DUS ana sayfasındaki − / + ile değiştirebilirsin.'
            : 'Bugün tekrar edilecek soru yok; yanlış cevapladığın ya da ⭐ ile işaretlediğin sorular ertesi gün burada çıkar.'}
        </p>
      </section>
    )

  if (!it) {
    const list = Object.entries(done)
    const kindOf = new Map(items.map((x) => [x.key, x.kind]))
    const rev = list.filter(([k]) => kindOf.get(k) === 'tekrar')
    const fresh = list.filter(([k]) => kindOf.get(k) === 'yeni')
    const counts = dusDeckCounts(deck)
    return (
      <section className={styles.page}>
        {back}
        <h1 className={styles.title}>{title} · bitti 🎉</h1>
        <article className={`card ${styles.dusSummary}`}>
          {rev.length > 0 && (
            <p>
              🔁 Tekrar: <b>{rev.length}</b> soru · doğru {rev.filter(([, d]) => d.ok).length}
            </p>
          )}
          {fresh.length > 0 && (
            <p>
              🆕 Yeni: <b>{fresh.length}</b> soru · doğru {fresh.filter(([, d]) => d.ok).length}
            </p>
          )}
          <p className="muted">
            Tekrar destesinde {counts.total} soru · yarın {counts.tomorrow} · 7 gün içinde {counts.week}.
          </p>
          <Link to="/dus" className="btn btn-primary">
            DUS ana sayfasına dön
          </Link>
        </article>
      </section>
    )
  }

  const t = DUS_TESTS.find((x) => x.key === it.test)!
  const reviewCount = items.filter((x) => x.kind === 'tekrar').length

  function answer(l: string) {
    const ok = l === it!.q.answer
    if (it!.kind === 'tekrar') {
      // Tekrarda cevap kaydı güncellenir; yanlışsa otomatik "Tekrar" (ertesi gün)
      setAll(saveDusAnswer(userId, it!.key, l, ok))
      if (!ok) setDeck(dusDeckGrade(userId, it!.key, 'tekrar'))
      setDone((d) => ({ ...d, [it!.key]: { c: l, ok, grade: ok ? undefined : 'tekrar' } }))
    } else {
      setAll(recordDusAnswer(userId, it!.key, l, ok))
      setDeck(readDusDeck(userId))
      setDone((d) => ({ ...d, [it!.key]: { c: l, ok } }))
    }
  }
  function grade(g: DusGrade) {
    setDeck(dusDeckGrade(userId, it!.key, g))
    setDone((d) => ({ ...d, [it!.key]: { ...d[it!.key], grade: g } }))
    setPos((p) => p + 1)
  }
  function remove() {
    if (!confirm('Bu soru tekrar destesinden çıkarılsın mı?')) return
    setDeck(dusDeckRemove(userId, it!.key))
    setDone((d) => ({ ...d, [it!.key]: { ...d[it!.key], grade: d[it!.key]?.grade ?? 'iyi' } }))
  }

  return (
    <section className={styles.page} {...swipe.props}>
      <header className={styles.compactHead}>
        {back}
        <h1>{title}</h1>
        <span className="muted" style={{ fontSize: '0.85rem' }}>
          {pos + 1} / {count}
          {daily && reviewCount > 0 && ` · ${reviewCount} tekrar, ${count - reviewCount} yeni`}
        </span>
      </header>
      <QuestionCard
        key={it.key}
        exam={it.exam}
        test={it.test}
        q={it.q}
        title={`${it.kind === 'tekrar' ? '🔁' : '🆕'} ${it.exam.title} · ${t.short} · Soru ${it.q.n}`}
        chip={subjectOf(it.test, it.q.n)}
        saved={cur}
        quick={quick}
        onAnswer={answer}
        flagged={all[it.key]?.flag}
        onFlag={(on) => {
          setAll(flagDusQuestion(userId, it.key, on))
          setDeck(readDusDeck(userId))
        }}
        footer={
          // Cevaplanmadan ya da derece seçilmeden ilerleme düğmesi yok (derece düğmeleri kartın altında)
          !canNext ? null : (
            <>
              {it.kind === 'tekrar' && deck[it.key] && !deck[it.key].x && (
                <button type="button" className="btn btn-ghost" onClick={remove} data-focus-hide>
                  Desteden çıkar
                </button>
              )}
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => void swipe.turn(1)}
                data-focus-hide
              >
                {pos === count - 1 ? 'Bitir' : 'Sonraki →'}
              </button>
            </>
          )
        }
      />
      {intervals && (
        <div className={`card ${styles.dusGrades}`} data-noswipe>
          <small className="muted">Ne kadar zorlandın? Seçimine göre soru yeniden sorulur.</small>
          <div className={styles.dusGradeRow}>
            {DUS_GRADES.map(({ grade: g, label }) => (
              <button key={g} type="button" className="btn btn-secondary" onClick={() => grade(g)}>
                {label}
                <small>{intervals[g]}</small>
              </button>
            ))}
          </div>
        </div>
      )}
      <QuickAnswerToggle value={quick} onChange={setQuick} />
    </section>
  )
}

/** Kullanıcı değişince ekran baştan kurulur. */
export default function DusReview({ daily = false }: { daily?: boolean }) {
  const userId = useUserStore((s) => s.activeUserId)
  return <Review key={`${userId}/${daily}`} userId={userId} daily={daily} />
}
