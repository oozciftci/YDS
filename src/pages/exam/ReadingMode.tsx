import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useUserStore } from '../../stores/user'
import styles from '../ExamStudy.module.css'
import { loadAllExams, loadExam, shortTitle, type ExamBundle, type Passage } from './examData'
import { ListenControls } from './ListenControls'
import { PacerControls } from './PacerControls'
import { QueueRunner } from './QueueRunner'
import { SentenceView, useWordPopover } from './WordPopover'

// Okuma modu: çıkmış sınavlardaki okuma paragraflarını soru baskısı olmadan oku, dinle, süreni ölç,
// sonra o paragrafın sorularını çöz. Okuma kayıtları kişisel kolaylık olarak tarayıcı deposunda tutulur.

interface ReadLog {
  sec: number
  words: number
  at: string
}

function logKey(userId: string) {
  return `yds-reading:${userId}`
}
function readLogs(userId: string): Record<string, ReadLog> {
  try {
    return JSON.parse(localStorage.getItem(logKey(userId)) || '{}') as Record<string, ReadLog>
  } catch {
    return {}
  }
}
function writeLog(userId: string, id: string, log: ReadLog) {
  try {
    localStorage.setItem(logKey(userId), JSON.stringify({ ...readLogs(userId), [id]: log }))
  } catch {
    // Depo kapalıysa sonuç yalnızca ekranda görünür
  }
}

