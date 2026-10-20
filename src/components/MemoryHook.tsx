import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type CSSProperties } from 'react'
import { db } from '../db'
import { aiConfigured, generate } from '../services/ai'
import { updateWord } from '../services/words'
import type { WordItem } from '../types/database'

const SYSTEM = [
  'Sen İngilizce kelime öğreten bir hocasın. Türk bir öğrenci için akılda kalıcı bir "hafıza kancası" yaz.',
  'Türkçe yaz. Tek bir kanca: kelimenin sesine benzeyen Türkçe bir sözcükle kurulan kısa, canlı bir imge (anahtar kelime yöntemi) ya da kök/ek bilgisi.',
  'En fazla 2 kısa cümle; başlık, madde işareti ya da tırnak kullanma.',
].join('\n')

/**
 * Kartın arkasında "🪝 Hafıza kancası": öğrencinin kendi benzetmesi (kelimenin hook alanı).
 * İstenirse yapay zekâ bir kez öneri üretir (cihazda saklanır, tekrar çağrılmaz); öğrenci beğenirse kendi kancası yapar.
 */
export function MemoryHook({ word: initial }: { word: WordItem }) {
  // Çalışma ekranındaki kelime bir anlık kopya; kanca kaydedilince güncel hali görünsün
  const word = useLiveQuery(() => db.words.get(initial.id), [initial.id]) ?? initial
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(word.hook ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const id = `hook:${word.term.toLowerCase()}`
  const suggestion = useLiveQuery(() => db.aiNotes.get(id), [id])

  async function save(text: string) {
    await updateWord(word.id, word.userId, { hook: text })
    setEditing(false)
  }

  async function suggest() {
    setBusy(true)
    setError('')
    try {
      const r = await generate(SYSTEM, `Kelime: ${word.term}\nAnlamı: ${word.definition}`, 0.9)
      await db.aiNotes.put({ id, kind: 'hook', text: r.text.trim(), model: r.model, createdAt: new Date().toISOString() })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const box: CSSProperties = {
    display: 'grid',
    gap: '0.4rem',
    padding: '0.6rem 0.8rem',
    border: '1px dashed var(--border)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.9rem',
  }

  if (editing) {
    return (
      <div style={box}>
        <strong>🪝 Hafıza kancası</strong>
        <textarea
          className="input"
          rows={2}
          value={draft}
          autoFocus
          placeholder="Bu kelimeyi aklında tutacak benzetme, ses çağrışımı ya da hikâye…"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Kartın klavye kısayolları (1-5, boşluk) yazarken tetiklenmesin
            e.stopPropagation()
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void save(draft)
            }
          }}
        />
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <button type="button" className="btn btn-primary" onClick={() => void save(draft)}>
            Kaydet
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>
            Vazgeç
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={box}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <strong>🪝 Hafıza kancası</strong>
        <button
          type="button"
          className="btn btn-ghost"
          style={{ padding: '0.1rem 0.5rem', fontSize: '0.8rem' }}
          onClick={() => {
            setDraft(word.hook ?? '')
            setEditing(true)
          }}
        >
          {word.hook ? '✏️ Düzenle' : '+ Kendi kancanı yaz'}
        </button>
        {!suggestion && aiConfigured() && (
          <button type="button" className="btn btn-ghost" style={{ padding: '0.1rem 0.5rem', fontSize: '0.8rem' }} disabled={busy} onClick={() => void suggest()}>
            {busy ? 'Yazılıyor…' : '✨ Öneri al'}
          </button>
        )}
      </div>
      {word.hook && <span style={{ whiteSpace: 'pre-wrap' }}>{word.hook}</span>}
      {suggestion && suggestion.text !== word.hook && (
        <span className="muted" style={{ whiteSpace: 'pre-wrap' }}>
          ✨ {suggestion.text}{' '}
          <button type="button" className="btn btn-ghost" style={{ padding: '0 0.4rem', fontSize: '0.78rem' }} onClick={() => void save(suggestion.text)}>
            Kancam yap
          </button>
        </span>
      )}
      {error && <span style={{ color: 'var(--danger)' }}>{error}</span>}
    </div>
  )
}
