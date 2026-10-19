import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { AiText } from '../../components/AiText'
import { db } from '../../db'
import { aiConfigured, generateChat } from '../../services/ai'
import { sectionOf } from '../../services/ydsSections'
import type { AiNoteTurn } from '../../types/database'
import styles from '../ExamStudy.module.css'
import type { ExamBundle, Question } from './examData'

// Soru başına yapay zekâ sohbeti: ilk mesaj soruyu açıklatır (isteğe bağlı olarak öğrencinin takıldığı nokta
// ile), sonra öğrenci devam soruları sorabilir. Sohbet cihazda saklanır; geri dönüldüğünde geçmiş görünür.

const SYSTEM = `Sen deneyimli bir YDS (Yabancı Dil Seviye Tespit Sınavı) İngilizce öğretmenisin ve Türk bir öğrenciyle konuşuyorsun.

İlk açıklamada Türkçe, sade ve kısa yaz; şu biçimi kullan:
**Doğru cevap: X)** — neden doğru olduğu (2-3 cümle; cümledeki ipucu kelimeleri tırnakla göster).
**Şıklar:** her şık için tek satırlık madde ("- A) … : neden olmaz / neden olur").
**Sınav ipucu:** bu soru tipini hızlı çözmek için 1-2 cümlelik strateji.
**Önemli kelimeler:** 3-5 kelime/kalıp ve Türkçe anlamı, madde olarak.
Bu ilk açıklama 250 kelimeyi geçmesin.

Öğrenci sonradan soru sorarsa biçim zorunluluğu yok: yalnızca sorduğu noktaya odaklan, kısa ve somut yanıt ver, gerekirse kısa bir İngilizce örnek cümle ve Türkçesini ekle. Öğrencinin yanlış bir varsayımı varsa nazikçe ve gerekçesiyle düzelt; doğru bir noktası varsa bunu da kabul et.
Verilen cevap anahtarı esastır. Emin olmadığın bir şeyi uydurma; emin değilsen bunu söyle.`

const DEFAULT_ASK = 'Bu soruyu açıklar mısın?'

/** İlk mesaj: soru bağlamı + (varsa) öğrencinin özel sorusu. Öğrencinin metni sistem talimatına değil, mesaja konur. */
function buildFirstPrompt(bundle: ExamBundle, q: Question, choice: string | null, studentQuestion: string): string {
  const passage = q.passage ? bundle.exam.passages.find((p) => p.id === q.passage) : undefined
  const section = sectionOf(q.no)
  const lines = [`Sınav: ${bundle.exam.title}, Soru ${q.no} (${section.label}: ${section.hint})`]
  if (passage) lines.push('', 'Paragraf:', passage.sentences.map((s) => s.en).join(' '))
  if (q.stem.length) lines.push('', 'Soru:', q.stem.map((s) => s.en).join(' '))
  lines.push('', 'Şıklar:')
  for (const [l, o] of Object.entries(q.options)) lines.push(`${l}) ${o.en}`)
  lines.push('', `Doğru cevap (cevap anahtarı): ${q.answer}`)
  if (choice && choice !== q.answer) lines.push(`Öğrencinin işaretlediği: ${choice} (yanlış). Bu şıkkın neden yanlış olduğunu özellikle açıkla.`)
  else if (choice) lines.push(`Öğrenci doğru cevabı (${choice}) işaretledi.`)
  if (studentQuestion) {
    lines.push(
      '',
      'Öğrencinin bu soruda takıldığı nokta (kendi sözleriyle):',
      '"""',
      studentQuestion,
      '"""',
      'Önce yukarıdaki biçimde genel açıklamayı yap. Ardından "**Senin sorun:**" başlığıyla bu noktayı doğrudan yanıtla: öğrencinin düşüncesini ciddiye al, bu bağlamda neden tutmadığını (ya da tuttuğunu) somut bir karşılaştırma veya örnek cümleyle göster.',
    )
  }
  return lines.join('\n')
}

