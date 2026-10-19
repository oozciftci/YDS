import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AiText } from '../../components/AiText'
import { db } from '../../db'
import { aiConfigured, generate } from '../../services/ai'
import { sectionOf } from '../../services/ydsSections'
import styles from '../ExamStudy.module.css'
import type { ExamBundle, Question } from './examData'

// "Neden doğru / neden yanlış?" — Gemini ile Türkçe soru açıklaması. Açıklama soruya özgüdür (tüm şıkları
// kapsar) ve cihazda saklanır; aynı soru için yeniden ücret ödenmez.

const SYSTEM = `Sen deneyimli bir YDS (Yabancı Dil Seviye Tespit Sınavı) İngilizce öğretmenisin.
Öğrenciye Türkçe, sade ve kısa açıklama yap. Biçim:
**Doğru cevap: X)** — neden doğru olduğu (2-3 cümle, cümledeki ipucu kelimeleri tırnakla göster).
**Şıklar:** her şık için tek satırlık madde ("- A) … : neden olmaz / neden olur").
**Sınav ipucu:** bu soru tipini hızlı çözmek için 1-2 cümlelik strateji.
**Önemli kelimeler:** 3-5 kelime/kalıp ve Türkçe anlamı, madde olarak.
Toplam 250 kelimeyi geçme. Emin olmadığın bir şeyi uydurma.`

function buildPrompt(bundle: ExamBundle, q: Question, choice: string | null): string {
  const passage = q.passage ? bundle.exam.passages.find((p) => p.id === q.passage) : undefined
  const section = sectionOf(q.no)
  const lines = [`Sınav: ${bundle.exam.title}, Soru ${q.no} (${section.label}: ${section.hint})`]
  if (passage) lines.push('', 'Paragraf:', passage.sentences.map((s) => s.en).join(' '))
  if (q.stem.length) lines.push('', 'Soru:', q.stem.map((s) => s.en).join(' '))
  lines.push('', 'Şıklar:')
  for (const [l, o] of Object.entries(q.options)) lines.push(`${l}) ${o.en}`)
  lines.push('', `Doğru cevap: ${q.answer}`)
  if (choice && choice !== q.answer) lines.push(`Öğrencinin işaretlediği: ${choice} (yanlış). Bu şıkkın neden yanlış olduğunu özellikle açıkla.`)
  return lines.join('\n')
}

export function AiExplain({ bundle, q, choice }: { bundle: ExamBundle; q: Question; choice: string | null }) {
  const id = `explain:${bundle.exam.id}#${q.no}`
  const [text, setText] = useState<string | null>(null)
  const [meta, setMeta] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    void db.aiNotes.get(id).then((n) => {
      if (alive && n) {
        setText(n.text)
        setMeta(`Kayıtlı açıklama · ${n.model}`)
      }
    })
    return () => {
      alive = false
    }
  }, [id])

  async function run() {
    setLoading(true)
    setError('')
    try {
      const r = await generate(SYSTEM, buildPrompt(bundle, q, choice), 0.3)
      setText(r.text)
      setMeta(`${r.model} · ${r.tier === 'paid' ? `ücretli (~${r.usd.toFixed(4)} $)` : 'ücretsiz katman'}`)
      await db.aiNotes.put({ id, kind: 'explain', text: r.text, model: r.model, createdAt: new Date().toISOString() })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  if (!q.answer) return null

  if (!text) {
    return (
      <div className={styles.aiBox}>
        {aiConfigured() ? (
          <button type="button" className="btn btn-secondary" disabled={loading} onClick={() => void run()}>
            {loading ? '🤖 Açıklama hazırlanıyor…' : '🤖 Yapay zekâ ile açıkla'}
          </button>
        ) : (
          <span className="muted" style={{ fontSize: '0.85rem' }}>
            🤖 Yapay zekâ açıklaması için <Link to="/settings#ai">Ayarlar &gt; Yapay Zekâ</Link>’dan Gemini anahtarını ekle.
          </span>
        )}
        {error && <p className={styles.aiError}>{error}</p>}
      </div>
    )
  }

  return (
    <div className={styles.aiBox}>
      <div className={styles.aiHead}>
        <strong>🤖 Yapay zekâ açıklaması</strong>
        <small className="muted">{meta}</small>
        <span className={styles.spacer} />
        <button type="button" className="btn btn-ghost" disabled={loading} onClick={() => void run()} title="Yeni bir açıklama üret">
          {loading ? '…' : '↻ Yeniden üret'}
        </button>
      </div>
      <AiText text={text} />
      {error && <p className={styles.aiError}>{error}</p>}
      <small className="muted">Yapay zekâ hata yapabilir; resmi cevap anahtarı esastır.</small>
    </div>
  )
}
