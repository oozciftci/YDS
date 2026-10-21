import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AFFIXES, stemOf, type Affix } from '../data/affixes'
import { db } from '../db'
import { useQuestionNav } from './exam/answerControls'
import { speakWord } from '../services/tts'
import { useUserStore } from '../stores/user'
import type { WordItem } from '../types/database'
import styles from './WordFamilies.module.css'

// Kelime ailesi ve ekler: YDS'de türev kelimeler çok çıkar (develop → development, developer…).
// Ekler: anlamı ve havuzundaki örnekler · Aileler: havuzundaki aynı kökten kelimeler · Ek testi: ekin anlamını bul.

/** Ekin yazımları ("in- / im- / il-" → in, im, il). */
function forms(a: Affix): string[] {
  return a.affix.split('/').map((s) => s.trim().replace(/-/g, '').toLowerCase()).filter(Boolean)
}

/** Ön ekte kalan kısım da havuzda bir kelime olmalı (unhappy → happy); yoksa united, uniform gibi yanlış eşleşir. */
function matches(term: string, a: Affix, pool: Set<string>): boolean {
  const t = term.toLowerCase()
  if (t.includes(' ')) return false
  return forms(a).some((f) =>
    a.kind === 'prefix'
      ? t.startsWith(f) && t.length > f.length + 3 && pool.has(t.slice(f.length))
      : t.endsWith(f) && t.length > f.length + 3,
  )
}

function newRound() {
  const a = AFFIXES[Math.floor(Math.random() * AFFIXES.length)]
  const others = AFFIXES.filter((x) => x.meaning !== a.meaning)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3)
    .map((x) => x.meaning)
  const options = [...others, a.meaning].sort(() => Math.random() - 0.5)
  return { a, options, correct: options.indexOf(a.meaning), pick: null as number | null }
}