export function AiExplain({ bundle, q, choice }: { bundle: ExamBundle; q: Question; choice: string | null }) {
  const id = `explain:${bundle.exam.id}#${q.no}`
  const [turns, setTurns] = useState<AiNoteTurn[]>([])
  const [loaded, setLoaded] = useState(false)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  // Kayıtlı sohbeti yükle (eski kayıtlar yalnızca ilk yanıtı içerir)
  useEffect(() => {
    let alive = true
    void db.aiNotes.get(id).then((n) => {
      if (!alive) return
      if (n?.messages?.length) setTurns(n.messages)
      else if (n) {
        setTurns([
          { role: 'user', text: DEFAULT_ASK, prompt: buildFirstPrompt(bundle, q, choice, ''), at: n.createdAt },
          { role: 'model', text: n.text, meta: n.model, at: n.createdAt },
        ])
      }
      setLoaded(true)
    })
    return () => {
      alive = false
    }
    // Soru değişince bileşen yeniden kurulur (key); seçim değişince geçmiş yeniden yüklenmez
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function send() {
    if (loading) return
    const text = input.trim()
    const first = turns.length === 0
    if (!first && !text) return
    const now = new Date().toISOString()
    const userTurn: AiNoteTurn = first
      ? { role: 'user', text: text || DEFAULT_ASK, prompt: buildFirstPrompt(bundle, q, choice, text), at: now }
      : { role: 'user', text, at: now }
    const history = [...turns, userTurn]
    setTurns(history)
    setInput('')
    setLoading(true)
    setError('')
    try {
      const r = await generateChat(
        SYSTEM,
        history.map((t) => ({ role: t.role, text: t.prompt ?? t.text })),
        first ? 0.3 : 0.5,
      )
      const meta = `${r.model} · ${r.tier === 'paid' ? `ücretli (~${r.usd.toFixed(4)} $)` : 'ücretsiz katman'}`
      const next = [...history, { role: 'model' as const, text: r.text, meta, at: new Date().toISOString() }]
      setTurns(next)
      const firstModel = next.find((t) => t.role === 'model')
      await db.aiNotes.put({ id, kind: 'explain', text: firstModel?.text ?? r.text, model: r.model, createdAt: next[0].at, messages: next })
    } catch (e) {
      // Yanıt gelmediyse kullanıcının mesajını geri al, metni kutuya geri koy
      setTurns(turns)
      setInput(text)
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (turns.length > 1) endRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [turns.length])

  async function clear() {
    if (!confirm('Bu sorunun yapay zekâ sohbeti silinsin mi?')) return
    await db.aiNotes.delete(id)
    setTurns([])
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send()
    }
  }

  if (!q.answer || !loaded) return null

  if (!aiConfigured()) {
    return (
      <div className={styles.aiBox}>
        <span className="muted" style={{ fontSize: '0.85rem' }}>
          🤖 Yapay zekâ açıklaması için <Link to="/settings#ai">Ayarlar &gt; Yapay Zekâ</Link>’dan Gemini anahtarını ekle.
        </span>
      </div>
    )
  }

  const started = turns.length > 0
  return (
    <div className={styles.aiBox} data-noswipe>
      <div className={styles.aiHead}>
        <strong>🤖 Yapay zekâ {started ? 'sohbeti' : 'açıklaması'}</strong>
        <span className={styles.spacer} />
        {started && (
          <button type="button" className="btn btn-ghost" onClick={() => void clear()} title="Bu sorunun sohbetini sil">
            Sohbeti temizle
          </button>
        )}
      </div>

      {started && (
        <div className={styles.chat}>
          {turns.map((t, i) => (
            <div key={i} className={`${styles.msg} ${t.role === 'user' ? styles.msgUser : styles.msgAi}`}>
              <span className={styles.msgWho}>{t.role === 'user' ? 'Ben:' : 'YZ:'}</span>
              <div className={styles.msgBody}>
                {t.role === 'model' ? <AiText text={t.text} /> : <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{t.text}</p>}
                {t.meta && <small className="muted">{t.meta}</small>}
              </div>
            </div>
          ))}
          {loading && (
            <div className={`${styles.msg} ${styles.msgAi}`}>
              <span className={styles.msgWho}>YZ:</span>
              <div className={styles.msgBody}>
                <span className="muted">yazıyor…</span>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
      )}

      <textarea
        className={styles.aiInput}
        rows={started ? 2 : 3}
        value={input}
        disabled={loading}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={
          started
            ? 'Bu soruyla ilgili başka bir şey sor… (Enter: gönder, Shift+Enter: yeni satır)'
            : 'İstersen takıldığın noktayı yaz; örn. “help kullanmak istedim ama lead verilmiş, help’in şu anlamı neden olmuyor?” Boş bırakırsan genel açıklama yapılır.'
        }
      />
      <div className={styles.aiHead}>
        <button type="button" className="btn btn-secondary" disabled={loading || (started && !input.trim())} onClick={() => void send()}>
          {loading ? '🤖 Yanıt hazırlanıyor…' : started ? 'Gönder' : '🤖 Yapay zekâ ile açıkla'}
        </button>
        <small className="muted">Yapay zekâ hata yapabilir; resmi cevap anahtarı esastır.</small>
      </div>
      {error && <p className={styles.aiError}>{error}</p>}
    </div>
  )
}
