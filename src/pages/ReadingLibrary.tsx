import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { hasLocalContent } from '../services/localContent'
import { countWords, glossFor, loadLibrary, READING_LEVELS, type LibEntry, type LibQuestion, type ReadingLevel } from '../services/readingLibrary'
import { patchLog, readingStats, readLogs, wpmOf } from '../services/readingLog'
import { useUserStore } from '../stores/user'
import { useQuestionNav } from './exam/answerControls'
import { ReaderBody } from './exam/ReaderBody'
import ex from './ExamStudy.module.css'
import styles from './ReadingLibrary.module.css'

// Okuma Kütüphanesi: seviyeli özgün metinler (services/readingLibrary). Liste → okuyucu (ReaderBody: kelimeye dokun,
// cümle çevirisi, dinle, süre) → bitirince anlama soruları ve Türkçe özet. Yana kaydırınca aynı seviyede önceki/sonraki metin.

const LEVEL_KEY = 'yds-okuma-seviye'
type LevelFilter = ReadingLevel | 'all'

function readLevel(): LevelFilter {
  try {
    return (localStorage.getItem(LEVEL_KEY) as LevelFilter | null) ?? 'all'
  } catch {
    return 'all'
  }
}

const minutes = (words: number) => Math.max(1, Math.ceil(words / 120))

export function ReadingLibraryPage() {
  const userId = useUserStore((s) => s.activeUserId)
  const [texts, setTexts] = useState<LibEntry[] | null>(null)
  const [level, setLevel] = useState<LevelFilter>(readLevel)
  const [logs] = useState(() => readLogs(userId))

  useEffect(() => {
    void loadLibrary().then(setTexts)
  }, [])

  const stats = useMemo(() => readingStats((texts ?? []).map((t) => logs[`lib/${t.id}`]).filter(Boolean)), [texts, logs])
  const levels = READING_LEVELS.filter((l) => texts?.some((t) => t.level === l.level))

  function pick(l: LevelFilter) {
    setLevel(l)
    try {
      localStorage.setItem(LEVEL_KEY, l)
    } catch {
      // Seçim yalnızca bu oturumda hatırlanır
    }
  }

  return (
    <section className={ex.page}>
      <header className={ex.head}>
        <div>
          <Link to="/calis" className={ex.backLink}>
            ← Çalış
          </Link>
          <h1 className={ex.title}>📖 Okuma Kütüphanesi</h1>
          <p className="muted" style={{ margin: 0, fontSize: '0.88rem' }}>
            Seviyene uygun kısa metinler. Bilmediğin kelimeye dokun (anlamı bu metne göre), 🌐 cümlenin Türkçesini açar.
            Bitirince okuma hızını görür, 3 kısa soruyla anladığını yoklarsın.
            {stats.count > 0 && ` Şimdiye kadar ${stats.count} metin okudun${stats.wpm ? `, ortalama ${stats.wpm} kelime/dk` : ''}.`}
          </p>
        </div>
      </header>

      {!texts ? (
        <p className="muted">Metinler hazırlanıyor…</p>
      ) : texts.length === 0 ? (
        <p className="muted">Metinler yüklenemedi. İnternet bağlantını kontrol edip sayfayı yenile.</p>
      ) : (
        <>
          <div className={ex.poolBar}>
            {[{ key: 'all' as const, label: 'Tümü' }, ...levels.map((l) => ({ key: l.level, label: l.level }))].map(({ key, label }) => (
              <button key={key} type="button" className={`${ex.poolChip} ${level === key ? ex.poolOn : ''}`} onClick={() => pick(key)}>
                {label}
              </button>
            ))}
          </div>

          {levels
            .filter((l) => level === 'all' || l.level === level)
            .map((l) => (
              <div key={l.level} className={ex.passageGroup}>
                <h3>
                  {l.label} <span className={styles.levelHint}>· {l.hint}</span>
                </h3>
                {texts
                  .filter((t) => t.level === l.level)
                  .map((t) => {
                    const log = logs[`lib/${t.id}`]
                    const words = countWords(t.sentences)
                    return (
                      <Link key={t.id} to={`/okuma/${t.id}`} className={ex.passageRow}>
                        <span style={{ minWidth: 0 }}>
                          <strong>{t.title}</strong>
                          <small>
                            {t.titleTr} · {t.topic} · {words} kelime · ~{minutes(words)} dk
                          </small>
                        </span>
                        <span className={log ? ex.okText : 'muted'} style={{ fontSize: '0.8rem', textAlign: 'right' }}>
                          {log ? (log.skim ? '✓ göz gezdirildi' : `✓ ${wpmOf(log)} k/dk`) : 'Okunmadı'}
                          {log?.quiz && <small>{`${log.quiz.ok}/${log.quiz.all} doğru`}</small>}
                        </span>
                      </Link>
                    )
                  })}
              </div>
            ))}

          <p className="muted" style={{ margin: 0, fontSize: '0.82rem' }}>
            Yeni metinler seviye seviye eklenecek (B2, YDS düzeyi). Tüm metinler bu uygulama için yazıldı; internetsiz de açılır.
          </p>
          {hasLocalContent() && (
            <Link to="/yds-sorular/okuma" className={ex.passageRow}>
              <span>
                <strong>📚 Çıkmış sınav paragrafları</strong>
                <small>Okuma Modu: YDS/YÖKDİL okuma paragrafları ve soruları</small>
              </span>
              <span className="muted">→</span>
            </Link>
          )}
        </>
      )}
    </section>
  )
}

