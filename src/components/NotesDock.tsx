import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react'
import { useLocation } from 'react-router-dom'
import { db } from '../db'
import { addGeneralEntry, deleteEntry, pageLabel, pageNoteId, savePageNote, updateEntry } from '../services/notebook'
import { useUserStore } from '../stores/user'
import type { NoteEntry } from '../types/database'
import styles from './NotesDock.module.css'

// Sağ alttaki iki küçük not penceresi: "Bu sayfa" (sayfa değişince o sayfanın notu açılır) ve
// "Defterim" (tüm çalışma için tek defter; metin, sesli not, ekran görüntüsü). Tıklayınca genişler.

type Pane = 'page' | 'general' | null
const OPEN_KEY = 'yds-notes-open'

function readOpen(): Pane {
  try {
    const v = localStorage.getItem(OPEN_KEY)
    return v === 'page' || v === 'general' ? v : null
  } catch {
    return null
  }
}

function fmtDur(sec: number) {
  const s = Math.max(0, Math.round(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function NotesDock() {
  const userId = useUserStore((s) => s.activeUserId)
  const { pathname } = useLocation()
  const pageKey = pathname.replace(/\/+$/, '') || '/'
  const [open, setOpenState] = useState<Pane>(readOpen)
  const setOpen = (p: Pane) => {
    setOpenState(p)
    try {
      if (p) localStorage.setItem(OPEN_KEY, p)
      else localStorage.removeItem(OPEN_KEY)
    } catch {
      // yoksay
    }
  }

  const pageNote = useLiveQuery(() => db.notebook.get(pageNoteId(userId, pageKey)), [userId, pageKey])
  const generalCount = useLiveQuery(() => db.notebook.where('[userId+scope]').equals([userId, 'general']).count(), [userId], 0)

  useEffect(() => {
    if (!open) return
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && setOpen(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const hasPageNote = Boolean(pageNote?.text?.trim())

  return (
    <div className={styles.dock} aria-label="Notlarım">
      {open === 'page' ? (
        <PagePane key={`${userId}:${pageKey}`} userId={userId} pageKey={pageKey} onClose={() => setOpen(null)} />
      ) : (
        <button type="button" className={styles.pill} onClick={() => setOpen('page')} title="Bu sayfaya özel not">
          📄 Bu sayfa{hasPageNote && <span className={styles.dot} aria-label="not var" />}
        </button>
      )}
      {open === 'general' ? (
        <GeneralPane userId={userId} pageKey={pageKey} onClose={() => setOpen(null)} />
      ) : (
        <button type="button" className={styles.pill} onClick={() => setOpen('general')} title="Genel çalışma defteri">
          📓 Defterim{generalCount > 0 && <span className={styles.count}>{generalCount}</span>}
        </button>
      )}
    </div>
  )
}

/** Sayfaya özel not: tek metin, yazdıkça kaydedilir. */
function PagePane({ userId, pageKey, onClose }: { userId: string; pageKey: string; onClose: () => void }) {
  // Bileşen sayfa değişince yeniden kurulur (key); not bir kez yüklenir, sonra yazdıkça kaydedilir
  const note = useLiveQuery(() => db.notebook.get(pageNoteId(userId, pageKey)).then((n) => n ?? null), [userId, pageKey])
  const [text, setText] = useState<string | null>(null)
  const [saved, setSaved] = useState(true)
  const value = text ?? (note === undefined ? '' : (note?.text ?? ''))

  useEffect(() => {
    if (saved || text === null) return
    const t = setTimeout(() => {
      void savePageNote(userId, pageKey, text).then(() => setSaved(true))
    }, 500)
    return () => clearTimeout(t)
  }, [text, saved, userId, pageKey])

  return (
    <section className={styles.pane} aria-label="Bu sayfanın notu">
      <header className={styles.paneHead}>
        <div className={styles.paneTitle}>
          <strong>📄 Bu sayfa</strong>
          <small className="muted">{pageLabel(pageKey)}</small>
        </div>
        <span className={styles.saveState}>{saved ? 'Kaydedildi' : 'Kaydediliyor…'}</span>
        <button type="button" className={styles.iconBtn} onClick={onClose} aria-label="Küçült" title="Küçült (Esc)">
          ▾
        </button>
      </header>
      <textarea
        className={styles.pageText}
        autoFocus
        value={value}
        readOnly={note === undefined}
        placeholder="Bu sayfaya özel notun… (sayfaya her döndüğünde burada olur)"
        onChange={(e) => {
          setText(e.target.value)
          setSaved(false)
        }}
      />
    </section>
  )
}

/** Genel çalışma defteri: girdiler (metin / sesli not / görsel), her biri özellik adı + tarih/saat başlıklı. */
function GeneralPane({ userId, pageKey, onClose }: { userId: string; pageKey: string; onClose: () => void }) {
  const entries = useLiveQuery(
    () => db.notebook.where('[userId+scope]').equals([userId, 'general']).sortBy('createdAt'),
    [userId],
  )
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [zoom, setZoom] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const rec = useRecorder()

  // Yeni girdi eklenince en alta kaydır
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [entries?.length])

  async function addText() {
    if (!draft.trim()) return
    await addGeneralEntry(userId, pageKey, { kind: 'text', text: draft.trim() })
    setDraft('')
  }

  async function addImage(file: File | Blob) {
    if (!file.type.startsWith('image/')) {
      setError('Yalnızca görsel dosyası eklenebilir.')
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      setError('Görsel 8 MB’tan büyük olamaz.')
      return
    }
    setError('')
    await addGeneralEntry(userId, pageKey, { kind: 'image', blob: file, mime: file.type, text: draft.trim() || undefined })
    setDraft('')
  }

  function onPaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    const item = [...e.clipboardData.items].find((i) => i.type.startsWith('image/'))
    const file = item?.getAsFile()
    if (file) {
      e.preventDefault()
      void addImage(file)
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter gönderir; Shift+Enter yeni satır açar
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      void addText()
    }
  }

  async function toggleRecord() {
    setError('')
    if (rec.recording) {
      const r = await rec.stop()
      if (r) await addGeneralEntry(userId, pageKey, { kind: 'audio', blob: r.blob, mime: r.blob.type, durationSec: r.seconds })
      return
    }
    try {
      await rec.start()
    } catch {
      setError('Mikrofona erişilemedi. Tarayıcı izinlerini kontrol et.')
    }
  }

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

      <div className={styles.list} ref={listRef}>
        {!entries ? (
          <p className="muted">Yükleniyor…</p>
        ) : entries.length === 0 ? (
          <p className={`muted ${styles.empty}`}>
            Henüz not yok. Aşağıya yaz, 🎤 ile sesli not bırak ya da 🖼️ ile ekran görüntüsü ekle (yapıştırmak da olur). Her not, o an kullandığın
            özelliğin adı ve saatiyle kaydedilir.
          </p>
        ) : (
          entries.map((e) => <EntryRow key={e.id} entry={e} onZoom={setZoom} />)
        )}
      </div>

      {error && <p className={styles.error}>{error}</p>}
      <div className={styles.composer}>
        <textarea
          value={draft}
          autoFocus
          rows={2}
          placeholder={`Not yaz, Enter ile ekle… (${pageLabel(pageKey)})`}
          onChange={(e) => setDraft(e.target.value)}
          onPaste={onPaste}
          onKeyDown={onKeyDown}
        />
        <div className={styles.composerBtns}>
          <button
            type="button"
            className={`${styles.iconBtn} ${rec.recording ? styles.recOn : ''}`}
            onClick={() => void toggleRecord()}
            title={rec.recording ? 'Kaydı bitir' : 'Sesli not kaydet'}
            aria-label={rec.recording ? 'Kaydı bitir' : 'Sesli not kaydet'}
          >
            {rec.recording ? `⏹ ${fmtDur(rec.seconds)}` : '🎤'}
          </button>
          <button type="button" className={styles.iconBtn} onClick={() => fileRef.current?.click()} title="Ekran görüntüsü ekle" aria-label="Ekran görüntüsü ekle">
            🖼️
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void addImage(f)
              e.target.value = ''
            }}
          />
          <button type="button" className="btn btn-primary" disabled={!draft.trim()} onClick={() => void addText()} title="Ekle (Enter) · yeni satır: Shift+Enter">
            Ekle
          </button>
        </div>
      </div>

      {zoom && (
        <div className={styles.lightbox} onClick={() => setZoom(null)} role="dialog" aria-label="Görsel">
          <img src={zoom} alt="Ekran görüntüsü" />
        </div>
      )}
    </section>
  )
}

/** Blob için geçici adres. Adres efekt içinde oluşturulur ki temizlik (iptal) her zaman kendi adresini iptal etsin. */
function useBlobUrl(blob?: Blob) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!blob) return
    const u = URL.createObjectURL(blob)
    // Dış kaynak (Blob) ile eşitleme; adres yalnızca burada oluşturulabilir
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return url
}

