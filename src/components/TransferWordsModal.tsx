import { useState, useEffect } from 'react'
import type { UserProfile } from '../types/database'
import {
  copyWordsBetweenUsers,
  getTransferableStats,
  type SourceProfileStats,
  type TransferResult,
} from '../services/wordTransfer'
import styles from '../pages/Words.module.css'

interface TransferWordsModalProps {
  activeUserId: string
  allUsers: UserProfile[]
  onClose: () => void
  onSuccess: () => void
}

export function TransferWordsModal({
  activeUserId,
  allUsers,
  onClose,
  onSuccess,
}: TransferWordsModalProps) {
  // Aktif kullanıcı dışındaki diğer profilleri listele
  const otherUsers = allUsers.filter((u) => u.id !== activeUserId)
  const defaultSourceId = otherUsers[0]?.id || ''

  const [sourceUserId, setSourceUserId] = useState<string>(defaultSourceId)
  const [mode, setMode] = useState<'all' | 'tags'>('all')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [loadingStats, setLoadingStats] = useState(false)
  const [stats, setStats] = useState<SourceProfileStats | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<TransferResult | null>(null)

  const activeUser = allUsers.find((u) => u.id === activeUserId)
  const sourceUser = allUsers.find((u) => u.id === sourceUserId)

  useEffect(() => {
    if (!sourceUserId || !activeUserId) return
    let isCurrent = true
    setLoadingStats(true)

    getTransferableStats(sourceUserId, activeUserId)
      .then((data) => {
        if (isCurrent) {
          setStats(data)
          setLoadingStats(false)
        }
      })
      .catch(() => {
        if (isCurrent) setLoadingStats(false)
      })

    return () => {
      isCurrent = false
    }
  }, [sourceUserId, activeUserId])

  function handleToggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    )
  }

  async function handleTransfer() {
    if (!sourceUserId || !activeUserId) return
    setSubmitting(true)

    try {
      const res = await copyWordsBetweenUsers(sourceUserId, activeUserId, {
        copyAll: mode === 'all',
        tags: mode === 'tags' ? selectedTags : undefined,
      })
      setResult(res)
      onSuccess()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.modalBackdrop} onClick={onClose} role="dialog" aria-modal="true">
      <div
        className={styles.modalContent}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '580px' }}
      >
        <div className={styles.modalHead}>
          <h2>⇄ Profiller Arası Kelime Aktarımı</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Kapat">
            &times;
          </button>
        </div>

        {result ? (
          <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🎉</div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              Aktarım Tamamlandı!
            </h3>
            <p className="muted" style={{ marginBottom: '1.25rem' }}>
              <strong>{sourceUser?.displayName}</strong> havuzundan{' '}
              <strong>{activeUser?.displayName}</strong> havuzuna{' '}
              <span style={{ color: 'var(--success)', fontWeight: 700 }}>
                {result.copiedCount} yeni kelime
              </span>{' '}
              başarıyla kopyalandı.
              {result.skippedCount > 0 && (
                <span style={{ display: 'block', fontSize: '0.85rem', marginTop: '0.35rem' }}>
                  ({result.skippedCount} kelime havuzunuzda zaten bulunduğu için atlandı)
                </span>
              )}
            </p>

            <button type="button" className="btn btn-primary" onClick={onClose}>
              Tamam (Kelimelerime Git)
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '1.1rem' }}>
            <p className="muted" style={{ fontSize: '0.88rem' }}>
              İki profilin kelime havuzları tamamen bağımsızdır; ancak dilediğiniz zaman birbirinizin
              eklediği kelimeleri veya konu kategorilerini kendi çalışma havuzunuza tek tıkla kopyalayabilirsiniz.
            </p>

            {/* Kaynak ve Hedef Profil Seçimi */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="field">
                <label>Kelimelerin Alınacağı Profil</label>
                <select
                  className="input"
                  value={sourceUserId}
                  onChange={(e) => {
                    setSourceUserId(e.target.value)
                    setSelectedTags([])
                  }}
                >
                  {otherUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.displayName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label>Hedef Profil (Aktif)</label>
                <input
                  className="input"
                  type="text"
                  disabled
                  value={`${activeUser?.displayName || 'Siz'} (Sizin Havuzunuz)`}
                  style={{ opacity: 0.8 }}
                />
              </div>
            </div>

            {/* Analiz & Özet Kartı */}
            {loadingStats ? (
              <div className="muted" style={{ padding: '0.8rem', textAlign: 'center' }}>
                Havuz istatistikleri inceleniyor…
              </div>
            ) : stats ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '0.5rem',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  background: 'color-mix(in srgb, var(--input-bg) 70%, transparent)',
                  border: '1px solid var(--border)',
                  textAlign: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{stats.totalWords}</div>
                  <div className="muted" style={{ fontSize: '0.75rem' }}>Kaynak Kelime</div>
                </div>
                <div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--success)' }}>
                    {stats.availableNewCount}
                  </div>
                  <div className="muted" style={{ fontSize: '0.75rem' }}>Sizde Olmayan</div>
                </div>
                <div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-muted)' }}>
                    {stats.alreadyExistingCount}
                  </div>
                  <div className="muted" style={{ fontSize: '0.75rem' }}>Zaten Mevcut</div>
                </div>
              </div>
            ) : null}

            {/* Aktarım Modu Seçimi */}
            <div className="field">
              <label>Aktarma Yöntemi</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  className={`btn ${mode === 'all' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ flex: 1, fontSize: '0.85rem' }}
                  onClick={() => setMode('all')}
                >
                  Tüm Yeni Kelimeleri Aktar
                </button>
                <button
                  type="button"
                  className={`btn ${mode === 'tags' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ flex: 1, fontSize: '0.85rem' }}
                  onClick={() => setMode('tags')}
                >
                  Kategoriye / Etikete Göre Seç
                </button>
              </div>
            </div>

            {/* Kategori Seçim Çipleri */}
            {mode === 'tags' && (
              <div className="field">
                <label>Aktarmak İstediğiniz Kategorileri Seçin</label>
                {stats?.tagsWithCounts && stats.tagsWithCounts.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', maxHeight: '140px', overflowY: 'auto' }}>
                    {stats.tagsWithCounts.map(({ tag, count }) => {
                      const isSelected = selectedTags.includes(tag)
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => handleToggleTag(tag)}
                          style={{
                            all: 'unset',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            padding: '0.3rem 0.65rem',
                            borderRadius: '999px',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            border: `1px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}`,
                            background: isSelected
                              ? 'color-mix(in srgb, var(--primary) 20%, transparent)'
                              : 'var(--input-bg)',
                            color: isSelected ? 'var(--primary)' : 'var(--text-muted)',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <span>{isSelected ? '✓' : '+'}</span>
                          <span>#{tag}</span>
                          <span style={{ fontSize: '0.72rem', opacity: 0.8 }}>({count})</span>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <span className="muted" style={{ fontSize: '0.8rem' }}>
                    Bu profilde henüz etiket tanımlanmış kelime bulunmuyor.
                  </span>
                )}
              </div>
            )}

            {/* Aksiyon Butonları */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button type="button" className="btn btn-ghost" onClick={onClose} disabled={submitting}>
                İptal
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={submitting || (mode === 'tags' && selectedTags.length === 0)}
                onClick={handleTransfer}
              >
                {submitting ? 'Aktarılıyor…' : '🚀 Havuzuma Kopyala & Aktar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
