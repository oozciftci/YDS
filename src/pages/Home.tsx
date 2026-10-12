import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { useSettings } from '../stores/settings'
import { useSwStatus } from '../pwa/registerSW'
import styles from './Home.module.css'

export function HomePage() {
  const online = useOnlineStatus()
  const configured = useSettings((s) => Boolean(s.backend.url && s.backend.anonKey))
  const sw = useSwStatus((s) => s.status)
  const offlineReady = sw === 'offline-ready' || sw === 'active' || sw === 'update-pending'

  return (
    <section className={styles.page}>
      <div className={styles.hero}>
        <h1>
          Merhaba! <span className={styles.gradient}>Bugün kaç kelime?</span>
        </h1>
        <p className="muted">
          Çalışma ekranları sonraki adımlarda gelecek. Şimdilik uygulama iskeleti ve çevrimdışı altyapısı hazır.
        </p>
      </div>

      <div className={styles.grid}>
        <StatusCard
          id="status-offline"
          ok={offlineReady}
          title="Çevrimdışı kullanım"
          text={offlineReady ? 'Uygulama internetsiz açılabilir.' : 'Hazırlanıyor… (ilk yüklemeden sonra hazır olur)'}
        />
        <StatusCard id="status-network" ok={online} title="Ağ" text={online ? 'Çevrimiçi' : 'Çevrimdışı — veriler yerelde kalacak'} />
        <StatusCard
          id="status-backend"
          ok={configured}
          title="Sunucu"
          text={configured ? 'Adres ayarlı' : 'Henüz ayarlanmadı'}
          action={!configured ? <Link to="/settings">Ayarlara git →</Link> : undefined}
        />
      </div>
    </section>
  )
}

function StatusCard(props: { id: string; ok: boolean; title: string; text: string; action?: ReactNode }) {
  return (
    <article id={props.id} className={`card ${styles.status}`}>
      <span className={`${styles.icon} ${props.ok ? styles.iconOk : styles.iconWarn}`} aria-hidden="true">
        {props.ok ? '✓' : '!'}
      </span>
      <div>
        <h2>{props.title}</h2>
        <p className="muted">{props.text}</p>
        {props.action}
      </div>
    </article>
  )
}
