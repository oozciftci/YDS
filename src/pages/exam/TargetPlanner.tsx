import { useMemo } from 'react'
import type { ExamAnswer } from '../../types/database'
import { summarizeBySection } from '../../services/examProgress'
import { buildTargetPlan } from '../../services/targetPlan'
import { isYokdil } from '../../services/ydsSections'
import { useSettings } from '../../stores/settings'
import styles from '../ExamStudy.module.css'

/** Hedef puana kaç doğru gerektiğini ve eksiğin hangi soru tiplerinden kapatılacağını gösterir (YDS cevaplarından). */
export function TargetPlanner({ answers }: { answers: ExamAnswer[] }) {
  const target = useSettings((s) => s.exam.targetScore)
  const plan = useMemo(
    () => buildTargetPlan(target, summarizeBySection(answers.filter((a) => !isYokdil(a.examId)))),
    [answers, target],
  )
  if (!plan) return null
  const top = plan.gains.filter((g) => g.gain >= 0.5).slice(0, 3)
  const nf = (n: number) => n.toLocaleString('tr-TR', { maximumFractionDigits: 1 })

  return (
    <article className="card">
      <h2 className={styles.blockTitle}>Hedef puan planı</h2>
      <p className={styles.blockDesc}>
        {plan.target} puan için 80 sorudan <strong>{plan.needCorrect}</strong> doğru gerekir. Şu anki başarına göre tahminin{' '}
        <strong>~{Math.round(plan.estCorrect)}</strong> doğru.
      </p>
      {plan.gap <= 0 ? (
        <p className={styles.okText}>Hedefin içindesin. Bu seviyeyi koru; zayıf tipleri yoklamaya devam et.</p>
      ) : (
        <>
          <p style={{ margin: '0 0 0.4rem' }}>
            Eksik: <strong>~{Math.ceil(plan.gap)} doğru</strong>. En çok kazanç:
          </p>
          <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
            {top.map((g) => (
              <li key={g.key}>
                {g.label}: <strong>+{nf(g.gain)}</strong> doğru (şu an %{Math.round(g.rate * 100)}, {g.questions} soru)
              </li>
            ))}
          </ul>
        </>
      )}
    </article>
  )
}
