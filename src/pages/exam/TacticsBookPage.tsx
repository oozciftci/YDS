import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { GRAMMAR_TOPICS } from '../../data/grammar'
import { loadSourceMap, loadTactics, saveTactics, type SourceMap, type TacticRule } from '../../services/tactics'
import { YDS_SECTIONS, type SectionKey } from '../../services/ydsSections'
import styles from '../ExamStudy.module.css'

// Taktik Kitabı (yalnızca yerel): hocaların kitaplarından çıkarılan kuralları görüntüleme ve düzeltme.
// Kurallar local-data/kaynaklar/taktik-kitabi.json'da; kaydederken önceki sürüm .bak.json olarak saklanır.

function RuleEditor({
  rule,
  map,
  onSave,
  onCancel,
}: {
  rule: TacticRule
  map: SourceMap
  onSave: (r: TacticRule) => void
  onCancel: () => void
}) {
  const [r, setR] = useState(rule)
  return (
    <div className={styles.ruleEdit}>
      <textarea
        className={styles.aiInput}
        rows={3}
        value={r.text}
        placeholder="Kural (Türkçe, kısa ve uygulanabilir)"
        onChange={(e) => setR({ ...r, text: e.target.value })}
      />
      <input
        className={styles.aiInput}
        value={r.example ?? ''}
        placeholder="İsteğe bağlı İngilizce örnek"
        onChange={(e) => setR({ ...r, example: e.target.value || undefined })}
      />
      <div className={styles.ruleFields}>
        <select
          className={styles.examSelect}
          value={r.section ?? ''}
          onChange={(e) => setR({ ...r, section: (e.target.value || undefined) as SectionKey | undefined })}
        >
          <option value="">— soru tipi yok —</option>
          {YDS_SECTIONS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.icon} {s.label}
            </option>
          ))}
        </select>
        <select className={styles.examSelect} value={r.grammar ?? ''} onChange={(e) => setR({ ...r, grammar: e.target.value || undefined })}>
          <option value="">— dilbilgisi konusu yok —</option>
          {GRAMMAR_TOPICS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
        <select
          className={styles.examSelect}
          value={r.source?.book ?? ''}
          onChange={(e) => setR({ ...r, source: e.target.value ? { book: e.target.value, page: r.source?.page ?? 1 } : undefined })}
        >
          <option value="">— kaynak yok —</option>
          {map.books.map((b) => (
            <option key={b.id} value={b.id}>
              {b.title}
            </option>
          ))}
        </select>
        {r.source && (
          <input
            className={styles.examSelect}
            type="number"
            min={1}
            style={{ width: '5.5rem' }}
            value={r.source.page}
            aria-label="Sayfa"
            onChange={(e) => setR({ ...r, source: { book: r.source!.book, page: Math.max(1, Number(e.target.value) || 1) } })}
          />
        )}
      </div>
      <div className={styles.actions} style={{ marginTop: 0 }}>
        <button type="button" className="btn btn-primary" disabled={!r.text.trim() || (!r.section && !r.grammar)} onClick={() => onSave({ ...r, text: r.text.trim() })}>
          Tamam
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Vazgeç
        </button>
        {!r.section && !r.grammar && <small className="muted">Kural bir soru tipine ya da dilbilgisi konusuna bağlanmalı.</small>}
      </div>
    </div>
  )
}

