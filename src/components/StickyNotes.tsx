import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { useNotePageKey } from '../services/noteScope'
import { db } from '../db'
import { addStickyItem, createSticky, deleteSticky, deleteStickyIfEmpty, newSticky, pageLabel, updateEntry } from '../services/notebook'
import { useUserStore } from '../stores/user'
import type { NoteEntry, StickyPlace } from '../types/database'
import { NoteFeed } from './NoteFeed'
import styles from './StickyNotes.module.css'

// Sayfaya yapıştırılmış renkli notlar (post-it). "📄 Bu sayfa" düğmesi o sayfanın notunu açar (yoksa sarı bir not
// oluşturur); not açıkken Defterim'deki gibi bir akıştır: metin, sesli not, görsel art arda eklenir (NoteFeed).
// Küçük hâli sürükleyerek taşınır, sağ alt köşeden boyutlanır, dokununca büyüyüp açılır. Odak modunda da görünür.
// Not, açıldığı sayfaya ya da soruya aittir (src/services/noteScope.ts); başka soruya geçince görünmez.
// Konum ekranın oranı olarak saklanır (telefon yan çevrilince de ekranda kalır). Hareket yalnızca stil değiştirir;
// parmağın altındaki öğe hareket sırasında DOM'dan kalkmaz (iOS dokunma hedefi sorunu).

export const STICKY_COLORS: { key: string; label: string; bg: string }[] = [
  { key: 'sari', label: 'Sarı', bg: '#fff59d' },
  { key: 'pembe', label: 'Pembe', bg: '#f8bbd0' },
  { key: 'mavi', label: 'Mavi', bg: '#b3e5fc' },
  { key: 'yesil', label: 'Yeşil', bg: '#c5e1a5' },
  { key: 'turuncu', label: 'Turuncu', bg: '#ffcc80' },
  { key: 'mor', label: 'Mor', bg: '#d1c4e9' },
]
const bgOf = (key: string) => STICKY_COLORS.find((c) => c.key === key)?.bg ?? STICKY_COLORS[0].bg

/** Belli bir notu aç: window.dispatchEvent(new CustomEvent(STICKY_OPEN, { detail: id })) */
export const STICKY_OPEN = 'yds-sticky-open'
/** Bu sayfanın notunu aç (yoksa oluştur): "📄 Bu sayfa" düğmesi gönderir */
export const STICKY_OPEN_PAGE = 'yds-sticky-open-page'

const MIN_W = 72
const MIN_H = 56
const MAX = 420