/** Ek testi. Yana kaydırma / ← →: sonraki soru ya da önceki sorulara (cevabıyla) geri dönüş — kitap gibi sayfa çevirerek. */
function AffixQuiz() {
  const [rounds, setRounds] = useState(() => [newRound()])
  const [at, setAt] = useState(0)
  const round = rounds[at]
  const pick = round.pick
  const answered = rounds.filter((r) => r.pick !== null)
  const score = { ok: answered.filter((r) => r.pick === r.correct).length, all: answered.length }

  const swipe = useQuestionNav(
    () => setAt((i) => Math.max(0, i - 1)),
    () => {
      if (at + 1 >= rounds.length) setRounds((r) => [...r, newRound()])
      setAt(at + 1)
    },
    { canPrev: at > 0 },
  )

  return (
    <div className="card" data-focus-stage {...swipe.props} style={{ ...swipe.props.style, display: 'grid', gap: '0.6rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <strong>Ek testi</strong>
        <span className="muted">
          {score.ok}/{score.all} doğru
        </span>
      </div>
      <p style={{ margin: 0 }}>
        <span className={styles.bigAffix}>{round.a.affix}</span>{' '}
        <span className="muted">ör. {round.a.examples.slice(0, 2).join(', ')}</span>
      </p>
      <div className={styles.quizOptions}>
        {round.options.map((o, i) => (
          <button
            key={o}
            type="button"
            className={`${styles.quizBtn} ${pick !== null && i === round.correct ? styles.ok : ''} ${pick === i && i !== round.correct ? styles.bad : ''}`}
            disabled={pick !== null}
            onClick={() => setRounds((r) => r.map((x, j) => (j === at ? { ...x, pick: i } : x)))}
          >
            {o}
          </button>
        ))}
      </div>
      {pick !== null && (
        <button type="button" className="btn btn-primary" data-focus-hide onClick={() => void swipe.turn(1)}>
          Sonraki →
        </button>
      )}
      <p className="muted" style={{ margin: 0, fontSize: '0.8rem' }} data-focus-hide>
        Yana kaydırarak da geçebilirsin; geri kaydırınca önceki sorular cevabıyla görünür.
      </p>
    </div>
  )
}

export function WordFamiliesPage() {
  const userId = useUserStore((s) => s.activeUserId)
  const words = useLiveQuery(() => db.words.where('userId').equals(userId).filter((w) => !w.isDeleted).toArray(), [userId])
  const [tab, setTab] = useState<'ekler' | 'aileler' | 'test'>('ekler')
  const [kind, setKind] = useState<'prefix' | 'suffix'>('prefix')
  const [q, setQ] = useState('')

  const pool = useMemo(() => new Set((words ?? []).map((w) => w.term.toLowerCase())), [words])

  const families = useMemo(() => {
    const m = new Map<string, WordItem[]>()
    for (const w of words ?? []) {
      const s = stemOf(w.term)
      if (s.length < 4 || w.term.includes(' ')) continue
      m.set(s, [...(m.get(s) ?? []), w])
    }
    return [...m.values()].filter((g) => g.length >= 2).sort((a, b) => b.length - a.length)
  }, [words])

  const shownFamilies = useMemo(() => {
    const t = q.trim().toLowerCase()
    return (t ? families.filter((g) => g.some((w) => w.term.toLowerCase().includes(t))) : families).slice(0, 60)
  }, [families, q])

  return (
    <section className={styles.page}>
      <header>
        <Link to="/calis" className={styles.back}>
          ← Çalış
        </Link>
        <h1 className={styles.title}>👪 Kelime ailesi ve ekler</h1>
        <p className="muted" style={{ margin: 0 }}>
          Bir kökü ve ekleri bilmek, tanımadığın türev kelimeyi tahmin ettirir: develop → development, undeveloped…
        </p>
      </header>

      <div className={styles.tabs} role="tablist">
        {(
          [
            ['ekler', 'Ekler'],
            ['aileler', `Havuzundaki aileler (${families.length})`],
            ['test', 'Ek testi'],
          ] as const
        ).map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? styles.on : ''} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'ekler' && (
        <>
          <div className={styles.tabs}>
            <button type="button" className={kind === 'prefix' ? styles.on : ''} onClick={() => setKind('prefix')}>
              Ön ekler
            </button>
            <button type="button" className={kind === 'suffix' ? styles.on : ''} onClick={() => setKind('suffix')}>
              Son ekler
            </button>
          </div>
          <div className={styles.grid}>
            {AFFIXES.filter((a) => a.kind === kind).map((a) => {
              const mine = (words ?? []).filter((w) => matches(w.term, a, pool)).slice(0, 6)
              return (
                <article key={a.affix} className="card">
                  <div className={styles.affixHead}>
                    <span className={styles.bigAffix}>{a.affix}</span>
                    {a.pos && <span className={styles.pos}>→ {a.pos}</span>}
                  </div>
                  <p className={styles.meaning}>{a.meaning}</p>
                  <p className={styles.examples}>{a.examples.join(' · ')}</p>
                  {mine.length > 0 && (
                    <p className={styles.mine}>
                      Havuzunda:{' '}
                      {mine.map((w, i) => (
                        <span key={w.id} title={w.definition}>
                          {i > 0 && ', '}
                          {w.term}
                        </span>
                      ))}
                    </p>
                  )}
                </article>
              )
            })}
          </div>
        </>
      )}

      {tab === 'aileler' && (
        <>
          <input className="input" placeholder="Kelime ara…" value={q} onChange={(e) => setQ(e.target.value)} />
          {shownFamilies.length === 0 && <p className="muted">Havuzunda aynı kökten iki kelime bulunamadı.</p>}
          <div className={styles.grid}>
            {shownFamilies.map((g) => (
              <article key={g[0].id} className="card">
                <ul className={styles.family}>
                  {g.map((w) => (
                    <li key={w.id}>
                      <button type="button" className={styles.speak} onClick={() => speakWord(w.term)} aria-label={`${w.term} dinle`}>
                        🔊
                      </button>
                      <strong>{w.term}</strong> <span className="muted">{w.definition}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </>
      )}

      {tab === 'test' && <AffixQuiz />}
    </section>
  )
}
