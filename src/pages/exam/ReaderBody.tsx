import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { fmtDuration, MAX_REAL_WPM, writeLog } from '../../services/readingLog'
import { useUserStore } from '../../stores/user'
import styles from '../ExamStudy.module.css'
import type { Seg } from './examData'
import { ListenControls } from './ListenControls'
import { PacerControls } from './PacerControls'
import { SentenceView, useWordPopover } from './WordPopover'

// Ortak okuyucu (Okuma Modu ve Okuma Kütüphanesi): süre, dinleme, okuma hızı, çeviriler, dokunulan kelimenin anlamı;
// "Okumayı bitirdim" → hız, baktığın kelimeler ve sayfaya özgü devamı (sorular, sonraki metin) aynı kartta, metnin altında.
// Kart sayfanın ana alanıdır ([data-focus-stage]): odak modunda metin + sonuç birlikte görünür, kart kendi içinde kayar.
// Metin değişince bileşen anahtarla yeniden kurulmalı (süre, çeviriler, bakılan kelimeler baştan başlar).

interface Props {
  back: { to: string; label: string }
  title: ReactNode
  /** Başlığın altındaki bilgi satırı */
  info: ReactNode
  sentences: Seg[]
  tr: Record<string, string>
  words: number
  /** Okuma kaydının kimliği (readingLog) */
  logId: string
  /** Havuza eklenen kelimenin notu */
  note: string
  /** Metnin kendi kelime anlamları */
  glossFor?: (word: string) => string | undefined
  /** Bitirince sonucun altında (anlama soruları, sonraki metin düğmesi …) */
  after?: ReactNode
}

export function ReaderBody({ back, title, info, sentences, tr, words, logId, note, glossFor, after }: Props) {
  const userId = useUserStore((s) => s.activeUserId)
  const [showTr, setShowTr] = useState(false)
  const [speaking, setSpeaking] = useState<number | null>(null)
  const [startedAt] = useState(() => Date.now())
  const [now, setNow] = useState(() => Date.now())
  const [finishedSec, setFinishedSec] = useState<number | null>(null)
  const { onWord, popover, lookedUp } = useWordPopover(note, glossFor)
  const resultRef = useRef<HTMLDivElement>(null)

  // Yeni metin baştan görünsün (kaydırarak gelindiğinde sayfa aşağıda kalmasın)
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  // Süre sayacı (okuma bitene kadar)
  useEffect(() => {
    if (finishedSec !== null) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [finishedSec])

  // Sonuç görünsün (odak modunda kart kendi içinde kayar)
  useEffect(() => {
    if (finishedSec !== null) resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [finishedSec])

  const elapsed = finishedSec ?? (now - startedAt) / 1000
  const wpm = finishedSec ? Math.round((words / finishedSec) * 60) : null

  function finish() {
    const sec = Math.max(1, Math.round((Date.now() - startedAt) / 1000))
    setFinishedSec(sec)
    const skim = (words / sec) * 60 > MAX_REAL_WPM
    writeLog(userId, logId, { sec, words, at: new Date().toISOString(), ...(skim ? { skim } : {}) })
  }

  return (
    <>
      <header className={styles.head}>
        <div>
          <Link to={back.to} className={styles.backLink}>
            {back.label}
          </Link>
          <h1 className={styles.title}>{title}</h1>
          <p className="muted" style={{ margin: 0, fontSize: '0.88rem' }}>
            {info}
          </p>
        </div>
      </header>

      <div className={styles.readBar}>
        <span className={styles.timer} title="Okuma süresi" data-focus-keep>
          ⏱ {fmtDuration(elapsed)}
        </span>
        <ListenControls sentences={sentences} tr={tr} onActive={setSpeaking} showRate />
        <PacerControls userId={userId} sentences={sentences} onActive={setSpeaking} />
        <label className={styles.toggle}>
          <input type="checkbox" checked={showTr} onChange={(e) => setShowTr(e.target.checked)} />
          Çeviriler
        </label>
        <span className={styles.spacer} />
        {finishedSec === null && (
          <button type="button" className="btn btn-primary" onClick={finish} data-focus-keep>
            ✓ Okumayı bitirdim
          </button>
        )}
      </div>

      <article className="card" data-focus-stage>
        <p className={styles.readText}>
          {sentences.map((s, i) => (
            <SentenceView key={s.id} seg={s} tr={tr[s.id]} forceShow={showTr} onWord={onWord} assist active={speaking === i} />
          ))}
        </p>

        {/* Metnin sonunda da: telefonda üst çubuk sabit değil, okuyup bitiren yukarı dönmesin */}
        {finishedSec === null && (
          <div className={styles.readEnd}>
            <button type="button" className="btn btn-primary" onClick={finish}>
              ✓ Okumayı bitirdim
            </button>
          </div>
        )}

        {finishedSec !== null && (
          <div ref={resultRef} className={styles.readResult}>
            <div className={styles.readStats}>
              <span>
                <span className={styles.readBig}>{wpm}</span> kelime/dk
              </span>
              <span className="muted">{fmtDuration(finishedSec)} sürede okudun</span>
            </div>
            {wpm && wpm > MAX_REAL_WPM && (
              <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--warning)' }}>
                Çok hızlı bitirdin; bu bir göz gezdirme gibi görünüyor, okuma hızı olarak sayılmadı. Gerçek hızını ölçmek için
                metni baştan sona okuyup sonra bitir.
              </p>
            )}
            {wpm && wpm <= MAX_REAL_WPM && (
              <p className="muted" style={{ margin: 0, fontSize: '0.86rem' }}>
                Bu hızla sınavdaki 5 okuma paragrafını (yaklaşık 200'er kelime) yalnızca okumak {Math.round(1000 / wpm)} dakika
                sürer (sorular hariç).
              </p>
            )}
            {lookedUp.length > 0 && (
              <div>
                <strong style={{ fontSize: '0.9rem' }}>Anlamına baktığın kelimeler ({lookedUp.length})</strong>
                <div className={styles.chipRow} style={{ marginTop: '0.35rem' }}>
                  {lookedUp.map((w) => (
                    <span key={w} className={styles.chip}>
                      {w}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {after}
          </div>
        )}
      </article>

      {popover}
    </>
  )
}
