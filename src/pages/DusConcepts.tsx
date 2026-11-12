import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  DUS_SUBJECTS,
  listDusExams,
  loadDusSpots,
  loadDusTopics,
  subjectOf,
  type DusTestKey,
  type DusTopicSubject,
} from '../services/dus'
import { loadConcepts, trLower as tr, type Concept } from '../services/dusConcepts'
import { useUserStore } from '../stores/user'
import { DusTermCards } from './DusTermCards'
import styles from './DusConcepts.module.css'

// DUS Kavramlar (/dus/kavramlar): çıkmış sorulardan derlenen üç şey tek sayfada.
//  - Kavram sözlüğü: soru terim sözlüklerindeki (local-data/dus/sozluk) terimler tekilleştirilir; ara, derse göre süz.
//  - Terim kartları (/dus/kavramlar/terimler): aynı terimler YDS kelime kartı düzeninde, ders → seviye (DusTermCards.tsx).
//  - Bilgi kartları (/dus/kavramlar/kartlar): konu/spot verisindeki (local-data/dus/konu) soru–cevap kartları; ders ve
//    konuya göre liste ya da tek tek çalışma. "Bildim" işaretleri bu cihazda kalır (yds-dus-spot:<kullanıcı>).

interface SpotCard {
  id: string
  on: string
  arka: string
  subject: string
  konu: string
  altBaslik: string
  exam: string
}

function splitKey(key: string): { test: DusTestKey; n: number } {
  const [test, n] = key.split('/')
  return { test: test as DusTestKey, n: Number(n) }
}

async function loadCards(): Promise<SpotCard[]> {
  const exams = await listDusExams()
  const all = await Promise.all(exams.map(async (e) => [e.id, await loadDusSpots(e.id)] as const))
  const out: SpotCard[] = []
  for (const [exam, spots] of all) {
    for (const [key, rec] of Object.entries(spots)) {
      const { test, n } = splitKey(key)
      const subject = subjectOf(test, n)?.id ?? rec.konu.split('/')[0]
      rec.spotlar?.forEach((s, i) =>
        out.push({ id: `${exam}/${key}#${i}`, on: s.on, arka: s.arka, subject, konu: rec.konu, altBaslik: rec.altBaslik, exam }),
      )
    }
  }
  return out
}

function SubjectSelect({ value, onChange, counts }: { value: string; onChange: (v: string) => void; counts: Map<string, number> }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label="Ders">
      <option value="">Tüm dersler</option>
      {DUS_SUBJECTS.filter((s) => counts.get(s.id)).map((s) => (
        <option key={s.id} value={s.id}>
          {s.icon} {s.title} ({counts.get(s.id)})
        </option>
      ))}
    </select>
  )
}

const PAGE = 60

function Glossary() {
  const [items, setItems] = useState<Concept[] | null>(null)
  const [q, setQ] = useState('')
  const [subject, setSubject] = useState('')
  const [sort, setSort] = useState<'az' | 'sik'>('az')
  const [limit, setLimit] = useState(PAGE)
  const [open, setOpen] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    void loadConcepts().then((c) => live && setItems(c))
    return () => {
      live = false
    }
  }, [])

  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of items ?? []) for (const s of c.subjects) m.set(s, (m.get(s) ?? 0) + 1)
    return m
  }, [items])

  const shown = useMemo(() => {
    const needle = tr(q.trim())
    let list = (items ?? []).filter(
      (c) => (!subject || c.subjects.has(subject)) && (!needle || tr(c.terim).includes(needle) || tr(c.kisa ?? '').includes(needle)),
    )
    if (sort === 'sik') list = [...list].sort((a, b) => b.count - a.count || a.terim.localeCompare(b.terim, 'tr'))
    return list
  }, [items, q, subject, sort])

  if (!items) return <p className="muted">Yükleniyor…</p>
  if (items.length === 0) return <p className="muted">Terim sözlüğü bu cihazda yok. Kaynak paketini yenile.</p>

  return (
    <>
      <div className={styles.filters}>
        <input
          type="search"
          value={q}
          placeholder="Terim ara…"
          aria-label="Terim ara"
          onChange={(e) => {
            setQ(e.target.value)
            setLimit(PAGE)
          }}
        />
        <SubjectSelect
          value={subject}
          counts={counts}
          onChange={(v) => {
            setSubject(v)
            setLimit(PAGE)
          }}
        />
        <select value={sort} onChange={(e) => setSort(e.target.value as 'az' | 'sik')} aria-label="Sıralama">
          <option value="az">A → Z</option>
          <option value="sik">En sık geçen</option>
        </select>
      </div>
      <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
        {shown.length} terim. Terime dokun, açıklamasını gör.
      </p>
      <ul className={styles.list}>
        {shown.slice(0, limit).map((c) => {
          const isOpen = open === c.terim
          return (
            <li key={c.terim}>
              <button type="button" className={styles.term} aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : c.terim)}>
                <strong>{c.terim}</strong>
                <span>{c.kisa}</span>
              </button>
              {isOpen && (
                <div className={styles.detail}>
                  <p>{c.aciklama}</p>
                  {c.koken && <p className="muted">Köken: {c.koken}</p>}
                  <p className="muted">
                    {c.count} soruda geçti ·{' '}
                    {[...c.subjects].map((s) => DUS_SUBJECTS.find((x) => x.id === s)?.title ?? s).join(', ')}
                  </p>
                </div>
              )}
            </li>
          )
        })}
      </ul>
      {shown.length > limit && (
        <button type="button" className="btn btn-secondary" onClick={() => setLimit(limit + PAGE)}>
          Daha fazla göster ({shown.length - limit})
        </button>
      )}
    </>
  )
}

