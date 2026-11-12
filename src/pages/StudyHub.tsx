import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { QuickLinks } from '../components/QuickLinks'
import { EXAMS, STUDY_CATEGORIES, activeExam, categoriesOf, setActiveExam, type ExamId } from '../services/studyMap'
import { hasLocalContent } from '../services/localContent'
import styles from './StudyHub.module.css'

/** Çalış merkezi: önce sınav seçilir (YDS / DUS / KPSS), altında o sınavın çalışma türleri kategorilere ayrılır. */
export function StudyHubPage() {
  const { hash } = useLocation()
  const [exam, setExamState] = useState<ExamId>(() => STUDY_CATEGORIES.find((c) => c.id === hash.slice(1))?.exam ?? activeExam())
  const pick = (id: ExamId) => {
    setExamState(id)
    setActiveExam(id)
  }
  const cats = categoriesOf(exam)
  const info = EXAMS.find((e) => e.id === exam)!

  // Ana sayfadaki kategori kutusundan gelindiyse o kategorinin sınavına geç ve kategoriye kaydır
  useEffect(() => {
    if (!hash) return
    const target = STUDY_CATEGORIES.find((c) => c.id === hash.slice(1))
    // Adresle (dış kaynak) eşitleme
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (target) setExamState(target.exam)
    document.getElementById(`cat-${hash.slice(1)}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [hash])

  return (
    <section className={styles.page}>
      <header>
        <h1 className={styles.title}>Çalış</h1>
        <p className="muted" style={{ margin: 0 }}>Önce sınavını seç; çalışma türleri ona göre gelir.</p>
      </header>

      <div className={styles.exams} role="tablist" aria-label="Sınav seçimi">
        {EXAMS.map((e) => (
          <button
            key={e.id}
            type="button"
            role="tab"
            aria-selected={exam === e.id}
            className={`${styles.exam} ${exam === e.id ? styles.examOn : ''}`}
            onClick={() => pick(e.id)}
          >
            <span className={styles.examIcon}>{e.icon}</span>
            <strong>{e.title}</strong>
            <small>{e.desc}</small>
          </button>
        ))}
      </div>

      {exam === 'yds' && <QuickLinks showHint />}

      {exam === 'yds' && (
      <details className={styles.guide}>
        <summary>🧭 Yeni misin? Nereden başlayacağını gör</summary>
        <ol>
          <li>
            <strong>Her gün kelime:</strong> <Link to="/study?preset=due&auto=1">Günün tekrarları</Link>, sonra{' '}
            <Link to="/study">bir seviye (20 kelime)</Link>. Kelime YDS puanının en büyük parçası.
          </li>
          <li>
            <strong>Dilbilgisi temeli:</strong> <Link to="/dilbilgisi">Dilbilgisi Rehberi</Link>’nden günde bir konu.
          </li>
          <li>
            <strong>Soru tiplerini tanı:</strong> <Link to="/yds-test">Alıştırma Merkezi</Link>’nde her tipten birkaç
            set çöz.
          </li>
          <li>
            <strong>Günlük plan:</strong> <Link to="/">Ana Sayfa</Link>’daki “Bugünkü Planın” ne kadar yapacağını
            söyler; onu izlemen yeterli.
          </li>
        </ol>
      </details>
      )}

      {cats.length === 0 && (
        <p className={`card ${styles.emptyExam}`}>
          {exam === 'dus' && !hasLocalContent() ? (
            <>
              DUS soruları telifli olduğu için yalnızca cihazına yüklediğin kaynak paketiyle açılır.{' '}
              <Link to="/settings">Ayarlar › Kaynak paketi</Link>’nden yükle.
            </>
          ) : (
            <>{info.title} bölümü hazırlanıyor. İçerik eklendiğinde çalışma türleri burada görünecek.</>
          )}
        </p>
      )}

      <div className={styles.grid}>
        {cats.map((c) => (
          <article key={c.id} id={`cat-${c.id}`} className={`card ${styles.cat} ${hash === `#${c.id}` ? styles.catFocus : ''}`}>
            <div className={styles.catHead}>
              <span className={styles.catIcon}>{c.icon}</span>
              <div>
                <h2>{c.title}</h2>
                <p className="muted">{c.desc}</p>
              </div>
            </div>
            <ul className={styles.links}>
              {c.links.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className={styles.link}>
                    <span>
                      <strong>{l.label}</strong>
                      <small>{l.hint}</small>
                    </span>
                    <span aria-hidden="true">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  )
}
