import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../db'
import { aiConfigured, generate } from '../services/ai'
import { useUserStore } from '../stores/user'
import styles from './ExamStudy.module.css'
import { useSwipeNav } from '../hooks/useSwipeNav'

// Çeviri atölyesi (7.7): özgün cümleyi kendin çevir, yapay zekâ örnek çeviriyle karşılaştırıp puanlasın.
// Sonuç aynı çeviri için cihazda önbelleğe alınır (aynı metin için ikinci kez ücret çıkmaz).

interface Sentence {
  id: string
  dir: 'en-tr' | 'tr-en'
  src: string
  ref: string
  focus: string
}
interface Grade {
  score: number
  good: string
  issues: string
  better: string
}

type Dir = 'all' | 'en-tr' | 'tr-en'
const progressKey = (userId: string) => `yds-ceviri:${userId}`
function readProgress(userId: string): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(progressKey(userId)) || '{}') as Record<string, number>
  } catch {
    return {}
  }
}

/** Kısa, kararlı özet (önbellek anahtarı için). */
function hash(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    score: { type: 'NUMBER' },
    good: { type: 'STRING' },
    issues: { type: 'STRING' },
    better: { type: 'STRING' },
  },
  required: ['score', 'good', 'issues', 'better'],
}

const SYSTEM = [
  'Sen YDS/YÖKDİL çeviri sorularına hazırlanan bir öğrencinin çeviri hocasısın. Öğrencinin çevirisini örnek çeviriyle karşılaştır.',
  'Kelimesi kelimesine aynı olması gerekmez; ANLAM tam ve doğru aktarılıyorsa yüksek puan ver. Yapı hatalarını (zaman, edilgen/etken, bağlaç, olumsuzluk, özne-nesne) özellikle yakala.',
  'Yanıtı JSON olarak ver: score (0-10 arası tam sayı), good (iyi yaptığı şey, 1 cümle, Türkçe), issues (hatalar ve nedenleri, kısa, Türkçe; hata yoksa "Belirgin hata yok."), better (öğrencinin cümlesini düzelten doğal bir çeviri, hedef dilde).',
].join('\n')