const knownKey = (userId: string) => `yds-dus-spot:${userId}`

function readKnown(userId: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(knownKey(userId)) || '[]') as string[])
  } catch {
    return new Set()
  }
}

function shuffle<T>(a: T[]): T[] {
  const out = [...a]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function Cards() {
  const userId = useUserStore((s) => s.activeUserId)
  const [cards, setCards] = useState<SpotCard[] | null>(null)
  const [topics, setTopics] = useState<DusTopicSubject[]>([])
  const [subject, setSubject] = useState('')
  const [konu, setKonu] = useState('')
  const [hideKnown, setHideKnown] = useState(false)
  const [known, setKnown] = useState(() => readKnown(userId))
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [limit, setLimit] = useState(PAGE)
  const [deck, setDeck] = useState<SpotCard[] | null>(null)

  useEffect(() => {
    let live = true
    void Promise.all([loadCards(), loadDusTopics()]).then(([c, t]) => {
      if (!live) return
      setCards(c)
      setTopics(t)
    })
    return () => {
      live = false
    }
  }, [])

  function mark(id: string, on: boolean) {
    const next = new Set(known)
    if (on) next.add(id)
    else next.delete(id)
    setKnown(next)
    try {
      localStorage.setItem(knownKey(userId), JSON.stringify([...next]))
    } catch {
      // depo dolu/kapalı: işaret yalnızca bu oturumda kalır
    }
  }

  const subjectCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of cards ?? []) m.set(c.subject, (m.get(c.subject) ?? 0) + 1)
    return m
  }, [cards])

  const konuList = useMemo(() => {
    if (!subject) return []
    const m = new Map<string, number>()
    for (const c of cards ?? []) if (c.subject === subject) m.set(c.konu, (m.get(c.konu) ?? 0) + 1)
    const names = new Map((topics.find((d) => d.id === subject)?.konular ?? []).map((k) => [k.id, k.ad]))
    return [...m.entries()]
      .map(([id, n]) => ({ id, n, ad: names.get(id) ?? (id.endsWith('/diger') ? 'Diğer' : id) }))
      .sort((a, b) => b.n - a.n)
  }, [cards, topics, subject])

  const shown = useMemo(
    () => (cards ?? []).filter((c) => (!subject || c.subject === subject) && (!konu || c.konu === konu) && (!hideKnown || !known.has(c.id))),
    [cards, subject, konu, hideKnown, known],
  )

  if (!cards) return <p className="muted">Yükleniyor…</p>
  if (cards.length === 0) return <p className="muted">Bilgi kartları bu cihazda yok. Kaynak paketini yenile.</p>
  if (deck) return <Deck deck={deck} known={known} onMark={mark} onClose={() => setDeck(null)} />

  const knownHere = shown.filter((c) => known.has(c.id)).length

  return (
    <>
      <div className={styles.filters}>
        <SubjectSelect
          value={subject}
          counts={subjectCounts}
          onChange={(v) => {
            setSubject(v)
            setKonu('')
            setLimit(PAGE)
          }}
        />
        {subject && (
          <select
            value={konu}
            aria-label="Konu"
            onChange={(e) => {
              setKonu(e.target.value)
              setLimit(PAGE)
            }}
          >
            <option value="">Tüm konular</option>
            {konuList.map((k) => (
              <option key={k.id} value={k.id}>
                {k.ad} ({k.n})
              </option>
            ))}
          </select>
        )}
        <label className={styles.check}>
          <input type="checkbox" checked={hideKnown} onChange={(e) => setHideKnown(e.target.checked)} /> Bildiklerimi gizle
        </label>
      </div>
      <div className={styles.bar}>
        <span className="muted">
          {shown.length} kart{!hideKnown && ` · ${knownHere} bildim`}
        </span>
        <button type="button" className="btn btn-primary" disabled={shown.length === 0} onClick={() => setDeck(shuffle(shown))}>
          ▶ Kart kart çalış
        </button>
      </div>
      <ul className={styles.list}>
        {shown.slice(0, limit).map((c) => {
          const isOpen = open.has(c.id)
          return (
            <li key={c.id}>
              <button
                type="button"
                className={styles.term}
                aria-expanded={isOpen}
                onClick={() => {
                  const next = new Set(open)
                  if (isOpen) next.delete(c.id)
                  else next.add(c.id)
                  setOpen(next)
                }}
              >
                <strong>
                  {known.has(c.id) && '✓ '}
                  {c.on}
                </strong>
                <span>{c.altBaslik}</span>
              </button>
              {isOpen && (
                <div className={styles.detail}>
                  <p>{c.arka}</p>
                </div>
              )}
            </li>
          )
        })}
      </ul>
      {shown.length > limit && (
        <button type="button" className="btn btn-secondary" onClick={() => setLimit(limit + PAGE)}>
          Daha fazla göster ({shown.length - limit})
        </button>
      )}
    </>
  )
}

