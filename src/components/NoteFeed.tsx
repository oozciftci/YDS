import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type KeyboardEvent, type ReactNode } from 'react'
import { useRecorder } from '../hooks/useRecorder'
import { deleteEntry, entryBlob, stamp, updateEntry, type NewEntry } from '../services/notebook'
import type { NoteEntry } from '../types/database'
import styles from './NotesDock.module.css'

// Not akışı: mesajlar (metin / sesli not / görsel) sırayla, altta yazma alanı (Enter ekler, 🎤 sesli not, 🖼️ görsel).
// "Defterim" ve yapışkan notlar ("Bu sayfa") aynı bileşeni kullanır; kapsayıcı dikey esnek kutu olmalıdır.

function fmtDur(sec: number) {
  const s = Math.max(0, Math.round(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function NoteFeed({
  entries,
  onAdd,
  placeholder,
  empty,
  titled = false,
  autoFocus = false,
}: {
  /** undefined: yükleniyor */
  entries: NoteEntry[] | undefined
  onAdd: (entry: NewEntry) => Promise<unknown>
  placeholder: string
  empty: ReactNode
  /** Defterim: her girdinin başlığı (özellik adı + saat) görünür ve değiştirilebilir. Kapalıyken yalnızca saat. */
  titled?: boolean
  /** Açılınca yazma alanına odaklan (telefonda klavye açılır) */
  autoFocus?: boolean
}) {
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
    const text = draft.trim()
    if (!text) return
    setDraft('')
    await onAdd({ kind: 'text', text })
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
    const text = draft.trim() || undefined
    setDraft('')
    await onAdd({ kind: 'image', blob: file, mime: file.type, text })
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
      if (r) await onAdd({ kind: 'audio', blob: r.blob, mime: r.blob.type, durationSec: r.seconds })
      return
    }
    try {
      await rec.start()
    } catch {
      setError('Mikrofona erişilemedi. Tarayıcı izinlerini kontrol et.')
    }
  }

  return (
    <>
      <div className={styles.list} ref={listRef}>
        {!entries ? (
          <p className="muted">Yükleniyor…</p>
        ) : entries.length === 0 ? (
          <p className={`muted ${styles.empty}`}>{empty}</p>
        ) : (
          entries.map((e) => <EntryRow key={e.id} entry={e} titled={titled} onZoom={setZoom} />)
        )}
      </div>

      {error && <p className={styles.error}>{error}</p>}
      <div className={styles.composer}>
        <textarea
          value={draft}
          autoFocus={autoFocus}
          rows={2}
          placeholder={placeholder}
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
    </>
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

function EntryRow({ entry, titled, onZoom }: { entry: NoteEntry; titled: boolean; onZoom: (url: string) => void }) {
  // Kayıtlı baytlardan, türü belli Blob (her seferinde yenisi üretilmesin: adres boşuna yenilenir)
  const blob = useMemo(() => entryBlob(entry), [entry.bytes, entry.blob, entry.mime]) // eslint-disable-line react-hooks/exhaustive-deps
  const url = useBlobUrl(entry.kind === 'image' ? blob : undefined)
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
    if (!blob) {
      setPlayError('Bu sesli notun kaydı bulunamadı.')
      return
    }
    setPlayError('')
    release()
    const src = URL.createObjectURL(blob)
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
        {titled ? (
          <button type="button" className={styles.entryTitle} onClick={rename} title="Başlığı değiştir">
            {entry.title ?? entry.pageLabel}
          </button>
        ) : (
          <span className={styles.entryTitle} style={{ cursor: 'default' }}>
            {stamp(entry.createdAt)}
          </span>
        )}
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
