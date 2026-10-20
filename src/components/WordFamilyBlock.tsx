import { useEffect, useState } from 'react'
import { speakWord } from '../services/tts'
import type { WordItem } from '../types/database'

// "👪 Aynı aileden": kelimenin türevleri (tür + Türkçe), eş anlamlıları ve zıt anlamlıları bir arada.
// Türev verisi public/data/word_families.json (özgün derleme; scripts/buildWordFamilies.py) — bir kez yüklenir.

type Form = [string, string, string]

let cache: Promise<Map<string, Form[]>> | null = null
function loadFamilies(): Promise<Map<string, Form[]>> {
  cache ??= fetch(`${import.meta.env.BASE_URL}data/word_families.json`)
    .then((r) => (r.ok ? r.json() : { families: [] }))
    .then((d: { families: Form[][] }) => {
      const m = new Map<string, Form[]>()
      for (const fam of d.families) {
        for (const [w] of fam) {
          const k = w.toLowerCase()
          // Bir kelime birden çok ailede geçerse en geniş aile
          if (!m.has(k) || (m.get(k)?.length ?? 0) < fam.length) m.set(k, fam)
        }
      }
      return m
    })
    .catch(() => new Map())
  return cache
}

const POS_TR: Record<string, string> = { n: 'isim', v: 'fiil', adj: 'sıfat', adv: 'zarf', prep: 'edat', conj: 'bağlaç' }
const posLabel = (p: string) => p.split('/').map((x) => POS_TR[x] ?? x).join('/')

export function WordFamilyBlock({ word, showSynonyms = true }: { word: WordItem; showSynonyms?: boolean }) {
  const [family, setFamily] = useState<Form[] | null>(null)
  useEffect(() => {
    let alive = true
    void loadFamilies().then((m) => alive && setFamily(m.get(word.term.toLowerCase().trim()) ?? []))
    return () => {
      alive = false
    }
  }, [word.term])

  const forms = (family ?? []).filter(([w]) => w.toLowerCase() !== word.term.toLowerCase())
  const syn = showSynonyms ? word.synonyms ?? [] : []
  const ant = word.antonyms ?? []
  if (!forms.length && !syn.length && !ant.length) return null

  return (
    <div style={{ display: 'grid', gap: '0.3rem', fontSize: '0.9rem' }}>
      <strong style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>👪 Aynı aileden</strong>
      {forms.length > 0 && (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.15rem' }}>
          {forms.map(([w, p, tr]) => (
            <li key={w} style={{ display: 'flex', gap: '0.45rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => speakWord(w)}
                title="Dinle"
                style={{ border: 0, background: 'none', padding: 0, cursor: 'pointer', fontWeight: 700, color: 'var(--text)', font: 'inherit' }}
              >
                {w}
              </button>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{posLabel(p)}</span>
              <span className="muted">{tr}</span>
            </li>
          ))}
        </ul>
      )}
      {syn.length > 0 && (
        <div>
          <span style={{ color: 'var(--success)', fontWeight: 700 }}>≈ Eş anlamlı:</span> {syn.join(', ')}
        </div>
      )}
      {ant.length > 0 && (
        <div>
          <span style={{ color: 'var(--danger)', fontWeight: 700 }}>≠ Zıt anlamlı:</span> {ant.join(', ')}
        </div>
      )}
    </div>
  )
}
