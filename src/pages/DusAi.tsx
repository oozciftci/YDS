import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { AiText } from '../components/AiText'
import { db } from '../db'
import { aiConfigured, generateChat } from '../services/ai'
import { dusImageUrl, loadDusTexts, subjectOf, type DusExam, type DusQuestion, type DusTestKey, type DusText } from '../services/dus'
import { localFetch } from '../services/localContent'
import { useUserStore } from '../stores/user'
import type { AiNoteTurn } from '../types/database'
import styles from './ExamStudy.module.css'

// DUS sorusu için yapay zekâ sohbeti (Gemini). Soru sayfadan kırpılmış görüntü olduğu için görüntü de gönderilir
// (şekil, radyografi, tablo okunabilsin); metin yardımcı olarak eklenir: varsa denetlenmiş OCR metni (soru + şıklar),
// yoksa PDF'ten çıkan ham metin. Sohbet cihazda (aiNotes) saklanır.

const SYSTEM = `Sen Diş Hekimliğinde Uzmanlık Eğitimi Giriş Sınavı'na (DUS) hazırlayan deneyimli bir öğretim üyesisin ve Türk bir diş hekimiyle konuşuyorsun.

Sana ÖSYM'nin çıkmış bir DUS sorusunun görüntüsü, metni (görüntüden okunmuş ya da PDF'ten çıkarılmış; hatalı olabilir) ve resmî cevap anahtarı verilir. Soruyu görüntüden oku; metin yalnızca yardımcıdır.

İlk açıklamada Türkçe, sade ve kısa yaz; şu biçimi kullan:
**Doğru cevap: X)** — neden doğru olduğu (2-4 cümle, temel bilgi ya da mekanizma).
**Şıklar:** her şık için tek satırlık madde ("- A) … : neden olmaz / neden olur").
**Akılda kalsın:** sınavda işe yarayacak 1-2 cümlelik kural, sınıflama ya da hafıza ipucu.
**Terimler:** sorudaki 2-5 önemli terim ve kısa Türkçe açıklaması, madde olarak.
Bu ilk açıklama 300 kelimeyi geçmesin.

Öğrenci sonradan soru sorarsa biçim zorunluluğu yok: sorduğu noktaya odaklan, kısa ve somut yanıt ver.
Resmî cevap anahtarı esastır; ona karşı çıkma. Emin olmadığın bilgiyi uydurma, emin değilsen bunu açıkça söyle. Klinik doz ya da tedavi önerisini kesin bilgi gibi sunma; ders kitabına yönlendir.`

const DEFAULT_ASK = 'Bu soruyu açıklar mısın?'

/** Soru kutusunu sayfa görüntüsünden kırpıp JPEG (base64) yapar. */
async function cropImage(exam: DusExam, q: DusQuestion): Promise<{ mime: string; data: string } | null> {
  try {
    const r = await localFetch(dusImageUrl(exam.id, q.page))
    if (!r.ok) return null
    const bmp = await createImageBitmap(await r.blob())
    const [x0, y0, x1, y1] = q.box
    const sx = Math.round(x0 * bmp.width)
    const sy = Math.round(y0 * bmp.height)
    const sw = Math.round((x1 - x0) * bmp.width)
    const sh = Math.round((y1 - y0) * bmp.height)
    const canvas = document.createElement('canvas')
    canvas.width = sw
    canvas.height = sh
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, sw, sh)
    ctx.drawImage(bmp, sx, sy, sw, sh, 0, 0, sw, sh)
    bmp.close()
    return { mime: 'image/jpeg', data: canvas.toDataURL('image/jpeg', 0.85).split(',')[1] }
  } catch {
    return null
  }
}

/** Yardımcı metin: varsa OCR (soru + şıklar), yoksa PDF metni. */
function promptText(q: DusQuestion, ocr: DusText | null | undefined): string[] {
  if (ocr?.soru) {
    const opts = ['A', 'B', 'C', 'D', 'E'].filter((l) => ocr.siklar[l]).map((l) => `${l}) ${ocr.siklar[l]}`)
    return ['Soru metni (görüntüden okundu; yardımcı):', ocr.soru, ...opts]
  }
  return ['PDF metni (yardımcı; şıklar ve satırlar karışmış olabilir):', q.text]
}

