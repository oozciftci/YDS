import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { fmtDuration, MAX_REAL_WPM, writeLog } from '../../services/readingLog'
import { coverage, readHighlight, saveHighlight, useWordStatus } from '../../services/wordStatus'
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
  /** Paragraf düzeni (kitaplar): her paragrafın cümle sayısı ya da ara başlık; yoksa tek paragraf */
  paras?: (number | { h: string })[]
  /** Metnin üstünde (kitap: içindekiler/bölüm seçici) */
  before?: ReactNode
  /** Bilgi satırının sonunda, kelime durumu değişince yenilenen ek (kitap: kitabın bilinen oranı) */
  infoExtra?: ReactNode
}

/** Paragraf düzenini cümle aralıklarına çevirir */
function layout(paras: (number | { h: string })[]): ({ h: string } | { from: number; to: number })[] {
  let at = 0
  return paras.map((p) => (typeof p === 'number' ? { from: at, to: (at += p) } : p))
}

export function ReaderBody({ back, title, info, sentences, tr, words, logId, note, glossFor, after, paras, before, infoExtra }: Props) {
  const userId = useUserStore((s) => s.activeUserId)
  const [showTr, setShowTr] = useState(false)
  const [speaking, setSpeaking] = useState<number | null>(null)
  const [startedAt] = useState(() => Date.now())
  const [now, setNow] = useState(() => Date.now())
  const [finishedSec, setFinishedSec] = useState<number | null>(null)
  const { onWord, popover, lookedUp } = useWordPopover(note, glossFor, 'reading')
  // Kelime vurgusu ve bilinen oranı (services/wordStatus)
  const [highlight, setHighlight] = useState(readHighlight)
  const { ix, version, loaded, userId: ixUser, load: loadStatus, mark } = useWordStatus()
  useEffect(() => {
    if (userId) void loadStatus(userId) // her açılışta tazele: kartlar başka ekranda çalışılmış olabilir
  }, [userId, loadStatus])
  const ready = loaded && ixUser === userId
  const cov = useMemo(() => (ready ? coverage(ix, sentences.map((s) => s.en)) : null), [ready, ix, version, sentences]) // eslint-disable-line react-hooks/exhaustive-deps
  // Sayfa sonu: dokunmadan geçtiğin yeni kelimeler bilinen sayılabilir (anlamına baktıkların hariç)
  const untouched = useMemo(() => (cov ? cov.newWords.filter((w) => !lookedUp.includes(w)) : []), [cov, lookedUp])
  const [bulk, setBulk] = useState<string[] | null>(null)
  async function markRestKnown() {
    const list = untouched
    await mark(userId, list, 'known')
    setBulk(list)
  }
  async function undoBulk() {
    if (bulk) await mark(userId, bulk, 'new')
    setBulk(null)
  }
  const bulkBox =
    bulk ? (
      <p className="muted" style={{ margin: 0, fontSize: '0.84rem' }}>
        ✓ {bulk.length} kelime bilinenlere eklendi.{' '}
        <button type="button" className={styles.linkBtn} onClick={() => void undoBulk()}>
          Geri al
        </button>
      </p>
    ) : untouched.length > 0 ? (
      <button type="button" className="btn btn-secondary" onClick={() => void markRestKnown()} title="Anlamına bakmadığın yeni kelimeler bilinen sayılır; yanlışsa kelimeye dokunup “Yeniye döndür” diyebilirsin">
        ✓ Kalan {untouched.length} yeni kelimeyi bildiğim olarak işaretle
      </button>
    ) : null
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

  const hl = highlight && ready ? ix : undefined
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
            {cov && cov.total > 0 && (
              <span title="Bu sayfadaki kelime geçişlerinin bildiğin oranı (özel adlar ve yok saydıkların hariç)">
                {' '}
                · Bu sayfada bilinen %{cov.pct} · {cov.newWords.length} yeni
              </span>
            )}
            {infoExtra}
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
        <label className={styles.toggle} title="Yeni kelimeler mavi, öğrenmekte oldukların sarı">
          <input
            type="checkbox"
            checked={highlight}
            onChange={(e) => {
              setHighlight(e.target.checked)
              saveHighlight(e.target.checked)
            }}
          />
          Kelime vurgusu
        </label>
        <span className={styles.spacer} />
        {finishedSec === null && (
          <button type="button" className="btn btn-primary" onClick={finish} data-focus-keep>
            ✓ Okumayı bitirdim
          </button>
        )}
      </div>

      {before}

      <article className="card" data-focus-stage>
        {paras ? (
          layout(paras).map((b, k) =>
            'h' in b ? (
              <h3 key={k} className={styles.readHeading}>
                {b.h}
              </h3>
            ) : (
              <p key={k} className={`${styles.readText} ${styles.readPara}`}>
                {sentences.slice(b.from, b.to).map((s, j) => (
                  <SentenceView key={s.id} seg={s} tr={tr[s.id]} forceShow={showTr} onWord={onWord} assist active={speaking === b.from + j} ix={hl} ixVersion={version} />
                ))}
              </p>
            ),
          )
        ) : (
          <p className={styles.readText}>
            {sentences.map((s, i) => (
              <SentenceView key={s.id} seg={s} tr={tr[s.id]} forceShow={showTr} onWord={onWord} assist active={speaking === i} ix={hl} ixVersion={version} />
            ))}
          </p>
        )}

        {/* Metnin sonunda da: telefonda üst çubuk sabit değil, okuyup bitiren yukarı dönmesin */}
        {finishedSec === null && (
          <div className={styles.readEnd}>
            {bulkBox}
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
            {bulkBox}
            {after}
          </div>
        )}
      </article>

      {popover}
    </>
  )
}
