import { useState } from 'react'
import { Link } from 'react-router-dom'
import { addNotes, MEMORY_CATEGORIES, suggestNotes, type NoteSuggestion } from '../services/memory'
import { useUserStore } from '../stores/user'
import type { MemoryCategory } from '../types/database'
import styles from './SaveToMemory.module.css'

// "Hafızaya kaydet": sohbetten yapay zekâ not önerir, kullanıcı seçip düzenleyerek kaydeder. Otomatik kayıt yok.

interface Props {
  /** Sohbet dökümü (kim ne dedi); düğmeye basılınca hazırlanır */
  getTranscript: () => string
  /** Notun nereden geldiği, örn. "coach:<id>" */
  source: string
  disabled?: boolean
}

interface Draft extends NoteSuggestion {
  keep: boolean
}

export function SaveToMemory({ getTranscript, source, disabled }: Props) {
  const userId = useUserStore((s) => s.activeUserId)
  const [drafts, setDrafts] = useState<Draft[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState<number | null>(null)

  async function suggest() {
    setLoading(true)
    setError('')
    setSaved(null)
    try {
      const list = await suggestNotes(userId, getTranscript())
      setDrafts(list.map((n) => ({ ...n, keep: true })))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  async function save() {
    if (!drafts) return
    const chosen = drafts.filter((d) => d.keep && d.text.trim())
    await addNotes(userId, chosen, source)
    setSaved(chosen.length)
    setDrafts(null)
  }

  const patch = (i: number, p: Partial<Draft>) => setDrafts((d) => d && d.map((x, j) => (j === i ? { ...x, ...p } : x)))

  if (drafts) {
    return (
      <div className={styles.panel}>
        <strong>🧠 Hafızaya eklenecek notlar</strong>
        {drafts.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            Bu sohbette kalıcı bir gözlem bulunamadı.
          </p>
        ) : (
          <>
            <p className="muted" style={{ margin: 0, fontSize: '0.82rem' }}>
              İstemediğin notun işaretini kaldır, yanlış olanı düzelt. Yalnızca işaretli olanlar kaydedilir.
            </p>
            <ul className={styles.list}>
              {drafts.map((d, i) => (
                <li key={i} className={styles.item}>
                  <input type="checkbox" checked={d.keep} onChange={(e) => patch(i, { keep: e.target.checked })} aria-label="Bu notu kaydet" />
                  <div className={styles.fields}>
                    <textarea className={styles.text} rows={2} value={d.text} onChange={(e) => patch(i, { text: e.target.value })} />
                    <select className={styles.select} value={d.category} onChange={(e) => patch(i, { category: e.target.value as MemoryCategory })}>
                      {Object.entries(MEMORY_CATEGORIES).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v.icon} {v.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
        <div className={styles.row}>
          {drafts.length > 0 && (
            <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={!drafts.some((d) => d.keep)}>
              Seçilenleri kaydet
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={() => setDrafts(null)}>
            Vazgeç
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.row}>
      <button type="button" className="btn btn-ghost" disabled={disabled || loading} onClick={() => void suggest()} title="Bu sohbetten senin hakkında kalıcı notlar öner">
        {loading ? '🧠 Notlar çıkarılıyor…' : '🧠 Hafızaya kaydet'}
      </button>
      {saved !== null && (
        <small className="muted">
          ✓ {saved} not eklendi · <Link to="/koc/hafiza">Hafızam</Link>
        </small>
      )}
      {error && <small className={styles.error}>{error}</small>}
    </div>
  )
}