function wordCount(p: Passage): number {
  return p.sentences.reduce((n, s) => n + (s.en.match(/[A-Za-z]+(?:['’][A-Za-z]+)?/g) || []).length, 0)
}
function questionRange(bundle: ExamBundle, pid: string): [number, number] | null {
  const nos = bundle.exam.questions.filter((q) => q.passage === pid).map((q) => q.no)
  return nos.length ? [Math.min(...nos), Math.max(...nos)] : null
}
/** Bunun üstü göz gezdirmedir; okuma hızı olarak kaydedilmez. */
const MAX_REAL_WPM = 400

function fmt(sec: number) {
  const s = Math.max(0, Math.round(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Okuma paragrafları listesi: en yeni sınav önce. */
export function ReadingList() {
  const userId = useUserStore((s) => s.activeUserId)
  const [bundles, setBundles] = useState<ExamBundle[] | null>(null)
  const [logs] = useState(() => readLogs(userId))
  const [error, setError] = useState('')

  useEffect(() => {
    loadAllExams()
      .then((b) => setBundles([...b].reverse()))
      .catch((e) => setError('Sınavlar yüklenemedi: ' + e))
  }, [])

  const stats = useMemo(() => {
    const list = Object.values(logs)
    const words = list.reduce((n, l) => n + l.words, 0)
    const sec = list.reduce((n, l) => n + l.sec, 0)
    return { count: list.length, wpm: sec > 0 ? Math.round((words / sec) * 60) : null }
  }, [logs])

  if (error) return <p className="muted">{error}</p>
  if (!bundles) return <p className="muted">Paragraflar hazırlanıyor…</p>

  return (
    <section className={styles.page}>
      <header className={styles.head}>
        <div>
          <Link to="/yds-sorular" className={styles.backLink}>
            ← Soru Merkezi
          </Link>
          <h1 className={styles.title}>📚 Okuma Modu</h1>
          <p className="muted" style={{ margin: 0, fontSize: '0.88rem' }}>
            Paragrafı soru baskısı olmadan oku ya da dinle; bilmediğin kelimeye dokun. Bitirince okuma hızını görür, o
            paragrafın sorularını çözersin.
            {stats.count > 0 && ` Şimdiye kadar ${stats.count} paragraf okudun${stats.wpm ? `, ortalama ${stats.wpm} kelime/dk` : ''}.`}
          </p>
        </div>
      </header>

      {bundles.map(({ exam }) => {
        const reading = exam.passages.filter((p) => p.kind === 'reading')
        if (!reading.length) return null
        return (
          <div key={exam.id} className={styles.passageGroup}>
            <h3>{shortTitle(exam.title)}</h3>
            {reading.map((p, i) => {
              const log = logs[`${exam.id}/${p.id}`]
              const range = questionRange({ exam, tr: {} }, p.id)
              return (
                <Link key={p.id} to={`${exam.id}/${p.id}`} className={styles.passageRow}>
                  <span style={{ minWidth: 0 }}>
                    <strong>Paragraf {i + 1}</strong>
                    <small>
                      {range ? `Soru ${range[0]}-${range[1]} · ` : ''}
                      {wordCount(p)} kelime
                    </small>
                    <span className={styles.passagePreview}>{p.sentences[0]?.en}</span>
                  </span>
                  <span className={log ? styles.okText : 'muted'} style={{ fontSize: '0.8rem' }}>
                    {log ? `✓ ${Math.round((log.words / Math.max(1, log.sec)) * 60)} k/dk` : 'Okunmadı'}
                  </span>
                </Link>
              )
            })}
          </div>
        )
      })}
    </section>
  )
}

/** Tek paragraf okuyucu. */
export function ReadingPassage() {
  const { examId = '', passageId = '' } = useParams()
  const navigate = useNavigate()
  const userId = useUserStore((s) => s.activeUserId)
  const [bundle, setBundle] = useState<ExamBundle | null>(null)
  const [error, setError] = useState('')
  const [showTr, setShowTr] = useState(false)
  const [speaking, setSpeaking] = useState<number | null>(null)
  const [startedAt] = useState(() => Date.now())
  const [now, setNow] = useState(() => Date.now())
  const [finishedSec, setFinishedSec] = useState<number | null>(null)
  const { onWord, popover, lookedUp } = useWordPopover(`${examId} / okuma ${passageId}`)

  useEffect(() => {
    loadExam(examId)
      .then(setBundle)
      .catch((e) => setError('Sınav yüklenemedi: ' + e))
  }, [examId])

  // Süre sayacı (okuma bitene kadar)
  useEffect(() => {
    if (finishedSec !== null) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [finishedSec])

  if (error) return <p className="muted">{error}</p>
  if (!bundle) return <p className="muted">Yükleniyor…</p>

  const { exam, tr } = bundle
  const reading = exam.passages.filter((p) => p.kind === 'reading')
  const idx = reading.findIndex((p) => p.id === passageId)
  const passage = reading[idx]
  if (!passage) return <p className="muted">Paragraf bulunamadı.</p>
  const words = wordCount(passage)
  const next = reading[idx + 1]
  const range = questionRange(bundle, passage.id)
  const elapsed = finishedSec ?? (now - startedAt) / 1000

  function finish() {
    const sec = Math.max(1, Math.round((Date.now() - startedAt) / 1000))
    setFinishedSec(sec)
    if ((words / sec) * 60 <= MAX_REAL_WPM) {
      writeLog(userId, `${exam.id}/${passage.id}`, { sec, words, at: new Date().toISOString() })
    }
  }

  const wpm = finishedSec ? Math.round((words / finishedSec) * 60) : null

  return (
    <section className={styles.page}>
      <header className={styles.head}>
        <div>
          <Link to="/yds-sorular/okuma" className={styles.backLink}>
            ← Okuma listesi
          </Link>
          <h1 className={styles.title}>
            {shortTitle(exam.title)} · Paragraf {idx + 1}
          </h1>
          <p className="muted" style={{ margin: 0, fontSize: '0.88rem' }}>
            {words} kelime{range ? ` · Soru ${range[0]}-${range[1]}` : ''} · Bilmediğin kelimeye dokun, 🌐 cümlenin
            Türkçesini açar.
          </p>
        </div>
      </header>

      <div className={styles.readBar}>
        <span className={styles.timer} title="Okuma süresi">
          ⏱ {fmt(elapsed)}
        </span>
        <ListenControls key={`${exam.id}/${passage.id}`} sentences={passage.sentences} tr={tr} onActive={setSpeaking} showRate />
        <PacerControls key={`pacer-${exam.id}/${passage.id}`} userId={userId} sentences={passage.sentences} onActive={setSpeaking} />
        <label className={styles.toggle}>
          <input type="checkbox" checked={showTr} onChange={(e) => setShowTr(e.target.checked)} />
          Çeviriler
        </label>
        <span className={styles.spacer} />
        {finishedSec === null && (
          <button type="button" className="btn btn-primary" onClick={finish}>
            ✓ Okumayı bitirdim
          </button>
        )}
      </div>

      <article className="card">
        <p className={styles.readText}>
          {passage.sentences.map((s, i) => (
            <SentenceView
              key={s.id}
              seg={s}
              tr={tr[s.id]}
              forceShow={showTr}
              onWord={onWord}
              assist
              active={speaking === i}
            />
          ))}
        </p>
      </article>

      {finishedSec !== null && (
        <article className="card" style={{ display: 'grid', gap: '0.75rem' }}>
          <div className={styles.readStats}>
            <span>
              <span className={styles.readBig}>{wpm}</span> kelime/dk
            </span>
            <span className="muted">{fmt(finishedSec)} sürede okudun</span>
          </div>
          {wpm && wpm > MAX_REAL_WPM && (
            <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--warning)' }}>
              Çok hızlı bitirdin; bu bir göz gezdirme gibi görünüyor, okuma hızı olarak kaydedilmedi. Gerçek hızını
              ölçmek için paragrafı baştan sona okuyup sonra bitir.
            </p>
          )}
          {wpm && wpm <= MAX_REAL_WPM && (
            <p className="muted" style={{ margin: 0, fontSize: '0.86rem' }}>
              Bu hızla sınavdaki 5 okuma paragrafını yalnızca okumak yaklaşık {Math.round((words * 5) / wpm)} dakika
              sürer (sorular hariç).
            </p>
          )}
          {lookedUp.length > 0 && (
            <div>
              <strong style={{ fontSize: '0.9rem' }}>Anlamına baktığın kelimeler ({lookedUp.length})</strong>
              <div className={styles.chipRow} style={{ marginTop: '0.35rem' }}>
                {lookedUp.map((w) => (
                  <span key={w} className={styles.chip}>
                    {w}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className={styles.actions} style={{ marginTop: 0 }}>
            {range && (
              <button type="button" className="btn btn-primary" onClick={() => navigate('sorular')}>
                Bu paragrafın {range[1] - range[0] + 1} sorusunu çöz →
              </button>
            )}
            {next && (
              <Link to={`/yds-sorular/okuma/${exam.id}/${next.id}`} className="btn btn-secondary">
                Sonraki paragraf
              </Link>
            )}
          </div>
        </article>
      )}

      {popover}
    </section>
  )
}

/** Paragrafın soruları (okumadan sonra). */
export function ReadingQuestions() {
  const { examId = '', passageId = '' } = useParams()
  const [bundle, setBundle] = useState<ExamBundle | null>(null)

  useEffect(() => {
    void loadExam(examId).then(setBundle)
  }, [examId])

  if (!bundle) return <p className="muted">Yükleniyor…</p>
  const items = bundle.exam.questions.filter((q) => q.passage === passageId && q.answer).map((q) => ({ bundle, q }))
  return (
    <QueueRunner
      title="📚 Paragraf soruları"
      description={`${shortTitle(bundle.exam.title)} — az önce okuduğun paragraf.`}
      items={items}
      empty={<p>Bu paragrafın cevap anahtarlı sorusu yok.</p>}
    />
  )
}

