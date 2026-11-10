import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { useNotePageKey } from '../services/noteScope'
import { useRecorder } from '../hooks/useRecorder'
import { db } from '../db'
import { deleteEntry, updateEntry } from '../services/notebook'
import { useUserStore } from '../stores/user'
import type { NoteEntry, StickyPlace } from '../types/database'
import styles from './StickyNotes.module.css'

// Sayfaya yapıştırılmış renkli notlar (post-it): "📄 Bu sayfa" penceresinden renk seçilerek yapıştırılır.
// Sürükleyerek taşınır, sağ alt köşeden boyutlanır, dokununca büyüyüp açılır (yazı, sesli not, renk, sil). Odak modunda da
// görünür. Not, açıldığı sayfaya ya da soruya aittir (src/services/noteScope.ts); başka soruya geçince görünmez.
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

/** Yeni yapıştırılan notu hemen açmak için: window.dispatchEvent(new CustomEvent(STICKY_OPEN, { detail: id })) */
export const STICKY_OPEN = 'yds-sticky-open'

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
  const notes = useLiveQuery(
    () =>
      db.notebook
        .where('[userId+pageKey]')
        .equals([userId, pageKey])
        .filter((n) => n.scope === 'sticky')
        .sortBy('createdAt'),
    [userId, pageKey],
  )
  const [openId, setOpenId] = useState<string | null>(null)
  const vp = useViewport()

  useEffect(() => {
    const on = (e: Event) => setOpenId(String((e as CustomEvent).detail))
    window.addEventListener(STICKY_OPEN, on)
    return () => window.removeEventListener(STICKY_OPEN, on)
  }, [])

  if (!notes?.length) return null
  const open = notes.find((n) => n.id === openId)
  return (
    <div className={`${styles.layer} ${open ? styles.layerOpen : ''}`}>
      {notes.map((n) => (
        <Sticky key={n.id} note={n} vp={vp} onOpen={() => setOpenId(n.id)} hidden={n.id === openId} />
      ))}
      {open && <StickyEditor key={open.id} note={open} onClose={() => setOpenId(null)} />}
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

/** Küçük hâl: sürükle-taşı, köşeden boyutla, dokununca aç */
function Sticky({ note, vp, onOpen, hidden }: { note: NoteEntry; vp: { w: number; h: number }; onOpen: () => void; hidden: boolean }) {
  const p = note.sticky ?? { color: 'sari', x: 0.2, y: 0.2, w: 150, h: 130 }
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
      {note.blob && <span className={styles.voiceChip}>🎤 {fmtDur(note.durationSec ?? 0)}</span>}
      <p className={styles.text}>{note.text?.trim() || (note.blob ? '' : 'Boş not — dokun, yaz')}</p>
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

const fmtDur = (sec: number) => {
  const s = Math.max(0, Math.round(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Sesli not: kaydet / dinle / sil (ses yapışkan notun kendisinde saklanır) */
function StickyVoice({ note }: { note: NoteEntry }) {
  const rec = useRecorder()
  const [error, setError] = useState('')
  const [playing, setPlaying] = useState(false)
  const audio = useRef<HTMLAudioElement | null>(null)
  useEffect(
    () => () => {
      audio.current?.pause()
      if (audio.current?.src) URL.revokeObjectURL(audio.current.src)
    },
    [],
  )

  async function toggleRecord() {
    setError('')
    if (rec.recording) {
      const r = await rec.stop()
      if (r) await updateEntry(note.id, { blob: r.blob, mime: r.blob.type, durationSec: r.seconds })
      return
    }
    audio.current?.pause()
    try {
      await rec.start()
    } catch {
      setError('Mikrofona erişilemedi. Tarayıcı izinlerini kontrol et.')
    }
  }

  function togglePlay() {
    if (!note.blob) return
    if (playing && audio.current) {
      audio.current.pause()
      setPlaying(false)
      return
    }
    if (audio.current?.src) URL.revokeObjectURL(audio.current.src)
    const a = new Audio(URL.createObjectURL(note.blob))
    audio.current = a
    a.onended = () => setPlaying(false)
    a.play().then(
      () => setPlaying(true),
      () => setError('Ses çalınamadı.'),
    )
  }

  return (
    <div className={styles.voice}>
      <button type="button" className={`${styles.barBtn} ${rec.recording ? styles.recOn : ''}`} onClick={() => void toggleRecord()}>
        {rec.recording ? `⏹ Bitir · ${fmtDur(rec.seconds)}` : note.blob ? '🎤 Yeniden kaydet' : '🎤 Sesli not'}
      </button>
      {note.blob && !rec.recording && (
        <>
          <button type="button" className={styles.barBtn} onClick={togglePlay} aria-label={playing ? 'Durdur' : 'Sesli notu dinle'}>
            {playing ? '⏸' : '▶'} {fmtDur(note.durationSec ?? 0)}
          </button>
          <button
            type="button"
            className={styles.barBtn}
            onClick={() => {
              if (!confirm('Sesli not silinsin mi?')) return
              audio.current?.pause()
              setPlaying(false)
              void updateEntry(note.id, { blob: undefined, mime: undefined, durationSec: undefined })
            }}
            aria-label="Sesli notu sil"
            title="Sesli notu sil"
          >
            ✕
          </button>
        </>
      )}
      {error && <span className={styles.voiceErr}>{error}</span>}
    </div>
  )
}

/** Büyük hâl: yaz, sesli not, rengi değiştir, sil, küçült */
function StickyEditor({ note, onClose }: { note: NoteEntry; onClose: () => void }) {
  const [text, setText] = useState(note.text ?? '')
  const [saved, setSaved] = useState(true)
  const p = note.sticky ?? { color: 'sari', x: 0.2, y: 0.2, w: 150, h: 130 }
  const [openedAt] = useState(() => Date.now())

  useEffect(() => {
    if (saved) return
    const t = setTimeout(() => void updateEntry(note.id, { text }).then(() => setSaved(true)), 400)
    return () => clearTimeout(t)
  }, [text, saved, note.id])

  function close() {
    if (!saved) void updateEntry(note.id, { text })
    onClose()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className={styles.backdrop} onClick={() => Date.now() - openedAt > 350 && close()} role="dialog" aria-label="Yapışkan not">
      <div className={styles.editor} style={{ background: bgOf(p.color) }} onClick={(e) => e.stopPropagation()}>
        <span className={styles.tape} aria-hidden="true" />
        <textarea
          className={styles.editText}
          value={text}
          placeholder="Notunu yaz…"
          onChange={(e) => {
            setText(e.target.value)
            setSaved(false)
          }}
        />
        <StickyVoice note={note} />
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
          <span className={styles.spacer} />
          <button
            type="button"
            className={styles.barBtn}
            onClick={() => {
              if (confirm('Bu yapışkan not silinsin mi?')) {
                void deleteEntry(note.id)
                onClose()
              }
            }}
            title="Sil"
          >
            🗑
          </button>
          <button type="button" className={styles.barBtn} onClick={close} title="Küçült (Esc)">
            Küçült ▾
          </button>
        </div>
      </div>
    </div>
  )
}
