import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { guessGrammarTopics } from '../../data/grammar'
import { sectionOf } from '../../services/ydsSections'
import styles from '../ExamStudy.module.css'
import type { ExamBundle, Question, Seg } from './examData'
import { SentenceView, useWordPopover } from './WordPopover'
import { AiExplain } from './AiExplain'
import { ListenControls } from './ListenControls'

interface Props {
  bundle: ExamBundle
  q: Question
  choice: string | null
  revealed: boolean
  onChoose: (letter: string) => void
  /** Çeviri, kelime sözlüğü ve çeviri bölümü açık mı (deneme sırasında kapalı). */
  assist?: boolean
  /** Soru başlığının yanında gösterilecek ek bilgi (örn. hangi sınavdan olduğu). */
  subtitle?: ReactNode
  /** Kartın altındaki eylem satırı (kontrol et, önceki/sonraki vb.). */
  children?: ReactNode
  /** Yapay zekâ açıklama kutusu gösterilsin mi (YDS TEST örneğinde kapalı). */
  ai?: boolean
}

/** Bir YDS sorusunu (varsa paragrafıyla) gösterir: şıklar, çeviriler, kelime balonu, orijinal PDF sayfası. */
export function QuestionCard({ bundle, q, choice, revealed, onChoose, assist = true, subtitle, children, ai = true }: Props) {
  const { exam, tr } = bundle
  const passage = q.passage ? exam.passages.find((p) => p.id === q.passage) : undefined
  const section = sectionOf(q.no, exam.id)
  const [showAllTr, setShowAllTr] = useState(false)
  const [pdfPage, setPdfPage] = useState<number | null>(null)
  const { onWord, close, popover } = useWordPopover(exam.id + ' / Soru ' + q.no)
  // Paragraf seslendirme: o an okunan cümlenin sırası (null = okunmuyor)
  const [speaking, setSpeaking] = useState<number | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPdfPage(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Soru değişince balonu kapat (seslendirme, paragrafa bağlı denetimle birlikte kapanır)
  useEffect(() => {
    close()
  }, [q.no, exam.id, close])

  const letters = Object.keys(q.options)
  // Dilbilgisi ve cloze sorularında şıklara bakıp ilgili rehber konusunu öner
  const grammarTopics =
    section.key === 'grammar' || section.key === 'cloze'
      ? guessGrammarTopics(letters.map((l) => q.options[l].en))
      : []
  const stemTr = q.stem.map((s) => tr[s.id]).filter(Boolean)
  const optionTrCount = letters.filter((l) => tr[q.options[l].id]).length
  const sv = (s: Seg, i = -1) => (
    <SentenceView
      key={s.id}
      seg={s}
      tr={tr[s.id]}
      forceShow={showAllTr}
      onWord={onWord}
      assist={assist}
      active={speaking === i}
    />
  )

  return (
    <>
      {assist && (
        <div className={styles.toolbar}>
          <label className={styles.toggle}>
            <input type="checkbox" checked={showAllTr} onChange={(e) => setShowAllTr(e.target.checked)} />
            Tüm cümle çevirilerini aç
          </label>
        </div>
      )}

      {passage && (
        <article className={`card ${styles.passage}`}>
          <h2 className={styles.sectionTitle}>
            {passage.kind === 'cloze' ? 'Boşluk doldurma paragrafı' : 'Okuma paragrafı'}
            {exam.pdf && passage.page ? (
              <button type="button" className={styles.pdfBtn} onClick={() => setPdfPage(passage.page ?? 1)}>
                📄 Orijinal sayfa {passage.page}
              </button>
            ) : null}
            {assist && passage.kind === 'reading' && (
              <ListenControls
                key={`${exam.id}/${passage.id}`}
                sentences={passage.sentences}
                tr={tr}
                onActive={setSpeaking}
              />
            )}
          </h2>
          <p className={styles.text}>{passage.sentences.map((s, i) => sv(s, i))}</p>
        </article>
      )}

      <article className={`card ${styles.question}`}>
        <h2 className={styles.sectionTitle}>
          Soru {q.no}
          <span className={styles.sectionChip} title={section.hint}>
            {section.icon} {section.label}
          </span>
          {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
          {exam.pdf && q.page ? (
            <button type="button" className={styles.pdfBtn} onClick={() => setPdfPage(q.page ?? 1)}>
              📄 Orijinal sayfa {q.page}
            </button>
          ) : null}
        </h2>
        {q.stem.length > 0 && <p className={styles.text}>{q.stem.map((s) => sv(s))}</p>}
        {passage?.kind === 'cloze' && q.stem.length === 0 && (
          <p className="muted">Paragraftaki ({q.no})---- boşluğu için doğru seçeneği işaretleyin.</p>
        )}

        <ul className={styles.options}>
          {letters.map((l) => {
            const opt = q.options[l]
            const state = revealed
              ? l === q.answer
                ? styles.optCorrect
                : l === choice
                  ? styles.optWrong
                  : ''
              : l === choice
                ? styles.optPicked
                : ''
            return (
              <li key={l} className={`${styles.option} ${state}`}>
                <button
                  type="button"
                  className={styles.optPick}
                  onClick={() => !revealed && onChoose(l)}
                  aria-label={`Seçenek ${l}`}
                >
                  <span className={styles.optLetter}>{l}</span>
                </button>
                <span className={styles.optBody}>{sv(opt)}</span>
              </li>
            )
          })}
        </ul>

        {revealed && grammarTopics.length > 0 && (
          <p className={styles.grammarLink}>
            📘 İlgili dilbilgisi konusu:{' '}
            {grammarTopics.map((t, i) => (
              <span key={t.id}>
                {i > 0 && ' · '}
                <Link to={`/dilbilgisi/${t.id}`}>{t.title}</Link>
              </span>
            ))}
          </p>
        )}

        {children}

        {revealed && assist && ai && <AiExplain key={`${exam.id}-${q.no}`} bundle={bundle} q={q} choice={choice} />}
      </article>

      {assist && (
        <article className={`card ${styles.translations}`}>
          <h2 className={styles.sectionTitle}>Çeviriler</h2>
          {passage && (
            <details className={styles.details}>
              <summary>Paragrafın tam çevirisi</summary>
              {passage.sentences.every((s) => tr[s.id]) ? (
                <p className={styles.trBlock}>{passage.sentences.map((s) => tr[s.id]).join(' ')}</p>
              ) : (
                <p className={styles.noTr}>
                  {passage.sentences.filter((s) => tr[s.id]).length === 0
                    ? 'Bu paragrafın çevirisi henüz eklenmedi.'
                    : passage.sentences.map((s) => tr[s.id] || '[çeviri eksik]').join(' ')}
                </p>
              )}
            </details>
          )}
          <details className={styles.details}>
            <summary>Soru cümlesinin çevirisi</summary>
            {stemTr.length ? (
              <p className={styles.trBlock}>{stemTr.join(' ')}</p>
            ) : (
              <p className={styles.noTr}>Çeviri henüz eklenmedi.</p>
            )}
          </details>
          <details className={styles.details}>
            <summary>
              Şıkların çevirisi ({optionTrCount}/{letters.length})
            </summary>
            <ul className={styles.optTrList}>
              {letters.map((l) => (
                <li key={l}>
                  <strong>{l})</strong> {q.options[l].en}
                  <div className={styles.trBlock}>
                    {tr[q.options[l].id] || <em className={styles.noTr}>Çeviri henüz eklenmedi</em>}
                  </div>
                </li>
              ))}
            </ul>
          </details>
        </article>
      )}

      {popover}

      {pdfPage !== null && exam.pdf && (
        <div className={styles.pdfBackdrop} onClick={() => setPdfPage(null)} role="dialog" aria-modal="true">
          <div className={styles.pdfModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.pdfHead}>
              <strong>
                {exam.title} — PDF sayfa {pdfPage}
              </strong>
              <span className={styles.spacer} />
              <button
                type="button"
                className="btn btn-ghost"
                disabled={pdfPage <= 1}
                onClick={() => setPdfPage(pdfPage - 1)}
              >
                ←
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setPdfPage(pdfPage + 1)}>
                →
              </button>
              <a
                className="btn btn-secondary"
                href={`/local-api/pdf/${exam.pdf}#page=${pdfPage}`}
                target="_blank"
                rel="noreferrer"
              >
                Yeni sekmede aç
              </a>
              <button type="button" className="btn btn-ghost" onClick={() => setPdfPage(null)} aria-label="Kapat">
                ✕
              </button>
            </div>
            <iframe
              key={pdfPage}
              className={styles.pdfFrame}
              title="Orijinal PDF sayfası"
              src={`/local-api/pdf/${exam.pdf}#page=${pdfPage}&zoom=page-width`}
            />
          </div>
        </div>
      )}
    </>
  )
}
