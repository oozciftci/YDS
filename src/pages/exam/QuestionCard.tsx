import { useEffect, useMemo, useState, type MouseEvent, type ReactNode } from 'react'
import { cleanToken, lookupWordInSentence, type WordLookupResult } from '../../services/dictionary'
import { EXAM_COLLECTED_TAG } from '../../services/groups'
import { createWord, updateWord } from '../../services/words'
import { speakWord } from '../../services/tts'
import { sectionOf } from '../../services/ydsSections'
import { useUserStore } from '../../stores/user'
import styles from '../ExamStudy.module.css'
import type { ExamBundle, Question, Seg } from './examData'

const WORD_RE = /([A-Za-zÇĞİÖŞÜçğıöşü0-9]+(?:['’][A-Za-z]+)?|[^\sA-Za-zÇĞİÖŞÜçğıöşü0-9]+|\s+)/g

interface PopoverState {
  word: string
  top: number
  left: number
}

/** Bir cümleyi tıklanabilir kelimelere böler; başındaki rozet cümle çevirisini açar/kapatır. */
function SentenceView({
  seg,
  tr,
  forceShow,
  onWord,
  assist,
}: {
  seg: Seg
  tr?: string
  forceShow: boolean
  onWord: (word: string, e: MouseEvent<HTMLButtonElement>) => void
  assist: boolean
}) {
  const [open, setOpen] = useState(false)
  const show = assist && (open || forceShow)
  const tokens = useMemo(() => seg.en.match(WORD_RE) || [seg.en], [seg.en])
  // Çeviri sorularında Türkçe cümleler olur; yardım kapalıyken (deneme) düz metin gösterilir
  if (!assist || (seg.en.match(/[çğıöşüÇĞİÖŞÜ]/g) || []).length >= 2) {
    return <span className={styles.sentence}>{seg.en} </span>
  }
  return (
    <span className={styles.sentence}>
      <button
        type="button"
        className={`${styles.badge} ${show ? styles.badgeOn : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={show}
        title="Cümlenin Türkçesini göster/gizle"
      >
        🌐
      </button>
      {tokens.map((t, i) =>
        /^[A-Za-zÇĞİÖŞÜçğıöşü0-9]/.test(t) ? (
          <button key={i} type="button" className={styles.word} onClick={(e) => onWord(t, e)}>
            {t}
          </button>
        ) : (
          <span key={i}>{t}</span>
        ),
      )}
      {show && (
        <span className={styles.trLine}>{tr || <em className={styles.noTr}>Çeviri henüz eklenmedi</em>}</span>
      )}
    </span>
  )
}

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
}

/** Bir YDS sorusunu (varsa paragrafıyla) gösterir: şıklar, çeviriler, kelime balonu, orijinal PDF sayfası. */
export function QuestionCard({ bundle, q, choice, revealed, onChoose, assist = true, subtitle, children }: Props) {
  const activeUserId = useUserStore((s) => s.activeUserId)
  const { exam, tr } = bundle
  const passage = q.passage ? exam.passages.find((p) => p.id === q.passage) : undefined
  const section = sectionOf(q.no)
  const [showAllTr, setShowAllTr] = useState(false)
  const [pop, setPop] = useState<PopoverState | null>(null)
  const [lookup, setLookup] = useState<WordLookupResult | null>(null)
  const [lookingUp, setLookingUp] = useState(false)
  const [added, setAdded] = useState(false)
  const [pdfPage, setPdfPage] = useState<number | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setPop(null)
      setPdfPage(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => setPop(null), [q.no, exam.id])

  async function onWord(word: string, e: MouseEvent<HTMLButtonElement>) {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    const width = Math.min(300, window.innerWidth - 16)
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))
    setPop({ word, top: rect.bottom + 6, left })
    setLookup(null)
    setAdded(false)
    setLookingUp(true)
    try {
      setLookup(await lookupWordInSentence(cleanToken(word) || word, undefined, activeUserId))
    } finally {
      setLookingUp(false)
    }
  }

  async function addToDeck() {
    if (!lookup) return
    await createWord(activeUserId, {
      term: lookup.term,
      definition: lookup.meaning,
      partOfSpeech: 'noun',
      tags: [EXAM_COLLECTED_TAG],
      notes: exam.id + ' / Soru ' + q.no,
    })
    setAdded(true)
  }

  /** Havuzda zaten olan kelimeyi "Sınavdan Topladıklarım" destesine alır (etiket ekler). */
  async function collectExisting() {
    const w = lookup?.existingWord
    if (!w) return
    await updateWord(w.id, activeUserId, { tags: [...(w.tags || []), EXAM_COLLECTED_TAG] })
    setAdded(true)
  }

  const letters = Object.keys(q.options)
  const stemTr = q.stem.map((s) => tr[s.id]).filter(Boolean)
  const optionTrCount = letters.filter((l) => tr[q.options[l].id]).length
  const sv = (s: Seg) => (
    <SentenceView key={s.id} seg={s} tr={tr[s.id]} forceShow={showAllTr} onWord={onWord} assist={assist} />
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
          </h2>
          <p className={styles.text}>{passage.sentences.map(sv)}</p>
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
        {q.stem.length > 0 && <p className={styles.text}>{q.stem.map(sv)}</p>}
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

        {children}
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

      {pop && (
        <>
          <div className={styles.popBackdrop} onClick={() => setPop(null)} aria-hidden="true" />
          <div className={styles.pop} style={{ top: pop.top, left: pop.left }} role="dialog">
            <div className={styles.popHead}>
              <strong>{lookup?.term || cleanToken(pop.word)}</strong>
              <button
                type="button"
                className={styles.popIcon}
                onClick={() => speakWord(lookup?.term || pop.word)}
                aria-label="Dinle"
              >
                🔊
              </button>
              <button type="button" className={styles.popIcon} onClick={() => setPop(null)} aria-label="Kapat">
                ×
              </button>
            </div>
            <p className={styles.popMeaning}>
              {lookingUp ? 'Anlam aranıyor…' : lookup?.meaning || 'Anlam bulunamadı.'}
            </p>
            {lookup?.existingWord &&
              (added || (lookup.existingWord.tags || []).includes(EXAM_COLLECTED_TAG) ? (
                <p className="muted" style={{ margin: 0, fontSize: '0.78rem' }}>
                  ✓ Havuzunda ve "Sınavdan Topladıklarım" destesinde
                </p>
              ) : (
                <button type="button" className="btn btn-secondary" onClick={() => void collectExisting()}>
                  📥 Topladıklarıma ekle
                </button>
              ))}
            {lookup?.isNewWord && lookup.meaning && (
              <button type="button" className="btn btn-secondary" disabled={added} onClick={() => void addToDeck()}>
                {added ? '✓ Eklendi' : '➕ Havuzuma ekle'}
              </button>
            )}
            {(lookup?.isNewWord || lookup?.existingWord) && (
              <p className="muted" style={{ margin: 0, fontSize: '0.74rem' }}>
                Toplanan kelimeler Çalış ekranında "📥 Sınavdan Topladıklarım" destesinde çıkar.
              </p>
            )}
          </div>
        </>
      )}

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