function EntryRow({ entry, onZoom }: { entry: NoteEntry; onZoom: (url: string) => void }) {
  const url = useBlobUrl(entry.blob)
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(entry.text ?? '')
  const [playing, setPlaying] = useState(false)
  const [playError, setPlayError] = useState('')
  const audioRef = useRef<{ el: HTMLAudioElement; src: string } | null>(null)

  function release() {
    const a = audioRef.current
    if (!a) return
    a.el.pause()
    URL.revokeObjectURL(a.src)
    audioRef.current = null
  }

  function togglePlay() {
    if (playing) {
      release()
      setPlaying(false)
      return
    }
    if (!entry.blob) return
    setPlayError('')
    release()
    const src = URL.createObjectURL(entry.blob)
    const el = new Audio(src)
    el.onended = () => {
      release()
      setPlaying(false)
    }
    audioRef.current = { el, src }
    el.play()
      .then(() => setPlaying(true))
      .catch(() => {
        release()
        setPlaying(false)
        setPlayError('Bu sesli not oynatılamadı.')
      })
  }
  useEffect(() => () => release(), [])

  function rename() {
    const t = prompt('Not başlığı', entry.title ?? '')
    if (t !== null && t.trim()) void updateEntry(entry.id, { title: t.trim() })
  }

  return (
    <article className={styles.entry}>
      <div className={styles.entryHead}>
        <button type="button" className={styles.entryTitle} onClick={rename} title="Başlığı değiştir">
          {entry.title ?? entry.pageLabel}
        </button>
        <button
          type="button"
          className={styles.delBtn}
          onClick={() => confirm('Bu not silinsin mi?') && void deleteEntry(entry.id)}
          aria-label="Notu sil"
          title="Sil"
        >
          ×
        </button>
      </div>
      {entry.kind === 'audio' && (
        <button type="button" className={styles.audioRow} onClick={togglePlay} aria-label={playing ? 'Durdur' : 'Sesli notu dinle'}>
          <span className={styles.play}>{playing ? '⏸' : '▶'}</span>
          Sesli not · {fmtDur(entry.durationSec ?? 0)}
        </button>
      )}
      {playError && <span className={styles.error}>{playError}</span>}
      {entry.kind === 'image' && url && (
        <button type="button" className={styles.thumbBtn} onClick={() => onZoom(url)} aria-label="Görseli büyüt">
          <img src={url} alt="Ekran görüntüsü" className={styles.thumb} />
        </button>
      )}
      {entry.kind !== 'audio' &&
        (editing ? (
          <textarea
            className={styles.editText}
            value={text}
            autoFocus
            onChange={(e) => setText(e.target.value)}
            onBlur={() => {
              setEditing(false)
              if (text !== (entry.text ?? '')) void updateEntry(entry.id, { text })
            }}
          />
        ) : entry.text ? (
          <p className={styles.entryText} onClick={() => setEditing(true)} title="Düzenlemek için tıkla">
            {entry.text}
          </p>
        ) : null)}
    </article>
  )
}

