import { useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { notifyRouteChanged } from '../pwa/registerSW'
import styles from './Layout.module.css'

const NAV_ITEMS = [
  { to: '/', label: 'Ana Sayfa', icon: 'M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z' },
  { to: '/study', label: 'Çalış', icon: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11' },
  { to: '/words', label: 'Kelimeler', icon: 'M4 6h16M4 12h16M4 18h10' },
  { to: '/stats', label: 'İstatistik', icon: 'M5 20V10M12 20V4M19 20v-7' },
  { to: '/settings', label: 'Ayarlar', icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z' },
]

export function Layout() {
  const online = useOnlineStatus()
  const location = useLocation()

  useEffect(() => {
    notifyRouteChanged()
  }, [location.pathname])

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <NavLink to="/" className={styles.brand} aria-label="YDS Kelime ana sayfa">
          <img src="/favicon.svg" alt="" width={32} height={32} />
          <span>YDS Kelime</span>
        </NavLink>
        <span
          id="network-status"
          className={`${styles.netBadge} ${online ? styles.online : styles.offline}`}
          role="status"
          aria-live="polite"
        >
          <span className={styles.dot} />
          {online ? 'Çevrimiçi' : 'Çevrimdışı'}
        </span>
      </header>

      <main className={styles.main}>
        <div key={location.pathname} className="page-enter">
          <Outlet />
        </div>
      </main>

      <nav className={styles.nav} aria-label="Ana menü">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            id={`nav-${item.to === '/' ? 'home' : item.to.slice(1)}`}
            className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path d={item.icon} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
