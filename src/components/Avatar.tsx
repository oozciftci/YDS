import type { CSSProperties } from 'react'
import type { UserProfile } from '../types/database'

/** Profil simgesi: kullanıcının resmi, yoksa seçtiği renkte baş harfi. */
export function Avatar({ user, size, round = false, style }: { user: UserProfile | null | undefined; size: number; round?: boolean; style?: CSSProperties }) {
  const box: CSSProperties = {
    width: size,
    height: size,
    flexShrink: 0,
    borderRadius: round ? '50%' : Math.round(size * 0.24),
    overflow: 'hidden',
    display: 'inline-grid',
    placeItems: 'center',
    background: user?.avatarColor || 'var(--primary)',
    color: '#fff',
    fontWeight: 700,
    fontSize: Math.round(size * 0.45),
    lineHeight: 1,
    ...style,
  }
  if (user?.avatarImage) {
    return (
      <span style={box} aria-hidden="true">
        <img src={user.avatarImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      </span>
    )
  }
  return (
    <span style={box} aria-hidden="true">
      {size >= 18 ? user?.displayName?.charAt(0).toLocaleUpperCase('tr-TR') || 'Ö' : null}
    </span>
  )
}
