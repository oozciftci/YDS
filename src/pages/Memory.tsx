import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../db'
import { addNotes, buildProfile, deleteNote, MEMORY_CATEGORIES, updateNote } from '../services/memory'
import { useUserStore } from '../stores/user'
import type { MemoryCategory, MemoryNote } from '../types/database'
import styles from './Coach.module.css'

// "Hafızam": yapay zekânın seni tanımak için kullandığı bilgiler. Profil uygulama verisinden hesaplanır;
// notları yalnızca sen eklersin ("Hafızaya kaydet" ya da elle) ve buradan düzeltip silebilirsin.

function NoteRow({ note }: { note: MemoryNote }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(note.text)
  const [category, setCategory] = useState<MemoryCategory>(note.category)
  const cat = MEMORY_CATEGORIES[note.category]

  if (editing) {
    return (
      <li className={styles.noteRow}>
        <div className={styles.noteEdit}>
          <textarea className={styles.input} rows={2} value={text} onChange={(e) => setText(e.target.value)} />
          <div className={styles.setupRow}>
            <select className={styles.select} value={category} onChange={(e) => setCategory(e.target.value as MemoryCategory)}>
              {Object.entries(MEMORY_CATEGORIES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.icon} {v.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!text.trim()}
              onClick={() => void updateNote(note.id, { text: text.trim(), category }).then(() => setEditing(false))}
            >
              Kaydet
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>
              Vazgeç
            </button>
          </div>
        </div>
      </li>
    )
  }

  return (
    <li className={styles.noteRow}>
      <span className={styles.noteIcon} title={cat?.label}>
        {cat?.icon ?? '•'}
      </span>
      <span className={styles.noteText}>
        {note.text}
        <small className="muted">
          {cat?.label} · {new Date(note.updatedAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
        </small>
      </span>
      <button type="button" className={styles.iconBtn} onClick={() => setEditing(true)} aria-label="Düzenle" title="Düzenle">
        ✎
      </button>
      <button
        type="button"
        className={styles.iconBtn}
        onClick={() => confirm('Bu not silinsin mi?') && void deleteNote(note.id)}
        aria-label="Sil"
        title="Sil"
      >
        ✕
      </button>
    </li>
  )
}

export function MemoryPage() {
  const userId = useUserStore((s) => s.activeUserId)
  const notes = useLiveQuery(
    () => db.memoryNotes.where('[userId+updatedAt]').between([userId, ''], [userId, '￿']).reverse().toArray(),
    [userId],
  )
  const [profile, setProfile] = useState<string | null>(null)
  const [newText, setNewText] = useState('')
  const [newCat, setNewCat] = useState<MemoryCategory>('hata')

  useEffect(() => {
    let alive = true
    void buildProfile(userId).then((p) => alive && setProfile(p))
    return () => {
      alive = false
    }
  }, [userId])

  async function add() {
    if (!newText.trim()) return
    await addNotes(userId, [{ text: newText, category: newCat }], 'manual')
    setNewText('')
  }

  return (
    <section className={styles.page}>
      <header>
        <Link to="/koc" className={styles.back}>
          ← YZ Koç
        </Link>
        <h1 className={styles.title}>🧠 Hafızam</h1>
        <p className="muted" style={{ margin: 0 }}>
          Yapay zekânın seni tanımak için kullandığı bilgiler. Yalnızca bu cihazda saklanır (JSON yedeğine girer); yapay
          zekâya yalnızca koç sohbetinde ve “beni tanıyarak açıkla” açıkken gönderilir.
        </p>
      </header>

      <article className="card">
        <h2 className={styles.blockTitle}>📊 Otomatik profil</h2>
        <p className="muted" style={{ margin: '0 0 0.6rem', fontSize: '0.85rem' }}>
          Uygulamadaki verilerinden her seferinde yeniden hesaplanır; düzenlenemez.
        </p>
        {profile === null ? (
          <p className="muted">Hesaplanıyor…</p>
        ) : (
          <ul className={styles.profileList}>
            {profile.split('\n').map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        )}
      </article>

      <article className="card">
        <h2 className={styles.blockTitle}>📝 Hafıza notları {notes && notes.length > 0 && <span className="muted">({notes.length})</span>}</h2>
        <p className="muted" style={{ margin: '0 0 0.6rem', fontSize: '0.85rem' }}>
          Bir sohbette “🧠 Hafızaya kaydet”e bastığında yapay zekâ not önerir; onayladıkların buraya gelir. Elle de ekleyebilirsin.
        </p>
        {!notes ? null : notes.length === 0 ? (
          <p className="muted" style={{ margin: '0 0 0.75rem' }}>
            Henüz not yok.
          </p>
        ) : (
          <ul className={styles.noteList}>
            {notes.map((n) => (
              <NoteRow key={n.id} note={n} />
            ))}
          </ul>
        )}
        <div className={styles.noteAdd}>
          <textarea
            className={styles.input}
            rows={2}
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="Elle not ekle; örn. “Okuma sorularında önce soruyu, sonra paragrafı okumayı tercih ediyorum.”"
          />
          <div className={styles.setupRow}>
            <select className={styles.select} value={newCat} onChange={(e) => setNewCat(e.target.value as MemoryCategory)}>
              {Object.entries(MEMORY_CATEGORIES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.icon} {v.label}
                </option>
              ))}
            </select>
            <button type="button" className="btn btn-secondary" disabled={!newText.trim()} onClick={() => void add()}>
              + Not ekle
            </button>
          </div>
        </div>
      </article>
    </section>
  )
}
