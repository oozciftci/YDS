import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../db'
import { canSpeak, hasTurkishVoice, speakQueue, TTS_RATES, type SpeechItem } from '../services/tts'
import { useUserStore } from '../stores/user'
import { listOzgunReadings } from './exam/ozgunData'
import styles from './NightMode.module.css'

// Gece modu: yatarken dinlemek için kelime (apple, elma, apple, elma…) ya da paragraf cümleleri
// (İngilizce, Türkçe…) belirlenen sayıda tekrarlanarak sabaha kadar döngüde okunur.
// Tamamen tarayıcının kendi sesiyle çalışır: internet ve yapay zekâ (token) kullanmaz.

type Source = 'words' | 'paragraphs'
type WordPool = 'due' | 'learning' | 'all'
type ParaPool = 'ozgun' | 'exam' | 'story'

interface NightSettings {
  source: Source
  wordPool: WordPool
  paraPool: ParaPool
  order: 'en-tr' | 'tr-en'
  repeat: number
  gapSec: number
  rate: number
  minutes: number // 0 = durdurana kadar
  shuffle: boolean
  keepAwake: boolean
}

const DEFAULTS: NightSettings = {
  source: 'words',
  wordPool: 'all',
  paraPool: 'ozgun',
  order: 'en-tr',
  repeat: 3,
  gapSec: 2,
  rate: 0.9,
  minutes: 0,
  shuffle: true,
  keepAwake: true,
}

const KEY = 'yds-night'

function readSettings(): NightSettings {
  try {
    return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) || '{}') as Partial<NightSettings>) }
  } catch {
    return DEFAULTS
  }
}

/** Dinlenecek bir birim: bir kelime ya da bir cümle. */
interface Unit {
  en: string
  tr: string
  /** Paragraf adı (paragraf modunda). */
  group?: string
}

function shuffled<T>(list: T[]): T[] {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** "kötüleşmek; bozulmak (tıp)" → "kötüleşmek" gibi kısa, dinlemeye uygun anlam. */
function shortMeaning(def: string): string {
  return def.split(/[;\n]/)[0].replace(/\([^)]*\)/g, '').trim()
}

async function loadWordUnits(userId: string, pool: WordPool): Promise<Unit[]> {
  const words = await db.words.where('userId').equals(userId).filter((w) => !w.isDeleted).toArray()
  if (pool === 'all') return words.map((w) => ({ en: w.term, tr: shortMeaning(w.definition) }))
  const cards = await db.cardStates.where('userId').equals(userId).toArray()
  const now = new Date().toISOString()
  const keep = new Set(
    cards
      .filter((c) => c.reps > 0 && (pool === 'due' ? c.due <= now : (c.masteryScore ?? 1) <= 3))
      .map((c) => c.wordId),
  )
  return words.filter((w) => keep.has(w.id)).map((w) => ({ en: w.term, tr: shortMeaning(w.definition) }))
}

async function loadParagraphUnits(pool: ParaPool, userId = ''): Promise<Unit[]> {
  if (pool === 'story') {
    // Ana sayfadaki "Günün hikâyesi" kartlarının hepsi (en yeniden eskiye)
    const notes = await db.aiNotes.where('kind').equals('story').filter((n) => n.id.startsWith(`story:${userId}:`)).toArray()
    notes.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return notes.flatMap((n) => {
      const s = JSON.parse(n.text) as { title: string; sentences: { en: string; tr: string }[] }
      return s.sentences.map((x) => ({ en: x.en.replace(/\*\*/g, ''), tr: x.tr, group: `📜 ${s.title}` }))
    })
  }
  if (pool === 'exam' && import.meta.env.DEV) {
    const { loadAllExams, shortTitle } = await import('./exam/examData')
    const bundles = await loadAllExams()
    return bundles.flatMap((b) =>
      b.exam.passages
        .filter((p) => p.kind === 'reading')
        .flatMap((p) =>
          p.sentences
            .filter((s) => b.tr[s.id])
            .map((s) => ({ en: s.en, tr: b.tr[s.id], group: shortTitle(b.exam.title) })),
        ),
    )
  }
  const readings = await listOzgunReadings()
  return readings.flatMap((r) => r.sentences.filter((s) => s.tr).map((s) => ({ en: s.en, tr: s.tr ?? '', group: r.title })))
}

