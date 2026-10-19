import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../db'
import { useUserStore } from '../stores/user'
import type { Suggestion, SuggestionStatus } from '../types/database'
import styles from './Coach.module.css'

// "Öneriler": geliştirici danışmanından beğenilip eklenen öneriler. Yalnızca cihazda (JSON yedeğine girer).

const STATUS: Record<SuggestionStatus, string> = {
  yeni: '🆕 Yeni',
  planlandi: '📌 Planlandı',
  yapildi: '✅ Yapıldı',
  vazgecildi: '🚫 Vazgeçildi',
}

const EFFORT: Record<Suggestion['effort'], string> = { S: 'S · birkaç saat', M: 'M · 1-2 gün', L: 'L · daha uzun' }

/** Öneriyi Claude Code'a verilecek görev metnine çevirir. */
function asPrompt(x: Suggestion): string {
  return [
    `YDS Kelime uygulamasında (C:\\Projeler\\YDS_Proje) şu iyileştirmeyi yap: ${x.title}`,
    '',
    x.detail,
    '',
    `Alan: ${x.area} · Tahmini efor: ${x.effort}`,
    'Önce ilgili kodu incele; uygun değilse ya da daha iyi bir yol varsa önce bunu söyle. Bitince YOL_HARITASI.md’yi güncelle ve commit et.',
  ].join('\n')
}

export function SuggestionsPage() {
  const userId = useUserStore((s) => s.activeUserId)
  const items = useLiveQuery(
    () => db.suggestions.where('[userId+updatedAt]').between([userId, ''], [userId, '\uffff']).reverse().toArray(),
    [userId],
  )
  const [filter, setFilter] = useState<SuggestionStatus | 'all'>('all')
  const [copied, setCopied] = useState<string | null>(null)

  async function setStatus(id: string, status: SuggestionStatus) {
    await db.suggestions.update(id, { status, updatedAt: new Date().toISOString() })
  }

  async function copy(x: Suggestion) {
    try {
      await navigator.clipboard.writeText(asPrompt(x))
      setCopied(x.id)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      alert(asPrompt(x))
    }
  }

  const list = (items ?? []).filter((x) => filter === 'all' || x.status === filter)
  const count = (s: SuggestionStatus) => (items ?? []).filter((x) => x.status === s).length

  return (
    <section className={styles.page}>
      <header>
        <Link to="/koc" className={styles.back}>
          ← YZ Koç
        </Link>
        <h1 className={styles.title}>💡 Öneriler</h1>
        <p className="muted" style={{ margin: 0 }}>
          Geliştirici danışmanından beğenip eklediğin iyileştirmeler. Durumlarını takip et; “Claude için kopyala” ile görevi
          doğrudan bir geliştirme oturumuna verebilirsin.
        </p>
      </header>

      <div className={styles.statusTabs}>
        <button type="button" className={`${styles.chip} ${filter === 'all' ? styles.chipOn : ''}`} onClick={() => setFilter('all')}>
          Tümü ({items?.length ?? 0})
        </button>
        {(Object.keys(STATUS) as SuggestionStatus[]).map((s) => (
          <button key={s} type="button" className={`${styles.chip} ${filter === s ? styles.chipOn : ''}`} onClick={() => setFilter(s)}>
            {STATUS[s]} ({count(s)})
          </button>
        ))}
      </div>

      <article className="card">
        {!items ? null : list.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            {items.length === 0 ? (
              <>
                Henüz öneri yok. <Link to="/koc">YZ Koç</Link>’ta “🛠️ Geliştirici danışmanı” ile bir sohbet başlat; beğendiğin
                önerinin altındaki “＋ Önerilere ekle”ye bas.
              </>
            ) : (
              'Bu durumda öneri yok.'
            )}
          </p>
        ) : (
          list.map((x) => (
            <div key={x.id} className={styles.suggestionRow}>
              <div className={styles.suggestionHead}>
                <strong>{x.title}</strong>
                <span className={styles.effort}>
                  {x.area} · {EFFORT[x.effort]}
                </span>
              </div>
              <p>{x.detail}</p>
              <div className={styles.rowActions}>
                <select
                  className={styles.select}
                  value={x.status}
                  onChange={(e) => void setStatus(x.id, e.target.value as SuggestionStatus)}
                  aria-label="Durum"
                >
                  {(Object.keys(STATUS) as SuggestionStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {STATUS[s]}
                    </option>
                  ))}
                </select>
                <button type="button" className="btn btn-ghost" onClick={() => void copy(x)}>
                  {copied === x.id ? '✓ Kopyalandı' : '📋 Claude için kopyala'}
                </button>
                {x.chatId && (
                  <Link to={`/koc/${x.chatId}`} className="btn btn-ghost">
                    Sohbete git
                  </Link>
                )}
                <span className={styles.spacer} />
                <small className="muted">{new Date(x.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}</small>
                <button
                  type="button"
                  className={styles.iconBtn}
                  aria-label="Sil"
                  title="Sil"
                  onClick={() => confirm('Bu öneri silinsin mi?') && void db.suggestions.delete(x.id)}
                >
                  ✕
                </button>
              </div>
            </div>
          ))
        )}
      </article>
    </section>
  )
}
