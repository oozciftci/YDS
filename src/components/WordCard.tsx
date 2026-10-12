import { MASTERY_CONFIG, type CardState, type MasteryLevel, type PartOfSpeech, type WordItem } from '../types/database'
import { speakWord } from '../services/tts'
import { InteractiveSentence } from './InteractiveSentence'
import styles from '../pages/Words.module.css'

interface WordCardProps {
  word: WordItem
  cardState?: CardState
  onEdit: (word: WordItem) => void
  onDelete: (wordId: string) => void
}

function getPosClass(pos: PartOfSpeech): string {
  switch (pos) {
    case 'verb':
      return styles.posVerb
    case 'noun':
      return styles.posNoun
    case 'adjective':
      return styles.posAdj
    case 'adverb':
      return styles.posAdv
    case 'phrasal_verb':
      return styles.posPhrasal
    case 'conjunction':
      return styles.posConj
    default:
      return styles.posOther
  }
}

const POS_LABELS: Record<PartOfSpeech, string> = {
  verb: 'Fiil',
  noun: 'İsim',
  adjective: 'Sıfat',
  adverb: 'Zarf',
  phrasal_verb: 'Phrasal Verb',
  conjunction: 'Bağlaç',
  preposition: 'Edat',
  idiom: 'Deyim',
  other: 'Diğer',
}

export function WordCard({ word, cardState, onEdit, onDelete }: WordCardProps) {
  return (
    <article className={styles.wordCard}>
      <div className={styles.cardHead}>
        <div className={styles.termRow}>
          <h2 className={styles.term}>{word.term}</h2>
          <button
            type="button"
            className={styles.audioBtn}
            onClick={() => speakWord(word.term)}
            title="Dinle (Telaffuz)"
            aria-label={`${word.term} kelimesini dinle`}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" strokeLinecap="round" />
            </svg>
          </button>
          <span className={`${styles.posBadge} ${getPosClass(word.partOfSpeech)}`}>
            {POS_LABELS[word.partOfSpeech] || word.partOfSpeech}
          </span>
          {cardState && (
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '0.15rem 0.45rem',
                borderRadius: '6px',
                background: 'color-mix(in srgb, var(--input-bg) 80%, transparent)',
                border: '1px solid var(--border)',
              }}
              title={`Öğrenme Puanı: ${cardState.masteryScore || 1}/5`}
            >
              {MASTERY_CONFIG[(cardState.masteryScore as MasteryLevel) || 1].badge}
            </span>
          )}
        </div>

        <div className={styles.cardActions}>
          <button
            type="button"
            className={styles.actionBtn}
            onClick={() => onEdit(word)}
            title="Düzenle"
            aria-label="Düzenle"
          >
            ✏️
          </button>
          <button
            type="button"
            className={`${styles.actionBtn} ${styles.actionBtnDelete}`}
            onClick={() => {
              if (window.confirm(`"${word.term}" kelimesini silmek istediğinize emin misiniz?`)) {
                onDelete(word.id)
              }
            }}
            title="Sil"
            aria-label="Sil"
          >
            🗑️
          </button>
        </div>
      </div>

      <p className={styles.definition}>{word.definition}</p>

      {/* YDS Eş Anlamlılar Bölümü */}
      {word.synonyms && word.synonyms.length > 0 && (
        <div className={styles.synSection}>
          <span className={styles.synLabel}>Eş Anlamlılar (YDS)</span>
          <div className={styles.synChips}>
            {word.synonyms.map((syn, idx) => (
              <span key={idx} className={styles.synChip}>
                {syn}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Birlikte Kullanılan Kalıplar */}
      {word.collocations && word.collocations.length > 0 && (
        <div className={styles.collocations}>
          Kalıp: {word.collocations.join(' • ')}
        </div>
      )}

      {/* Örnek Cümle (Her bir kelimesi tıklanabilir ve anlamı görüntülenebilir) */}
      {word.sentences && word.sentences.length > 0 && word.sentences[0] && (
        <div style={{ marginTop: '0.4rem' }}>
          <InteractiveSentence
            sentence={
              typeof word.sentences[0] === 'string'
                ? { en: word.sentences[0] }
                : word.sentences[0]
            }
            activeUserId={word.userId}
            highlightTerm={word.term}
            showTranslationByDefault={true}
          />
        </div>
      )}

      {/* Etiketler */}
      {word.tags && word.tags.length > 0 && (
        <div className={styles.tagsRow}>
          {word.tags.map((tag, idx) => (
            <span key={idx} className={styles.tagChip}>
              #{tag}
            </span>
          ))}
        </div>
      )}
    </article>
  )
}