function useViewport() {
  const [vp, setVp] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }))
  useEffect(() => {
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return vp
}

/** Notun kimliğinden sabit, hafif bir eğim (-2.5° … 2.5°) */
function tilt(id: string) {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0
  return ((Math.abs(h) % 11) - 5) / 2
}

export function StickyLayer() {
  const userId = useUserStore((s) => s.activeUserId)
  const pageKey = useNotePageKey()
  // Sayfa/soru değişince baştan kurulur: açık not kapanır, durum sıfırlanır
  return <Layer key={`${userId}:${pageKey}`} userId={userId} pageKey={pageKey} />
}

function Layer({ userId, pageKey }: { userId: string; pageKey: string }) {
  const rows = useLiveQuery(
    () =>
      db.notebook
        .where('[userId+pageKey]')
        .equals([userId, pageKey])
        .filter((n) => n.scope === 'sticky' || n.scope === 'stickyItem')
        .sortBy('createdAt'),
    [userId, pageKey],
  )
  const notes = useMemo(() => rows?.filter((n) => n.scope === 'sticky'), [rows])
  const itemsBy = useMemo(() => {
    const m = new Map<string, NoteEntry[]>()
    for (const r of rows ?? []) if (r.scope === 'stickyItem' && r.parentId) m.set(r.parentId, [...(m.get(r.parentId) ?? []), r])
    return m
  }, [rows])

  const [openId, setOpenId] = useState<string | null>(null)
  // Yeni oluşturulan not: veritabanına yazılırken (sorguya düşmeden) de açık dursun
  const [draft, setDraft] = useState<NoteEntry | null>(null)
  // "Bu sayfa" ile açıldıysa yazma alanına odaklan; nota dokunup açınca (okumak/dinlemek için) klavye açılmasın
  const [focus, setFocus] = useState(false)
  const vp = useViewport()

  const open = notes?.find((n) => n.id === openId) ?? (draft && draft.id === openId ? draft : undefined)
  // Olay dinleyicileri ve kapanış temizliği hep güncel durumu görsün
  const live = useRef({ notes, open })
  useEffect(() => {
    live.current = { notes, open }
  })

  function create(count: number) {
    const row = newSticky(userId, pageKey, STICKY_COLORS[count % STICKY_COLORS.length].key, count)
    setDraft(row)
    setOpenId(row.id)
    setFocus(true)
    void createSticky(row)
  }

  function close() {
    const o = live.current.open
    setOpenId(null)
    setDraft(null)
    if (o) void deleteStickyIfEmpty(o)
  }

  useEffect(() => {
    const onOpen = (e: Event) => {
      setFocus(false)
      setOpenId(String((e as CustomEvent).detail))
    }
    const onPage = () => {
      const list = live.current.notes
      if (list?.length) {
        setFocus(true)
        setOpenId(list[0].id)
      } else if (list) create(0)
      else
        // Sorgu henüz dönmedi (çok ender): sonucu bekle
        void db.notebook
          .where('[userId+pageKey]')
          .equals([userId, pageKey])
          .filter((n) => n.scope === 'sticky')
          .sortBy('createdAt')
          .then((l) => {
            if (l.length) {
              setFocus(true)
              setOpenId(l[0].id)
            } else create(0)
          })
    }
    window.addEventListener(STICKY_OPEN, onOpen)
    window.addEventListener(STICKY_OPEN_PAGE, onPage)
    return () => {
      window.removeEventListener(STICKY_OPEN, onOpen)
      window.removeEventListener(STICKY_OPEN_PAGE, onPage)
      // Sayfa/soru değişti: açık kalan boş not sayfada kalmasın
      const o = live.current.open
      if (o) void deleteStickyIfEmpty(o)
    }
    // create/close yalnızca userId + pageKey'e bağlı; bileşen bunlar değişince zaten baştan kurulur
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, pageKey])

  const shown = [...(notes ?? []), ...(draft && !notes?.some((n) => n.id === draft.id) ? [draft] : [])]
  if (!shown.length) return null
  return (
    <div className={`${styles.layer} ${open ? styles.layerOpen : ''}`}>
      {shown.map((n) => (
        <Sticky
          key={n.id}
          note={n}
          items={itemsBy.get(n.id) ?? []}
          vp={vp}
          onOpen={() => {
            setFocus(false)
            setOpenId(n.id)
          }}
          hidden={n.id === openId}
        />
      ))}
      {open && (
        <StickyEditor
          key={open.id}
          note={open}
          items={rows ? (itemsBy.get(open.id) ?? []) : undefined}
          autoFocus={focus}
          onClose={close}
          onNew={() => {
            close()
            create(shown.length)
          }}
        />
      )}
    </div>
  )
}

function place(p: StickyPlace, vp: { w: number; h: number }) {
  const w = Math.min(p.w, vp.w - 8)
  const h = Math.min(p.h, vp.h - 8)
  return {
    left: Math.max(4, Math.min(p.x * vp.w, vp.w - w - 4)),
    top: Math.max(4, Math.min(p.y * vp.h, vp.h - h - 4)),
    w,
    h,
  }
}

const DEFAULT_PLACE: StickyPlace = { color: 'sari', x: 0.2, y: 0.2, w: 150, h: 130 }

/** Küçük hâl: sürükle-taşı, köşeden boyutla, dokununca aç */
function Sticky({
  note,
  items,
  vp,
  onOpen,
  hidden,
}: {
  note: NoteEntry
  items: NoteEntry[]
  vp: { w: number; h: number }
  onOpen: () => void
  hidden: boolean
}) {
  const p = note.sticky ?? DEFAULT_PLACE
  const base = place(p, vp)
  // Hareket sırasında yerel konum/boyut; bırakınca kaydedilir
  const [live, setLive] = useState<{ left: number; top: number; w: number; h: number } | null>(null)
  const drag = useRef<{ mode: 'move' | 'size'; sx: number; sy: number; moved: boolean; start: typeof base } | null>(null)
  // Dokunma (hareketsiz bırakma) açar; açma tıklama olayında yapılır ki iOS'un dokunmadan sonra gönderdiği tıklama
  // yeni açılan pencerenin arka planına düşüp onu hemen kapatmasın
  const tap = useRef(false)
  const cur = live ?? base

  function down(e: RPointerEvent<HTMLElement>, mode: 'move' | 'size') {
    if (e.button !== 0) return
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { mode, sx: e.clientX, sy: e.clientY, moved: false, start: base }
  }
  function move(e: RPointerEvent<HTMLElement>) {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.sx
    const dy = e.clientY - d.sy
    if (!d.moved && Math.hypot(dx, dy) < 6) return
    d.moved = true
    const s = d.start
    if (d.mode === 'move')
      setLive({ ...s, left: Math.max(0, Math.min(s.left + dx, vp.w - s.w)), top: Math.max(0, Math.min(s.top + dy, vp.h - s.h)) })
    else
      setLive({
        ...s,
        w: Math.max(MIN_W, Math.min(s.w + dx, MAX, vp.w - s.left - 4)),
        h: Math.max(MIN_H, Math.min(s.h + dy, MAX, vp.h - s.top - 4)),
      })
  }
  function up() {
    const d = drag.current
    drag.current = null
    if (!d) return
    if (!d.moved) {
      tap.current = d.mode === 'move'
      return
    }
    if (live) {
      const next: StickyPlace = { ...p, x: live.left / vp.w, y: live.top / vp.h, w: Math.round(live.w), h: Math.round(live.h) }
      void updateEntry(note.id, { sticky: next }).then(() => setLive(null))
    }
  }

  const texts = items.map((i) => i.text?.trim()).filter(Boolean)
  const voices = items.filter((i) => i.kind === 'audio').length
  const images = items.filter((i) => i.kind === 'image').length

  return (
    <div
      className={styles.sticky}
      style={{
        left: cur.left,
        top: cur.top,
        width: cur.w,
        height: cur.h,
        background: bgOf(p.color),
        transform: `rotate(${live ? 0 : tilt(note.id)}deg)`,
        visibility: hidden ? 'hidden' : undefined,
      }}
      onPointerDown={(e) => down(e, 'move')}
      onPointerMove={move}
      onPointerUp={up}
      onClick={() => {
        if (!tap.current) return
        tap.current = false
        onOpen()
      }}
      onPointerCancel={() => {
        drag.current = null
        setLive(null)
      }}
      role="button"
      tabIndex={0}
      aria-label="Yapışkan not (aç)"
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onOpen()}
    >
      <span className={styles.tape} aria-hidden="true" />
      {(voices > 0 || images > 0) && (
        <span className={styles.chips}>
          {voices > 0 && <span className={styles.voiceChip}>🎤 {voices}</span>}
          {images > 0 && <span className={styles.voiceChip}>🖼️ {images}</span>}
        </span>
      )}
      <p className={styles.text}>{texts.join('\n') || (voices || images ? '' : 'Boş not — dokun, yaz')}</p>
      <span
        className={styles.resize}
        onPointerDown={(e) => down(e, 'size')}
        onPointerMove={move}
        onPointerUp={up}
        aria-label="Boyutlandır"
        title="Sürükleyerek boyutlandır"
      />
    </div>
  )
}

