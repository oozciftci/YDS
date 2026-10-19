import { useEffect, useState } from 'react'
import { ALL_WORD_PACKS, type WordPack } from '../data/wordPacks'
import { bulkCreateWords, type CreateWordInput } from '../services/words'
import styles from '../pages/Words.module.css'

interface WordPacksModalProps {
  activeUserId: string
  activeUserName: string
  onClose: () => void
  onSuccess: () => void
}

interface ImportProgress {
  current: number
  total: number
  label: string
}

export function WordPacksModal({
  activeUserId,
  activeUserName,
  onClose,
  onSuccess,
}: WordPacksModalProps) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null)
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null)
  const [resultMsg, setResultMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showArchGuide, setShowArchGuide] = useState(false)
  // Yalnızca yerelde (npm run dev): telifli kitaplardan çıkarılan kelime paketleri, yayın derlemesinde yoktur
  const [localPack, setLocalPack] = useState<{ id: string; count: number } | null>(null)

  useEffect(() => {
    if (!import.meta.env.DEV) return
    fetch('/local-api/paket')
      .then((r) => (r.ok ? r.json() : []))
      .then((list: { id: string; count: number }[]) => setLocalPack(list.find((p) => p.id === 'modadil-60-gun') ?? null))
      .catch(() => setLocalPack(null))
  }, [])

  async function handleLoadLocalPack() {
    if (!localPack) return
    setLoadingAction('local_pack')
    setResultMsg(null)
    try {
      const res = await fetch(`/local-api/paket/${localPack.id}`)
      if (!res.ok) throw new Error('Paket dosyası okunamadı: ' + res.status)
      const words: CreateWordInput[] = await res.json()
      const added = await bulkCreateWords(activeUserId, words)
      setResultMsg({
        type: 'success',
        text: `✓ "60 Günde YDS Kelimeleri" paketinden ${added.addedCount} yeni kelime ${activeUserName} havuzuna eklendi! (${added.skippedCount} mükerrer atlandı)`,
      })
      onSuccess()
    } catch (err) {
      setResultMsg({ type: 'error', text: `Hata: ${err instanceof Error ? err.message : String(err)}` })
    } finally {
      setLoadingAction(null)
    }
  }

  // 1. Oxford 3000 JSON verisini çekip parçalı yükleme fonksiyonu
  async function handleLoadBigDataset(levelFilter?: 'all' | 'a1_a2' | 'b1_b2' | 'c1_c2', actionId = 'full_oxford') {
    setLoadingAction(actionId)
    setResultMsg(null)
    setImportProgress({ current: 0, total: 3354, label: 'Veri tabanı indiriliyor…' })

    try {
      const res = await fetch(`${import.meta.env.BASE_URL}data/oxford3000_tr.json`)
      if (!res.ok) throw new Error('Veri tabanı dosyası yüklenemedi: ' + res.status)

      let rawWords: CreateWordInput[] = await res.json()

      if (levelFilter === 'a1_a2') {
        rawWords = rawWords.filter((w) => w.tags?.includes('A1') || w.tags?.includes('A2'))
      } else if (levelFilter === 'b1_b2') {
        rawWords = rawWords.filter((w) => w.tags?.includes('B1') || w.tags?.includes('B2'))
      } else if (levelFilter === 'c1_c2') {
        rawWords = rawWords.filter((w) => w.tags?.includes('C1') || w.tags?.includes('C2') || w.tags?.includes('İleri'))
      }

      const total = rawWords.length
      let totalAdded = 0
      let totalSkipped = 0
      const batchSize = 350

      for (let i = 0; i < total; i += batchSize) {
        const chunk = rawWords.slice(i, i + batchSize)
        setImportProgress({
          current: Math.min(i + batchSize, total),
          total,
          label: `${Math.min(i + batchSize, total)} / ${total} kelime veritabanına işleniyor…`,
        })

        const chunkRes = await bulkCreateWords(activeUserId, chunk)
        totalAdded += chunkRes.addedCount
        totalSkipped += chunkRes.skippedCount

        // UI nefes alsın
        await new Promise((r) => setTimeout(r, 40))
      }

      setResultMsg({
        type: 'success',
        text: `✓ Tebrikler! ${totalAdded} yeni kelime ${activeUserName} profiline başarıyla aktarıldı. (${totalSkipped} mükerrer kelime atlandı)`,
      })
      onSuccess()
    } catch (err) {
      setResultMsg({
        type: 'error',
        text: `Hata: ${err instanceof Error ? err.message : String(err)}`,
      })
    } finally {
      setLoadingAction(null)
      setImportProgress(null)
    }
  }

  // 2. Çıkmış YDS metinlerinden çıkarılan, havuzda olmayan sınav kelimeleri
  async function handleLoadYdsExamPack() {
    setLoadingAction('yds_exam_pack')
    setResultMsg(null)
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}data/yds_sinav_paketi.json`)
      if (!res.ok) throw new Error('Paket dosyası yüklenemedi: ' + res.status)
      const words: CreateWordInput[] = await res.json()
      const added = await bulkCreateWords(activeUserId, words)
      setResultMsg({
        type: 'success',
        text: `✓ YDS Sınav Kelimeleri paketinden ${added.addedCount} yeni kelime ${activeUserName} havuzuna eklendi! (${added.skippedCount} mükerrer atlandı)`,
      })
      onSuccess()
    } catch (err) {
      setResultMsg({
        type: 'error',
        text: `Hata: ${err instanceof Error ? err.message : String(err)}`,
      })
    } finally {
      setLoadingAction(null)
    }
  }

  // 2b. Yeni YDS Kelimeleri: 27 çıkmış sınavın tam analizinden (scripts/analyzeYdsCorpus.mjs). Yayın
  // sürümünde anlam + sıklık/şık istatistiği gelir; dev sunucusunda (yalnızca bu bilgisayar) kelimelere
  // gerçek sınav cümleleri ve Türkçe çevirileri de eklenir (telifli içerik yayına girmez).
  async function handleLoadNewYdsPack() {
    setLoadingAction('new_yds_pack')
    setResultMsg(null)
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}data/yeni_yds_kelimeleri.json`)
      if (!res.ok) throw new Error('Paket dosyası yüklenemedi: ' + res.status)
      const words: CreateWordInput[] = await res.json()
      let withExamples = 0
      if (import.meta.env.DEV) {
        try {
          const ex = await fetch('/local-api/kelime-ornekleri')
          if (ex.ok) {
            const map: Record<string, CreateWordInput['sentences']> = await ex.json()
            for (const w of words) {
              const s = map[w.term.toLowerCase()]
              if (s?.length) {
                w.sentences = s
                withExamples++
              }
            }
          }
        } catch {
          // Sınav cümleleri isteğe bağlı; yoksa paket yine yüklenir
        }
      }
      const added = await bulkCreateWords(activeUserId, words)
      setResultMsg({
        type: 'success',
        text: `✓ Yeni YDS Kelimeleri paketinden ${added.addedCount} yeni kelime ${activeUserName} havuzuna eklendi! (${added.skippedCount} mükerrer atlandı${withExamples ? `; ${withExamples} kelimeye çıkmış sınav cümlesi eklendi` : ''})`,
      })
      onSuccess()
    } catch (err) {
      setResultMsg({
        type: 'error',
        text: `Hata: ${err instanceof Error ? err.message : String(err)}`,
      })
    } finally {
      setLoadingAction(null)
    }
  }

  // 3. Yerleşik özel YDS paketlerini yükleme
  async function handleLoadPack(pack: WordPack) {
    setLoadingAction(pack.id)
    setResultMsg(null)
    try {
      const res = await bulkCreateWords(activeUserId, pack.words)
      setResultMsg({
        type: 'success',
        text: `✓ "${pack.title}" paketinden ${res.addedCount} yeni kelime ${activeUserName} havuzuna eklendi! (${res.skippedCount} mükerrer atlandı)`,
      })
      onSuccess()
    } catch (err) {
      setResultMsg({
        type: 'error',
        text: `Hata: ${err instanceof Error ? err.message : String(err)}`,
      })
    } finally {
      setLoadingAction(null)
    }
  }

  return (
    <div className={styles.modalBackdrop} onClick={onClose} role="dialog" aria-modal="true">
      <div
        className={styles.modalContent}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '860px', maxHeight: '92vh', overflowY: 'auto' }}
      >
        {/* Modal Başlığı */}
        <div className={styles.modalHead}>
          <div>
            <h2>📦 Büyük Kelime Veri Tabanı & Seviye Paketleri</h2>
            <p className="muted" style={{ margin: '0.2rem 0 0', fontSize: '0.85rem' }}>
              <strong>{activeUserName}</strong> profili için 3.300+ kelimelik tam Oxford 3000 & YDS havuzu
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
              padding: '0.85rem 1rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.9rem',
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

        {/* İlerleme Çubuğu */}
        {importProgress && (
          <div
            style={{
              padding: '1rem',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--surface-strong)',
              border: '1px solid var(--primary)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86rem', fontWeight: 700 }}>
              <span>⏳ {importProgress.label}</span>
              <span style={{ color: 'var(--primary)' }}>
                {Math.round((importProgress.current / importProgress.total) * 100)}%
              </span>
            </div>
            <div
              style={{
                width: '100%',
                height: '8px',
                background: 'var(--input-bg)',
                borderRadius: '4px',
                overflow: 'hidden',
                marginTop: '0.5rem',
              }}
            >
              <div
                style={{
                  width: `${(importProgress.current / importProgress.total) * 100}%`,
                  height: '100%',
                  background: 'var(--primary)',
                  transition: 'width 0.2s ease',
                }}
              />
            </div>
          </div>
        )}

        {/* ANA HERO BANNER: 3.354 KELİMELİK TAM HAVUZ */}
        <div
          style={{
            padding: '1.25rem',
            background: 'linear-gradient(135deg, color-mix(in srgb, var(--primary) 18%, transparent), var(--surface-strong))',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--primary)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.8rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.3rem' }}>🏆</span>
                <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text)' }}>
                  Oxford 3000 & YDS Tam Kelime Havuzu (3.354 Kelime)
                </h3>
              </div>
              <p className="muted" style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', maxWidth: '580px' }}>
                İngilizcenin %90'ını oluşturan tüm A1, A2, B1, B2 ve C1 düzeyindeki 3.354 kelime. Türkçe anlamları, türleri, eş/zıt anlamlıları, kalıpları ve örnek cümleleriyle eksiksiz dev havuz.
              </p>
            </div>

            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void handleLoadBigDataset('all', 'full_oxford')}
              disabled={loadingAction !== null}
              style={{
                fontSize: '0.95rem',
                padding: '0.65rem 1.2rem',
                fontWeight: 700,
                boxShadow: '0 4px 14px color-mix(in srgb, var(--primary) 40%, transparent)',
              }}
            >
              {loadingAction === 'full_oxford' ? '⏳ Aktarılıyor…' : '⚡ 3.354 Kelimelik Tam Havuzu Yükle'}
            </button>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              Kapsam:
            </span>
            <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem', borderRadius: '4px', background: 'var(--input-bg)', border: '1px solid var(--border)' }}>
              A1-A2: 1.417 Kelime
            </span>
            <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem', borderRadius: '4px', background: 'var(--input-bg)', border: '1px solid var(--border)' }}>
              B1-B2: 1.822 Kelime
            </span>
            <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem', borderRadius: '4px', background: 'var(--input-bg)', border: '1px solid var(--border)' }}>
              C1-C2: 115+ Akademik Kelime
            </span>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setShowArchGuide(!showArchGuide)}
              style={{ fontSize: '0.78rem', marginLeft: 'auto', padding: '0.2rem 0.5rem' }}
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

        {/* BÖLÜMLENDİRİLMİŞ SEVİYE PAKETLERİ */}
        <h3 style={{ margin: '0.5rem 0 0', fontSize: '1.05rem', color: 'var(--text)' }}>
          Aşamalara Göre Parçalı Yükleme Paketleri
        </h3>

        <div style={{ display: 'grid', gap: '0.85rem' }}>
          {/* Seviye 1: A1 - A2 Başlangıç */}
          <div
            style={{
              padding: '1rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>🌱 A1 - A2 Başlangıç & Temel İngilizce</span>
                <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.45rem', borderRadius: '4px', background: 'var(--input-bg)', fontWeight: 600 }}>
                  1.417 Kelime
                </span>
              </div>
              <p className="muted" style={{ margin: '0.2rem 0 0', fontSize: '0.82rem' }}>
                Günlük konuşmada, seyahatte ve temel diyaloglarda en sık geçen 1.417 kelime.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => void handleLoadBigDataset('a1_a2', 'a1_a2_pack')}
              disabled={loadingAction !== null}
            >
              {loadingAction === 'a1_a2_pack' ? '⏳ Yükleniyor…' : '📥 A1-A2 Paketini Yükle (1.417)'}
            </button>
          </div>

          {/* Seviye 2: B1 - B2 Orta Düzey Akıcılık */}
          <div
            style={{
              padding: '1rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>🚀 B1 - B2 Orta Düzey Akıcılık & Genel İngilizce</span>
                <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.45rem', borderRadius: '4px', background: 'var(--input-bg)', fontWeight: 600 }}>
                  1.822 Kelime
                </span>
              </div>
              <p className="muted" style={{ margin: '0.2rem 0 0', fontSize: '0.82rem' }}>
                Dizi, film, haber takibi ve iş dünyasında akıcı iletişim omurgasını oluşturan 1.822 kelime.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => void handleLoadBigDataset('b1_b2', 'b1_b2_pack')}
              disabled={loadingAction !== null}
            >
              {loadingAction === 'b1_b2_pack' ? '⏳ Yükleniyor…' : '📥 B1-B2 Paketini Yükle (1.822)'}
            </button>
          </div>

          {/* Seviye 3: C1 - C2 & YDS Akademik Çekirdek */}
          <div
            style={{
              padding: '1rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>🎯 C1 İleri Seviye (Oxford)</span>
                <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.45rem', borderRadius: '4px', background: 'var(--input-bg)', fontWeight: 600 }}>
                  106 Kelime
                </span>
              </div>
              <p className="muted" style={{ margin: '0.2rem 0 0', fontSize: '0.82rem' }}>
                Tam havuzdaki C1 seviye kelimeler. Tam havuzu yüklediyseniz bunlar zaten içindedir.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => void handleLoadBigDataset('c1_c2', 'c1_c2_pack')}
              disabled={loadingAction !== null}
            >
              {loadingAction === 'c1_c2_pack' ? '⏳ Yükleniyor…' : '📥 C1-YDS Paketini Yükle'}
            </button>
          </div>

          {/* Çıkmış YDS sınav kelimeleri (havuzda olmayanlar) */}
          <div
            style={{
              padding: '1rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--primary)',
              background: 'var(--primary-subtle)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>📝 YDS Sınav Kelimeleri</span>
                <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.45rem', borderRadius: '4px', background: 'var(--input-bg)', fontWeight: 600 }}>
                  B1-C1 • 397 Kelime
                </span>
              </div>
              <p className="muted" style={{ margin: '0.2rem 0 0', fontSize: '0.82rem' }}>
                2013-2023 çıkmış YDS metinlerinde sık geçen ama Oxford 3000 havuzunda olmayan kelimeler (psychological, symptom, chronic…). Tam havuzdan ayrıdır.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void handleLoadYdsExamPack()}
              disabled={loadingAction !== null}
            >
              {loadingAction === 'yds_exam_pack' ? '⏳ Yükleniyor…' : '📥 YDS Sınav Kelimelerini Yükle'}
            </button>
          </div>

          {/* Yeni YDS Kelimeleri: 2013-2026 (27 sınav) tam analizi */}
          <div
            style={{
              padding: '1rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--primary)',
              background: 'var(--primary-subtle)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>🆕 Yeni YDS Kelimeleri</span>
                <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.45rem', borderRadius: '4px', background: 'var(--input-bg)', fontWeight: 600 }}>
                  B1-C1 • 821 Kelime
                </span>
              </div>
              <p className="muted" style={{ margin: '0.2rem 0 0', fontSize: '0.82rem' }}>
                2013-2026 arası 27 çıkmış sınavın tamamı tarandı: en az 4 sınavda geçen ya da kelime sorularında şık olarak çıkan, havuzunuzda olmayan kelimeler. Her kartta kaç sınavda/kaç kez geçtiği ve şıklarda kaç kez çıktığı yazar.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void handleLoadNewYdsPack()}
              disabled={loadingAction !== null}
            >
              {loadingAction === 'new_yds_pack' ? '⏳ Yükleniyor…' : '📥 Yeni YDS Kelimelerini Yükle'}
            </button>
          </div>

          {/* 60 Günde YDS Kelimeleri (Modadil): telifli kitap, yalnızca yerelde */}
          {import.meta.env.DEV && localPack && (
            <div
              style={{
                padding: '1rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--primary)',
                background: 'var(--primary-subtle)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.75rem',
              }}
            >
              <div style={{ flex: 1, minWidth: '240px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>📘 60 Günde YDS Kelimeleri</span>
                  <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.45rem', borderRadius: '4px', background: 'var(--input-bg)', fontWeight: 600 }}>
                    {localPack.count} Kelime
                  </span>
                  <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.45rem', borderRadius: '4px', background: 'var(--input-bg)', fontWeight: 600 }}>
                    🔒 yalnızca bu bilgisayar
                  </span>
                </div>
                <p className="muted" style={{ margin: '0.2rem 0 0', fontSize: '0.82rem' }}>
                  Modadil (Suat Gürcan &amp; Dirvan Gürbüz) kitabından: 54 günlük kelime kartları (anlam, örnek cümle ve çevirisi, eş/zıt anlamlılar), phrasal
                  verb ve edat kalıpları, son sınavların sık kelimeleri. Telifli olduğu için yayındaki sürümde görünmez.
                </p>
              </div>
              <button type="button" className="btn btn-primary" onClick={() => void handleLoadLocalPack()} disabled={loadingAction !== null}>
                {loadingAction === 'local_pack' ? '⏳ Yükleniyor…' : '📥 Paketi Yükle'}
              </button>
            </div>
          )}

          {/* Özel YDS Akademik Çekirdek, Phrasal Verbs & Bağlaçlar */}
          {ALL_WORD_PACKS.slice(0, 3).map((pack) => (
            <div
              key={pack.id}
              style={{
                padding: '1rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.75rem',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{pack.title}</span>
                  <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.45rem', borderRadius: '4px', background: 'var(--input-bg)', fontWeight: 600 }}>
                    {pack.badge} • {pack.words.length} Kelime
                  </span>
                </div>
                <p className="muted" style={{ margin: '0.2rem 0 0', fontSize: '0.82rem' }}>
                  {pack.description}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => void handleLoadPack(pack)}
                disabled={loadingAction !== null}
              >
                {loadingAction === pack.id ? '⏳ Yükleniyor…' : `📥 ${pack.title} Yükle`}
              </button>
            </div>
          ))}
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
