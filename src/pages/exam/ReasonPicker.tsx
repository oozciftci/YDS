import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db'
import { setWrongReason } from '../../services/examProgress'
import { WRONG_REASONS } from '../../services/wrongReasons'
import styles from '../ExamStudy.module.css'

/** Yanlış yapılan sorunun altında “neden yanlış yaptın?” seçimi (tek dokunuş, isteğe bağlı). */
export function ReasonPicker({ answerId }: { answerId: string }) {
  const row = useLiveQuery(() => db.examAnswers.get(answerId), [answerId])
  if (!row || row.correct) return null
  return (
    <div className={styles.reasonRow} role="group" aria-label="Yanlışın nedeni">
      <span className="muted">Neden yanlış yaptın?</span>
      {WRONG_REASONS.map((r) => (
        <button
          key={r.key}
          type="button"
          title={r.hint}
          className={`${styles.reasonChip} ${row.wrongReason === r.key ? styles.reasonOn : ''}`}
          onClick={() => void setWrongReason(answerId, row.wrongReason === r.key ? undefined : r.key)}
        >
          {r.label}
        </button>
      ))}
    </div>
  )
}