/** MediaRecorder ile ses kaydı. */
function useRecorder() {
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const recRef = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const startedAt = useRef(0)

  useEffect(() => {
    if (!recording) return
    const t = setInterval(() => setSeconds((Date.now() - startedAt.current) / 1000), 500)
    return () => clearInterval(t)
  }, [recording])

  // Panel kapanırsa kaydı ve mikrofonu bırak
  useEffect(
    () => () => {
      const r = recRef.current
      if (r && r.state !== 'inactive') r.stop()
      r?.stream.getTracks().forEach((t) => t.stop())
    },
    [],
  )

  async function start() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const r = new MediaRecorder(stream)
    chunks.current = []
    r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data)
    recRef.current = r
    startedAt.current = Date.now()
    setSeconds(0)
    r.start()
    setRecording(true)
  }

  function stop(): Promise<{ blob: Blob; seconds: number } | null> {
    const r = recRef.current
    if (!r) return Promise.resolve(null)
    return new Promise((resolve) => {
      r.onstop = () => {
        r.stream.getTracks().forEach((t) => t.stop())
        setRecording(false)
        const blob = new Blob(chunks.current, { type: r.mimeType || 'audio/webm' })
        resolve(blob.size ? { blob, seconds: (Date.now() - startedAt.current) / 1000 } : null)
      }
      r.stop()
    })
  }

  return { recording, seconds, start, stop }
}
