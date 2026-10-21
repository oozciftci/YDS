import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { countWords } from '../../services/readingLibrary'
import { readingStats, readLogs, wpmOf } from '../../services/readingLog'
import { useUserStore } from '../../stores/user'
import styles from '../ExamStudy.module.css'
import { useQuestionNav } from './answerControls'
import { loadAllExams, loadExam, shortTitle, type ExamBundle, type Passage } from './examData'
import { QueueRunner } from './QueueRunner'
import { ReaderBody } from './ReaderBody'

// Okuma modu: çıkmış sınavlardaki okuma paragraflarını soru baskısı olmadan oku, dinle, süreni ölç,
// sonra o paragrafın sorularını çöz. Okuyucu: ReaderBody (Okuma Kütüphanesi ile ortak); kayıtlar: services/readingLog.

const wordCount = (p: Passage) => countWords(p.sentences)
function questionRange(bundle: ExamBundle, pid: string): [number, number] | null {
  const nos = bundle.exam.questions.filter((q) => q.passage === pid).map((q) => q.no)
  return nos.length ? [Math.min(...nos), Math.max(...nos)] : null
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

  const stats = useMemo(() => readingStats(Object.values(logs)), [logs])

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
                    {log ? (log.skim ? '✓ göz gezdirildi' : `✓ ${wpmOf(log)} k/dk`) : 'Okunmadı'}
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

/** Tek paragraf okuyucu. Kaydırma / ← → ile aynı sınavın önceki-sonraki paragrafı (kitap gibi sayfa çevirerek). */
export function ReadingPassage() {
  const { examId = '', passageId = '' } = useParams()
  const navigate = useNavigate()
  const [bundle, setBundle] = useState<ExamBundle | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    loadExam(examId)
      .then(setBundle)
      .catch((e) => setError('Sınav yüklenemedi: ' + e))
  }, [examId])

  const reading = bundle?.exam.passages.filter((p) => p.kind === 'reading') ?? []
  const idx = reading.findIndex((p) => p.id === passageId)
  // Geçmişe yazılmaz: geri tuşu okuma listesine döner
  const goTo = (p?: Passage) => p && navigate(`/yds-sorular/okuma/${examId}/${p.id}`, { replace: true })
  const swipe = useQuestionNav(
    () => goTo(reading[idx - 1]),
    () => goTo(reading[idx + 1]),
    { canPrev: idx > 0, canNext: idx >= 0 && idx + 1 < reading.length },
  )

  // Kaydırılan kapsayıcı paragraf değişince yerinde kalır (çevirmenin kopyası onun içinde); paragrafa ait her şey
  // (süre, çeviriler, bakılan kelimeler) anahtarla baştan başlar.
  return (
    <section className={styles.page} {...swipe.props}>
      {error ? (
        <p className="muted">{error}</p>
      ) : !bundle ? (
        <p className="muted">Yükleniyor…</p>
      ) : idx < 0 ? (
        <p className="muted">Paragraf bulunamadı.</p>
      ) : (
        <PassageReader key={`${examId}/${passageId}`} bundle={bundle} idx={idx} onNext={() => void swipe.turn(1)} />
      )}
    </section>
  )
}

function PassageReader({ bundle, idx, onNext }: { bundle: ExamBundle; idx: number; onNext: () => void }) {
  const navigate = useNavigate()
  const { exam, tr } = bundle
  const reading = exam.passages.filter((p) => p.kind === 'reading')
  const passage = reading[idx]
  const range = questionRange(bundle, passage.id)
  const words = wordCount(passage)
  return (
    <ReaderBody
      back={{ to: '/yds-sorular/okuma', label: '← Okuma listesi' }}
      title={`${shortTitle(exam.title)} · Paragraf ${idx + 1}`}
      info={`${words} kelime${range ? ` · Soru ${range[0]}-${range[1]}` : ''} · Bilmediğin kelimeye dokun, 🌐 cümlenin Türkçesini açar. Yana kaydırınca önceki/sonraki paragraf.`}
      sentences={passage.sentences}
      tr={tr}
      words={words}
      logId={`${exam.id}/${passage.id}`}
      note={`${exam.id} / okuma ${passage.id}`}
      after={
        <div className={styles.actions} style={{ marginTop: 0 }}>
          {range && (
            <button type="button" className="btn btn-primary" onClick={() => navigate('sorular')}>
              Bu paragrafın {range[1] - range[0] + 1} sorusunu çöz →
            </button>
          )}
          {reading[idx + 1] && (
            <button type="button" className="btn btn-secondary" onClick={onNext}>
              Sonraki paragraf
            </button>
          )}
        </div>
      }
    />
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