export default function NightModePage() {
  const userId = useUserStore((s) => s.activeUserId)
  const [cfg, setCfg] = useState<NightSettings>(readSettings)
  const [counts, setCounts] = useState<Record<string, number | undefined>>({})
  const [trVoice, setTrVoice] = useState(true)
  const [units, setUnits] = useState<Unit[] | null>(null)
  const [error, setError] = useState('')

  function update(patch: Partial<NightSettings>) {
    setCfg((c) => {
      const next = { ...c, ...patch }
      try {
        localStorage.setItem(KEY, JSON.stringify(next))
      } catch {
        // yoksay
      }
      return next
    })
  }

  // Kaynaklardaki öğe sayıları (seçimden önce görünsün)
  useEffect(() => {
    let alive = true
    void Promise.all([
      loadWordUnits(userId, 'due'),
      loadWordUnits(userId, 'learning'),
      loadWordUnits(userId, 'all'),
      loadParagraphUnits('ozgun'),
      loadParagraphUnits('story', userId),
      import.meta.env.DEV ? loadParagraphUnits('exam').catch(() => []) : Promise.resolve([]),
    ]).then(([due, learning, all, ozgun, story, exam]) => {
      if (alive) setCounts({ due: due.length, learning: learning.length, all: all.length, ozgun: ozgun.length, story: story.length, exam: exam.length })
    })
    return () => {
      alive = false
    }
  }, [userId])

  // Türkçe ses: sesler geç yüklenebildiği için değişince yeniden bak
  useEffect(() => {
    if (!canSpeak()) return
    const check = () => setTrVoice(hasTurkishVoice())
    check()
    window.speechSynthesis.addEventListener('voiceschanged', check)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', check)
  }, [])

  async function start() {
    setError('')
    const list = cfg.source === 'words' ? await loadWordUnits(userId, cfg.wordPool) : await loadParagraphUnits(cfg.paraPool, userId)
    if (list.length === 0) {
      setError('Bu seçimde dinlenecek bir şey yok. Başka bir kaynak seç.')
      return
    }
    // Paragraflarda cümle sırası korunur; karıştırma yalnızca kelimelerde
    setUnits(cfg.shuffle && cfg.source === 'words' ? shuffled(list) : list)
  }

  if (!canSpeak()) {
    return (
      <section className={styles.page}>
        <h1 className={styles.title}>🌙 Gece Modu</h1>
        <p className="muted">Bu tarayıcı seslendirmeyi desteklemiyor.</p>
      </section>
    )
  }

  if (units) return <Player units={units} cfg={cfg} onExit={() => setUnits(null)} />

  const n = (k: string) => (counts[k] === undefined ? '…' : counts[k])

  return (
    <section className={styles.page}>
      <header>
        <Link to="/calis" className={styles.back}>
          ← Çalış
        </Link>
        <h1 className={styles.title}>🌙 Gece Modu</h1>
        <p className="muted" style={{ margin: 0 }}>
          Yatarken dinle: kelime ya da paragraf cümleleri, İngilizce ve Türkçesiyle, seçtiğin sayıda tekrarlanır ve liste
          bitince başa döner. Tamamen cihazında çalışır; internet ve yapay zekâ kullanmaz.
        </p>
      </header>

      <div className={`card ${styles.form}`}>
        <fieldset className={styles.field}>
          <legend>Ne dinlemek istiyorsun?</legend>
          <div className={styles.choices}>
            <label className={cfg.source === 'words' ? styles.on : ''}>
              <input type="radio" checked={cfg.source === 'words'} onChange={() => update({ source: 'words' })} />
              📚 Kelime
              <small>apple, elma, apple, elma…</small>
            </label>
            <label className={cfg.source === 'paragraphs' ? styles.on : ''}>
              <input type="radio" checked={cfg.source === 'paragraphs'} onChange={() => update({ source: 'paragraphs', repeat: Math.min(cfg.repeat, 2) })} />
              📖 Paragraf
              <small>Cümle cümle İngilizce + Türkçe</small>
            </label>
          </div>
        </fieldset>

        {cfg.source === 'words' ? (
          <label className={styles.row}>
            <span>Hangi kelimeler?</span>
            <select value={cfg.wordPool} onChange={(e) => update({ wordPool: e.target.value as WordPool })}>
              <option value="learning">Öğrenmekte olduklarım ({n('learning')})</option>
              <option value="due">Bugün tekrarı gelenler ({n('due')})</option>
              <option value="all">Tüm kelimelerim ({n('all')})</option>
            </select>
          </label>
        ) : (
          <label className={styles.row}>
            <span>Hangi paragraflar?</span>
            <select value={cfg.paraPool} onChange={(e) => update({ paraPool: e.target.value as ParaPool })}>
              <option value="ozgun">Özgün okuma paragrafları ({n('ozgun')} cümle)</option>
              <option value="story">Günün hikâyelerim ({n('story')} cümle)</option>
              {import.meta.env.DEV && <option value="exam">Çıkmış sınav paragrafları ({n('exam')} cümle)</option>}
            </select>
          </label>
        )}

        <label className={styles.row}>
          <span>Okuma sırası</span>
          <select value={cfg.order} onChange={(e) => update({ order: e.target.value as NightSettings['order'] })}>
            <option value="en-tr">Önce İngilizce, sonra Türkçe</option>
            <option value="tr-en">Önce Türkçe, sonra İngilizce</option>
          </select>
        </label>

        <label className={styles.row}>
          <span>Her {cfg.source === 'words' ? 'kelime' : 'cümle'} kaç kez?</span>
          <select value={cfg.repeat} onChange={(e) => update({ repeat: Number(e.target.value) })}>
            {[1, 2, 3, 4, 5].map((k) => (
              <option key={k} value={k}>
                {k} kez
              </option>
            ))}
          </select>
        </label>

        <label className={styles.row}>
          <span>Aralarda bekleme</span>
          <select value={cfg.gapSec} onChange={(e) => update({ gapSec: Number(e.target.value) })}>
            {[1, 2, 3, 5, 8].map((k) => (
              <option key={k} value={k}>
                {k} saniye
              </option>
            ))}
          </select>
        </label>

        <label className={styles.row}>
          <span>Hız</span>
          <select value={cfg.rate} onChange={(e) => update({ rate: Number(e.target.value) })}>
            {TTS_RATES.map((r) => (
              <option key={r} value={r}>
                {r.toLocaleString('tr-TR')}×
              </option>
            ))}
          </select>
        </label>

        <label className={styles.row}>
          <span>Ne kadar sürsün?</span>
          <select value={cfg.minutes} onChange={(e) => update({ minutes: Number(e.target.value) })}>
            <option value={0}>Sabaha kadar (ben durdurana dek)</option>
            <option value={30}>30 dakika</option>
            <option value={60}>1 saat</option>
            <option value={120}>2 saat</option>
            <option value={240}>4 saat</option>
          </select>
        </label>

        {cfg.source === 'words' && (
          <label className={styles.check}>
            <input type="checkbox" checked={cfg.shuffle} onChange={(e) => update({ shuffle: e.target.checked })} />
            Kelimeleri karışık sırayla oku
          </label>
        )}
        <label className={styles.check}>
          <input type="checkbox" checked={cfg.keepAwake} onChange={(e) => update({ keepAwake: e.target.checked })} />
          Ekranı açık tut (karartılmış). Telefonlarda ekran kilitlenince ses çoğu zaman durur.
        </label>

        {!trVoice && (
          <p className={styles.warn}>
            Cihazında Türkçe ses bulunamadı; Türkçe kısımlar yanlış okunabilir. Windows’ta Ayarlar › Zaman ve dil › Konuşma
            bölümünden Türkçe ses ekleyebilirsin (telefonlarda genelde yüklüdür).
          </p>
        )}
        {error && <p className={styles.warn}>{error}</p>}

        <button type="button" className="btn btn-primary" onClick={() => void start()}>
          🌙 Başlat
        </button>
      </div>
    </section>
  )
}

