import { useState, type FormEvent } from 'react'
import type { PartOfSpeech, WordItem } from '../types/database'
import type { CreateWordInput } from '../services/words'
import { extractSentenceWordGlosses } from '../services/dictionary'
import styles from '../pages/Words.module.css'

interface WordModalProps {
  initialWord?: WordItem | null
  onClose: () => void
  onSave: (data: CreateWordInput) => Promise<void>
}

const POS_OPTIONS: Array<{ value: PartOfSpeech; label: string }> = [
  { value: 'verb', label: 'Fiil (Verb)' },
  { value: 'noun', label: 'İsim (Noun)' },
  { value: 'adjective', label: 'Sıfat (Adjective)' },
  { value: 'adverb', label: 'Zarf (Adverb)' },
  { value: 'phrasal_verb', label: 'Phrasal Verb (Deyimsel Fiil)' },
  { value: 'conjunction', label: 'Bağlaç (Conjunction)' },
  { value: 'preposition', label: 'Edat (Preposition)' },
  { value: 'idiom', label: 'Deyim / Kalıp (Idiom)' },
  { value: 'other', label: 'Diğer' },
]

export function WordModal({ initialWord, onClose, onSave }: WordModalProps) {
  const [term, setTerm] = useState(initialWord?.term || '')
  const [definition, setDefinition] = useState(initialWord?.definition || '')
  const [partOfSpeech, setPartOfSpeech] = useState<PartOfSpeech>(initialWord?.partOfSpeech || 'verb')
  const [synonyms, setSynonyms] = useState(initialWord?.synonyms.join(', ') || '')
  const [antonyms, setAntonyms] = useState(initialWord?.antonyms?.join(', ') || '')
  const [collocations, setCollocations] = useState(initialWord?.collocations?.join(', ') || '')
  const [sentenceEn, setSentenceEn] = useState(initialWord?.sentences?.[0]?.en || '')
  const [sentenceTr, setSentenceTr] = useState(initialWord?.sentences?.[0]?.tr || '')
  const [wordGlosses, setWordGlosses] = useState<Record<string, string>>(
    initialWord?.sentences?.[0]?.wordGlosses || {},
  )
  const [extractingGlosses, setExtractingGlosses] = useState(false)
  const [tags, setTags] = useState(initialWord?.tags?.join(', ') || '')
  const [difficulty, setDifficulty] = useState<number>(initialWord?.difficulty ?? 2)
  const [notes, setNotes] = useState(initialWord?.notes || '')
  const [submitting, setSubmitting] = useState(false)

  async function handleAutoExtractGlosses() {
    if (!sentenceEn.trim()) return
    setExtractingGlosses(true)
    try {
      const extracted = await extractSentenceWordGlosses(sentenceEn, sentenceTr)
      setWordGlosses((prev) => ({ ...prev, ...extracted }))
    } finally {
      setExtractingGlosses(false)
    }
  }

  function handleRemoveGloss(word: string) {
    setWordGlosses((prev) => {
      const next = { ...prev }
      delete next[word]
      return next
    })
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!term.trim() || !definition.trim()) return

    setSubmitting(true)
    try {
      await onSave({
        term: term.trim(),
        definition: definition.trim(),
        partOfSpeech,
        synonyms: synonyms.split(/[,;]/).map((s) => s.trim()).filter(Boolean),
        antonyms: antonyms.split(/[,;]/).map((s) => s.trim()).filter(Boolean),
        collocations: collocations.split(/[,;]/).map((c) => c.trim()).filter(Boolean),
        sentences: sentenceEn.trim()
          ? [
              {
                en: sentenceEn.trim(),
                tr: sentenceTr.trim() || undefined,
                wordGlosses: Object.keys(wordGlosses).length > 0 ? wordGlosses : undefined,
              },
            ]
          : [],
        tags: tags.split(/[,;]/).map((t) => t.trim()).filter(Boolean),
        difficulty,
        notes: notes.trim() || undefined,
      })
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.modalBackdrop} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <h2>{initialWord ? 'Kelimeyi Düzenle' : 'Yeni Kelime Ekle'}</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Kapat">
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '0.9rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="field">
              <label htmlFor="word-term">İngilizce Kelime / İfade *</label>
              <input
                id="word-term"
                className="input"
                type="text"
                required
                placeholder="Örn: deteriorate"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                autoFocus={!initialWord}
              />
            </div>

            <div className="field">
              <label htmlFor="word-pos">Kelime Türü</label>
              <select
                id="word-pos"
                className="input"
                value={partOfSpeech}
                onChange={(e) => setPartOfSpeech(e.target.value as PartOfSpeech)}
              >
                {POS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="field">
            <label htmlFor="word-def">Türkçe Anlamı *</label>
            <input
              id="word-def"
              className="input"
              type="text"
              required
              placeholder="Örn: kötüleşmek, bozulmak"
              value={definition}
              onChange={(e) => setDefinition(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="word-syn">Eş Anlamlılar (Synonyms) — Virgülle ayırın</label>
            <input
              id="word-syn"
              className="input"
              type="text"
              placeholder="Örn: worsen, decline, degenerate"
              value={synonyms}
              onChange={(e) => setSynonyms(e.target.value)}
            />
            <span className="hint">YDS'de en çok sorulan alan. Birkaç eş anlamlı eklemeniz önerilir.</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="field">
              <label htmlFor="word-ant">Zıt Anlamlılar (Opsiyonel)</label>
              <input
                id="word-ant"
                className="input"
                type="text"
                placeholder="Örn: improve, recover"
                value={antonyms}
                onChange={(e) => setAntonyms(e.target.value)}
              />
            </div>

            <div className="field">
              <label htmlFor="word-diff">Zorluk Seviyesi</label>
              <select
                id="word-diff"
                className="input"
                value={difficulty}
                onChange={(e) => setDifficulty(Number(e.target.value))}
              >
                <option value={1}>1 - Temel Seviye</option>
                <option value={2}>2 - Orta (YDS Standardı)</option>
                <option value={3}>3 - İleri Seviye (Zor)</option>
              </select>
            </div>
          </div>

          <div className="field">
            <label htmlFor="word-colloc">Birlikte Kullanılan Kalıplar (Collocations)</label>
            <input
              id="word-colloc"
              className="input"
              type="text"
              placeholder="Örn: deteriorate rapidly, health deteriorates"
              value={collocations}
              onChange={(e) => setCollocations(e.target.value)}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.75rem' }}>
            <div className="field">
              <label htmlFor="word-sent-en">Örnek Cümle (İngilizce)</label>
              <input
                id="word-sent-en"
                className="input"
                type="text"
                placeholder="The patient's health began to deteriorate."
                value={sentenceEn}
                onChange={(e) => setSentenceEn(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="word-sent-tr">Cümle Çevirisi (Türkçe)</label>
              <input
                id="word-sent-tr"
                className="input"
                type="text"
                placeholder="Hastanın sağlığı kötüleşmeye başladı."
                value={sentenceTr}
                onChange={(e) => setSentenceTr(e.target.value)}
              />
            </div>
          </div>

          {/* Cümledeki Kelimelerin Anlamları (Glosses) */}
          {sentenceEn.trim() && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.45rem',
                padding: '0.65rem 0.8rem',
                borderRadius: '8px',
                background: 'color-mix(in srgb, var(--input-bg) 60%, transparent)',
                border: '1px solid var(--border)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                  Cümledeki Kelime Anlamları ({Object.keys(wordGlosses).length} kelime)
                </span>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ fontSize: '0.78rem', padding: '0.2rem 0.55rem' }}
                  disabled={extractingGlosses}
                  onClick={handleAutoExtractGlosses}
                  title="Cümledeki her bir kelimenin Türkçe anlamını otomatik bulur ve eşler"
                >
                  {extractingGlosses ? '⏳ Çıkartılıyor…' : '✨ Kelime Anlamlarını Otomatik Çıkar'}
                </button>
              </div>

              {Object.keys(wordGlosses).length > 0 ? (
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.35rem',
                    maxHeight: '120px',
                    overflowY: 'auto',
                  }}
                >
                  {Object.entries(wordGlosses).map(([w, m]) => (
                    <span
                      key={w}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        fontSize: '0.75rem',
                        padding: '0.2rem 0.45rem',
                        borderRadius: '4px',
                        background: 'color-mix(in srgb, var(--primary) 12%, transparent)',
                        border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)',
                      }}
                    >
                      <strong style={{ color: 'var(--primary)' }}>{w}:</strong> <span>{m}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveGloss(w)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--text-muted)',
                          padding: '0 2px',
                          fontWeight: 700,
                        }}
                        title="Sil"
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <span className="hint" style={{ fontSize: '0.75rem', marginTop: 0 }}>
                  Kelime anlamlarını otomatik çıkartarak, çalışma esnasında cümleye tıklandığında anında görünmesini sağlayabilirsiniz.
                </span>
              )}
            </div>
          )}

          <div className="field">
            <label htmlFor="word-tags">Etiketler (Kategoriler)</label>
            <input
              id="word-tags"
              className="input"
              type="text"
              placeholder="Örn: Sağlık, YDS 2023, Akademik"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="word-notes">Kişisel Not / Hatırlatıcı İpucu</label>
            <input
              id="word-notes"
              className="input"
              type="text"
              placeholder="Örn: 'de' eki olumsuzluk katar, terror ile çağrışım"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              İptal
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting || !term.trim() || !definition.trim()}>
              {submitting ? 'Kaydediliyor…' : initialWord ? 'Değişiklikleri Kaydet' : 'Kelimeyi Ekle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
