import { useState, useMemo, type ChangeEvent } from 'react'
import {
  AI_PROMPT_TEMPLATE,
  parseCsvText,
  parsePastedText,
} from '../services/importer'
import type { CreateWordInput } from '../services/words'
import styles from '../pages/Words.module.css'

interface BulkImportModalProps {
  onClose: () => void
  onImport: (items: CreateWordInput[]) => Promise<{ addedCount: number; skippedCount: number }>
}

export function BulkImportModal({ onClose, onImport }: BulkImportModalProps) {
  const [activeTab, setActiveTab] = useState<'paste' | 'csv' | 'prompt'>('paste')
  const [pastedText, setPastedText] = useState('')
  const [csvContent, setCsvContent] = useState('')
  const [csvFileName, setCsvFileName] = useState('')
  const [copiedPrompt, setCopiedPrompt] = useState(false)
  const [importing, setImporting] = useState(false)
  const [resultMsg, setResultMsg] = useState<string | null>(null)

  // Metin sekmesinde ayrıştırılan kelimeler
  const parsedFromText = useMemo(() => {
    return parsePastedText(pastedText)
  }, [pastedText])

  // CSV sekmesinde ayrıştırılan kelimeler
  const parsedFromCsv = useMemo(() => {
    return parseCsvText(csvContent)
  }, [csvContent])

  const currentParsed = activeTab === 'paste' ? parsedFromText : parsedFromCsv

  async function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCsvFileName(file.name)
    const text = await file.text()
    setCsvContent(text)
  }

  async function handleExecuteImport() {
    if (currentParsed.length === 0) return
    setImporting(true)
    setResultMsg(null)
    try {
      const res = await onImport(currentParsed)
      setResultMsg(`✓ ${res.addedCount} yeni kelime eklendi. (${res.skippedCount} mükerrer kelime atlandı)`)
      setTimeout(() => {
        onClose()
      }, 1800)
    } catch (err) {
      setResultMsg(`Hata: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setImporting(false)
    }
  }

  function handleCopyPrompt() {
    void navigator.clipboard.writeText(AI_PROMPT_TEMPLATE)
    setCopiedPrompt(true)
    setTimeout(() => setCopiedPrompt(false), 2000)
  }

  return (
    <div className={styles.modalBackdrop} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <h2>Toplu Kelime İçe Aktarma</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Kapat">
            &times;
          </button>
        </div>

        {/* Sekmeler */}
        <div className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'paste' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('paste')}
          >
            📋 Metin Yapıştır
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'csv' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('csv')}
          >
            📁 CSV / Excel Dosyası
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'prompt' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('prompt')}
          >
            🤖 Yapay Zeka (AI) İstem Şablonu
          </button>
        </div>

        {/* TAB 1: METİN YAPIŞTIR */}
        {activeTab === 'paste' && (
          <div style={{ display: 'grid', gap: '0.8rem' }}>
            <p className="muted" style={{ fontSize: '0.82rem', margin: 0 }}>
              AI'dan aldığınız JSON dizisini veya her satıra{' '}
              <code>kelime = anlam | eş anlamlılar | tür</code> şeklinde hazırladığınız listeyi yapıştırın:
            </p>
            <textarea
              className={styles.textarea}
              placeholder={`Örnek Formatlar:\ndeteriorate = kötüleşmek, bozulmak | worsen, decline | verb | Sağlık\nabolish = yürürlükten kaldırmak | terminate, eliminate | verb\n\nveya doğrudan AI'ın ürettiği JSON dizisi: [...]`}
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
            />

            {parsedFromText.length > 0 && (
              <div style={{ fontSize: '0.85rem', color: 'var(--success)', fontWeight: 600 }}>
                ✓ {parsedFromText.length} kelime başarıyla ayrıştırıldı.
              </div>
            )}
          </div>
        )}

        {/* TAB 2: CSV / EXCEL */}
        {activeTab === 'csv' && (
          <div style={{ display: 'grid', gap: '0.8rem' }}>
            <p className="muted" style={{ fontSize: '0.82rem', margin: 0 }}>
              Sütunlarında <code>term, definition, partOfSpeech, synonyms</code> başlıkları olan bir CSV dosyası seçin:
            </p>
            <label className="btn" style={{ cursor: 'pointer', textAlign: 'center' }}>
              📁 CSV Dosyası Seç {csvFileName && `(${csvFileName})`}
              <input
                type="file"
                accept=".csv,.tsv,.txt"
                onChange={(e) => void handleFileSelect(e)}
                style={{ display: 'none' }}
              />
            </label>

            {parsedFromCsv.length > 0 && (
              <div style={{ fontSize: '0.85rem', color: 'var(--success)', fontWeight: 600 }}>
                ✓ Dosyadan {parsedFromCsv.length} kelime başarıyla ayrıştırıldı.
              </div>
            )}
          </div>
        )}

        {/* TAB 3: AI PROMPT ŞABLONU */}
        {activeTab === 'prompt' && (
          <div style={{ display: 'grid', gap: '0.8rem' }}>
            <p className="muted" style={{ fontSize: '0.82rem', margin: 0 }}>
              Bu metni kopyalayıp ChatGPT veya Claude'a verin. Ürettiği JSON listesini doğrudan{' '}
              <strong>"Metin Yapıştır"</strong> sekmesine yapıştırabilirsiniz:
            </p>
            <div className={styles.promptBox}>{AI_PROMPT_TEMPLATE}</div>
            <button type="button" className="btn btn-primary" onClick={handleCopyPrompt}>
              {copiedPrompt ? '✓ İstem Kopyalandı!' : '📋 İstemi Kopyala'}
            </button>
          </div>
        )}

        {/* Sonuç Bildirimi */}
        {resultMsg && (
          <div
            role="status"
            aria-live="polite"
            style={{
              padding: '0.6rem 0.8rem',
              borderRadius: '8px',
              backgroundColor: resultMsg.startsWith('✓')
                ? 'color-mix(in srgb, var(--success) 15%, transparent)'
                : 'color-mix(in srgb, var(--danger) 15%, transparent)',
              color: resultMsg.startsWith('✓') ? 'var(--success)' : 'var(--danger)',
              fontWeight: 600,
              fontSize: '0.85rem',
            }}
          >
            {resultMsg}
          </div>
        )}

        {/* Alt Butonlar */}
        {activeTab !== 'prompt' && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              İptal
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={importing || currentParsed.length === 0}
              onClick={() => void handleExecuteImport()}
            >
              {importing
                ? 'İçe Aktarılıyor…'
                : currentParsed.length > 0
                  ? `${currentParsed.length} Kelimeyi İçe Aktar`
                  : 'İçe Aktar'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
