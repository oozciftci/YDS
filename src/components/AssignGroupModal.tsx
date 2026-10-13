import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { db } from '../db'
import { createCustomGroup, toggleWordInGroup } from '../services/groups'
import type { WordItem } from '../types/database'

interface AssignGroupModalProps {
  word: WordItem
  activeUserId: string
  onClose: () => void
}

export function AssignGroupModal({ word, activeUserId, onClose }: AssignGroupModalProps) {
  const navigate = useNavigate()
  const [newGroupName, setNewGroupName] = useState('')
  const [loading, setLoading] = useState(false)

  // Kullanıcının özel grupları
  const groups = useLiveQuery(
    () => db.wordGroups.where('userId').equals(activeUserId).toArray(),
    [activeUserId],
    [],
  )

  // Yeni grup oluşturup kelimeyi hemen ekle
  async function handleCreateAndAssign(e: React.FormEvent) {
    e.preventDefault()
    if (!newGroupName.trim() || loading) return

    setLoading(true)
    try {
      const created = await createCustomGroup(activeUserId, newGroupName.trim())
      await toggleWordInGroup(created.id, word.id)
      setNewGroupName('')
    } finally {
      setLoading(false)
    }
  }

  // Gruba ekle / çıkar (toggle)
  async function handleToggle(groupId: string) {
    await toggleWordInGroup(groupId, word.id)
  }

  // Grubu çalışmaya git
  function handleStudyGroup(groupId: string) {
    navigate(`/study?group=${groupId}&auto=1`)
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: '1rem',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '1.5rem',
          maxWidth: '460px',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.15rem',
          boxShadow: 'var(--shadow)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>Kelimeyi Grupla & Desteye Ekle</h3>
            <p className="muted" style={{ margin: '0.25rem 0 0', fontSize: '0.85rem' }}>
              <strong>{word.term}</strong> ({word.definition})
            </p>
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            style={{ padding: '0.2rem 0.5rem' }}
          >
            ✕
          </button>
        </div>

        {/* MEVCUT ÖZEL GRUPLAR LİSTESİ */}
        <div>
          <label style={{ fontSize: '0.82rem', fontWeight: 700, display: 'block', marginBottom: '0.45rem' }}>
            Dahil Olduğu Gruplar
          </label>

          {groups.length === 0 ? (
            <div
              style={{
                padding: '0.85rem',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--input-bg)',
                border: '1px dashed var(--border)',
                fontSize: '0.82rem',
                color: 'var(--text-muted)',
                textAlign: 'center',
              }}
            >
              Henüz özel grup oluşturmadınız. Aşağıdan yeni bir grup adı girerek ekleyin.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto' }}>
              {groups.map((grp) => {
                const isMember = (grp.wordIds && grp.wordIds.includes(word.id)) || (word.groupIds && word.groupIds.includes(grp.id))
                return (
                  <div
                    key={grp.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.5rem 0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      background: isMember ? 'color-mix(in srgb, var(--primary) 12%, var(--surface))' : 'var(--input-bg)',
                      border: `1px solid ${isMember ? 'var(--primary)' : 'var(--border)'}`,
                    }}
                  >
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.6rem',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        flex: 1,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(isMember)}
                        onChange={() => void handleToggle(grp.id)}
                        style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                      />
                      <span>{grp.icon || '📁'} {grp.name}</span>
                      <span className="muted" style={{ fontSize: '0.75rem', fontWeight: 400 }}>
                        ({grp.wordIds?.length || 0} kelime)
                      </span>
                    </label>

                    {isMember && (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                        onClick={() => handleStudyGroup(grp.id)}
                        title="Bu grubu çalış"
                      >
                        Çalış →
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* YENİ GRUP OLUŞTURMA ALANI */}
        <form onSubmit={handleCreateAndAssign} style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            className="input"
            placeholder="Yeni grup / deste adı…"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            style={{ fontSize: '0.85rem' }}
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!newGroupName.trim() || loading}
            style={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}
          >
            + Oluştur & Ekle
          </button>
        </form>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Kapat
          </button>
        </div>
      </div>
    </div>
  )
}
