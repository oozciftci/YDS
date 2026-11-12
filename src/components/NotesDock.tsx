import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { useNotePageKey } from '../services/noteScope'
import { db } from '../db'
import { addGeneralEntry, pageLabel } from '../services/notebook'
import { NoteFeed } from './NoteFeed'
import { STICKY_OPEN_PAGE } from './StickyNotes'
import { useUserStore } from '../stores/user'
import styles from './NotesDock.module.css'

// Sağ alttaki iki küçük düğme: "Bu sayfa" o sayfanın (ya da sorunun) yapışkan notunu açar (StickyNotes.tsx; yoksa
// oluşturur) ve "Defterim" (tüm çalışma için tek defter) burada genişler. İkisi de aynı not akışını kullanır (NoteFeed):
// metin, sesli not, ekran görüntüsü.

const OPEN_KEY = 'yds-notes-open'

function readOpen(): boolean {
  try {
    return localStorage.getItem(OPEN_KEY) === 'general'
  } catch {
    return false
  }
}

export function NotesDock() {
  const userId = useUserStore((s) => s.activeUserId)
  const pageKey = useNotePageKey()
  const [open, setOpenState] = useState(readOpen)
  const setOpen = (v: boolean) => {
    setOpenState(v)
    try {
      if (v) localStorage.setItem(OPEN_KEY, 'general')
      else localStorage.removeItem(OPEN_KEY)
    } catch {
      // yoksay
    }
  }

  const pageNotes = useLiveQuery(
    () =>
      db.notebook
        .where('[userId+pageKey]')
        .equals([userId, pageKey])
        .filter((n) => n.scope === 'sticky')
        .count(),
    [userId, pageKey],
    0,
  )
  const generalCount = useLiveQuery(() => db.notebook.where('[userId+scope]').equals([userId, 'general']).count(), [userId], 0)

  useEffect(() => {
    if (!open) return
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <div className={styles.dock} aria-label="Notlarım">
      {/* Olay dokunma anında (eşzamanlı) gönderilir: not hemen açılır, telefonda klavye de açılabilir */}
      <button
        type="button"
        className={styles.pill}
        onClick={() => window.dispatchEvent(new CustomEvent(STICKY_OPEN_PAGE))}
        title="Bu sayfaya özel yapışkan not"
      >
        📄 Bu sayfa{pageNotes > 0 && <span className={styles.dot} aria-label="not var" />}
      </button>
      {open ? (
        <GeneralPane userId={userId} pageKey={pageKey} onClose={() => setOpen(false)} />
      ) : (
        <button type="button" className={styles.pill} onClick={() => setOpen(true)} title="Genel çalışma defteri">
          📓 Defterim{generalCount > 0 && <span className={styles.count}>{generalCount}</span>}
        </button>
      )}
    </div>
  )
}

/** Genel çalışma defteri: girdiler (metin / sesli not / görsel), her biri özellik adı + tarih/saat başlıklı. */
function GeneralPane({ userId, pageKey, onClose }: { userId: string; pageKey: string; onClose: () => void }) {
  const entries = useLiveQuery(
    () => db.notebook.where('[userId+scope]').equals([userId, 'general']).sortBy('createdAt'),
    [userId],
  )
  return (
    <section className={`${styles.pane} ${styles.paneWide}`} aria-label="Genel çalışma defteri">
      <header className={styles.paneHead}>
        <div className={styles.paneTitle}>
          <strong>📓 Defterim</strong>
          <small className="muted">Tüm çalışma için tek defter</small>
        </div>
        <button type="button" className={styles.iconBtn} onClick={onClose} aria-label="Küçült" title="Küçült (Esc)">
          ▾
        </button>
      </header>
      <NoteFeed
        entries={entries}
        onAdd={(e) => addGeneralEntry(userId, pageKey, e)}
        placeholder={`Not yaz, Enter ile ekle… (${pageLabel(pageKey)})`}
        empty="Henüz not yok. Aşağıya yaz, 🎤 ile sesli not bırak ya da 🖼️ ile ekran görüntüsü ekle (yapıştırmak da olur). Her not, o an kullandığın özelliğin adı ve saatiyle kaydedilir."
        titled
        autoFocus
      />
    </section>
  )
}
