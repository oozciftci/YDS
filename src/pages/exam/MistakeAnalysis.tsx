import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { SourceModeToggle, useSourceMode } from '../../components/SourceModeToggle'
import { aiConfigured } from '../../services/ai'
import { addNotes, listNotes, MEMORY_CATEGORIES } from '../../services/memory'
import { useUserStore } from '../../stores/user'
import styles from '../ExamStudy.module.css'
import { lastAnalysis, MAX_ITEMS, MIN_ITEMS, runAnalysis, wrongAnswers, type AnalysisResult } from './analysis'

// "Hatalarımı analiz et" (yalnızca yerel): son yanlışlardaki tekrar eden kök hatalar, çalışma önerileri,
// uygulama içi bağlantılar ve onaylanınca hafızaya eklenen notlar.

export function MistakeAnalysis() {
  const userId = useUserStore((s) => s.activeUserId)
  const source = useSourceMode()
  const [counts, setCounts] = useState<{ current: number; fixed: number; used: number } | null>(null)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [keep, setKeep] = useState<boolean[]>([])
  const [savedNotes, setSavedNotes] = useState<number | null>(null)
  // Hafızada zaten olan notlar (aynı not ikinci kez eklenmesin)
  const [existing, setExisting] = useState<Set<string>>(new Set())

  async function refreshExisting(notes: { text: string }[]) {
    const have = new Set((await listNotes(userId)).map((n) => n.text.trim()))
    setExisting(have)
    setKeep(notes.map((n) => !have.has(n.text.trim())))
  }

  useEffect(() => {
    let alive = true
    void Promise.all([wrongAnswers(userId), lastAnalysis()]).then(([w, last]) => {
      if (!alive) return
      setCounts({ current: w.currentCount, fixed: w.fixedCount, used: w.items.length })
      if (last) {
        setResult(last)
        void refreshExisting(last.notes)
      }
    })
    return () => {
      alive = false
    }
    // refreshExisting yalnızca userId’ye bağlı; kullanıcı değişince yeniden yüklenir
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  async function run() {
    setLoading(true)
    setError('')
    setSavedNotes(null)
    try {
      const r = await runAnalysis(userId, { koc: source.effective === 'koc' })
      setResult(r)
      await refreshExisting(r.notes)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  async function saveNotes() {
    if (!result) return
    const chosen = result.notes.filter((n, i) => keep[i] && !existing.has(n.text.trim()))
    await addNotes(userId, chosen, 'analysis')
    setSavedNotes(chosen.length)
    await refreshExisting(result.notes)
  }

  const enough = (counts?.used ?? 0) >= MIN_ITEMS

  return (
    <section className={styles.page}>
      <header className={styles.head}>
        <div>
          <Link to="/yds-sorular" className={styles.backLink}>
            ← Soru Merkezi
          </Link>
          <h1 className={styles.title}>🔍 Hatalarımı analiz et</h1>
          <p className="muted" style={{ margin: 0, fontSize: '0.88rem' }}>
            Son yanlışlarındaki tekrar eden kök hataları bulur, ne çalışman gerektiğini söyler ve seni ilgili alıştırmaya
            götürür. Yanlışların ve hafıza notların Gemini’ye gönderilir (bir analiz ≈ 0,01 $).
          </p>
        </div>
      </header>

      <article className="card" style={{ display: 'grid', gap: '0.6rem' }}>
        {!counts ? (
          <p className="muted" style={{ margin: 0 }}>
            Hazırlanıyor…
          </p>
        ) : (
          <p style={{ margin: 0 }}>
            Analize girecek: <strong>{counts.used}</strong> soru (en fazla {MAX_ITEMS}; hâlâ yanlış {counts.current}, sonradan düzelttiğin{' '}
            {counts.fixed}).
          </p>
        )}
        {counts && !enough && (
          <p className="muted" style={{ margin: 0 }}>
            Anlamlı bir analiz için en az {MIN_ITEMS} yanlış gerekiyor. Biraz daha soru çöz: <Link to="/yds-sorular">Soru Merkezi</Link>.
          </p>
        )}
        <div className={styles.actions} style={{ marginTop: 0 }}>
          {aiConfigured() ? (
            <button type="button" className="btn btn-primary" disabled={loading || !enough} onClick={() => void run()}>
              {loading ? '🔍 Analiz ediliyor…' : result ? '↻ Yeniden analiz et' : '🔍 Analizi başlat'}
            </button>
          ) : (
            <span className="muted">
              Önce <Link to="/settings#ai">Ayarlar &gt; Yapay Zekâ</Link>’dan Gemini anahtarını ekle.
            </span>
          )}
          <SourceModeToggle mode={source.mode} available={source.available} onChange={source.setMode} />
        </div>
        {error && <p className={styles.aiError}>{error}</p>}
      </article>

      {result && (
        <>
          <article className="card" style={{ display: 'grid', gap: '0.4rem' }}>
            <h2 className={styles.blockTitle}>Genel tablo</h2>
            <p style={{ margin: 0, lineHeight: 1.6 }}>{result.summary}</p>
            <small className="muted">
              {new Date(result.createdAt).toLocaleString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })} ·{' '}
              {result.itemCount} soru · {result.meta}
            </small>
          </article>

          {result.patterns.map((p, i) => (
            <article key={i} className={`card ${styles.pattern}`}>
              <h2 className={styles.blockTitle}>
                {i + 1}. {p.title}
              </h2>
              <p>{p.explanation}</p>
              {p.evidence && (
                <p className="muted" style={{ fontSize: '0.84rem' }}>
                  🔎 Örnekler: {p.evidence}
                </p>
              )}
              <p className={styles.patternAdvice}>✅ {p.advice}</p>
              {p.links.length > 0 && (
                <div className={styles.actions} style={{ marginTop: 0 }}>
                  {p.links.map((l) => (
                    <Link key={l.href} to={l.href} className="btn btn-secondary">
                      {l.label} →
                    </Link>
                  ))}
                </div>
              )}
            </article>
          ))}

          {result.notes.length > 0 && (
            <article className="card" style={{ display: 'grid', gap: '0.5rem' }}>
              <h2 className={styles.blockTitle}>🧠 Hafızaya eklenebilecek notlar</h2>
              <p className="muted" style={{ margin: 0, fontSize: '0.84rem' }}>
                Onayladıkların koçun ve “beni tanıyarak açıkla”nın bağlamına girer. İstemediğinin işaretini kaldır.
              </p>
              <ul className={styles.ruleList}>
                {result.notes.map((n, i) => (
                  <li key={i} className={styles.ruleRow}>
                    <input
                      type="checkbox"
                      disabled={existing.has(n.text.trim())}
                      checked={keep[i] ?? false}
                      onChange={(e) => setKeep((k) => k.map((v, j) => (j === i ? e.target.checked : v)))}
                      aria-label="Bu notu kaydet"
                    />
                    <span className={styles.ruleText}>
                      {n.text}
                      <small className="muted">
                        {MEMORY_CATEGORIES[n.category]?.icon} {MEMORY_CATEGORIES[n.category]?.label}
                        {existing.has(n.text.trim()) && ' · ✓ zaten hafızada'}
                      </small>
                    </span>
                  </li>
                ))}
              </ul>
              <div className={styles.actions} style={{ marginTop: 0 }}>
                <button type="button" className="btn btn-secondary" disabled={savedNotes !== null || !keep.some(Boolean)} onClick={() => void saveNotes()}>
                  {savedNotes !== null ? `✓ ${savedNotes} not eklendi` : 'Seçilenleri hafızaya kaydet'}
                </button>
                {savedNotes !== null && <Link to="/koc/hafiza">Hafızam →</Link>}
              </div>
            </article>
          )}
        </>
      )}
    </section>
  )
}
