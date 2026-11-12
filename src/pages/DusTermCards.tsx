import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DUS_SUBJECTS, DUS_TESTS } from '../services/dus'
import {
  isLearned,
  levelSummary,
  levelsOf,
  loadConcepts,
  readTermScores,
  saveTermScore,
  termsOfSubject,
  type Concept,
  type TermScores,
} from '../services/dusConcepts'
import { useUserStore } from '../stores/user'
import study from './Study.module.css'
import styles from './DusConcepts.module.css'

// DUS Terim kartları (/dus/kavramlar/terimler): kavram sözlüğündeki terimler YDS kelime kartlarının düzeniyle çalışılır.
// Sıra: Temel / Klinik Bilimler → ders (16) → 20'lik seviyeler (en sık sorulan terim önce) → kart: çevir, 1–5 puanla.
// Görünüm Study.module.css'ten alınır; puanlar bu cihazda kalır (yds-dus-terim:<kullanıcı>).

interface Session {
  title: string
  items: Concept[]
  /** Sıradaki seviye varsa özet ekranında "Sonraki seviye" çıkar */
  next?: () => void
}

const GRADE_LABELS: Record<number, string> = {
  1: 'Hiç bilmiyorum',
  2: 'Zor hatırladım',
  3: 'Kararsızım',
  4: 'Biliyorum',
  5: 'Çok iyi biliyorum',
}