/** Büyük hâl: Defterim'deki gibi not akışı (metin, sesli not, görsel) + renk, yeni not, sil, küçült */
function StickyEditor({
  note,
  items,
  autoFocus,
  onClose,
  onNew,
}: {
  note: NoteEntry
  /** undefined: yükleniyor */
  items: NoteEntry[] | undefined
  autoFocus: boolean
  onClose: () => void
  onNew: () => void
}) {
  const p = note.sticky ?? DEFAULT_PLACE
  const [openedAt] = useState(() => Date.now())
  const backdrop = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // Telefonda klavye açılınca görünen alan küçülür ama "fixed" öğeler eski boyutta kalır: pencereyi görünen alana
  // oturt ki yazma alanı klavyenin altında kalmasın
  useEffect(() => {
    const vv = window.visualViewport
    const el = backdrop.current
    if (!vv || !el) return
    const fit = () => {
      el.style.top = `${vv.offsetTop}px`
      el.style.left = `${vv.offsetLeft}px`
      el.style.width = `${vv.width}px`
      el.style.height = `${vv.height}px`
    }
    fit()
    vv.addEventListener('resize', fit)
    vv.addEventListener('scroll', fit)
    return () => {
      vv.removeEventListener('resize', fit)
      vv.removeEventListener('scroll', fit)
    }
  }, [])

  return (
    <div ref={backdrop} className={styles.backdrop} onClick={() => Date.now() - openedAt > 350 && onClose()} role="dialog" aria-label="Yapışkan not">
      <div className={styles.editor} style={{ background: bgOf(p.color) }} onClick={(e) => e.stopPropagation()}>
        <span className={styles.tape} aria-hidden="true" />
        <header className={styles.head}>
          <div className={styles.title}>
            <strong>📌 Bu sayfa</strong>
            <small>{pageLabel(note.pageKey)}</small>
          </div>
          <button type="button" className={styles.barBtn} onClick={onNew} title="Bu sayfaya bir yapışkan not daha" aria-label="Yeni yapışkan not">
            ＋
          </button>
          <button
            type="button"
            className={styles.barBtn}
            onClick={() => {
              if (!items?.length || confirm('Bu yapışkan not içindekilerle birlikte silinsin mi?')) {
                void deleteSticky(note)
                onClose()
              }
            }}
            title="Notu sil"
            aria-label="Notu sil"
          >
            🗑
          </button>
          <button type="button" className={styles.barBtn} onClick={onClose} title="Küçült (Esc)">
            Küçült ▾
          </button>
        </header>
        <NoteFeed
          entries={items}
          onAdd={(e) => addStickyItem(note, e)}
          placeholder="Not yaz, Enter ile ekle…"
          empty="Bu sayfaya özel notun. Aşağıya yaz, 🎤 ile sesli not bırak ya da 🖼️ ile görsel ekle. Not sayfada küçük bir kâğıt olarak durur; sürükleyip istediğin yere koyabilirsin."
          autoFocus={autoFocus}
        />
        <div className={styles.editBar}>
          <span className={styles.swatches} role="group" aria-label="Renk">
            {STICKY_COLORS.map((c) => (
              <button
                key={c.key}
                type="button"
                className={`${styles.swatch} ${c.key === p.color ? styles.swatchOn : ''}`}
                style={{ background: c.bg }}
                onClick={() => void updateEntry(note.id, { sticky: { ...p, color: c.key } })}
                aria-label={c.label}
                title={c.label}
              />
            ))}
          </span>
        </div>
      </div>
    </div>
  )
}
