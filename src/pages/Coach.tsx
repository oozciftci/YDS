import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Link, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import { AiText } from '../components/AiText'
import { SaveToMemory } from '../components/SaveToMemory'
import { db } from '../db'
import { aiConfigured } from '../services/ai'
import {
  COACH_MODES,
  ENGLISH_SCENARIOS,
  LEVELS,
  YDS_QUICK_PROMPTS,
  coachTranscript,
  createEnglishChat,
  createYdsChat,
  deleteChat,
  sendMessage,
} from '../services/coach'
import { isKnownRoute } from '../services/appMap'
import { canSpeak, speakSentences, stopSpeaking } from '../services/tts'
import { useUserStore } from '../stores/user'
import type { CoachChat, CoachTurn } from '../types/database'
import styles from './Coach.module.css'
import { MemoryPage } from './Memory'

// YZ Koç: sohbet listesi (/koc) ve sohbet ekranı (/koc/:chatId).

function NotConfigured() {
  return (
    <article className="card">
      <p style={{ margin: 0 }}>
        YZ Koç için önce <Link to="/settings#ai">Ayarlar &gt; Yapay Zekâ</Link> bölümünden Gemini anahtarını ekle.
      </p>
    </article>
  )
}

function ChatList() {
  const navigate = useNavigate()
  const userId = useUserStore((s) => s.activeUserId)
  const chats = useLiveQuery(
    () => db.coachChats.where('[userId+updatedAt]').between([userId, ''], [userId, '￿']).reverse().toArray(),
    [userId],
  )
  const noteCount = useLiveQuery(() => db.memoryNotes.where('userId').equals(userId).count(), [userId])
  const [setup, setSetup] = useState(false)
  const [scenario, setScenario] = useState(ENGLISH_SCENARIOS[0].id)
  const [level, setLevel] = useState(() => {
    try {
      return localStorage.getItem('yds-coach-level') || 'B2'
    } catch {
      return 'B2'
    }
  })

  async function start() {
    try {
      localStorage.setItem('yds-coach-level', level)
    } catch {
      // yoksay
    }
    const chat = await createEnglishChat(userId, scenario, level)
    navigate(chat.id)
  }

  return (
    <section className={styles.page}>
      <header>
        <h1 className={styles.title}>🤖 YZ Koç</h1>
        <p className="muted" style={{ margin: 0 }}>
          Gemini ile İngilizce pratik yap ya da YDS sürecini konuş. Sohbetler yalnızca bu cihazda saklanır.
        </p>
        <div className={styles.headLinks}>
          <Link to="hafiza">🧠 Hafızam{noteCount ? ` (${noteCount} not)` : ''}</Link>
        </div>
      </header>

      {!aiConfigured() && <NotConfigured />}

      <article className="card">
        <h2 className={styles.blockTitle}>Yeni sohbet</h2>
        <div className={styles.modeGrid}>
          {COACH_MODES.map((m) => (
            <button
              key={m.mode}
              type="button"
              className={`${styles.modeCard} ${m.mode === 'english' && setup ? styles.modeActive : ''}`}
              disabled={!m.ready}
              onClick={() => {
                if (m.mode === 'english') setSetup(true)
                else if (m.mode === 'yds' && aiConfigured()) void createYdsChat(userId).then((c) => navigate(c.id))
              }}
            >
              <span className={styles.modeIcon}>{m.icon}</span>
              <span className={styles.modeBody}>
                <strong>
                  {m.title} {!m.ready && <span className={styles.soon}>yakında</span>}
                </strong>
                <span>{m.desc}</span>
              </span>
            </button>
          ))}
        </div>

        {setup && (
          <div className={styles.setup}>
            <p className={styles.setupLabel}>Senaryo</p>
            <div className={styles.chips}>
              {ENGLISH_SCENARIOS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`${styles.chip} ${scenario === s.id ? styles.chipOn : ''}`}
                  onClick={() => setScenario(s.id)}
                >
                  {s.icon} {s.title}
                </button>
              ))}
            </div>
            <div className={styles.setupRow}>
              <label className={styles.setupLabel} htmlFor="coach-level">
                Seviyen
              </label>
              <select id="coach-level" className={styles.select} value={level} onChange={(e) => setLevel(e.target.value)}>
                {LEVELS.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </select>
              <span className={styles.spacer} />
              <button type="button" className="btn btn-primary" disabled={!aiConfigured()} onClick={() => void start()}>
                Sohbeti başlat
              </button>
            </div>
          </div>
        )}
      </article>

      <article className="card">
        <h2 className={styles.blockTitle}>Sohbetlerin</h2>
        {!chats ? null : chats.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            Henüz sohbet yok. Yukarıdan bir mod seçip başla.
          </p>
        ) : (
          <ul className={styles.chatList}>
            {chats.map((c) => {
              const last = [...c.messages].reverse().find((m) => !m.hidden)
              return (
                <li key={c.id} className={styles.chatRow}>
                  <Link to={c.id} className={styles.chatLink}>
                    <strong>{c.title}</strong>
                    <span className={styles.preview}>{last ? `${last.role === 'user' ? 'Ben' : 'YZ'}: ${last.text}` : 'Boş sohbet'}</span>
                  </Link>
                  <small className="muted">{new Date(c.updatedAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}</small>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    aria-label="Sohbeti sil"
                    title="Sohbeti sil"
                    onClick={() => confirm('Bu sohbet silinsin mi?') && void deleteChat(c.id)}
                  >
                    ✕
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </article>
    </section>
  )
}

/** Öğrenci mesajının altında: düzeltmeler ve daha doğal söyleyiş (bir sonraki YZ mesajından gelir). */
function Feedback({ next }: { next?: CoachTurn }) {
  if (!next || next.role !== 'model') return null
  const corrections = next.corrections ?? []
  if (!corrections.length && !next.better) {
    return <p className={styles.fbOk}>✓ Hata görünmüyor</p>
  }
  return (
    <div className={styles.feedback}>
      {corrections.map((c, i) => (
        <p key={i}>
          ✏️ <s>{c.original}</s> → <strong>{c.corrected}</strong> <span className="muted">— {c.explanation}</span>
        </p>
      ))}
      {next.better && (
        <p>
          💡 <span className="muted">Daha doğal:</span> <em>{next.better}</em>
        </p>
      )}
    </div>
  )
}

function ChatView() {
  const { chatId = '' } = useParams()
  const chat = useLiveQuery(() => db.coachChats.get(chatId), [chatId])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [speaking, setSpeaking] = useState<number | null>(null)
  const started = useRef(false)
  const endRef = useRef<HTMLDivElement>(null)

  async function send(text: string, current: CoachChat) {
    setLoading(true)
    setError('')
    try {
      await sendMessage(current, text)
    } catch (e) {
      setInput(text)
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  // Yeni sohbeti YZ başlatır (açılış cümlesi)
  useEffect(() => {
    if (!chat || started.current || chat.messages.length > 0 || !aiConfigured()) return
    started.current = true
    void send('', chat)
  }, [chat])

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
  }, [chat?.messages.length, loading])

  useEffect(() => () => stopSpeaking(), [])

  if (chat === undefined) return <p className="muted">Yükleniyor…</p>
  if (chat === null || !chat) {
    return (
      <section className={styles.page}>
        <p>Sohbet bulunamadı.</p>
        <Link to="/koc">← Sohbetler</Link>
      </section>
    )
  }

  function submit() {
    const text = input.trim()
    if (!text || loading || !chat) return
    setInput('')
    void send(text, chat)
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  function listen(i: number, text: string) {
    if (speaking === i) {
      stopSpeaking()
      setSpeaking(null)
      return
    }
    setSpeaking(i)
    speakSentences(text.match(/[^.!?]+[.!?]*/g) ?? [text], { onDone: () => setSpeaking(null) })
  }

  const visible = chat.messages.map((m, i) => ({ m, i })).filter(({ m }) => !m.hidden)

  return (
    <section className={styles.page}>
      <header className={styles.chatHead}>
        <div>
          <Link to="/koc" className={styles.back}>
            ← Sohbetler
          </Link>
          <h1 className={styles.title}>{chat.title}</h1>
          <p className="muted" style={{ margin: 0, fontSize: '0.86rem' }}>
            {chat.mode === 'yds'
              ? 'Koç; profilini, hafıza notlarını ve bugünkü planını görerek konuşur ve seni uygulamadaki alıştırmalara yönlendirir.'
              : 'İngilizce yaz; YZ rolünde kalır, hataların mesajının altında kısaca düzeltilir. Türkçe yazarsan İngilizcesini gösterir.'}
          </p>
        </div>
      </header>

      {!aiConfigured() && <NotConfigured />}

      <article className={`card ${styles.chatCard}`}>
        {visible.length === 0 && !loading && <p className="muted">Sohbet başlatılıyor…</p>}
        {visible.map(({ m, i }) => (
          <div key={i} className={`${styles.msg} ${m.role === 'user' ? styles.msgUser : styles.msgAi}`}>
            <span className={styles.who}>{m.role === 'user' ? 'Ben:' : 'YZ:'}</span>
            <div className={styles.bubbleWrap}>
              <div className={styles.bubble}>
                {m.role === 'model' ? (
                  <AiText text={m.text} isAllowedLink={chat.mode === 'yds' ? isKnownRoute : undefined} />
                ) : (
                  <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{m.text}</p>
                )}
              </div>
              {m.role === 'user' && chat.mode === 'english' && <Feedback next={chat.messages[i + 1]} />}
              {m.role === 'model' && (
                <div className={styles.msgMeta}>
                  {canSpeak() && (
                    <button type="button" className={styles.iconBtn} onClick={() => listen(i, m.text)} aria-label="Dinle">
                      {speaking === i ? '⏹' : '🔊'}
                    </button>
                  )}
                  {m.meta && <small className="muted">{m.meta}</small>}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className={`${styles.msg} ${styles.msgAi}`}>
            <span className={styles.who}>YZ:</span>
            <div className={styles.bubble}>
              <span className="muted">yazıyor…</span>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </article>

      {error && (
        <p className={styles.error}>
          {error}{' '}
          {chat.messages.length === 0 && (
            <button type="button" className="btn btn-ghost" onClick={() => void send('', chat)}>
              Tekrar dene
            </button>
          )}
        </p>
      )}

      {chat.mode === 'yds' && !loading && chat.messages.length > 0 && (
        <div className={styles.chips}>
          {YDS_QUICK_PROMPTS.map((p) => (
            <button key={p} type="button" className={styles.chip} onClick={() => void send(p, chat)}>
              {p}
            </button>
          ))}
        </div>
      )}

      <SaveToMemory
        source={`coach:${chat.id}`}
        getTranscript={() => coachTranscript(chat)}
        disabled={loading || chat.messages.filter((m) => m.role === 'user' && !m.hidden).length === 0}
      />

      <div className={styles.composer}>
        <textarea
          className={styles.input}
          rows={2}
          value={input}
          disabled={loading || !aiConfigured()}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={
            chat.mode === 'yds'
              ? 'Koçuna yaz… (Enter: gönder, Shift+Enter: yeni satır)'
              : 'Write in English… (Enter: gönder, Shift+Enter: yeni satır)'
          }
        />
        <button type="button" className="btn btn-primary" disabled={loading || !input.trim()} onClick={submit}>
          Gönder
        </button>
      </div>
    </section>
  )
}

export default function CoachPage() {
  return (
    <Routes>
      <Route index element={<ChatList />} />
      <Route path="hafiza" element={<MemoryPage />} />
      <Route path=":chatId" element={<ChatView />} />
    </Routes>
  )
}