export function DusTermCards() {
  const userId = useUserStore((s) => s.activeUserId)
  const [all, setAll] = useState<Concept[] | null>(null)
  const [scores, setScores] = useState<TermScores>(() => readTermScores(userId))
  const [subjectId, setSubjectId] = useState<string | null>(null)
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    let live = true
    void loadConcepts().then((c) => live && setAll(c))
    return () => {
      live = false
    }
  }, [])

  const bySubject = useMemo(() => {
    const m = new Map<string, Concept[]>()
    for (const s of DUS_SUBJECTS) m.set(s.id, termsOfSubject(all ?? [], s.id))
    return m
  }, [all])

  if (!all) return <p className="muted">Yükleniyor…</p>
  if (all.length === 0) return <p className="muted">Terim sözlüğü bu cihazda yok. Kaynak paketini yenile.</p>

  if (session) {
    return (
      <Deck
        key={session.title}
        session={session}
        scores={scores}
        onScore={(key, score) => setScores(saveTermScore(userId, key, score))}
        onClose={() => setSession(null)}
      />
    )
  }

  // 1) Ders seçimi: önce Temel, sonra Klinik Bilimler
  if (!subjectId) {
    return (
      <>
        {DUS_TESTS.map((t) => (
          <section key={t.key} className={styles.group}>
            <h2 className={styles.groupTitle}>{t.title.replace(' Testi', '')}</h2>
            <div className={styles.subjects}>
              {DUS_SUBJECTS.filter((s) => s.test === t.key).map((s) => {
                const terms = bySubject.get(s.id) ?? []
                const learned = terms.filter((c) => isLearned(scores[c.key])).length
                return (
                  <button key={s.id} type="button" className={styles.subject} disabled={terms.length === 0} onClick={() => setSubjectId(s.id)}>
                    <span className={styles.subjectIcon}>{s.icon}</span>
                    <strong>{s.title}</strong>
                    <small>
                      {terms.length} terim · {levelsOf(terms).length} seviye
                    </small>
                    <span className={styles.meter} aria-hidden="true">
                      <span style={{ width: `${terms.length ? (learned / terms.length) * 100 : 0}%` }} />
                    </span>
                    <small>{learned} öğrenildi</small>
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </>
    )
  }

  // 2) Seviye seçimi
  const subject = DUS_SUBJECTS.find((s) => s.id === subjectId)!
  const terms = bySubject.get(subjectId) ?? []
  const levels = levelsOf(terms)
  const weak = terms.filter((c) => scores[c.key] && !isLearned(scores[c.key]))

  const startLevel = (i: number) => {
    const from = i * 20 + 1
    setSession({
      title: `${subject.title} · Seviye ${i + 1} (${from}–${from + levels[i].length - 1})`,
      items: levels[i],
      next: i + 1 < levels.length ? () => startLevel(i + 1) : undefined,
    })
  }

  return (
    <>
      <div className={styles.bar}>
        <button type="button" className="btn btn-ghost" onClick={() => setSubjectId(null)}>
          ← Dersler
        </button>
        {weak.length > 0 && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setSession({ title: `${subject.title} · Bilmediklerim`, items: weak })}
          >
            🔁 Bilmediklerim ({weak.length})
          </button>
        )}
      </div>
      <h2 className={styles.groupTitle}>
        {subject.icon} {subject.title}
      </h2>
      <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
        {terms.length} terim, 20’şerlik {levels.length} seviye. İlk seviyeler sorularda en sık geçen terimlerdir.
      </p>
      <div className={study.levelsGrid}>
        {levels.map((lvl, i) => {
          const sum = levelSummary(lvl, scores)
          const inProgress = sum.done > 0 && sum.done < sum.total
          const completed = sum.done === sum.total
          const from = i * 20 + 1
          return (
            <div
              key={i}
              className={`${study.levelCard} ${inProgress ? study.levelCard_in_progress : completed ? study.levelCard_completed : ''}`}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <span
                    className={`${study.statusTag} ${
                      inProgress ? study.statusTag_in_progress : completed ? study.statusTag_completed : study.statusTag_not_started
                    }`}
                  >
                    {inProgress ? `⏳ Yarıda (${sum.done}/${sum.total})` : completed ? `✅ %${sum.percent} Başarı` : '⚪ Başlanmadı'}
                  </span>
                  <span className="muted" style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                    #{i + 1}
                  </span>
                </div>
                <h4 className={study.levelCardTitle}>Seviye {i + 1}</h4>
                <p className={study.levelCardRange}>
                  {from}–{from + lvl.length - 1} • {lvl.length} Terim
                </p>
              </div>
              <button
                type="button"
                className={`${study.levelCardBtn} ${!completed ? study.levelCardBtn_primary : ''}`}
                onClick={() => startLevel(i)}
              >
                {inProgress ? `▶ Devam Et (${sum.done + 1}. Terim)` : completed ? '🔄 Tekrar Çalış' : `Çalış (${lvl.length} Terim) →`}
              </button>
            </div>
          )
        })}
      </div>
    </>
  )
}

function Deck({
  session,
  scores,
  onScore,
  onClose,
}: {
  session: Session
  scores: TermScores
  onScore: (key: string, score: number) => void
  onClose: () => void
}) {
  const { items } = session
  // Yarıda kalan seviyede ilk puanlanmamış terimden devam; hepsi puanlıysa baştan
  const [index, setIndex] = useState(() => {
    const i = items.findIndex((c) => !scores[c.key])
    return i < 0 ? 0 : i
  })
  const [flipped, setFlipped] = useState(false)
  const [results, setResults] = useState<Record<string, number>>({})
  const [finished, setFinished] = useState(false)
  const card = items[index]
  const rootRef = useRef<HTMLDivElement>(null)

  // Telefonda kart, sayfa başlığı ve sekmelerin altında kalmasın
  useEffect(() => {
    rootRef.current?.scrollIntoView({ block: 'start' })
  }, [])

  const go = useCallback(
    (i: number) => {
      if (i < 0) return
      if (i >= items.length) setFinished(true)
      else setIndex(i)
      setFlipped(false)
    },
    [items.length],
  )

  const grade = useCallback(
    (score: number) => {
      onScore(card.key, score)
      setResults((r) => ({ ...r, [card.key]: score }))
      go(index + 1)
    },
    [card, go, index, onScore],
  )

  // YDS kartlarındaki kısayollar: Boşluk çevirir, 1–5 puanlar, oklar gezdirir
  useEffect(() => {
    if (finished) return
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return
      if (e.key === ' ') {
        e.preventDefault()
        setFlipped((f) => !f)
      } else if (e.key >= '1' && e.key <= '5') grade(Number(e.key))
      else if (e.key === 'ArrowRight') go(index + 1)
      else if (e.key === 'ArrowLeft') go(index - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [finished, grade, go, index])

  if (finished) {
    const graded = Object.values(results)
    const learned = graded.filter((s) => isLearned(s)).length
    return (
      <div className={study.resultCard}>
        <div style={{ fontSize: '3rem' }}>🎉</div>
        <h2 className={study.resultTitle}>Bitti!</h2>
        <p className="muted" style={{ margin: '0 0 1rem' }}>
          <strong>{session.title}</strong>
          <br />
          {graded.length === 0
            ? 'Bu turda terim puanlamadın.'
            : `${graded.length} terimden ${learned} tanesini öğrendin (%${Math.round((learned / graded.length) * 100)}).`}
        </p>
        <div className={styles.endBtns}>
          {session.next && (
            <button type="button" className="btn btn-primary" onClick={session.next}>
              Sonraki seviye →
            </button>
          )}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setResults({})
              setIndex(0)
              setFlipped(false)
              setFinished(false)
            }}
          >
            🔄 Tekrar çalış
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Seviyelere dön
          </button>
        </div>
      </div>
    )
  }

  const subject = DUS_SUBJECTS.find((s) => s.id === card.main)
  const prev = scores[card.key]

  const grading = (
    <div className={study.gradingContainer}>
      <div className={study.dualActionRow}>
        <button type="button" className={study.actionBtnFail} onClick={() => grade(1)} title="Öğrenmedim (Kısayol: 1)">
          <span>❌</span>
          <span>Öğrenmedim (1)</span>
        </button>
        <button type="button" className={study.actionBtnSuccess} onClick={() => grade(4)} title="Öğrendim (Kısayol: 4)">
          <span>✅</span>
          <span>Öğrendim (4)</span>
        </button>
      </div>
      <div className={study.numericGradeRow}>
        <span className={study.numericGradeLabel}>Öğrenme Düzeyi (1 - 5):</span>
        {[1, 2, 3, 4, 5].map((score) => (
          <button
            key={score}
            type="button"
            className={`${study.numericBtn} ${study[`numericBtn_${score}` as keyof typeof study]}`}
            onClick={() => grade(score)}
            title={`${score}: ${GRADE_LABELS[score]}`}
          >
            {score}
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <div className={styles.deck} ref={rootRef}>
      <div className={styles.bar}>
        <strong style={{ fontSize: '0.9rem' }}>{session.title}</strong>
        <button type="button" className="btn btn-ghost" style={{ color: 'var(--error)' }} onClick={() => setFinished(true)}>
          ✕ Oturumu Bitir
        </button>
      </div>

      <div className={study.progressBar} aria-hidden="true">
        <div className={study.progressFill} style={{ width: `${((index + 1) / items.length) * 100}%` }} />
      </div>

      <div className={`${study.cardStage} ${styles.stage}`}>
        <div className={study.cardFlip}>
          <div className={study.cardHeadRow}>
            <span className={study.cardSubPrompt}>
              {subject ? `${subject.icon} ${subject.title}` : 'DUS'} • {card.count} soruda geçti
            </span>
            {prev ? <span className="muted" style={{ fontSize: '0.8rem' }}>Son puan: {prev}</span> : null}
          </div>

          <div className={study.faceContainer}>
            <div className={study.topPromptBlock}>
              <div className={`${study.mainPromptCenter} ${styles.prompt}`}>
                {!flipped ? (
                  <h2 className={`${study.promptMainWord} ${styles.promptTerm}`}>{card.terim}</h2>
                ) : (
                  <>
                    <h2 className={`${study.promptMainWord} ${styles.promptKisa}`}>{card.kisa}</h2>
                    <div className={study.promptSubWord}>
                      <span>{card.terim}</span>
                    </div>
                  </>
                )}
              </div>
              <div className={study.centerFlipWrap}>
                <button
                  type="button"
                  className={`${study.centerFlipBtn} ${flipped ? study.centerFlipBtnBack : ''}`}
                  onClick={() => setFlipped(!flipped)}
                >
                  {flipped ? '🔄 Ön Yüze Dön' : '🔄 Kartı Çevir'}
                </button>
              </div>
            </div>

            {flipped ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div className={`${study.subtleDetailsArea} ${styles.explain}`}>
                  <span className={study.subtleLabel}>Açıklama:</span>
                  <p>{card.aciklama}</p>
                  {card.koken && (
                    <>
                      <span className={study.subtleLabel}>Köken:</span>
                      <p>{card.koken}</p>
                    </>
                  )}
                </div>
                {grading}
              </div>
            ) : (
              <div className={study.frontBottomBlock}>{grading}</div>
            )}
          </div>
        </div>

        <div className={study.navRow}>
          <button type="button" className={study.navBtn} disabled={index === 0} onClick={() => go(index - 1)}>
            ← Önceki
          </button>
          <span className="muted" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
            {index + 1} / {items.length}
          </span>
          <button type="button" className={study.navBtn} onClick={() => go(index + 1)}>
            {index + 1 < items.length ? 'Sonraki →' : 'Sonuçları Gör 🏁'}
          </button>
        </div>
      </div>
    </div>
  )
}
