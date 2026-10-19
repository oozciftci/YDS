import { useState, useMemo, type ChangeEvent } from 'react'
import {
  AI_PROMPT_TEMPLATE,
  parseCsvText,
  parsePastedText,
} from '../services/importer'
import type { CreateWordInput } from '../services/words'
import { downloadText, isAnkiText, parseAnkiText, wordsToAnki, wordsToCsv } from '../services/exchange'
import type { CardState, WordItem } from '../types/database'
import styles from '../pages/Words.module.css'

interface BulkImportModalProps {
  onClose: () => void
  onImport: (items: CreateWordInput[]) => Promise<{ addedCount: number; skippedCount: number }>
  onOpenPacks?: () => void
  /** Dışa aktarma için: tüm havuz, şu anki filtrenin sonucu ve kart durumları. */
  allWords?: WordItem[]
  filteredWords?: WordItem[]
  cardMap?: Map<string, CardState>
}

export function BulkImportModal({ onClose, onImport, onOpenPacks, allWords, filteredWords, cardMap }: BulkImportModalProps) {
  const [activeTab, setActiveTab] = useState<'paste' | 'csv' | 'prompt' | 'export'>('paste')
  const [swapOverride, setSwapOverride] = useState<boolean | undefined>(undefined)
  const [exportScope, setExportScope] = useState<'all' | 'filtered'>('all')
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

  // Dosya sekmesi: Anki "Notes in Plain Text" dosyası kendiliğinden tanınır, değilse CSV okunur
  const isAnki = useMemo(() => isAnkiText(csvContent), [csvContent])
  const ankiResult = useMemo(() => (isAnki ? parseAnkiText(csvContent, swapOverride) : null), [isAnki, csvContent, swapOverride])
  const parsedFromCsv = useMemo(() => {
    return ankiResult ? ankiResult.items : parseCsvText(csvContent)
  }, [ankiResult, csvContent])

  const currentParsed = activeTab === 'paste' ? parsedFromText : parsedFromCsv

  async function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCsvFileName(file.name)
    setSwapOverride(undefined)
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

  const exportList = (exportScope === 'filtered' ? filteredWords : allWords) ?? []

  function handleExport(kind: 'csv' | 'anki') {
    if (exportList.length === 0) return
    const stamp = new Date().toISOString().slice(0, 10)
    if (kind === 'csv') {
      downloadText(wordsToCsv(exportList, cardMap ?? new Map()), `yds_kelimeler_${stamp}.csv`, 'text/csv;charset=utf-8')
    } else {
      downloadText(wordsToAnki(exportList), `yds_kelimeler_anki_${stamp}.txt`, 'text/plain;charset=utf-8')
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
          <h2>Kelime İçe / Dışa Aktarma</h2>
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
            📁 Dosya (CSV / Anki)
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'prompt' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('prompt')}
          >
            🤖 Yapay Zeka (AI) İstem Şablonu
          </button>
          {allWords && (
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === 'export' ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab('export')}
            >
              📤 Dışa Aktar
            </button>
          )}
          {onOpenPacks && (
            <button
              type="button"
              className={styles.tabBtn}
              onClick={() => {
                onClose()
                onOpenPacks()
              }}
              style={{ color: 'var(--primary)', marginLeft: 'auto', fontWeight: 700 }}
              title="Doğrudan yüklenebilecek hazır seviye ve YDS paketleri"
            >
              📦 Hazır Paketleri İncele ➔
            </button>
          )}
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
              <strong>CSV / Excel:</strong> sütunlarında <code>term, definition, partOfSpeech, synonyms</code> başlıkları
              olan (ya da ilk iki sütunu kelime ve anlam olan) bir dosya. <strong>Anki:</strong> Anki’de Dosya &gt; Dışa
              Aktar &gt; “Notes in Plain Text” ile alınan .txt dosyası; kendiliğinden tanınır.
            </p>
            <label className="btn" style={{ cursor: 'pointer', textAlign: 'center' }}>
              📁 Dosya Seç {csvFileName && `(${csvFileName})`}
              <input
                type="file"
                accept=".csv,.tsv,.txt"
                onChange={(e) => void handleFileSelect(e)}
                style={{ display: 'none' }}
              />
            </label>

            {ankiResult && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', fontSize: '0.85rem' }}>
                <span>
                  🗂️ Anki dosyası ·{' '}
                  {ankiResult.swapped
                    ? 'ön yüz Türkçe görünüyor, kelime arka yüzden alındı'
                    : 'ön yüz kelime, arka yüz anlam olarak alındı'}
                </span>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={ankiResult.swapped}
                    onChange={(e) => setSwapOverride(e.target.checked)}
                  />
                  Ön ve arka yüzü değiştir
                </label>
              </div>
            )}

            {parsedFromCsv.length > 0 && (
              <>
                <div style={{ fontSize: '0.85rem', color: 'var(--success)', fontWeight: 600 }}>
                  ✓ Dosyadan {parsedFromCsv.length} kelime ayrıştırıldı. İlk birkaçı:
                </div>
                <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.85rem', display: 'grid', gap: '0.2rem' }}>
                  {parsedFromCsv.slice(0, 5).map((w, i) => (
                    <li key={i}>
                      <strong>{w.term}</strong> — {w.definition}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {csvContent && parsedFromCsv.length === 0 && (
              <div style={{ fontSize: '0.85rem', color: 'var(--danger)' }}>
                Dosyada kelime bulunamadı. İlk iki sütunun kelime ve anlam olduğundan emin ol.
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

        {/* TAB 4: DIŞA AKTAR */}
        {activeTab === 'export' && allWords && (
          <div style={{ display: 'grid', gap: '0.9rem' }}>
            <p className="muted" style={{ fontSize: '0.82rem', margin: 0 }}>
              Kelimelerini yedeklemek, Excel’de düzenlemek ya da Anki’de çalışmak için indir. CSV dosyası bu pencereden geri
              yüklenebilir.
            </p>
            {filteredWords && filteredWords.length !== allWords.length && (
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.88rem' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}>
                  <input type="radio" checked={exportScope === 'all'} onChange={() => setExportScope('all')} />
                  Tüm havuz ({allWords.length})
                </label>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}>
                  <input type="radio" checked={exportScope === 'filtered'} onChange={() => setExportScope('filtered')} />
                  Yalnızca şu anki filtre ({filteredWords.length})
                </label>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
              <button type="button" className="btn btn-primary" disabled={!exportList.length} onClick={() => handleExport('csv')}>
                📊 CSV (Excel) indir · {exportList.length} kelime
              </button>
              <button type="button" className="btn btn-secondary" disabled={!exportList.length} onClick={() => handleExport('anki')}>
                🗂️ Anki dosyası indir
              </button>
            </div>
            <ul className="muted" style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.8rem', display: 'grid', gap: '0.25rem' }}>
              <li>CSV: anlam, tür, eş/zıt anlamlılar, örnek cümle, etiketler, not ve öğrenme puanı sütunları; Türkçe Excel’de doğrudan açılır.</li>
              <li>Anki: Anki’de Dosya &gt; İçe Aktar ile seç, not türü “Basic” olsun. Ön yüz kelime; arka yüz anlam, eş anlamlılar ve örnek cümle.</li>
              <li>Öğrenme geçmişi (FSRS) Anki’ye aktarılmaz; Anki kartları yeni olarak başlar.</li>
            </ul>
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
        {activeTab !== 'prompt' && activeTab !== 'export' && (
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
