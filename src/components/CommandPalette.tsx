import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GRAMMAR_TOPICS } from '../data/grammar'
import { db } from '../db'
import { getSaved } from '../services/favorites'
import { STUDY_CATEGORIES } from '../services/studyMap'
import { useUserStore } from '../stores/user'
import styles from './CommandPalette.module.css'

// Hızlı arama (Ctrl+K / ⌘K): sayfa, kelime, dilbilgisi konusu, kitap ünitesi ve test adını yaz, Enter ile git.

interface Item {
  group: string
  label: string
  hint?: string
  to: string
}

const PAGES: Item[] = [
  { group: 'Sayfa', label: 'Ana Sayfa', to: '/' },
  { group: 'Sayfa', label: 'Çalış', to: '/calis' },
  { group: 'Sayfa', label: 'Kelimeler', to: '/words' },
  { group: 'Sayfa', label: 'İstatistik', to: '/stats' },
  { group: 'Sayfa', label: 'Ayarlar', to: '/settings' },
  { group: 'Sayfa', label: 'Yedekleme ve geri yükleme', hint: 'Ayarlar', to: '/settings' },
  ...STUDY_CATEGORIES.flatMap((c) => c.links.map((l) => ({ group: 'Sayfa', label: l.label, hint: `${c.title} · ${l.hint}`, to: l.to }))),
  ...(import.meta.env.DEV
    ? [
        { group: 'Sayfa', label: 'Soru Merkezi', hint: 'Çıkmış sınavlar', to: '/yds-sorular' },
        { group: 'Sayfa', label: 'Özel Deneme', to: '/yds-sorular/ozel' },
        { group: 'Sayfa', label: 'Soru bankaları', to: '/yds-sorular/bankalar' },
        { group: 'Sayfa', label: 'Sınav Stratejileri 3', hint: 'Konulara göre testler', to: '/yds-sorular/bankalar/strateji-3' },
      ]
    : []),
]

const GRAMMAR: Item[] = GRAMMAR_TOPICS.map((t) => ({ group: 'Dilbilgisi', label: t.title, to: `/dilbilgisi/${t.id}` }))

/** Türkçe karakter ve büyük/küçük harf duyarsız karşılaştırma. */
function fold(s: string): string {
  return s
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
}

/** Yalnızca yerelde var olan kaynaklar (kitap üniteleri, sınavlar, testler); ilk açılışta bir kez yüklenir. */
let localCache: Promise<Item[]> | null = null
function loadLocal(): Promise<Item[]> {
  if (!import.meta.env.DEV) return Promise.resolve([])
  localCache ??= (async () => {
    const out: Item[] = []
    try {
      const { listBooks, loadBook } = await import('../pages/books/bookData')
      for (const b of await listBooks()) {
        const book = await loadBook(b.id)
        for (const u of book.units) out.push({ group: 'Kitap', label: `${b.short} · ${u.no}. ${u.title}`, to: `/kitap/${b.id}/s/${u.page}` })
      }
    } catch {
      // kitap yoksa geç
    }
    try {
      const { listExams, listBanks } = await import('../pages/exam/examData')
      for (const e of [...(await listExams()), ...(await listBanks())]) out.push({ group: 'Sınav', label: e.title, to: `/yds-sorular/sinav/${e.id}` })
    } catch {
      // sınav verisi yoksa geç
    }
    try {
      const r = await fetch('/local-api/kitap/modadil-sinav-stratejileri-3/testler')
      if (r.ok) {
        const d = (await r.json()) as { tests: { id: string; section: string; no: number }[] }
        for (const t of d.tests)
          out.push({ group: 'Test', label: `${t.section} · Test ${t.no}`, hint: 'Sınav Stratejileri 3', to: `/yds-sorular/bankalar/strateji-3/${t.id}` })
      }
    } catch {
      // yoksa geç
    }
    return out
  })()
  return localCache
}

export function CommandPalette() {
  const navigate = useNavigate()
  const userId = useUserStore((s) => s.activeUserId)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [local, setLocal] = useState<Item[]>([])
  const [words, setWords] = useState<Item[]>([])
  const listRef = useRef<HTMLUListElement>(null)

  // Ctrl+K / ⌘K her yerden açar; başlıktaki 🔍 düğmesi de bu olayı tetikler
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    const onOpen = () => setOpen(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener('yds-open-palette', onOpen)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('yds-open-palette', onOpen)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    void loadLocal().then(setLocal)
  }, [open])

  // Kelime araması: en az 2 harf
  useEffect(() => {
    const q = query.trim().toLowerCase()
    if (!open || q.length < 2) return
    let alive = true
    void db.words
      .where('userId')
      .equals(userId)
      .filter((w) => !w.isDeleted && (w.term.toLowerCase().startsWith(q) || fold(w.definition).includes(fold(q))))
      .limit(8)
      .toArray()
      .then((list) => {
        if (alive)
          setWords(list.map((w) => ({ group: 'Kelime', label: w.term, hint: w.definition, to: `/words?q=${encodeURIComponent(w.term)}` })))
      })
    return () => {
      alive = false
    }
  }, [query, open, userId])

  const results = useMemo(() => {
    const q = fold(query.trim())
    const saved: Item[] = getSaved(userId).map((s) => ({ group: 'Kaydedilen', label: s.label, to: s.path }))
    const pool = [...saved, ...PAGES, ...GRAMMAR, ...local]
    if (!q) return [...saved, ...PAGES.slice(0, 8)]
    const scored = pool
      .map((it) => {
        const l = fold(it.label)
        const h = fold(it.hint ?? '')
        const score = l.startsWith(q) ? 3 : l.includes(q) ? 2 : h.includes(q) ? 1 : 0
        return { it, score }
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 30)
      .map((x) => x.it)
    // Kelime sonuçları yalnızca en az 2 harfte (eski sonuçlar kısa sorguda görünmesin)
    return [...scored.slice(0, 20), ...(q.length >= 2 ? words : [])]
  }, [query, local, words, userId])

  function go(it: Item) {
    setOpen(false)
    setQuery('')
    setActive(0)
    navigate(it.to)
  }

  useEffect(() => {
    listRef.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  if (!open) return null

  return (
    <div className={styles.backdrop} onClick={() => setOpen(false)} role="dialog" aria-modal="true" aria-label="Hızlı arama">
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <input
          className={styles.input}
          autoFocus
          value={query}
          placeholder="Ara: sayfa, kelime, konu, ünite, test…"
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false)
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActive((a) => Math.min(results.length - 1, a + 1))
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((a) => Math.max(0, a - 1))
            }
            if (e.key === 'Enter' && results[active]) go(results[active])
          }}
        />
        <ul className={styles.list} ref={listRef}>
          {results.length === 0 && <li className={styles.empty}>Sonuç yok</li>}
          {results.map((it, i) => (
            <li key={`${it.group}:${it.to}:${it.label}`}>
              <button
                type="button"
                data-i={i}
                className={`${styles.item} ${i === active ? styles.active : ''}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(it)}
              >
                <span className={styles.group}>{it.group}</span>
                <span className={styles.label}>{it.label}</span>
                {it.hint && <span className={styles.hint}>{it.hint}</span>}
              </button>
            </li>
          ))}
        </ul>
        <p className={styles.foot}>↑↓ seç · Enter git · Esc kapat · Ctrl+K her yerden açar</p>
      </div>
    </div>
  )
}