function firstPrompt(
  exam: DusExam,
  test: DusTestKey,
  q: DusQuestion,
  choice: string | undefined,
  studentQuestion: string,
  ocr?: DusText | null,
) {
  const subject = subjectOf(test, q.n)
  const lines = [
    `Sınav: ${exam.title}, ${test === 'tbt' ? 'Temel Bilimler' : 'Klinik Bilimler'} Testi, Soru ${q.n}${subject ? ` (ders: ${subject.title})` : ''}`,
    '',
    ...promptText(q, ocr),
    '',
    `Doğru cevap (ÖSYM cevap anahtarı): ${q.answer}`,
  ]
  if (choice && choice !== q.answer) lines.push(`Öğrencinin işaretlediği: ${choice} (yanlış). Bu şıkkın neden yanlış olduğunu özellikle açıkla.`)
  else if (choice) lines.push(`Öğrenci doğru cevabı (${choice}) işaretledi.`)
  if (studentQuestion) lines.push('', 'Öğrencinin takıldığı nokta (kendi sözleriyle):', '"""', studentQuestion, '"""', 'Genel açıklamadan sonra "**Senin sorun:**" başlığıyla bu noktayı doğrudan yanıtla.')
  return lines.join('\n')
}

export function DusAiExplain({ exam, test, q, choice }: { exam: DusExam; test: DusTestKey; q: DusQuestion; choice?: string }) {
  const userId = useUserStore((s) => s.activeUserId)
  const id = `dus:${userId}:${exam.id}/${test}/${q.n}`
  const [turns, setTurns] = useState<AiNoteTurn[]>([])
  const [loaded, setLoaded] = useState(false)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true
    void db.aiNotes.get(id).then((n) => {
      if (!alive) return
      if (n?.messages?.length) setTurns(n.messages)
      setLoaded(true)
    })
    return () => {
      alive = false
    }
  }, [id])

  useEffect(() => {
    if (turns.length > 1) endRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [turns.length])

  async function send() {
    if (loading) return
    const text = input.trim()
    const first = turns.length === 0
    if (!first && !text) return
    const now = new Date().toISOString()
    setLoading(true)
    const ocr = first ? ((await loadDusTexts(exam.id))[`${test}/${q.n}`] ?? null) : null
    const userTurn: AiNoteTurn = first
      ? { role: 'user', text: text || DEFAULT_ASK, prompt: firstPrompt(exam, test, q, choice, text, ocr), at: now }
      : { role: 'user', text, at: now }
    const history = [...turns, userTurn]
    setTurns(history)
    setInput('')
    setLoading(true)
    setError('')
    try {
      // Görüntü her istekte ilk mesaja eklenir (Gemini hafızasız); kaydedilmez
      const image = await cropImage(exam, q)
      const r = await generateChat(
        SYSTEM,
        history.map((t, i) => ({ role: t.role, text: t.prompt ?? t.text, images: i === 0 && image ? [image] : undefined })),
        first ? 0.3 : 0.5,
      )
      const meta = `${r.model} · ${r.tier === 'paid' ? `ücretli (~${r.usd.toFixed(4)} $)` : 'ücretsiz katman'}${image ? '' : ' · görüntüsüz'}`
      const next = [...history, { role: 'model' as const, text: r.text, meta, at: new Date().toISOString() }]
      setTurns(next)
      const firstModel = next.find((t) => t.role === 'model')
      await db.aiNotes.put({ id, kind: 'dus-explain', text: firstModel?.text ?? r.text, model: r.model, createdAt: next[0].at, messages: next })
    } catch (e) {
      setTurns(turns)
      setInput(text)
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

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

  if (!loaded) return null
  if (!aiConfigured())
    return (
      <div className={styles.aiBox}>
        <span className="muted" style={{ fontSize: '0.85rem' }}>
          🤖 Yapay zekâ açıklaması için <Link to="/settings#ai">Ayarlar &gt; Yapay Zekâ</Link>’dan Gemini anahtarını ekle.
        </span>
      </div>
    )

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
        rows={started ? 2 : 2}
        value={input}
        disabled={loading}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={
          started
            ? 'Bu soruyla ilgili başka bir şey sor… (Enter: gönder)'
            : 'İstersen takıldığın noktayı yaz; boş bırakırsan genel açıklama yapılır.'
        }
      />
      <div className={styles.aiHead}>
        <button type="button" className="btn btn-secondary" disabled={loading || (started && !input.trim())} onClick={() => void send()}>
          {loading ? '🤖 Yanıt hazırlanıyor…' : started ? 'Gönder' : '🤖 Yapay zekâ ile açıkla'}
        </button>
        <small className="muted">Yapay zekâ hata yapabilir; ÖSYM cevap anahtarı esastır.</small>
      </div>
      {error && <p className={styles.aiError}>{error}</p>}
    </div>
  )
}
