import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../../db'
import { useUserStore } from '../../stores/user'
import { loadExam } from './examData'
import { QueueRunner, type QueueItem } from './QueueRunner'

/** Yanlış Defteri: yanlış yapılan sorular, en eski yanlıştan başlayarak. Doğru çözülen defterden çıkar. */
export function WrongBook() {
  const userId = useUserStore((s) => s.activeUserId)
  const [items, setItems] = useState<QueueItem[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    db.examAnswers
      .where('userId')
      .equals(userId)
      .filter((a) => a.inWrongBook)
      .sortBy('answeredAt')
      .then(async (rows) => {
        const out: QueueItem[] = []
        for (const r of rows) {
          try {
            const bundle = await loadExam(r.examId)
            const q = bundle.exam.questions.find((x) => x.no === r.no)
            if (q?.answer) out.push({ bundle, q })
          } catch {
            // Sınav dosyası artık yoksa atla
          }
        }
        if (alive) setItems(out)
      })
      .catch((e) => setError('Defter yüklenemedi: ' + e))
    return () => {
      alive = false
    }
  }, [userId])

  if (error) return <p className="muted">{error}</p>
  if (!items) return <p className="muted">Defter hazırlanıyor…</p>

  return (
    <QueueRunner
      title="📕 Yanlış Defteri"
      description="Daha önce yanlış yaptığın sorular. Doğru çözdüğün soru defterden çıkar; yanlışsa defterde kalır."
      items={items}
      wrongBook
      empty={
        <>
          <p>Defterin boş. Soru çözerken yaptığın yanlışlar burada toplanır.</p>
          <Link to="/yds-sorular" className="btn btn-secondary">
            Soru çözmeye git
          </Link>
        </>
      }
    />
  )
}