export function TacticsBookPage() {
  const [map, setMap] = useState<SourceMap | null>(null)
  const [rules, setRules] = useState<TacticRule[] | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [status, setStatus] = useState('')
  const [page, setPage] = useState<{ book: string; page: number; text: string } | null>(null)

  useEffect(() => {
    void Promise.all([loadSourceMap(), loadTactics()]).then(([m, b]) => {
      setMap(m)
      setRules(b.rules)
    })
  }, [])

  const groups = useMemo(() => {
    if (!rules) return []
    const bySection = YDS_SECTIONS.map((s) => ({ key: s.key as string, title: `${s.icon} ${s.label}`, rules: rules.filter((r) => r.section === s.key) }))
    const grammarOnly = { key: 'grammar', title: '📘 Dilbilgisi konusuna bağlı', rules: rules.filter((r) => !r.section && r.grammar) }
    return [...bySection, grammarOnly]
  }, [rules])

  if (!map || !rules) return <p className="muted">Yükleniyor…</p>

  const bookTitle = (id: string) => map.books.find((b) => b.id === id)?.title ?? id
  const grammarTitle = (id: string) => GRAMMAR_TOPICS.find((t) => t.id === id)?.title ?? id

  function update(next: TacticRule[]) {
    setRules(next)
    setDirty(true)
    setStatus('')
  }

  function addRule(section?: string) {
    const rule: TacticRule = { id: crypto.randomUUID(), text: '', section: section && section !== 'grammar' ? (section as SectionKey) : undefined }
    update([...rules!, rule])
    setEditing(rule.id)
  }

  async function save() {
    try {
      await saveTactics({ updatedAt: null, rules: rules!.filter((r) => r.text.trim()) })
      setDirty(false)
      setStatus('✓ Kaydedildi (önceki sürüm taktik-kitabi.bak.json olarak saklandı)')
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e))
    }
  }

  async function openPage(book: string, p: number) {
    const r = await fetch(`/local-api/kaynak/sayfa/${encodeURIComponent(book)}/${p}`)
    setPage({ book, page: p, text: r.ok ? await r.text() : 'Bu sayfanın OCR metni bulunamadı.' })
  }

  return (
    <section className={styles.page}>
      <header className={styles.head}>
        <div>
          <Link to="/yds-sorular" className={styles.backLink}>
            ← Soru Merkezi
          </Link>
          <h1 className={styles.title}>📒 Taktik Kitabı</h1>
          <p className="muted" style={{ margin: 0, fontSize: '0.88rem' }}>
            Hocaların kitaplarından çıkarılan, soru tipine göre kısa kurallar. Yapay zekâ “📒 Koç” modunda bunlara dayanır ve
            kaynağını belirtir. Yanlış ya da eksik gördüğün kuralı buradan düzelt.
          </p>
        </div>
      </header>

      <article className="card">
        <h2 className={styles.blockTitle}>Kaynak kitaplar</h2>
        {map.books.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            Henüz kaynak yok. PDF’leri <code>local-data/kaynaklar/</code> klasörüne koy ve Claude’a “OCR’ı başlat” de; OCR,
            konu haritası ve kurallar oradan çıkarılır.
          </p>
        ) : (
          <ul className={styles.examList}>
            {map.books.map((b) => (
              <li key={b.id} className={styles.examRow} style={{ gridTemplateColumns: 'minmax(0,1fr) auto' }}>
                <span className={styles.examName}>
                  {b.title}
                  <small>
                    {b.author ? `${b.author} · ` : ''}
                    {b.pages} sayfa · haritada {map.entries.filter((e) => e.book === b.id).length} konu ·{' '}
                    {rules.filter((r) => r.source?.book === b.id).length} kural
                  </small>
                </span>
              </li>
            ))}
          </ul>
        )}
      </article>

      <div className={styles.mockBar}>
        <strong>{rules.length} kural</strong>
        <span className="muted" style={{ fontSize: '0.85rem' }}>
          {dirty ? 'Kaydedilmemiş değişiklik var' : status}
        </span>
        <span className={styles.spacer} />
        <button type="button" className="btn btn-primary" disabled={!dirty} onClick={() => void save()}>
          Değişiklikleri kaydet
        </button>
      </div>

      {groups.map((g) => (
        <article key={g.key} className="card">
          <h2 className={styles.blockTitle}>
            {g.title} <span className="muted">({g.rules.length})</span>
          </h2>
          {g.rules.length === 0 && <p className="muted" style={{ margin: '0 0 0.5rem', fontSize: '0.85rem' }}>Bu bölümde henüz kural yok.</p>}
          <ul className={styles.ruleList}>
            {g.rules.map((r) =>
              editing === r.id ? (
                <li key={r.id}>
                  <RuleEditor
                    rule={r}
                    map={map}
                    onSave={(nr) => {
                      update(rules.map((x) => (x.id === r.id ? nr : x)))
                      setEditing(null)
                    }}
                    onCancel={() => {
                      if (!r.text.trim()) update(rules.filter((x) => x.id !== r.id))
                      setEditing(null)
                    }}
                  />
                </li>
              ) : (
                <li key={r.id} className={styles.ruleRow}>
                  <span className={styles.ruleText}>
                    {r.text}
                    {r.example && <em className="muted"> — {r.example}</em>}
                    <small className="muted">
                      {r.grammar && `📘 ${grammarTitle(r.grammar)} · `}
                      {r.source ? (
                        <button type="button" className={styles.linkBtn} onClick={() => void openPage(r.source!.book, r.source!.page)}>
                          {bookTitle(r.source.book)}, s. {r.source.page}
                        </button>
                      ) : (
                        'kaynak belirtilmemiş'
                      )}
                    </small>
                  </span>
                  <button type="button" className="btn btn-ghost" onClick={() => setEditing(r.id)} aria-label="Düzenle">
                    ✎
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    aria-label="Sil"
                    onClick={() => confirm('Bu kural silinsin mi?') && update(rules.filter((x) => x.id !== r.id))}
                  >
                    ✕
                  </button>
                </li>
              ),
            )}
          </ul>
          <button type="button" className="btn btn-ghost" onClick={() => addRule(g.key)}>
            + Kural ekle
          </button>
        </article>
      ))}

      {page && (
        <div className={styles.pdfBackdrop} onClick={() => setPage(null)} role="dialog" aria-modal="true">
          <div className={styles.pdfModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.pdfHead}>
              <strong>
                {bookTitle(page.book)} — s. {page.page}
              </strong>
              <span className={styles.spacer} />
              <button type="button" className="btn btn-ghost" disabled={page.page <= 1} onClick={() => void openPage(page.book, page.page - 1)}>
                ←
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => void openPage(page.book, page.page + 1)}>
                →
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setPage(null)} aria-label="Kapat">
                ✕
              </button>
            </div>
            <pre className={styles.pageText}>{page.text}</pre>
          </div>
        </div>
      )}
    </section>
  )
}
