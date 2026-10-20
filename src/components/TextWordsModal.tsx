import { useEffect, useMemo, useState } from 'react'
import { db } from '../db'
import { ALL_WORD_PACKS } from '../data/wordPacks'
import { bulkCreateWords, type CreateWordInput } from '../services/words'
import { extractWordsFromText, isBasicLevel, type TextWordsResult } from '../services/textWords'
import styles from '../pages/Words.module.css'

interface Props {
  activeUserId: string
  onClose: () => void
  onSuccess: () => void
}

const DICT_FILES = ['oxford3000_tr', 'yeni_yds_kelimeleri', 'yokdil_fen', 'yokdil_saglik', 'yokdil_sosyal']

let dictCache: Promise<CreateWordInput[]> | null = null
function loadDict(): Promise<CreateWordInput[]> {
  dictCache ??= Promise.all(
    DICT_FILES.map((f) =>
      fetch(`${import.meta.env.BASE_URL}data/${f}.json`)
        .then((r) => (r.ok ? (r.json() as Promise<CreateWordInput[]>) : []))
        .catch(() => [] as CreateWordInput[]),
    ),
  ).then((parts) => [...ALL_WORD_PACKS.flatMap((p) => p.words), ...parts.flat()])
  return dictCache
}

/** Bir metni (makale, soru, ders notu) yapıştır: havuzunda olmayan sınav kelimelerini bulur, seçtiklerini ekler. */
export function TextWordsModal({ activeUserId, onClose, onSuccess }: Props) {
  const [text, setText] = useState('')
  const [result, setResult] = useState<TextWordsResult | null>(null)
  const [hideBasic, setHideBasic] = useState(true)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    void loadDict()
  }, [])

  async function analyse() {
    setBusy(true)
    setMsg('')
    try {
      const [dict, mine] = await Promise.all([loadDict(), db.words.where('userId').equals(activeUserId).filter((w) => !w.isDeleted).toArray()])
      const r = extractWordsFromText(text, dict, new Set(mine.map((w) => w.term.toLowerCase().trim())))
      setResult(r)
      setPicked(new Set(r.found.filter((f) => !isBasicLevel(f.word.tags)).slice(0, 40).map((f) => f.word.term)))
    } finally {
      setBusy(false)
    }
  }

  const shown = useMemo(() => (result?.found ?? []).filter((f) => !hideBasic || !isBasicLevel(f.word.tags)), [result, hideBasic])

  async function add() {
    const items = (result?.found ?? []).filter((f) => picked.has(f.word.term)).map((f) => f.word)
    if (!items.length) return
    setBusy(true)
    try {
      const r = await bulkCreateWords(activeUserId, items)
      setMsg(`✓ ${r.addedCount} kelime havuzuna eklendi.`)
      onSuccess()
    } catch (e) {
      setMsg(`Hata: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.modalBackdrop} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '720px', maxHeight: '92vh', overflowY: 'auto' }}>
        <div className={styles.modalHead}>
          <div>
            <h2>📄 Metinden Kelime Çıkar</h2>
            <p className="muted" style={{ margin: '0.2rem 0 0', fontSize: '0.85rem' }}>
              Bir İngilizce metin yapıştır; havuzunda olmayan sınav kelimelerini (sınav sıklığına göre sıralı) bulup eklemeni sağlar.
            </p>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Kapat">
            &times;
          </button>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={7}
          placeholder="İngilizce metni buraya yapıştır…"
          style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', font: 'inherit' }}
        />
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', margin: '0.6rem 0' }}>
          <button type="button" className="btn btn-primary" disabled={busy || text.trim().length < 20} onClick={() => void analyse()}>
            {busy && !result ? 'Aranıyor…' : 'Kelimeleri bul'}
          </button>
          {result && (
            <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', fontSize: '0.88rem' }}>
              <input type="checkbox" checked={hideBasic} onChange={(e) => setHideBasic(e.target.checked)} />
              Basit (A1-A2) kelimeleri gizle
            </label>
          )}
        </div>

        {result && (
          <>
            <p className="muted" style={{ margin: '0 0 0.5rem', fontSize: '0.86rem' }}>
              {result.found.length} yeni kelime bulundu ({result.owned} tanesi zaten havuzunda{result.unknown > 0 && `, ${result.unknown} sözcük sözlükte yok`}).
            </p>
            {shown.length === 0 ? (
              <p>Bu metinde eklenecek yeni kelime çıkmadı.</p>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.3rem', maxHeight: '45vh', overflowY: 'auto' }}>
                {shown.map(({ word, count }) => {
                  const freq = (word.tags ?? []).find((t) => /Çok-Sık|Sık|Ara/.test(t) && /^(YDS|YÖKDİL)/.test(t))
                  return (
                    <li key={word.term} style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline' }}>
                      <input
                        type="checkbox"
                        checked={picked.has(word.term)}
                        onChange={(e) =>
                          setPicked((s) => {
                            const n = new Set(s)
                            if (e.target.checked) n.add(word.term)
                            else n.delete(word.term)
                            return n
                          })
                        }
                        aria-label={`${word.term} ekle`}
                      />
                      <span>
                        <strong>{word.term}</strong> — {word.definition}
                        <small className="muted">
                          {' '}
                          · metinde {count}×{freq ? ` · ${freq}` : ''}
                        </small>
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
            <div style={{ marginTop: '0.7rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button type="button" className="btn btn-primary" disabled={busy || picked.size === 0} onClick={() => void add()}>
                Seçilen {picked.size} kelimeyi ekle
              </button>
              {msg && <span>{msg}</span>}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
