import { useLiveQuery } from 'dexie-react-hooks'
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
      .filter((a) => a.inWrongBook && !a.examId.includes('-strateji3-'))
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
    <>
    <ImageWrongLink userId={userId} />
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
    </>
  )
}

/** Sınav Stratejileri 3 (görüntü tabanlı) yanlışları ayrı kuyrukta çözülür. */
function ImageWrongLink({ userId }: { userId: string }) {
  const count = useLiveQuery(
    () => db.examAnswers.where('userId').equals(userId).filter((a) => a.inWrongBook && a.examId.includes('-strateji3-')).count(),
    [userId],
  )
  if (!count) return null
  return (
    <Link to="/yds-sorular/bankalar/strateji-3/yanlislar" className="card" style={{ display: 'block', marginBottom: '0.75rem', textDecoration: 'none' }}>
      📗 Sınav Stratejileri 3’teki yanlışların: <strong>{count}</strong> soru → ayrı defterde çöz
    </Link>
  )
}
