import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { db } from '../../db'
import { getSection } from '../../services/ydsSections'
import { useUserStore } from '../../stores/user'
import styles from '../ExamStudy.module.css'
import { listBanks, type ExamMeta } from './examData'

/** Soru bankası testleri (yerel, telifli kitaplardan): test test çöz, her sorudan sonra kitabın çözümünü oku. */
export function BankList() {
  const navigate = useNavigate()
  const userId = useUserStore((s) => s.activeUserId)
  const [banks, setBanks] = useState<ExamMeta[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    listBanks()
      .then(setBanks)
      .catch(() => setError('Soru bankaları okunamadı. Bu sayfa yalnızca yerelde (npm run dev) çalışır.'))
  }, [])

  const answers = useLiveQuery(
    () => db.examAnswers.where('userId').equals(userId).filter((a) => a.examId.startsWith('banka-')).toArray(),
    [userId],
  )
  const perExam = useMemo(() => {
    const m = new Map<string, { answered: number; correct: number }>()
    for (const a of answers ?? []) {
      const s = m.get(a.examId) ?? { answered: 0, correct: 0 }
      s.answered++
      if (a.correct) s.correct++
      m.set(a.examId, s)
    }
    return m
  }, [answers])

  if (error) return <p className="muted">{error}</p>
  if (!banks || !answers) return <p className="muted">Yükleniyor…</p>

  const total = banks.reduce((n, b) => n + (b.count ?? 0), 0)
  const done = answers.length
  const correct = answers.filter((a) => a.correct).length

  return (
    <section className={styles.page}>
      <header className={styles.head}>
        <div>
          <Link to="/yds-sorular" className={styles.backLink}>
            ← Soru Merkezi
          </Link>
          <h1 className={styles.title}>📚 Soru bankaları</h1>
          <p className="muted" style={{ margin: 0 }}>
            {banks.length} test · {total} soru · Çözülen {done}
            {done > 0 && ` · Başarı %${Math.round((correct / done) * 100)}`}. Her sorudan sonra kitabın ayrıntılı çözümü
            açılır; yanlışların Yanlış Defteri’ne girer.
          </p>
        </div>
      </header>

      {banks.length === 0 ? (
        <p className="muted">Henüz soru bankası eklenmedi.</p>
      ) : (
        <article className="card">
          <ul className={styles.examList}>
            {banks.map((b) => {
              const st = perExam.get(b.id)
              const count = b.count ?? 0
              const answered = st?.answered ?? 0
              const sec = b.bank ? getSection(b.bank as Parameters<typeof getSection>[0]) : null
              return (
                <li key={b.id} className={styles.examRow}>
                  <span className={styles.examName}>
                    {b.title}
                    <small>
                      {sec && `${sec.icon} ${sec.label} · `}
                      {answered === 0 ? `${count} soru` : `${answered}/${count} çözüldü · ${st!.correct} doğru`}
                    </small>
                  </span>
                  <span className={styles.bar} aria-hidden="true">
                    <span className={styles.barFill} style={{ width: `${count ? (answered / count) * 100 : 0}%` }} />
                  </span>
                  <span className={styles.examActions}>
                    <button type="button" className="btn btn-secondary" onClick={() => navigate(`../sinav/${b.id}`)}>
                      {answered > 0 && answered < count ? 'Devam' : 'Çöz'}
                    </button>
                  </span>
                </li>
              )
            })}
          </ul>
        </article>
      )}
    </section>
  )
}
