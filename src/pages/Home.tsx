import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { useSettings } from '../stores/settings'
import { useUserStore } from '../stores/user'
import { useSwStatus } from '../pwa/registerSW'
import { useSyncStatus } from '../services/sync'
import styles from './Home.module.css'

export function HomePage() {
  const online = useOnlineStatus()
  const configured = useSettings((s) => Boolean(s.backend.url && s.backend.anonKey))
  const sw = useSwStatus((s) => s.status)
  const offlineReady = sw === 'offline-ready' || sw === 'active' || sw === 'update-pending'
  const activeUser = useUserStore((s) => s.activeUser)
  const sync = useSyncStatus()

  const wordCount = useLiveQuery(
    () =>
      activeUser
        ? db.words.where('userId').equals(activeUser.id).filter((w) => !w.isDeleted).count()
        : db.words.filter((w) => !w.isDeleted).count(),
    [activeUser?.id],
    0,
  )

  const dueCardCount = useLiveQuery(
    () => {
      if (!activeUser) return 0
      const now = new Date().toISOString()
      return db.cardStates.where('userId').equals(activeUser.id).filter((c) => c.due <= now).count()
    },
    [activeUser?.id],
    0,
  )

  const totalPending = sync.pendingOutboxCount + sync.pendingLogsCount

  return (
    <section className={styles.page}>
      <div className={styles.hero}>
        <h1>
          Merhaba, {activeUser?.displayName || 'Öğrenci'}!{' '}
          <span className={styles.gradient}>Bugün kaç kelime?</span>
        </h1>
        <p className="muted">
          Offline-first mimari devrede. Tüm kelimeler ve skorlar cihazında güvende; internet geldiğinde otomatik eşitlenir.
        </p>
      </div>

      <div className={styles.grid}>
        <StatusCard
          id="status-study"
          ok={true}
          title="Kelime Havuzun"
          text={`${wordCount} kelime kayıtlı (${dueCardCount} tekrar bekliyor)`}
          action={<Link to="/words">Kelimeleri Gör →</Link>}
        />
        <StatusCard
          id="status-sync"
          ok={totalPending === 0}
          title="Senkronizasyon"
          text={
            totalPending > 0
              ? `${totalPending} bekleyen kayıt var (${online ? 'Gönderiliyor…' : 'Çevrimdışı, internet bekleniyor'})`
              : 'Tüm veriler eşitlendi ✓'
          }
          action={<Link to="/settings">Senkronizasyon Ayarları →</Link>}
        />
        <StatusCard
          id="status-offline"
          ok={offlineReady}
          title="Çevrimdışı Çalışma"
          text={offlineReady ? 'Uygulama internetsiz açılabilir.' : 'Hazırlanıyor…'}
        />
        <StatusCard
          id="status-network"
          ok={online}
          title="Ağ Durumu"
          text={online ? 'Çevrimiçi' : 'Çevrimdışı — veriler yerelde birikiyor'}
        />
        <StatusCard
          id="status-backend"
          ok={configured}
          title="Supabase Sunucusu"
          text={configured ? 'Bağlantı adresi kayıtlı' : 'Henüz ayarlanmadı'}
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
