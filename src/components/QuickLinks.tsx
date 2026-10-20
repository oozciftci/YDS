import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { getFrequent, getSaved, hideFrequent, toggleSaved, useFavoritesVersion } from '../services/favorites'
import { useUserStore } from '../stores/user'
import styles from './QuickLinks.module.css'

/** Kaydedilenler ve sık kullanılanlar: tek tıkla sayfaya git. */
export function QuickLinks({ showHint = false }: { showHint?: boolean }) {
  const userId = useUserStore((s) => s.activeUserId)
  const version = useFavoritesVersion(userId)
  // version (depodaki ham metin) değişince listeler yeniden okunur
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const saved = useMemo(() => getSaved(userId), [userId, version])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const frequent = useMemo(() => getFrequent(userId), [userId, version])

  if (saved.length === 0 && frequent.length === 0) {
    return showHint ? (
      <p className={styles.hint}>
        ⭐ Sık açtığın bir sayfayı üst çubuktaki ☆ ile kaydedersen burada tek tıkla açılır. Çok kullandığın sayfalar da
        kendiliğinden burada belirir.
      </p>
    ) : null
  }

  return (
    <section className={styles.box}>
      {saved.length > 0 && (
        <div className={styles.row}>
          <span className={styles.head}>⭐ Kaydedilenler</span>
          {saved.map((s) => (
            <span key={s.path} className={styles.chip}>
              <Link to={s.path}>{s.label}</Link>
              <button
                type="button"
                onClick={() => toggleSaved(userId, s.path)}
                aria-label={`${s.label} kaydını kaldır`}
                title="Kaydı kaldır"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      {frequent.length > 0 && (
        <div className={styles.row}>
          <span className={styles.head}>🕘 Sık kullanılanlar</span>
          {frequent.map((f) => (
            <span key={f.path} className={styles.chip}>
              <Link to={f.path}>{f.label}</Link>
              <button
                type="button"
                onClick={() => hideFrequent(userId, f.path)}
                aria-label={`${f.label} sık kullanılanlardan kaldır`}
                title="Bu listeden kaldır"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </section>
  )
}