export function TranslationWorkshop() {
  const userId = useUserStore((s) => s.activeUserId)
  const [all, setAll] = useState<Sentence[] | null>(null)
  const [dir, setDir] = useState<Dir>('all')
  const [idx, setIdx] = useState(0)
  const [text, setText] = useState('')
  const [grade, setGrade] = useState<Grade | null>(null)
  const [showRef, setShowRef] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState(() => readProgress(userId))

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/ozgun/ceviri_cumleleri.json`)
      .then((r) => (r.ok ? (r.json() as Promise<Sentence[]>) : []))
      .then(setAll)
      .catch(() => setAll([]))
  }, [])

  const list = useMemo(() => (all ?? []).filter((s) => dir === 'all' || s.dir === dir), [all, dir])
  const cur = list[idx % Math.max(1, list.length)]

  function go(next: number) {
    setIdx(next)
    setText('')
    setGrade(null)
    setShowRef(false)
    setError('')
  }

  async function submit() {
    if (!cur || !text.trim()) return
    setBusy(true)
    setError('')
    const id = `ceviri:${cur.id}:${hash(text.trim())}`
    try {
      let g: Grade | null = null
      const cached = await db.aiNotes.get(id)
      if (cached) g = JSON.parse(cached.text) as Grade
      if (!g) {
        const r = await generate(
          SYSTEM,
          [
            `Yön: ${cur.dir === 'en-tr' ? 'İngilizce → Türkçe' : 'Türkçe → İngilizce'}`,
            `Kaynak cümle: ${cur.src}`,
            `Örnek çeviri: ${cur.ref}`,
            `Öğrencinin çevirisi: ${text.trim()}`,
          ].join('\n'),
          0.2,
          { jsonSchema: SCHEMA },
        )
        const parsed = JSON.parse(r.text) as Partial<Grade>
        g = {
          score: Math.max(0, Math.min(10, Math.round(Number(parsed.score) || 0))),
          good: String(parsed.good ?? ''),
          issues: String(parsed.issues ?? ''),
          better: String(parsed.better ?? ''),
        }
        await db.aiNotes.put({ id, kind: 'ceviri', text: JSON.stringify(g), model: r.model, createdAt: new Date().toISOString() })
      }
      setGrade(g)
      const next = { ...progress, [cur.id]: Math.max(progress[cur.id] ?? 0, g.score) }
      setProgress(next)
      try {
        localStorage.setItem(progressKey(userId), JSON.stringify(next))
      } catch {
        // Depo kapalıysa ilerleme yalnızca bu oturumda görünür
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const done = Object.keys(progress).length
  // Kaydırarak önceki / sonraki cümle (yazı alanında kaydırma çalışmaz)
  const swipe = useSwipeNav({
    onPrev: () => go((idx - 1 + list.length) % Math.max(1, list.length)),
    onNext: () => go((idx + 1) % Math.max(1, list.length)),
    enabled: list.length > 1,
  })

  return (
    <section className={styles.page} {...swipe.props}>
      <header className={styles.head}>
        <div>
          <Link to="/yds-test" className={styles.backLink}>
            ← Alıştırma Merkezi
          </Link>
          <h1 className={styles.title}>🔁 Çeviri Atölyesi</h1>
          <p className="muted" style={{ margin: 0, fontSize: '0.88rem' }}>
            Cümleyi kendin çevir; yapay zekâ örnek çeviriyle karşılaştırıp 10 üzerinden puanlasın ve hatalarını söylesin. Aynı çeviri için sonuç
            cihazında saklanır (tekrar ücret çıkmaz). {done > 0 && `${done} cümleyi denedin.`}
          </p>
        </div>
      </header>

      {!all ? (
        <p className="muted">Hazırlanıyor…</p>
      ) : !cur ? (
        <p className="muted">Cümleler yüklenemedi. Bağlantını kontrol edip sayfayı yenile.</p>
      ) : (
        <>
          <div className={styles.poolBar}>
            {(
              [
                ['all', 'Tümü'],
                ['en-tr', 'İngilizce → Türkçe'],
                ['tr-en', 'Türkçe → İngilizce'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                className={`${styles.poolChip} ${dir === k ? styles.poolOn : ''}`}
                onClick={() => {
                  setDir(k)
                  go(0)
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <article className="card" style={{ display: 'grid', gap: '0.7rem' }} data-focus-stage>
            <div className="muted" style={{ fontSize: '0.82rem' }}>
              Cümle {(idx % list.length) + 1} / {list.length} · {cur.dir === 'en-tr' ? 'İngilizce → Türkçe' : 'Türkçe → İngilizce'}
              {progress[cur.id] !== undefined && ` · en iyi puanın ${progress[cur.id]}/10`}
            </div>
            <p style={{ margin: 0, fontSize: '1.05rem', lineHeight: 1.55 }}>{cur.src}</p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              placeholder={cur.dir === 'en-tr' ? 'Türkçe çevirini yaz…' : 'İngilizce çevirini yaz…'}
              style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', font: 'inherit' }}
            />
            <div className={styles.actions} style={{ marginTop: 0 }}>
              {aiConfigured() ? (
                <button type="button" className="btn btn-primary" disabled={busy || !text.trim()} onClick={() => void submit()}>
                  {busy ? 'Puanlanıyor…' : 'Puanla'}
                </button>
              ) : (
                <span className="muted">
                  Puanlama için önce <Link to="/settings#ai">Ayarlar &gt; Yapay Zekâ</Link>’dan Gemini anahtarını ekle.
                </span>
              )}
              <button type="button" className="btn btn-ghost" onClick={() => setShowRef((v) => !v)}>
                {showRef ? 'Örnek çeviriyi gizle' : 'Örnek çeviriyi göster'}
              </button>
              <span className={styles.spacer} />
              <button type="button" className="btn btn-secondary" onClick={() => go((idx + 1) % list.length)}>
                Sonraki cümle →
              </button>
            </div>
            {showRef && (
              <p className={styles.grammarLink} style={{ margin: 0 }}>
                <strong>Örnek çeviri:</strong> {cur.ref}
                <br />
                <small>💡 Dikkat: {cur.focus}</small>
              </p>
            )}
            {error && <p className={styles.aiError}>{error}</p>}
          </article>

          {grade && (
            <article className="card" style={{ display: 'grid', gap: '0.4rem' }}>
              <h2 className={styles.blockTitle}>
                Puanın: <span className={grade.score >= 7 ? styles.okText : grade.score >= 4 ? undefined : styles.badText}>{grade.score}/10</span>
              </h2>
              {grade.good && <p style={{ margin: 0 }}>✅ {grade.good}</p>}
              {grade.issues && <p style={{ margin: 0 }}>⚠️ {grade.issues}</p>}
              {grade.better && (
                <p style={{ margin: 0 }}>
                  ✍️ <strong>Düzeltilmiş çeviri:</strong> {grade.better}
                </p>
              )}
            </article>
          )}
        </>
      )}
    </section>
  )
}
