import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { QuickLinks } from '../components/QuickLinks'
import { STUDY_CATEGORIES } from '../services/studyMap'
import styles from './StudyHub.module.css'

/** Çalış merkezi: tüm çalışma türleri kategorilere ayrılmış tek sayfada. */
export function StudyHubPage() {
  const { hash } = useLocation()

  // Ana sayfadaki kategori kutusundan gelindiyse o kategoriye kaydır
  useEffect(() => {
    if (!hash) return
    document.getElementById(`cat-${hash.slice(1)}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [hash])

  return (
    <section className={styles.page}>
      <header>
        <h1 className={styles.title}>Çalış</h1>
        <p className="muted" style={{ margin: 0 }}>Ne çalışmak istiyorsun? Bir kategori seç.</p>
      </header>

      <QuickLinks showHint />

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

      <div className={styles.grid}>
        {STUDY_CATEGORIES.map((c) => (
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
