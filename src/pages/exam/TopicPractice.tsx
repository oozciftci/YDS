import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { db } from '../../db'
import { ALL_SECTIONS, getSection, rangeIn, type SectionKey } from '../../services/ydsSections'
import { useUserStore } from '../../stores/user'
import { inPool, loadAllExams, readPool } from './examData'
import { QueueRunner, type QueueItem } from './QueueRunner'

/** Konuya göre çalışma: tüm sınavlardan seçilen tipteki sorular (en yeni sınav önce). */
export function TopicPractice() {
  const { section = '' } = useParams()
  const userId = useUserStore((s) => s.activeUserId)
  const valid = ALL_SECTIONS.some((s) => s.key === section)
  const sec = getSection(section as SectionKey)
  const [items, setItems] = useState<QueueItem[] | null>(null)
  const [includeSolved, setIncludeSolved] = useState(false)
  const [solvedCount, setSolvedCount] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!valid) return
    let alive = true
    setItems(null)
    Promise.all([loadAllExams(), db.examAnswers.where('[userId+section]').equals([userId, sec.key]).toArray()])
      .then(([bundles, answers]) => {
        if (!alive) return
        const solved = new Set(answers.map((a) => `${a.examId}#${a.no}`))
        const all: QueueItem[] = []
        const pool = readPool()
        for (const bundle of [...bundles].reverse()) {
          if (!inPool(bundle.exam, pool)) continue
          const range = rangeIn(sec.key, bundle.exam.id)
          if (!range) continue
          for (const q of bundle.exam.questions) {
            if (q.no < range[0] || q.no > range[1] || !q.answer) continue
            all.push({ bundle, q })
          }
        }
        // Liste oturum başında sabitlenir; çözdükçe sorular kaybolmaz
        setSolvedCount(all.filter((it) => solved.has(`${it.bundle.exam.id}#${it.q.no}`)).length)
        setItems(includeSolved ? all : all.filter((it) => !solved.has(`${it.bundle.exam.id}#${it.q.no}`)))
      })
      .catch((e) => setError('Sınavlar yüklenemedi: ' + e))
    return () => {
      alive = false
    }
  }, [userId, sec.key, valid, includeSolved])

  if (!valid) return <p className="muted">Bilinmeyen soru tipi.</p>
  if (error) return <p className="muted">{error}</p>
  if (!items) return <p className="muted">Sorular hazırlanıyor…</p>

  return (
    <QueueRunner
      key={`${sec.key}-${includeSolved}`}
      title={`${sec.icon} ${sec.label}`}
      description={sec.hint}
      items={items}
      empty={
        <>
          <p>
            Bu tipteki tüm soruları ({solvedCount}) çözdün. 👏 Yanlışların Yanlış Defteri’nde duruyor.
          </p>
          <button type="button" className="btn btn-secondary" onClick={() => setIncludeSolved(true)}>
            Hepsini yeniden çöz
          </button>
        </>
      }
    />
  )
}
