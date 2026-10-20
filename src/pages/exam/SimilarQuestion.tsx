import { useState } from 'react'
import { db } from '../../db'
import { aiConfigured, generate } from '../../services/ai'
import { sectionOf } from '../../services/ydsSections'
import styles from '../ExamStudy.module.css'
import type { ExamBundle, Question } from './examData'

// "Benzer soru üret" (7.8): yanlış yapılan sorunun kalıbında YENİ, özgün bir soru yazdırır ve hemen çözdürür.
// Üretilen soru yalnızca bu cihazdaki önbellekte (aiNotes) durur; yayına girmez. Aynı soru için tek sefer ücret çıkar.

interface Generated {
  stem: string
  options: string[]
  answer: number
  why: string
}

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    stem: { type: 'STRING' },
    options: { type: 'ARRAY', items: { type: 'STRING' } },
    answer: { type: 'INTEGER' },
    why: { type: 'STRING' },
  },
  required: ['stem', 'options', 'answer', 'why'],
}

const SYSTEM = [
  'Sen ÖSYM YDS/YÖKDİL tarzı soru yazan bir İngilizce hocasısın.',
  'Öğrencinin yanlış yaptığı sorunun TEST ETTİĞİ dilbilgisi/kelime/anlam kalıbını aynen koru, ama tamamen YENİ bir cümle ve yeni konu yaz; verilen soruyu kopyalama.',
  'Tam 5 şık ver (A-E sırasıyla), yalnızca biri doğru olsun, çeldiriciler kalıbın tipik tuzaklarını yansıtsın. Boşluğu "----" ile göster.',
  'JSON döndür: stem (soru gövdesi, İngilizce), options (5 şık), answer (doğru şıkkın 0-4 sırası), why (Türkçe, 2-3 cümle: doğru cevap neden doğru, çeldiriciler neden yanlış).',
].join('\n')

export function SimilarQuestion({ bundle, q }: { bundle: ExamBundle; q: Question }) {
  const [gen, setGen] = useState<Generated | null>(null)
  const [pick, setPick] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [round, setRound] = useState(0)
  if (!aiConfigured()) return null

  const baseId = `benzer:${bundle.exam.id}#${q.no}`

  async function make(next: number) {
    setBusy(true)
    setError('')
    setPick(null)
    const id = `${baseId}:${next}`
    try {
      const cached = await db.aiNotes.get(id)
      if (cached) {
        setGen(JSON.parse(cached.text) as Generated)
      } else {
        const sec = sectionOf(q.no, bundle.exam.id)
        const stem = q.stem.map((s) => s.en).join(' ')
        const opts = Object.entries(q.options)
          .map(([l, o]) => `${l}) ${o.en}`)
          .join('\n')
        const r = await generate(
          SYSTEM,
          [`Soru tipi: ${sec.label}`, `Yanlış yapılan soru:\n${stem}\n${opts}\nDoğru cevap: ${q.answer}`, next > 0 ? 'Bu kez bir öncekilerden farklı bir konu ve cümle yapısı kullan.' : ''].join('\n'),
          0.8,
          { jsonSchema: SCHEMA },
        )
        const p = JSON.parse(r.text) as Partial<Generated>
        if (!p.stem || !Array.isArray(p.options) || p.options.length !== 5 || typeof p.answer !== 'number' || p.answer < 0 || p.answer > 4) {
          throw new Error('Model geçerli bir soru üretemedi. Tekrar dene.')
        }
        const g: Generated = { stem: p.stem, options: p.options.map(String), answer: p.answer, why: String(p.why ?? '') }
        await db.aiNotes.put({ id, kind: 'benzer', text: JSON.stringify(g), model: r.model, createdAt: new Date().toISOString() })
        setGen(g)
      }
      setRound(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.reasonRow} style={{ display: 'grid', gap: '0.5rem' }}>
      {!gen ? (
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void make(round)}>
          {busy ? 'Soru yazılıyor…' : '✨ Benzer bir soru çöz (yapay zekâ yazar)'}
        </button>
      ) : (
        <div className="card" style={{ display: 'grid', gap: '0.5rem' }}>
          <strong>✨ Benzer soru</strong>
          <p style={{ margin: 0 }}>{gen.stem}</p>
          <div style={{ display: 'grid', gap: '0.3rem' }}>
            {gen.options.map((o, i) => {
              const letter = 'ABCDE'[i]
              const shown = pick !== null
              const cls = shown ? (i === gen.answer ? styles.okText : i === pick ? styles.badText : undefined) : undefined
              return (
                <button
                  key={i}
                  type="button"
                  className="btn btn-ghost"
                  style={{ justifyContent: 'flex-start', textAlign: 'left' }}
                  disabled={shown}
                  onClick={() => setPick(i)}
                >
                  <span className={cls}>
                    {letter}) {o}
                  </span>
                </button>
              )
            })}
          </div>
          {pick !== null && (
            <>
              <span className={pick === gen.answer ? styles.okText : styles.badText}>
                {pick === gen.answer ? '✓ Doğru' : `✗ Yanlış — doğru cevap: ${'ABCDE'[gen.answer]}`}
              </span>
              {gen.why && <p className={styles.grammarLink} style={{ margin: 0 }}>💡 {gen.why}</p>}
              <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void make(round + 1)}>
                {busy ? 'Soru yazılıyor…' : 'Bir tane daha'}
              </button>
            </>
          )}
        </div>
      )}
      {error && <p className={styles.aiError}>{error}</p>}
    </div>
  )
}
