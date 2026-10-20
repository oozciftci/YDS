import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../db'
import { aiConfigured, generate } from '../services/ai'
import { isLeech } from '../services/leech'
import type { CardState, WordItem } from '../types/database'

const SYSTEM = [
  'Sen İngilizce kelime öğreten bir hocasın. Öğrenci bu kelimeyi tekrar tekrar unutuyor.',
  'Türkçe yaz. Verilen kelime için TEK bir akılda kalıcı ipucu üret: ses benzerliği/kelime oyunu (Türkçe benzeri sese bağlayan kısa bir imge), ya da kök/ek bilgisi.',
  'Format: 1) "İpucu:" ile başlayan 1-2 cümle, 2) "Örnek:" ile başlayan, kelimeyi içeren kısa bir İngilizce cümle ve parantez içinde Türkçesi. Toplam 4 cümleyi geçme.',
].join('\n')

/**
 * Kart arkasında: çok unutulan kelimeler için uyarı + akılda kalıcı ipucu (Gemini; kelime başına bir kez, cihazda saklanır).
 * Yapay zekâ anahtarı yoksa yalnızca çalışma önerisi görünür.
 */
export function LeechHelp({ word, card }: { word: WordItem; card: CardState }) {
  const id = `leech:${word.id}`
  const cached = useLiveQuery(() => db.aiNotes.get(id), [id])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (!isLeech(card)) return null

  async function make() {
    setBusy(true)
    setError('')
    try {
      const r = await generate(SYSTEM, `Kelime: ${word.term}\nAnlamı: ${word.definition}\nEş anlamlılar: ${(word.synonyms ?? []).join(', ') || '—'}`, 0.8)
      await db.aiNotes.put({ id, kind: 'leech', text: r.text, model: r.model, createdAt: new Date().toISOString() })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      style={{
        padding: '0.7rem 0.85rem',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--warning, #f59e0b)',
        background: 'var(--surface-strong, rgba(245,158,11,0.08))',
        display: 'grid',
        gap: '0.4rem',
        fontSize: '0.9rem',
      }}
    >
      <strong>🩹 Bu kelimede takılıyorsun ({card.lapses} kez unuttun)</strong>
      <span className="muted">Kartı bir de eş anlamlısıyla ve bir cümle içinde çalış; aşağıdaki ipucuyla aklında tut.</span>
      {cached ? (
        <span style={{ whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{cached.text}</span>
      ) : aiConfigured() ? (
        <div>
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void make()}>
            {busy ? 'Yazılıyor…' : '✨ Akılda kalıcı ipucu üret'}
          </button>
        </div>
      ) : null}
      {error && <span style={{ color: 'var(--danger, #c0392b)' }}>{error}</span>}
    </div>
  )
}