/** Tek metin. Kaydırılan kapsayıcı metin değişince yerinde kalır (sayfa çevirmenin kopyası onun içinde); metne ait her şey anahtarla baştan başlar. */
export function LibraryReader() {
  const { textId = '' } = useParams()
  const navigate = useNavigate()
  const [texts, setTexts] = useState<LibEntry[] | null>(null)

  useEffect(() => {
    void loadLibrary().then(setTexts)
  }, [])

  const text = texts?.find((t) => t.id === textId)
  const same = texts?.filter((t) => t.level === text?.level) ?? []
  const idx = same.findIndex((t) => t.id === textId)
  // Geçmişe yazılmaz: geri tuşu kütüphaneye döner
  const goTo = (t?: LibEntry) => t && navigate(`/okuma/${t.id}`, { replace: true })
  const swipe = useQuestionNav(
    () => goTo(same[idx - 1]),
    () => goTo(same[idx + 1]),
    { canPrev: idx > 0, canNext: idx >= 0 && idx + 1 < same.length },
  )

  return (
    <section className={ex.page} {...swipe.props}>
      {!texts ? (
        <p className="muted">Yükleniyor…</p>
      ) : !text ? (
        <p className="muted">
          Metin bulunamadı. <Link to="/okuma">Kütüphaneye dön</Link>
        </p>
      ) : (
        <TextReader key={text.id} text={text} next={same[idx + 1]} onNext={() => void swipe.turn(1)} />
      )}
    </section>
  )
}

function TextReader({ text, next, onNext }: { text: LibEntry; next?: LibEntry; onNext: () => void }) {
  const userId = useUserStore((s) => s.activeUserId)
  const sentences = useMemo(() => text.sentences.map((s, i) => ({ id: `s${i + 1}`, en: s.en })), [text])
  const tr = useMemo(() => Object.fromEntries(text.sentences.map((s, i) => [`s${i + 1}`, s.tr])), [text])
  const words = countWords(text.sentences)
  const logId = `lib/${text.id}`

  return (
    <ReaderBody
      back={{ to: '/okuma', label: '← Okuma Kütüphanesi' }}
      title={text.title}
      info={
        <>
          <span className={styles.level}>{text.level}</span> {text.titleTr} · {text.topic} · {words} kelime · Bilmediğin kelimeye dokun, 🌐 cümlenin
          Türkçesini açar. Yana kaydırınca önceki/sonraki metin.
        </>
      }
      sentences={sentences}
      tr={tr}
      words={words}
      logId={logId}
      note={`Okuma Kütüphanesi / ${text.title}`}
      glossFor={(w) => glossFor(text.glosses, w)}
      after={
        <>
          <Quiz qs={text.qs} onDone={(ok, all) => patchLog(userId, logId, { quiz: { ok, all } })} />
          <details className={styles.summary}>
            <summary>Türkçe özet</summary>
            <p>{text.summary}</p>
          </details>
          <div className={ex.actions} style={{ marginTop: 0 }}>
            {next ? (
              <button type="button" className="btn btn-primary" onClick={onNext}>
                Sonraki metin: {next.title} →
              </button>
            ) : (
              <Link to="/okuma" className="btn btn-secondary">
                Kütüphaneye dön
              </Link>
            )}
          </div>
        </>
      }
    />
  )
}

/** Anlama soruları: şık seçince doğru/yanlış ve metindeki dayanağı (Türkçe) görünür. */
function Quiz({ qs, onDone }: { qs: LibQuestion[]; onDone: (ok: number, all: number) => void }) {
  const [picks, setPicks] = useState<(number | null)[]>(() => qs.map(() => null))
  const [showTr, setShowTr] = useState<boolean[]>(() => qs.map(() => false))
  const ok = picks.filter((p, i) => p === qs[i].a).length
  const done = picks.every((p) => p !== null)

  // Hepsi cevaplanınca sonuç bir kez kaydedilir
  const saved = useRef(false)
  const doneRef = useRef(onDone)
  useEffect(() => {
    doneRef.current = onDone
  })
  useEffect(() => {
    if (!done || saved.current) return
    saved.current = true
    doneRef.current(ok, qs.length)
  }, [done, ok, qs.length])

  const choose = (i: number, o: number) => setPicks((p) => p.map((v, j) => (j === i && v === null ? o : v)))

  return (
    <div className={styles.quiz}>
      <strong>Anladın mı? ({qs.length} soru)</strong>
      {qs.map((q, i) => (
        <div key={i} className={styles.q}>
          <p className={styles.qText}>
            {i + 1}. {q.q}{' '}
            <button
              type="button"
              className={styles.trBtn}
              aria-expanded={showTr[i]}
              title="Sorunun Türkçesi"
              onClick={() => setShowTr((s) => s.map((v, j) => (j === i ? !v : v)))}
            >
              🌐
            </button>
          </p>
          {showTr[i] && <p className={styles.qTr}>{q.qt}</p>}
          <div className={styles.opts}>
            {q.o.map((o, j) => {
              const picked = picks[i]
              const cls = picked === null ? '' : j === q.a ? styles.ok : picked === j ? styles.bad : styles.dim
              return (
                <button key={j} type="button" className={`${styles.opt} ${cls}`} disabled={picked !== null} onClick={() => choose(i, j)}>
                  <b>{'ABCD'[j]})</b> {o}
                </button>
              )
            })}
          </div>
          {picks[i] !== null && (
            <p className={styles.why}>
              {picks[i] === q.a ? '✓ Doğru. ' : `✗ Doğru cevap ${'ABCD'[q.a]}. `}
              {q.why}
            </p>
          )}
        </div>
      ))}
      {done && (
        <p className={styles.score}>
          {ok}/{qs.length} doğru{ok === qs.length ? ' — metni iyi anlamışsın.' : ' — yanlış soruların dayanağını metinde bir daha oku.'}
        </p>
      )}
    </div>
  )
}
