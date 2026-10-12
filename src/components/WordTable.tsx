import { MASTERY_CONFIG, type CardState, type MasteryLevel, type PartOfSpeech, type WordItem } from '../types/database'
import { speakWord } from '../services/tts'
import styles from '../pages/Words.module.css'

interface WordTableProps {
  words: WordItem[]
  cardMap?: Map<string, CardState>
  onEdit: (word: WordItem) => void
  onDelete: (wordId: string) => void
  onTransfer?: (word: WordItem) => void
  otherUserName?: string
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

export function WordTable({ words, cardMap, onEdit, onDelete, onTransfer, otherUserName }: WordTableProps) {
  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Kelime</th>
            <th>Puan</th>
            <th>Tür</th>
            <th>Türkçe Anlamı</th>
            <th>Eş Anlamlılar (YDS)</th>
            <th>Etiketler</th>
            <th style={{ textAlign: 'right' }}>İşlemler</th>
          </tr>
        </thead>
        <tbody>
          {words.map((w) => (
            <tr key={w.id}>
              <td>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                  <strong>{w.term}</strong>
                  <button
                    type="button"
                    className={styles.audioBtn}
                    onClick={() => speakWord(w.term)}
                    title="Dinle"
                  >
                    🔊
                  </button>
                </div>
              </td>
              <td>
                {cardMap?.get(w.id) ? (
                  <span
                    style={{
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      padding: '0.15rem 0.45rem',
                      borderRadius: '4px',
                      background: 'color-mix(in srgb, var(--input-bg) 80%, transparent)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    {MASTERY_CONFIG[(cardMap.get(w.id)?.masteryScore as MasteryLevel) || 1].badge}
                  </span>
                ) : (
                  <span className="muted" style={{ fontSize: '0.78rem' }}>
                    Yeni
                  </span>
                )}
              </td>
              <td>
                <span className={`${styles.posBadge} ${getPosClass(w.partOfSpeech)}`}>
                  {w.partOfSpeech}
                </span>
              </td>
              <td>{w.definition}</td>
              <td>
                {w.synonyms && w.synonyms.length > 0 ? (
                  <span style={{ color: 'var(--primary)', fontWeight: 500 }}>
                    {w.synonyms.join(', ')}
                  </span>
                ) : (
                  <span className="muted">—</span>
                )}
              </td>
              <td>
                {w.tags && w.tags.length > 0 ? (
                  <span className="muted" style={{ fontSize: '0.78rem' }}>
                    {w.tags.map((t) => `#${t}`).join(' ')}
                  </span>
                ) : (
                  <span className="muted">—</span>
                )}
              </td>
              <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                {onTransfer && otherUserName && (
                  <button
                    type="button"
                    className={styles.actionBtn}
                    onClick={() => onTransfer(w)}
                    title={`${otherUserName} profiline kopyala`}
                    style={{ color: 'var(--primary)' }}
                  >
                    ⇄
                  </button>
                )}
                <button
                  type="button"
                  className={styles.actionBtn}
                  onClick={() => onEdit(w)}
                  title="Düzenle"
                >
                  ✏️
                </button>
                <button
                  type="button"
                  className={`${styles.actionBtn} ${styles.actionBtnDelete}`}
                  onClick={() => {
                    if (window.confirm(`"${w.term}" kelimesini silmek istediğinize emin misiniz?`)) {
                      onDelete(w.id)
                    }
                  }}
                  title="Sil"
                >
                  🗑️
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