/** Tek tek çalışma: soruyu gör, dokun, cevabı gör; Bildim / Tekrar. */
function Deck({ deck, known, onMark, onClose }: { deck: SpotCard[]; known: Set<string>; onMark: (id: string, on: boolean) => void; onClose: () => void }) {
  const [i, setI] = useState(0)
  const [shown, setShown] = useState(false)
  const [ok, setOk] = useState(0)
  const card = deck[i]

  if (!card) {
    return (
      <article className={`card ${styles.flash}`}>
        <h2 style={{ margin: 0 }}>Bitti 🎉</h2>
        <p style={{ margin: 0 }}>
          {deck.length} karttan {ok} tanesini bildin.
        </p>
        <button type="button" className="btn btn-primary" onClick={onClose}>
          Listeye dön
        </button>
      </article>
    )
  }

  function answer(good: boolean) {
    onMark(card.id, good)
    if (good) setOk(ok + 1)
    setShown(false)
    setI(i + 1)
  }

  return (
    <article className={`card ${styles.flash}`}>
      <div className={styles.bar}>
        <span className="muted">
          {i + 1} / {deck.length} · {card.altBaslik}
          {known.has(card.id) && ' · ✓'}
        </span>
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          ✕ Bitir
        </button>
      </div>
      <p className={styles.front}>{card.on}</p>
      {shown ? (
        <>
          <p className={styles.back}>{card.arka}</p>
          <div className={styles.flashBtns}>
            <button type="button" className="btn btn-secondary" onClick={() => answer(false)}>
              🔁 Tekrar
            </button>
            <button type="button" className="btn btn-primary" onClick={() => answer(true)}>
              ✓ Bildim
            </button>
          </div>
        </>
      ) : (
        <button type="button" className="btn btn-primary" onClick={() => setShown(true)}>
          Cevabı göster
        </button>
      )}
    </article>
  )
}

export default function DusConcepts({ tab = 'sozluk' }: { tab?: 'sozluk' | 'terim' | 'kart' }) {
  return (
    <section className={styles.page}>
      <header>
        <Link to="/dus" className="muted" style={{ fontSize: '0.85rem' }}>
          ← DUS
        </Link>
        <h1 className={styles.title}>📖 DUS Kavramlar</h1>
        <p className="muted" style={{ margin: 0 }}>
          Çıkmış sorulardan derlendi. Yapay zekâ ile yazıldı; şüphelendiğin bilgiyi kaynağından doğrula.
        </p>
      </header>
      <nav className={styles.tabs} aria-label="Kavramlar bölümü">
        <Link to="/dus/kavramlar" replace className={`${styles.tab} ${tab === 'sozluk' ? styles.tabOn : ''}`}>
          Sözlük
        </Link>
        <Link to="/dus/kavramlar/terimler" replace className={`${styles.tab} ${tab === 'terim' ? styles.tabOn : ''}`}>
          Terim kartları
        </Link>
        <Link to="/dus/kavramlar/kartlar" replace className={`${styles.tab} ${tab === 'kart' ? styles.tabOn : ''}`}>
          Bilgi kartları
        </Link>
      </nav>
      {tab === 'kart' ? <Cards /> : tab === 'terim' ? <DusTermCards /> : <Glossary />}
    </section>
  )
}