/** Karanlık oynatıcı: birimleri tekrar sayısınca okur, liste bitince başa döner. */
function Player({ units, cfg, onExit }: { units: Unit[]; cfg: NightSettings; onExit: () => void }) {
  const [idx, setIdx] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [round, setRound] = useState(1)
  const [endsAt] = useState(() => (cfg.minutes ? Date.now() + cfg.minutes * 60_000 : 0))
  const [finished, setFinished] = useState(false)
  const stopRef = useRef<(() => void) | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const unit = units[idx]

  // Bir birimi oku; bitince bekle ve sıradakine geç
  useEffect(() => {
    if (!playing || finished) return
    if (endsAt && Date.now() >= endsAt) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFinished(true)
      return
    }
    const first = { text: cfg.order === 'en-tr' ? unit.en : unit.tr, lang: cfg.order === 'en-tr' ? 'en' : 'tr' } as const
    const second = { text: cfg.order === 'en-tr' ? unit.tr : unit.en, lang: cfg.order === 'en-tr' ? 'tr' : 'en' } as const
    const items: SpeechItem[] = []
    for (let r = 0; r < cfg.repeat; r++) {
      items.push({ ...first, pauseAfter: 500 }, { ...second, pauseAfter: 900 })
    }
    stopRef.current = speakQueue(items, {
      rate: cfg.rate,
      onDone: () => {
        stopRef.current = null
        timerRef.current = setTimeout(() => {
          setIdx((i) => {
            if (i + 1 >= units.length) {
              setRound((r) => r + 1)
              return 0
            }
            return i + 1
          })
        }, cfg.gapSec * 1000)
      },
    })
    return () => {
      clearTimeout(timerRef.current)
      stopRef.current?.()
      stopRef.current = null
    }
  }, [idx, round, playing, finished, unit, units.length, cfg, endsAt])

  // Ekranı açık tut
  useEffect(() => {
    if (!cfg.keepAwake || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    const take = () => {
      if (document.visibilityState === 'visible') {
        navigator.wakeLock.request('screen').then((l) => (lock = l)).catch(() => undefined)
      }
    }
    take()
    document.addEventListener('visibilitychange', take)
    return () => {
      document.removeEventListener('visibilitychange', take)
      void lock?.release()
    }
  }, [cfg.keepAwake])

  // Esc: çık
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onExit()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onExit])

  function skip(step: number) {
    setIdx((i) => (i + step + units.length) % units.length)
  }

  return (
    <div className={styles.night} role="dialog" aria-label="Gece modu oynatıcı">
      <div className={styles.nightTop}>
        <span>
          {idx + 1} / {units.length}
          {round > 1 && ` · ${round}. tur`}
        </span>
        {endsAt > 0 && <span>{new Date(endsAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}’de biter</span>}
      </div>

      <div className={styles.nightBody}>
        {unit.group && <small className={styles.nightGroup}>{unit.group}</small>}
        <p className={cfg.source === 'words' ? styles.nightWord : styles.nightSentence}>{unit.en}</p>
        <p className={styles.nightTr}>{unit.tr}</p>
        {finished && <p className={styles.nightTr}>Süre doldu. İyi uykular 🌙</p>}
      </div>

      <div className={styles.nightControls}>
        <button type="button" onClick={() => skip(-1)} aria-label="Önceki">
          ⏮
        </button>
        {finished ? (
          <button type="button" onClick={onExit}>
            Kapat
          </button>
        ) : (
          <button type="button" onClick={() => setPlaying((p) => !p)}>
            {playing ? '⏸ Duraklat' : '▶ Devam'}
          </button>
        )}
        <button type="button" onClick={() => skip(1)} aria-label="Sonraki">
          ⏭
        </button>
        <button type="button" onClick={onExit}>
          ⏹ Bitir
        </button>
      </div>
    </div>
  )
}
