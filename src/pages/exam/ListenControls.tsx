import { useEffect, useMemo, useRef, useState } from 'react'
import { buildQueue, canSpeak, getSpeechRate, setSpeechRate, speakQueue, TTS_RATES, type ListenOrder } from '../../services/tts'
import styles from '../ExamStudy.module.css'
import type { Seg } from './examData'

const ORDER_KEY = 'yds-listen-order'
const ORDERS: { key: ListenOrder; label: string }[] = [
  { key: 'en', label: 'Yalnız İngilizce' },
  { key: 'en-tr', label: 'Cümle cümle: İngilizce → Türkçe' },
  { key: 'tr-en', label: 'Cümle cümle: Türkçe → İngilizce' },
]

function readOrder(): ListenOrder {
  try {
    const v = localStorage.getItem(ORDER_KEY)
    return v === 'en-tr' || v === 'tr-en' ? v : 'en'
  } catch {
    return 'en'
  }
}

interface Props {
  sentences: Seg[]
  tr: Record<string, string>
  /** O an okunan cümlenin sırası (vurgu için); null = okunmuyor. */
  onActive: (i: number | null) => void
  /** Hız seçici gösterilsin mi. */
  showRate?: boolean
}

/**
 * Paragraf dinleme: Dinle → Duraklat → Devam et (kaldığı cümleden), Baştan.
 * Çeviri varsa cümle cümle İngilizce→Türkçe ya da Türkçe→İngilizce okunabilir. Tarayıcının kendi sesi kullanılır (ücretsiz).
 */
export function ListenControls({ sentences, tr, onActive, showRate = false }: Props) {
  const [order, setOrder] = useState<ListenOrder>(readOrder)
  const [rate, setRate] = useState(getSpeechRate)
  // pos: sıradaki/okunan parça; null = hiç başlamadı ya da bitti
  const [pos, setPos] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const stopRef = useRef<(() => void) | null>(null)
  const posRef = useRef(0)

  const hasTr = sentences.some((s) => tr[s.id])
  const { items, refs } = useMemo(
    () => buildQueue(sentences.map((s) => ({ en: s.en, tr: tr[s.id] })), hasTr ? order : 'en'),
    [sentences, tr, order, hasTr],
  )

  // Ayrılınca sustur
  useEffect(
    () => () => {
      stopRef.current?.()
      stopRef.current = null
    },
    [],
  )

  function play(from: number, r = rate) {
    stopRef.current?.()
    setPlaying(true)
    setPos(from)
    posRef.current = from
    onActive(refs[from] ?? null)
    stopRef.current = speakQueue(items, {
      rate: r,
      start: from,
      onItem: (i) => {
        posRef.current = i
        setPos(i)
        onActive(refs[i] ?? null)
      },
      onDone: () => {
        stopRef.current = null
        setPlaying(false)
        setPos(null)
        onActive(null)
      },
    })
  }

  function pause() {
    stopRef.current?.()
    stopRef.current = null
    setPlaying(false)
    // Devam edince o an okunan parça baştan okunur
    setPos(posRef.current)
  }

  function restart() {
    play(0)
  }

  function changeOrder(o: ListenOrder) {
    setOrder(o)
    try {
      localStorage.setItem(ORDER_KEY, o)
    } catch {
      // yoksay
    }
    // Sıra değişince kuyruk yeniden kurulur; o cümlenin başından devam edilir
    if (pos !== null) {
      const sentence = refs[pos] ?? 0
      stopRef.current?.()
      stopRef.current = null
      setPlaying(false)
      const next = buildQueue(sentences.map((s) => ({ en: s.en, tr: tr[s.id] })), hasTr ? o : 'en')
      const at = Math.max(0, next.refs.indexOf(sentence))
      posRef.current = at
      setPos(at)
    }
  }

  function changeRate(r: number) {
    setRate(r)
    setSpeechRate(r)
    if (playing) play(posRef.current, r)
  }

  if (!canSpeak()) return null

  const started = pos !== null
  return (
    <span className={styles.listen}>
      {playing ? (
        <button type="button" className={styles.pdfBtn} onClick={pause}>
          ⏸ Duraklat
        </button>
      ) : started ? (
        <>
          <button type="button" className={styles.pdfBtn} onClick={() => play(pos)}>
            ▶ Devam et
          </button>
          <button type="button" className={styles.pdfBtn} onClick={restart} title="Baştan dinle">
            ⏮ Baştan
          </button>
        </>
      ) : (
        <button type="button" className={styles.pdfBtn} onClick={() => play(0)}>
          🔊 Dinle
        </button>
      )}
      {hasTr && (
        <select
          className={styles.rateSelect}
          value={order}
          onChange={(e) => changeOrder(e.target.value as ListenOrder)}
          aria-label="Okuma sırası"
          title="Okuma sırası"
        >
          {ORDERS.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>
      )}
      {showRate && (
        <select
          className={styles.rateSelect}
          value={rate}
          onChange={(e) => changeRate(Number(e.target.value))}
          aria-label="Seslendirme hızı"
        >
          {TTS_RATES.map((r) => (
            <option key={r} value={r}>
              {r.toLocaleString('tr-TR')}×
            </option>
          ))}
        </select>
      )}
    </span>
  )
}
