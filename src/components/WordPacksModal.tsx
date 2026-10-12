import { useState } from 'react'
import { ALL_WORD_PACKS, type WordPack } from '../data/wordPacks'
import { bulkCreateWords } from '../services/words'
import styles from '../pages/Words.module.css'

interface WordPacksModalProps {
  activeUserId: string
  activeUserName: string
  onClose: () => void
  onSuccess: () => void
}

export function WordPacksModal({
  activeUserId,
  activeUserName,
  onClose,
  onSuccess,
}: WordPacksModalProps) {
  const [loadingPackId, setLoadingPackId] = useState<string | null>(null)
  const [isBulkLoading, setIsBulkLoading] = useState(false)
  const [resultMsg, setResultMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showArchGuide, setShowArchGuide] = useState(false)

  const totalWordsInAllPacks = ALL_WORD_PACKS.reduce((acc, p) => acc + p.words.length, 0)

  async function handleLoadPack(pack: WordPack) {
    setLoadingPackId(pack.id)
    setResultMsg(null)
    try {
      const res = await bulkCreateWords(activeUserId, pack.words)
      setResultMsg({
        type: 'success',
        text: `✓ "${pack.title}" paketinden ${res.addedCount} yeni kelime ${activeUserName} havuzuna yüklendi! (${res.skippedCount} mükerrer kelime atlandı)`,
      })
      onSuccess()
    } catch (err) {
      setResultMsg({
        type: 'error',
        text: `Hata: ${err instanceof Error ? err.message : String(err)}`,
      })
    } finally {
      setLoadingPackId(null)
    }
  }

  async function handleLoadAllPacks() {
    if (!window.confirm(`Tüm paketlerdeki (${totalWordsInAllPacks} kelime) ${activeUserName} profiline yüklemek istiyor musunuz?`)) {
      return
    }

    setIsBulkLoading(true)
    setResultMsg(null)
    try {
      const allWords = ALL_WORD_PACKS.flatMap((p) => p.words)
      const res = await bulkCreateWords(activeUserId, allWords)
      setResultMsg({
        type: 'success',
        text: `✓ Tüm paketler başarıyla aktarıldı! ${res.addedCount} yeni kelime eklendi. (${res.skippedCount} mükerrer atlandı)`,
      })
      onSuccess()
    } catch (err) {
      setResultMsg({
        type: 'error',
        text: `Hata: ${err instanceof Error ? err.message : String(err)}`,
      })
    } finally {
      setIsBulkLoading(false)
    }
  }

  return (
    <div className={styles.modalBackdrop} onClick={onClose} role="dialog" aria-modal="true">
      <div
        className={styles.modalContent}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '820px', maxHeight: '90vh', overflowY: 'auto' }}
      >
        {/* Modal Başlığı */}
        <div className={styles.modalHead}>
          <div>
            <h2>📦 Hazır Kelime Paketleri</h2>
            <p className="muted" style={{ margin: '0.2rem 0 0', fontSize: '0.85rem' }}>
              <strong>{activeUserName}</strong> profiline doğrudan yüklenebilecek doğrulanmış seviye ve sınav setleri
            </p>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Kapat">
            &times;
          </button>
        </div>

        {/* Geri Bildirim Mesajı */}
        {resultMsg && (
          <div
            style={{
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.88rem',
              fontWeight: 600,
              background:
                resultMsg.type === 'success'
                  ? 'color-mix(in srgb, var(--success) 15%, transparent)'
                  : 'color-mix(in srgb, var(--danger) 15%, transparent)',
              color: resultMsg.type === 'success' ? 'var(--success)' : 'var(--danger)',
              border: `1px solid ${resultMsg.type === 'success' ? 'var(--success)' : 'var(--danger)'}`,
            }}
          >
            {resultMsg.text}
          </div>
        )}

        {/* Hızlı Eylem Barı */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
            padding: '0.85rem 1rem',
            background: 'var(--surface-strong)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
          }}
        >
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>
              🚀 Eksiksiz Başlangıç Havuzu
            </div>
            <div className="muted" style={{ fontSize: '0.8rem' }}>
              5 farklı seviye ve sınav paketinin tamamı ({totalWordsInAllPacks} kelime, eş anlamlılar ve çift dilli örnek cümleler)
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void handleLoadAllPacks()}
              disabled={isBulkLoading || loadingPackId !== null}
            >
              {isBulkLoading ? '⏳ Yükleniyor…' : '⚡ Tüm Paketleri Tek Tıkla Yükle'}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setShowArchGuide(!showArchGuide)}
              style={{ fontSize: '0.82rem' }}
            >
              {showArchGuide ? '▲ Rehberi Kapat' : '💡 Seviye & Aşama Rehberi'}
            </button>
          </div>
        </div>

        {/* Diğer Uygulamaların Mimari ve Seviyelendirme Rehberi (Katlanabilir) */}
        {showArchGuide && (
          <div
            style={{
              padding: '1rem',
              background: 'var(--input-bg)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              fontSize: '0.85rem',
              lineHeight: 1.5,
              display: 'grid',
              gap: '0.6rem',
            }}
          >
            <h4 style={{ margin: 0, color: 'var(--primary)', fontSize: '0.95rem' }}>
              📚 Kelime Uygulamalarında Seviyelendirme ve İlerleme Mimarisi
            </h4>
            <p style={{ margin: 0 }}>
              Dünyadaki lider kelime uygulamaları (Anki, WordUp, Memrise, Duolingo) kelime dağarcığını şu 3 eksende yönetir:
            </p>
            <ul style={{ margin: 0, paddingLeft: '1.2rem', display: 'grid', gap: '0.4rem' }}>
              <li>
                <strong>1. CEFR & Frekans Aşamaları (A1 ➔ C2):</strong> Kelimeler kullanım sıklığına göre ayrılır.
                <em>A1-A2</em> (Başlangıç - günlük temel 1000 kelime), <em>B1-B2</em> (Gelişme - akıcı diyalog ve dizi/film omurgası), <em>C1-C2 / YDS</em> (İleri - akademik makale ve sınav kelimeleri). Bizim uygulamamızda bu aşamalar etiketlerle (`#A1-A2`, `#YDS-Akademik`) filtrelenebilir.
              </li>
              <li>
                <strong>2. FSRS / SM-2 Algoritması (Unutma Eğrisi):</strong> Kelime yüklendiğinde <em>State 0 (Yeni)</em> başlar. Çalıştıkça <em>State 1 (Öğreniliyor)</em>, aralıklı tekrarlarla <em>State 2 (Kalıcı Bellek)</em> evresine geçer. Unutulursa <em>State 3 (Yeniden Öğrenme)</em> periyoduna alınır.
              </li>
              <li>
                <strong>3. 1–5 Ustalık Puanı (Mastery Score):</strong> 1 (Hiç bilmiyorum) ile 5 (Tamamen öğrendim) arasında puanlama. Filtreleme çubuğundan dilediğiniz puan aralığını seçip odaklanabilirsiniz.
              </li>
            </ul>
          </div>
        )}

        {/* Paketler Listesi */}
        <div style={{ display: 'grid', gap: '1rem' }}>
          {ALL_WORD_PACKS.map((pack) => {
            const isLoading = loadingPackId === pack.id

            return (
              <div
                key={pack.id}
                style={{
                  padding: '1.1rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.6rem',
                  transition: 'border-color 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <h3 style={{ margin: 0, fontSize: '1.05rem' }}>{pack.title}</h3>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '0.15rem 0.5rem',
                          borderRadius: '6px',
                          background: 'color-mix(in srgb, var(--primary) 15%, transparent)',
                          color: 'var(--primary)',
                          border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)',
                        }}
                      >
                        {pack.badge}
                      </span>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          padding: '0.15rem 0.45rem',
                          borderRadius: '6px',
                          background: 'var(--input-bg)',
                          color: 'var(--text-muted)',
                        }}
                      >
                        {pack.level}
                      </span>
                    </div>

                    <p className="muted" style={{ margin: '0.35rem 0 0', fontSize: '0.84rem' }}>
                      {pack.description}
                    </p>
                  </div>

                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => void handleLoadPack(pack)}
                    disabled={isLoading || isBulkLoading}
                    style={{ whiteSpace: 'nowrap', alignSelf: 'flex-start' }}
                  >
                    {isLoading ? '⏳ Yükleniyor…' : `📥 Paketi Yükle (${pack.words.length})`}
                  </button>
                </div>

                {/* Örnek Kelimeler Önizleme Çipleri */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.2rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Örnekler:
                  </span>
                  {pack.words.slice(0, 6).map((w, idx) => (
                    <span
                      key={idx}
                      style={{
                        fontSize: '0.74rem',
                        padding: '0.15rem 0.45rem',
                        background: 'var(--input-bg)',
                        borderRadius: '4px',
                        border: '1px solid var(--border)',
                        color: 'var(--text)',
                      }}
                    >
                      {w.term}
                    </span>
                  ))}
                  {pack.words.length > 6 && (
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      +{pack.words.length - 6} daha
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Alt Kapat Butonu */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Kapat
          </button>
        </div>
      </div>
    </div>
  )
}
