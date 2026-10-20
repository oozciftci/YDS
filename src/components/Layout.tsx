import { useEffect, useState, useRef } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { notifyRouteChanged } from '../pwa/registerSW'
import { useSyncStatus } from '../services/sync'
import { useUserStore } from '../stores/user'
import { isStudyPath } from '../services/studyMap'
import { cleanPath, isSaved, labelFor, recordVisit, toggleSaved, useFavoritesVersion } from '../services/favorites'
import { NotesDock } from './NotesDock'
import styles from './Layout.module.css'

const NAV_ITEMS = [
  { to: '/', label: 'Ana Sayfa', icon: 'M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z' },
  { to: '/calis', label: 'Çalış', icon: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11' },
  { to: '/words', label: 'Kelimeler', icon: 'M4 6h16M4 12h16M4 18h10' },
  { to: '/stats', label: 'İstatistik', icon: 'M5 20V10M12 20V4M19 20v-7' },
  { to: '/settings', label: 'Ayarlar', icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z' },
]

export function Layout() {
  const online = useOnlineStatus()
  const location = useLocation()
  const sync = useSyncStatus()
  const { activeUser, allUsers, setActiveUser } = useUserStore()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    notifyRouteChanged()
  }, [location.pathname])

  // Sık kullanılanlar için ziyaret sayacı; ☆ bu sayfayı kaydeder
  const activeUserId = activeUser?.id || 'user_ozgur'
  useEffect(() => {
    recordVisit(activeUserId, location.pathname)
  }, [activeUserId, location.pathname])
  useFavoritesVersion(activeUserId)
  const herePath = cleanPath(location.pathname, location.search)
  const hereSaved = isSaved(activeUserId, herePath)

  // Menü dışına tıklandığında kapat
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    if (userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [userMenuOpen])

  const totalPending = sync.pendingOutboxCount + sync.pendingLogsCount

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <NavLink to="/" className={styles.brand} aria-label="YDS Kelime ana sayfa">
            <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width={32} height={32} />
            <span className={styles.brandText}>YDS Kelime</span>
          </NavLink>
        </div>

        <nav className={styles.nav} aria-label="Ana menü">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              id={`nav-${item.to === '/' ? 'home' : item.to.slice(1)}`}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive || (item.to === '/calis' && isStudyPath(location.pathname)) ? styles.active : ''}`
              }
            >
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                <path d={item.icon} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className={styles.headerRight}>
          {herePath !== '/' && (
            <button
              type="button"
              className={`${styles.syncBtn} ${hereSaved ? styles.starOn : ''}`}
              onClick={() => toggleSaved(activeUserId, herePath)}
              title={hereSaved ? 'Kaydedilenlerden çıkar' : `“${labelFor(herePath)}” sayfasını kaydet`}
              aria-label={hereSaved ? 'Kaydedilenlerden çıkar' : 'Bu sayfayı kaydet'}
              aria-pressed={hereSaved}
            >
              {hereSaved ? '★' : '☆'}
            </button>
          )}
          {/* Senkronizasyon butonu */}
          <button
            type="button"
            className={`${styles.syncBtn} ${sync.status === 'syncing' ? styles.spinning : ''}`}
            onClick={() => void sync.syncNow()}
            title={
              totalPending > 0
                ? `${totalPending} bekleyen veri var. Senkronize etmek için tıklayın.`
                : 'Senkronizasyonu tetiklemek için tıklayın.'
            }
            aria-label="Senkronize et"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-1.19" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {totalPending > 0 && <span className={styles.badgeCount}>{totalPending}</span>}
          </button>

          {/* Ağ Durumu */}
          <span
            id="network-status"
            className={`${styles.netBadge} ${online ? styles.online : styles.offline}`}
            role="status"
            aria-live="polite"
          >
            <span className={styles.dot} />
            <span className={styles.hideMobile}>{online ? 'Çevrimiçi' : 'Çevrimdışı'}</span>
          </span>

          {/* Aktif Kullanıcı Değiştirici */}
          <div className={styles.userContainer} ref={menuRef}>
            <button
              id="active-user-btn"
              type="button"
              className={styles.userBtn}
              onClick={() => setUserMenuOpen((o) => !o)}
              aria-haspopup="true"
              aria-expanded={userMenuOpen}
            >
              <span
                className={styles.avatarDot}
                style={{ backgroundColor: activeUser?.avatarColor || '#7c5cff' }}
              />
              <span className={styles.userName}>{activeUser?.displayName || 'Kullanıcı'}</span>
              <svg viewBox="0 0 20 20" width="14" height="14" fill="currentColor">
                <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
              </svg>
            </button>

            {userMenuOpen && (
              <div className={styles.userMenu}>
                <div className={styles.menuHeader}>Kullanıcı Seç</div>
                {allUsers.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    className={`${styles.userMenuItem} ${u.id === activeUser?.id ? styles.activeUserItem : ''}`}
                    onClick={() => {
                      void setActiveUser(u.id)
                      setUserMenuOpen(false)
                    }}
                  >
                    <span className={styles.avatarDot} style={{ backgroundColor: u.avatarColor || '#7c5cff' }} />
                    <span>{u.displayName}</span>
                    {u.id === activeUser?.id && <span className={styles.check}>✓</span>}
                  </button>
                ))}
                <div className={styles.menuDivider} />
                <NavLink
                  to="/settings#users"
                  className={styles.menuSettingsLink}
                  onClick={() => setUserMenuOpen(false)}
                >
                  + Yeni Profil Yönetimi
                </NavLink>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <div key={location.pathname} className="page-enter">
          <Outlet />
        </div>
      </main>


      <NotesDock />
    </div>
  )
}
