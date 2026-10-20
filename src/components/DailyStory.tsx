import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../db'
import { aiConfigured, generate } from '../services/ai'
import { dayKey } from '../services/dates'
import { canSpeak, speakSentences } from '../services/tts'

// Günün mini hikâyesi: bugün çalışılan (yoksa öğrenilmekte olan) 10 kelimeyle kısa, kolay bir paragraf.
// Yapay zekâ günde bir kez çağrılır; sonuç cihazda saklanır (aiNotes, kind 'story') ve Gece Modu'nda dinlenebilir.

export interface StoryData {
  title: string
  words: string[]
  sentences: { en: string; tr: string }[]
}

const SYSTEM = [
  'You write very short, simple stories for a Turkish learner preparing for the YDS English exam (level A2–B1).',
  'Use ALL the given words naturally (any grammatical form). Wrap each given word in **double asterisks** in the English sentences.',
  'Write 6–9 short sentences, a coherent mini story. For each sentence give a natural Turkish translation (no asterisks in Turkish).',
  'Title: 2–5 English words.',
].join('\n')

const SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    sentences: {
      type: 'array',
      items: { type: 'object', properties: { en: { type: 'string' }, tr: { type: 'string' } }, required: ['en', 'tr'] },
    },
  },
  required: ['title', 'sentences'],
}

function storyId(userId: string, day: string) {
  return `story:${userId}:${day}`
}

/** "**word**" → vurgulu */
function Highlighted({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g)
  return (
    <>
      {parts.map((p, i) =>
        i % 2 ? (
          <mark key={i} style={{ background: 'var(--primary-subtle)', color: 'var(--primary)', fontWeight: 700, padding: '0 0.15em', borderRadius: 4 }}>
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  )
}

export function DailyStory({ userId }: { userId: string }) {
  const [today] = useState(() => dayKey(Date.now()))
  const id = storyId(userId, today)
  const cached = useLiveQuery(() => db.aiNotes.get(id), [id])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [showTr, setShowTr] = useState(false)
  const [speaking, setSpeaking] = useState<number | null>(null)
  const stopRef = useRef<(() => void) | null>(null)
  useEffect(() => () => stopRef.current?.(), [])

  // Kelimeler: bugün tekrar edilenler, yoksa öğrenilmekte olanlar (puanı 1–3)
  const words = useLiveQuery(async () => {
    const logs = await db.reviewLogs.where('userId').equals(userId).filter((l) => dayKey(l.reviewedAt) === today).toArray()
    let ids = [...new Set(logs.map((l) => l.wordId))]
    if (ids.length < 5) {
      const cards = await db.cardStates.where('userId').equals(userId).filter((c) => c.reps > 0 && (c.masteryScore ?? 1) <= 3).toArray()
      ids = [...new Set([...ids, ...cards.map((c) => c.wordId)])]
    }
    const list = (await db.words.bulkGet(ids.slice(0, 40))).filter((w) => w && !w.isDeleted && !w.term.includes(' '))
    return list.slice(0, 10).map((w) => w!.term)
  }, [userId, today])

  const story: StoryData | null = cached ? (JSON.parse(cached.text) as StoryData) : null

  async function make() {
    if (!words?.length) return
    setBusy(true)
    setError('')
    try {
      const r = await generate(SYSTEM, `Words: ${words.join(', ')}`, 0.8, { jsonSchema: SCHEMA })
      const data = JSON.parse(r.text) as Omit<StoryData, 'words'>
      const full: StoryData = { ...data, words }
      await db.aiNotes.put({ id, kind: 'story', text: JSON.stringify(full), model: r.model, createdAt: new Date().toISOString() })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  function listen() {
    if (!story) return
    if (stopRef.current) {
      stopRef.current()
      stopRef.current = null
      setSpeaking(null)
      return
    }
    setSpeaking(0)
    stopRef.current = speakSentences(
      story.sentences.map((s) => s.en.replace(/\*\*/g, '')),
      {
        onSentence: setSpeaking,
        onDone: () => {
          stopRef.current = null
          setSpeaking(null)
        },
      },
    )
  }

  if (!aiConfigured()) return null
  if (!story && (!words || words.length < 3)) return null

  return (
    <section className="card" style={{ display: 'grid', gap: '0.6rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <strong>📜 Günün hikâyesi</strong>
        <span className="muted" style={{ fontSize: '0.82rem' }}>
          {story ? story.words.join(', ') : `Bugünkü kelimelerinle: ${words?.join(', ')}`}
        </span>
      </div>
      {!story ? (
        <div>
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void make()}>
            {busy ? 'Yazılıyor…' : '✨ Bu kelimelerle kısa bir hikâye yaz'}
          </button>
          <p className="muted" style={{ margin: '0.35rem 0 0', fontSize: '0.8rem' }}>
            Günde bir kez üretilir ve saklanır; Gece Modu’nda da dinleyebilirsin.
          </p>
        </div>
      ) : (
        <>
          <h3 style={{ margin: 0, fontSize: '1.05rem' }}>{story.title}</h3>
          <p style={{ margin: 0, lineHeight: 1.7 }}>
            {story.sentences.map((s, i) => (
              <span key={i} style={speaking === i ? { background: 'var(--surface-strong)', borderRadius: 4 } : undefined}>
                <Highlighted text={s.en} />{' '}
              </span>
            ))}
          </p>
          {showTr && <p className="muted" style={{ margin: 0, lineHeight: 1.6 }}>{story.sentences.map((s) => s.tr).join(' ')}</p>}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {canSpeak() && (
              <button type="button" className="btn btn-ghost" onClick={listen}>
                {speaking !== null ? '⏹ Durdur' : '🔊 Dinle'}
              </button>
            )}
            <button type="button" className="btn btn-ghost" onClick={() => setShowTr((v) => !v)}>
              {showTr ? 'Türkçeyi gizle' : '🌐 Türkçesi'}
            </button>
            <Link to="/gece" className="btn btn-ghost">
              🌙 Gece Modu’nda dinle
            </Link>
          </div>
        </>
      )}
      {error && <span style={{ color: 'var(--danger)' }}>{error}</span>}
    </section>
  )
}
