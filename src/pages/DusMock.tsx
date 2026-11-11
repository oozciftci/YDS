import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import {
  DUS_SUBJECTS,
  DUS_TESTS,
  dusImageUrl,
  listDusExams,
  loadDusExam,
  loadDusSolutions,
  loadDusTexts,
  saveDusAnswer,
  subjectOf,
  type DusExam,
  type DusExamMeta,
  type DusQuestion,
  type DusSolution,
  type DusSubject,
  type DusTestKey,
  type DusText,
} from '../services/dus'
import {
  DUS_MOCK_SCOPES,
  activeRun,
  addMockLog,
  bestByExam,
  closeRun,
  examItems,
  isDone,
  logEntryOf,
  netPct,
  newRun,
  parseKey,
  pickMixed,
  readMockLog,
  remainingSec,
  scopeInfo,
  scoreMock,
  writeRun,
  type DusMockLogEntry,
  type DusMockRun,
  type DusMockScope,
} from '../services/dusMock'
import { useLocalUrl } from '../services/localContent'
import { AiText } from '../components/AiText'
import { useUserStore } from '../stores/user'
import styles from './ExamStudy.module.css'
import m from './DusMock.module.css'
import { useQuestionNav } from './exam/answerControls'
import { QuestionNav } from './exam/QuestionNav'

// DUS süreli deneme: çıkmış bir sınav ya da karma deneme, gerçek sınav gibi süreli ve yardımsız.
// Rotalar (/dus/deneme/*): giriş, `kos` (süren deneme), `sonuc/:runId` (sonuç ve inceleme).
// Saf mantık: src/services/dusMock.ts.

const LETTERS = ['A', 'B', 'C', 'D', 'E']
const BASE = '/dus/deneme'

function fmt(sec: number) {
  const s = Math.max(0, Math.floor(sec))
  const h = Math.floor(s / 3600)
  const mm = Math.floor((s % 3600) / 60)
  return `${h}:${String(mm).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}
const fmtNet = (n: number) => n.toLocaleString('tr-TR', { maximumFractionDigits: 2 })
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })
const testShort = (k: DusTestKey) => DUS_TESTS.find((t) => t.key === k)?.short ?? k

/** Yalnızca gerekli sınavları yükler. */
async function loadExams(keys: string[]): Promise<Map<string, DusExam>> {
  const ids = [...new Set(keys.map((k) => parseKey(k).examId))]
  const list = await Promise.all(ids.map((id) => loadDusExam(id).catch(() => null)))
  return new Map(list.filter((e): e is DusExam => !!e).map((e) => [e.id, e]))
}

interface Item {
  key: string
  exam: DusExam
  test: DusTestKey
  q: DusQuestion
}
function itemsOf(keys: string[], exams: Map<string, DusExam>): Item[] {
  const out: Item[] = []
  for (const key of keys) {
    const { examId, test, n } = parseKey(key)
    const exam = exams.get(examId)
    const q = exam?.tests.find((t) => t.key === test)?.questions.find((x) => x.n === n)
    if (exam && q) out.push({ key, exam, test, q })
  }
  return out
}
const answerLookup = (exams: Map<string, DusExam>) => (key: string) => {
  const { examId, test, n } = parseKey(key)
  return exams.get(examId)?.tests.find((t) => t.key === test)?.questions.find((x) => x.n === n)?.answer
}

// --- Soru kartı (yardımsız) ----------------------------------------------------

const VIEW_KEY = 'yds-dus-view'
const FONT_KEY = 'yds-dus-font'
const FONT_STEPS = [0.9, 1, 1.12, 1.25, 1.4, 1.6, 1.8]
function readLs(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function writeLs(key: string, v: string) {
  try {
    localStorage.setItem(key, v)
  } catch {
    // yoksay
  }
}

function PageCrop({ exam, page, box }: { exam: DusExam; page: number; box: DusQuestion['box'] | null }) {
  const p = exam.pages[page - 1]
  const [x0, y0, x1, y1] = box ?? [0, 0, 1, 1]
  const bw = x1 - x0
  const bh = y1 - y0
  const src = useLocalUrl(dusImageUrl(exam.id, page))
  return (
    <div className={styles.cropFrame} style={{ aspectRatio: `${(p?.w ?? 1) * bw} / ${(p?.h ?? 1) * bh}` }}>
      <img
        src={src}
        alt={`Sayfa ${page}`}
        draggable={false}
        style={{ width: `${100 / bw}%`, left: `${(-x0 / bw) * 100}%`, top: `${(-y0 / bh) * 100}%` }}
      />
    </div>
  )
}

function StemText({ text }: { text: string }) {
  const lines = text.split('\n').filter((l) => l.trim())
  return (
    <div className={styles.dusStem}>
      {lines.map((l, i) =>
        l.includes(' | ') ? (
          <div key={i} className={styles.dusRow}>
            {l.split(' | ').map((c, j) => (
              <span key={j}>{c}</span>
            ))}
          </div>
        ) : (
          <p key={i} className={/^\s*(I{1,3}|IV|VI{0,3}|IX|X)\.\s/.test(l) ? styles.dusItem : undefined}>
            {l}
          </p>
        ),
      )}
    </div>
  )
}

function Cols({ text }: { text: string }) {
  return (
    <span className={styles.dusCols}>
      {text.split(' | ').map((c, i) => (
        <span key={i}>{c}</span>
      ))}
    </span>
  )
}

/**
 * Deneme sorusu: metin ya da kitapçık görüntüsü, şıklar. Terim balonu, çözüm ve YZ yok.
 * `answer` verilirse (inceleme) doğru/yanlış boyanır ve seçim kilitlenir.
 */
function MockCard({
  exam,
  test,
  q,
  title,
  chip,
  choice,
  onChoose,
  answer,
  children,
}: {
  exam: DusExam
  test: DusTestKey
  q: DusQuestion
  title: string
  chip?: DusSubject
  choice: string | null
  onChoose?: (letter: string) => void
  answer?: string
  children?: ReactNode
}) {
  const [txt, setTxt] = useState<DusText | null | undefined>(undefined)
  const [pref, setPref] = useState(() => readLs(VIEW_KEY) ?? 'metin')
  const [local, setLocal] = useState<'metin' | 'orijinal' | null>(null)
  const [showPage, setShowPage] = useState(false)
  const [font, setFont] = useState(() => Number(readLs(FONT_KEY)) || 1)
  useEffect(() => {
    let alive = true
    void loadDusTexts(exam.id).then((all) => alive && setTxt(all[`${test}/${q.n}`] ?? null))
    return () => {
      alive = false
    }
  }, [exam.id, test, q.n])
  const locked = answer !== undefined
  const view: 'metin' | 'orijinal' = !txt ? 'orijinal' : (local ?? (txt.sekil ? 'orijinal' : pref === 'orijinal' ? 'orijinal' : 'metin'))
  function toggleView() {
    const next = view === 'metin' ? 'orijinal' : 'metin'
    if (txt?.sekil) setLocal(next)
    else {
      setPref(next)
      writeLs(VIEW_KEY, next)
    }
    setShowPage(false)
  }
  function stepFont(d: number) {
    const i = FONT_STEPS.findIndex((f) => f >= font)
    const next = FONT_STEPS[Math.max(0, Math.min(FONT_STEPS.length - 1, (i === -1 ? 1 : i) + d))]
    setFont(next)
    writeLs(FONT_KEY, String(next))
  }
  const choose = (l: string) => {
    if (!locked) onChoose?.(l)
  }
  const lastLine = txt ? (txt.soru.split('\n').pop() ?? '') : ''
  const table = txt && lastLine.includes(' | ') && Object.values(txt.siklar).some((v) => v.includes(' | ')) ? lastLine : null
  const state = (l: string, ok: string, bad: string, picked: string) =>
    locked ? (l === answer ? ok : l === choice ? bad : '') : l === choice ? picked : ''

  return (
    <article className={`card ${styles.question}`} data-focus-stage style={{ ['--dus-fs' as string]: String(font) }}>
      <h2 className={styles.sectionTitle}>
        {title}
        {chip && (
          <span className={styles.sectionChip}>
            {chip.icon} {chip.title}
          </span>
        )}
        <span className={styles.dusTools}>
          {view === 'metin' && (
            <>
              <button type="button" className={styles.pdfBtn} onClick={() => stepFont(-1)} aria-label="Yazıyı küçült">
                A−
              </button>
              <button type="button" className={styles.pdfBtn} onClick={() => stepFont(1)} aria-label="Yazıyı büyüt">
                A+
              </button>
            </>
          )}
          {view === 'orijinal' && (
            <button type="button" className={styles.pdfBtn} onClick={() => setShowPage((v) => !v)}>
              {showPage ? 'Yalnız soru' : '📄 Sayfa'}
            </button>
          )}
          {txt && (
            <button type="button" className={styles.pdfBtn} onClick={toggleView}>
              {view === 'metin' ? '🖼️ Orijinal' : '🔤 Metin'}
            </button>
          )}
        </span>
      </h2>
      {txt === undefined ? (
        <p className="muted">Yükleniyor…</p>
      ) : view === 'metin' && txt ? (
        <div className={styles.dusText}>
          <StemText text={table ? txt.soru.slice(0, txt.soru.lastIndexOf('\n')) : txt.soru} />
          <ul className={styles.options}>
            {table && (
              <li className={styles.dusColHead} aria-hidden="true">
                <span className={styles.optLetter} style={{ visibility: 'hidden' }}>
                  A
                </span>
                <Cols text={table} />
              </li>
            )}
            {LETTERS.map((l) => (
              <li key={l} className={`${styles.option} ${styles.dusOption} ${state(l, styles.optCorrect, styles.optWrong, styles.optPicked)}`}>
                <button type="button" className={styles.dusOptBtn} onClick={() => choose(l)} aria-disabled={locked} aria-pressed={l === choice} aria-label={`Seçenek ${l}`}>
                  <span className={styles.optLetter}>{l}</span>
                  <span className={styles.optBody}>{table ? <Cols text={txt.siklar[l] ?? ''} /> : (txt.siklar[l] ?? '')}</span>
                </button>
              </li>
            ))}
          </ul>
          {txt.durum === 'incele' && <p className={styles.dusWarn}>⚠️ Bu sorunun metni otomatik denetimden tam geçmedi; şüphelenirsen 🖼️ Orijinal’e bak.</p>}
        </div>
      ) : (
        <>
          {txt?.sekil && !showPage && <p className={styles.dusWarn}>🖼️ Şekilli soru: orijinal görüntü gösteriliyor.</p>}
          <PageCrop exam={exam} page={q.page} box={showPage ? null : q.box} />
          <div className={styles.letterRow} role="group" aria-label="Şıklar">
            {LETTERS.map((l) => (
              <button
                key={l}
                type="button"
                className={`${styles.letterBtn} ${state(l, styles.letterOk, styles.letterBad, styles.letterPicked)}`}
                onClick={() => choose(l)}
                aria-disabled={locked}
                aria-pressed={l === choice}
              >
                {l}
              </button>
            ))}
          </div>
        </>
      )}
      {children}
    </article>
  )
}

// --- Giriş -----------------------------------------------------------------------

function MockHome() {
  const navigate = useNavigate()
  const userId = useUserStore((s) => s.activeUserId)
  const [exams, setExams] = useState<DusExamMeta[] | null>(null)
  const [scope, setScope] = useState<DusMockScope>('tam')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const active = useMemo(() => activeRun(userId), [userId])
  const log = useMemo(() => readMockLog(userId), [userId])
  const best = useMemo(() => bestByExam(log), [log])
  useEffect(() => {
    void listDusExams().then(setExams)
  }, [])

  async function start(kind: 'sinav' | 'karma', meta?: DusExamMeta) {
    if (busy) return
    if (active && !confirm('Yarım kalan deneme silinip yenisi başlasın mı?')) return
    setBusy(true)
    setError('')
    try {
      const info = scopeInfo(scope)
      const suffix = scope === 'tam' ? '' : ` · ${info.tests.map(testShort).join('')}`
      let run: DusMockRun
      if (kind === 'sinav' && meta) {
        const exam = await loadDusExam(meta.id)
        run = newRun({ kind, scope, examId: exam.id, title: `${exam.title}${suffix}`, items: examItems(exam, scope) })
      } else {
        const all = await Promise.all((exams ?? []).map((e) => loadDusExam(e.id).catch(() => null)))
        const list = all.filter((e): e is DusExam => !!e)
        run = newRun({ kind: 'karma', scope, title: `Karma deneme${suffix}`, items: pickMixed(list, scope, Date.now() >>> 0) })
      }
      if (!run.items.length) throw new Error('soru yok')
      writeRun(userId, run)
      navigate(`${BASE}/kos`)
    } catch {
      setError('Deneme hazırlanamadı; sınav verisi yüklenemedi.')
      setBusy(false)
    }
  }

  if (!exams) return <p className="muted">Yükleniyor…</p>
  const left = active ? remainingSec(active) : 0

  return (
    <section className={styles.page}>
      <header className={styles.head}>
        <div>
          <Link to="/dus" className={styles.backLink}>
            ← DUS
          </Link>
          <h1 className={styles.title}>⏱️ DUS süreli deneme</h1>
          <p className="muted" style={{ margin: 0 }}>
            Gerçek sınav gibi: 120 soru, 150 dakika, tek oturum; cevaplar ve çözümler deneme bitince açılır.
          </p>
        </div>
      </header>

      {!exams.length && <p className="muted">DUS soruları bu cihazda yok; önce kaynak paketini yükle.</p>}

      {active && (
        <article className={`card ${styles.introCard}`}>
          <strong>Yarım kalan deneme: {active.title}</strong>
          <span className="muted">
            {Object.keys(active.choices).length}/{active.items.length} cevap · {left > 0 ? `kalan ${fmt(left)}` : 'süre doldu'}
          </span>
          <button type="button" className="btn btn-primary" onClick={() => navigate(`${BASE}/kos`)}>
            {left > 0 ? 'Devam et' : 'Sonucu gör'}
          </button>
        </article>
      )}

      {exams.length > 0 && (
        <>
          <article className={`card ${styles.introCard}`}>
            <h2 className={styles.blockTitle}>Süre ve kapsam</h2>
            <div className={m.scopeRow} role="group" aria-label="Deneme kapsamı">
              {DUS_MOCK_SCOPES.map((s) => (
                <button key={s.key} type="button" className={m.scopeBtn} aria-pressed={scope === s.key} onClick={() => setScope(s.key)}>
                  {s.label}
                </button>
              ))}
            </div>
            <ul className={styles.ruleList}>
              <li>Süre bitince deneme kendiliğinden biter; sekmeyi kapatsan da süre işler, döndüğünde kaldığın yerden sürersin.</li>
              <li>Sorular arasında serbestçe gez, cevabını değiştir; seçili şıkka yeniden dokunmak cevabı siler. 🚩 ile sonra dönmek istediğin soruyu işaretle.</li>
              <li>Net = doğru − yanlış/4 (test başına). Bitince cevapların DUS kaydına da işlenir, yanlışlar Yanlışlarım’a düşer.</li>
            </ul>
            {error && <p className={styles.badText}>{error}</p>}
          </article>

          <article className="card">
            <h2 className={styles.blockTitle}>🎲 Karma deneme</h2>
            <p className={styles.blockDesc}>Her dersten sınavdaki sayıda soru, farklı yılların kitapçıklarından rastgele seçilir.</p>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void start('karma')}>
              {busy ? 'Hazırlanıyor…' : 'Karma denemeyi başlat'}
            </button>
          </article>

          <h2 className={styles.sectionTitle} style={{ margin: '0.5rem 0 0' }}>
            Çıkmış sınavla deneme
          </h2>
          <ul className={styles.examList}>
            {exams.map((e) => {
              const b = best.get(e.id)
              return (
                <li key={e.id} className={styles.examRow}>
                  <span className={styles.examName}>
                    <span>
                      {e.title}
                      {b && <span className={m.badge}>✓ net {fmtNet(b.total.net)}</span>}
                    </span>
                    <small>
                      {b ? `En iyi deneme ${fmtDate(b.finishedAt)} · ${scopeInfo(b.scope).label.split(' (')[0]}` : `${e.counts.tbt + e.counts.kbt} soru`}
                    </small>
                  </span>
                  <span />
                  <span className={styles.examActions}>
                    <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void start('sinav', e)}>
                      Başlat
                    </button>
                  </span>
                </li>
              )
            })}
          </ul>
        </>
      )}

      {log.length > 0 && (
        <article className="card">
          <h2 className={styles.blockTitle}>Son denemeler</h2>
          <ul className={m.list}>
            {[...log]
              .reverse()
              .slice(0, 8)
              .map((e) => (
                <li key={e.id} className={m.histRow}>
                  <Link to={`${BASE}/sonuc/${e.id}`}>
                    <span>{e.title}</span>
                    <small>
                      {fmtDate(e.finishedAt)} · {fmt(e.durationSec)}
                      {e.tests.tbt ? ` · Temel ${fmtNet(e.tests.tbt.net)}` : ''}
                      {e.tests.kbt ? ` · Klinik ${fmtNet(e.tests.kbt.net)}` : ''}
                    </small>
                  </Link>
                  <strong>{fmtNet(e.total.net)}</strong>
                </li>
              ))}
          </ul>
          <p className="muted" style={{ margin: '0.5rem 0 0', fontSize: '0.85rem' }}>
            Gelişim grafiği: <Link to="/dus/istatistik">DUS istatistik</Link>
          </p>
        </article>
      )}
    </section>
  )
}

// --- Süren deneme ----------------------------------------------------------------

function MockRunner() {
  const navigate = useNavigate()
  const userId = useUserStore((s) => s.activeUserId)
  const [run, setRun] = useState<DusMockRun | null>(() => activeRun(userId))
  const [exams, setExams] = useState<Map<string, DusExam> | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const runRef = useRef(run)
  const timesRef = useRef<Record<string, number>>(run?.times ?? {})
  const finishing = useRef(false)
  const runId = run?.id

  useEffect(() => {
    runRef.current = run
  }, [run])

  useEffect(() => {
    const r = runRef.current
    if (!r) return
    let alive = true
    void loadExams(r.items).then((ex) => alive && setExams(ex))
    return () => {
      alive = false
    }
  }, [runId])

  const items = useMemo(() => (run && exams ? itemsOf(run.items, exams) : []), [run, exams])
  const count = items.length
  const pos = Math.min(run?.pos ?? 0, Math.max(0, count - 1))

  const update = useCallback(
    (fn: (r: DusMockRun) => DusMockRun) => {
      const cur = runRef.current
      if (!cur || isDone(cur)) return
      const next = { ...fn(cur), times: { ...timesRef.current } }
      runRef.current = next
      writeRun(userId, next)
      setRun(next)
    },
    [userId],
  )
  const go = useCallback((i: number) => update((r) => ({ ...r, pos: Math.max(0, Math.min(r.items.length - 1, i)) })), [update])

  const finish = useCallback(() => {
    const cur = runRef.current
    if (!cur || isDone(cur) || !exams || finishing.current) return
    finishing.current = true
    const finishedAt = new Date()
    const answerOf = answerLookup(exams)
    const final = closeRun({ ...cur, times: { ...timesRef.current } }, finishedAt)
    const score = scoreMock(final.items, final.choices, answerOf, final.times)
    addMockLog(userId, logEntryOf(final, score, finishedAt))
    // Normal DUS cevap kaydına da işlenir (yanlışlar Yanlışlarım'a düşer); boşlar işlenmez
    for (const [key, c] of Object.entries(final.choices)) {
      const ans = answerOf(key)
      if (ans && ans !== 'X') saveDusAnswer(userId, key, c, c === ans)
    }
    writeRun(userId, final)
    runRef.current = final
    navigate(`${BASE}/sonuc/${final.id}`, { replace: true })
  }, [exams, userId, navigate])

  const curKey = items[pos]?.key
  const curKeyRef = useRef(curKey)
  useEffect(() => {
    curKeyRef.current = curKey
  }, [curKey])
  // Sayaç: her saniye açık sorunun süresi artar; 5 sn'de bir kaydedilir
  useEffect(() => {
    if (!runId || !exams) return
    let tick = 0
    const t = setInterval(() => {
      setNow(Date.now())
      const k = curKeyRef.current
      if (k && !document.hidden) timesRef.current[k] = (timesRef.current[k] ?? 0) + 1
      if (++tick % 5 === 0) {
        const cur = runRef.current
        if (cur && !isDone(cur)) writeRun(userId, { ...cur, times: { ...timesRef.current } })
      }
    }, 1000)
    return () => clearInterval(t)
  }, [runId, exams, userId])

  const remaining = run ? remainingSec(run, now) : 0
  useEffect(() => {
    if (run && exams && remaining <= 0) finish()
  }, [run, exams, remaining, finish])

  const swipe = useQuestionNav(
    count ? () => go(pos - 1) : undefined,
    count ? () => go(pos + 1) : undefined,
    { canPrev: pos > 0, canNext: pos < count - 1, note: null },
  )

  if (!run)
    return (
      <section className={styles.page}>
        <Link to={BASE} className={styles.backLink}>
          ← Deneme
        </Link>
        <p className="muted">Süren deneme yok. Deneme sayfasından yeni bir deneme başlat.</p>
      </section>
    )
  if (!exams) return <p className="muted">Deneme hazırlanıyor…</p>
  if (!count) return <p className="muted">Deneme soruları yüklenemedi.</p>

  const it = items[pos]
  const choice = run.choices[it.key] ?? null
  const answered = Object.keys(run.choices).length
  const flagged = new Set(run.flags)
  const isFlagged = flagged.has(it.key)
  const testIdx = items.filter((x, i) => i <= pos && x.test === it.test).length

  function choose(l: string) {
    update((r) => {
      const choices = { ...r.choices }
      if (choices[it.key] === l) delete choices[it.key]
      else choices[it.key] = l
      return { ...r, choices }
    })
  }
  function toggleFlag() {
    update((r) => ({ ...r, flags: isFlagged ? r.flags.filter((k) => k !== it.key) : [...r.flags, it.key] }))
  }
  function askFinish() {
    const empty = count - answered
    const parts = [empty > 0 ? `${empty} soru boş` : '', flagged.size > 0 ? `${flagged.size} soru işaretli` : ''].filter(Boolean)
    if (confirm(`${parts.length ? parts.join(', ') + '. ' : ''}Denemeyi bitirmek istiyor musun?`)) finish()
  }

  return (
    <section className={styles.page} {...swipe.props}>
      <div className={styles.mockBar}>
        <span className={`${styles.timer} ${remaining < 600 ? styles.timerLow : ''}`} aria-live="off" data-focus-keep>
          ⏱ {fmt(remaining)}
        </span>
        <span className="muted" style={{ fontSize: '0.85rem' }}>
          {answered}/{count}
        </span>
        <span className={styles.spacer} />
        <button type="button" className="btn btn-primary" onClick={askFinish} data-focus-keep>
          Bitir
        </button>
      </div>
      <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
        {run.title}: doğru cevaplar deneme bitince görünür.
      </p>

      <QuestionNav
        count={count}
        idx={pos}
        onPick={go}
        summary={`${answered} cevaplandı${flagged.size ? ` · ${flagged.size} 🚩` : ''}`}
        stateClass={(i) => {
          const k = items[i].key
          return `${run.choices[k] ? styles.navPicked : ''} ${flagged.has(k) ? m.navFlag : ''}`
        }}
      />

      <MockCard
        key={it.key}
        exam={it.exam}
        test={it.test}
        q={it.q}
        title={`${testShort(it.test)} · Soru ${run.kind === 'sinav' ? it.q.n : testIdx}`}
        chip={subjectOf(it.test, it.q.n)}
        choice={choice}
        onChoose={choose}
      >
        <div className={styles.actions}>
          <button type="button" className={`btn btn-ghost ${isFlagged ? m.flagOn : ''}`} onClick={toggleFlag} aria-pressed={isFlagged} data-noswipe>
            🚩 {isFlagged ? 'İşaretli' : 'İşaretle'}
          </button>
          <span className={styles.spacer} />
          <button type="button" className="btn btn-ghost" disabled={pos === 0} onClick={() => void swipe.turn(-1)} data-focus-hide>
            ← Önceki
          </button>
          <button type="button" className="btn btn-secondary" disabled={pos === count - 1} onClick={() => void swipe.turn(1)} data-focus-hide>
            Sonraki →
          </button>
        </div>
      </MockCard>
    </section>
  )
}

// --- Sonuç ve inceleme ----------------------------------------------------------------

function SubjectTable({ entry }: { entry: DusMockLogEntry }) {
  return (
    <article className="card">
      <h2 className={styles.blockTitle}>Ders ders</h2>
      <p className={styles.blockDesc}>D doğru · Y yanlış · B boş; süre, o dersin sorularında geçen ortalama.</p>
      {DUS_TESTS.filter((t) => entry.tests[t.key]).map((t) => (
        <div key={t.key}>
          <h3 className={m.groupTitle}>{t.title}</h3>
          <ul className={m.list}>
            {DUS_SUBJECTS.filter((s) => s.test === t.key && entry.subjects[s.id]).map((s) => {
              const r = entry.subjects[s.id]
              const n = r.c + r.w + r.e
              const pct = n ? Math.round((r.c / n) * 100) : 0
              return (
                <li key={s.id} className={m.subjRow}>
                  <span className={m.subjName}>
                    <span>
                      {s.icon} {s.title}
                    </span>
                    <small>{r.s > 0 ? `ortalama ${Math.round(r.s / n)} sn/soru` : `${n} soru`}</small>
                  </span>
                  <span className={styles.bar} aria-hidden="true">
                    <span className={`${styles.barFill} ${styles[`tone_${pct >= 70 ? 'ok' : pct >= 45 ? 'mid' : 'bad'}`]}`} style={{ width: `${pct}%` }} />
                  </span>
                  <span className={m.subjNum}>
                    {r.c}D {r.w}Y {r.e}B
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </article>
  )
}

function Review({ entry, keys, onBack }: { entry: DusMockLogEntry; keys: string[]; onBack: () => void }) {
  const [exams, setExams] = useState<Map<string, DusExam> | null>(null)
  const [pos, setPos] = useState(0)
  // Çözüm hangi soruya ait: başka soruya geçince eski çözüm görünmesin
  const [sol, setSol] = useState<{ key: string; s: DusSolution | null } | null>(null)
  useEffect(() => {
    let alive = true
    void loadExams(keys).then((ex) => alive && setExams(ex))
    return () => {
      alive = false
    }
  }, [keys])
  const items = useMemo(() => (exams ? itemsOf(keys, exams) : []), [keys, exams])
  const count = items.length
  const it = items[Math.min(pos, Math.max(0, count - 1))]
  const itKey = it?.key
  useEffect(() => {
    if (!itKey) return
    let alive = true
    const { examId, test, n } = parseKey(itKey)
    void loadDusSolutions(examId).then((all) => alive && setSol({ key: itKey, s: all[`${test}/${n}`] ?? null }))
    return () => {
      alive = false
    }
  }, [itKey])
  const swipe = useQuestionNav(
    () => setPos((p) => Math.max(0, p - 1)),
    () => setPos((p) => Math.min(count - 1, p + 1)),
    { canPrev: pos > 0, canNext: pos < count - 1, note: it ? `/dus/${it.exam.id}/${it.test}#Soru ${it.q.n}` : null },
  )
  if (!exams) return <p className="muted">Yükleniyor…</p>
  if (!it) return <p className="muted">İncelenecek soru yok.</p>
  const choice = entry.choices[it.key] ?? null
  const solution = sol?.key === it.key ? sol.s : undefined

  return (
    <section className={styles.page} {...swipe.props}>
      <div className={styles.mockBar}>
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          ← Sonuç
        </button>
        <span className={styles.spacer} />
        <span className="muted" style={{ fontSize: '0.85rem' }}>
          Yanlış ve boşlar · {pos + 1}/{count}
        </span>
      </div>
      <QuestionNav
        count={count}
        idx={pos}
        onPick={setPos}
        stateClass={(i) => (entry.choices[items[i].key] ? styles.navBad : '')}
      />
      <MockCard
        key={it.key}
        exam={it.exam}
        test={it.test}
        q={it.q}
        title={`${it.exam.title} · ${testShort(it.test)} · Soru ${it.q.n}`}
        chip={subjectOf(it.test, it.q.n)}
        choice={choice}
        answer={it.q.answer}
      >
        <div className={styles.actions}>
          <span className={choice ? styles.badText : 'muted'}>
            {choice ? `✗ Senin cevabın ${choice} — doğru cevap: ${it.q.answer}` : `Boş — doğru cevap: ${it.q.answer}`}
          </span>
          <span className={styles.spacer} />
          <button type="button" className="btn btn-ghost" disabled={pos === 0} onClick={() => void swipe.turn(-1)} data-focus-hide>
            ← Önceki
          </button>
          <button type="button" className="btn btn-secondary" disabled={pos >= count - 1} onClick={() => void swipe.turn(1)} data-focus-hide>
            Sonraki →
          </button>
        </div>
        {solution?.cozum && (
          <div className={styles.aiBox} data-noswipe>
            <strong>💡 Çözüm</strong>
            <AiText text={solution.cozum} />
            <small className="muted">Yapay zekâyla önceden hazırlandı, uzman kontrolünden geçmedi; ÖSYM cevap anahtarı esastır.</small>
          </div>
        )}
        {solution === null && <p className="muted" style={{ fontSize: '0.85rem' }}>Bu soru için hazır çözüm yok.</p>}
        <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem' }}>
          <Link to={`/dus/${it.exam.id}/${it.test}`}>Bu testi normal soru ekranında aç →</Link> (terimler ve YZ açıklaması orada)
        </p>
      </MockCard>
    </section>
  )
}

function MockResult() {
  const { runId = '' } = useParams()
  const userId = useUserStore((s) => s.activeUserId)
  const entry = useMemo(() => readMockLog(userId).find((e) => e.id === runId) ?? null, [userId, runId])
  const [review, setReview] = useState(false)
  const [reviewKeys, setReviewKeys] = useState<string[] | null>(null)

  // Yanlış ve boşlar: doğru cevap sınav verisinden
  useEffect(() => {
    if (!entry) return
    let alive = true
    void loadExams(entry.items).then((ex) => {
      if (!alive) return
      const answerOf = answerLookup(ex)
      setReviewKeys(
        entry.items.filter((k) => {
          const a = answerOf(k)
          return a && a !== 'X' && entry.choices[k] !== a
        }),
      )
    })
    return () => {
      alive = false
    }
  }, [entry])

  if (!entry)
    return (
      <section className={styles.page}>
        <Link to={BASE} className={styles.backLink}>
          ← Deneme
        </Link>
        <p className="muted">Bu deneme kaydı bulunamadı.</p>
      </section>
    )
  if (review && reviewKeys) return <Review entry={entry} keys={reviewKeys} onBack={() => setReview(false)} />

  const { tbt, kbt } = entry.tests
  const answered = entry.total.correct + entry.total.wrong
  return (
    <section className={styles.page}>
      <header className={styles.head}>
        <div>
          <Link to={BASE} className={styles.backLink}>
            ← Deneme
          </Link>
          <h1 className={styles.title}>Deneme sonucu</h1>
          <p className="muted" style={{ margin: 0 }}>
            {entry.title} · {fmtDate(entry.finishedAt)} · {fmt(entry.durationSec)} / {fmt(entry.limitSec)}
          </p>
        </div>
      </header>

      <article className={`card ${styles.scoreCard}`}>
        <div className={m.statGrid}>
          {tbt && (
            <div className={m.stat}>
              <small>Temel net</small>
              <strong>{fmtNet(tbt.net)}</strong>
              <small>
                {tbt.correct}D {tbt.wrong}Y {tbt.empty}B / {tbt.count}
              </small>
            </div>
          )}
          {kbt && (
            <div className={m.stat}>
              <small>Klinik net</small>
              <strong>{fmtNet(kbt.net)}</strong>
              <small>
                {kbt.correct}D {kbt.wrong}Y {kbt.empty}B / {kbt.count}
              </small>
            </div>
          )}
          {tbt && kbt && (
            <div className={m.stat}>
              <small>Toplam net</small>
              <strong>{fmtNet(entry.total.net)}</strong>
              <small>/ {entry.total.count} soru</small>
            </div>
          )}
        </div>
        <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
          Soru başına ortalama {answered ? Math.round(entry.durationSec / answered) : 0} sn (cevaplanan {answered} soru; sınav temposu 75 sn).
        </p>
        {entry.weighted ? (
          <>
            <div className={m.statGrid}>
              <div className={m.stat}>
                <small>Ağırlıklı başarı K</small>
                <strong>%{entry.weighted.K.toLocaleString('tr-TR')}</strong>
                <small>0,4×Temel + 0,6×Klinik</small>
              </div>
              <div className={m.stat}>
                <small>Ağırlıklı başarı T</small>
                <strong>%{entry.weighted.T.toLocaleString('tr-TR')}</strong>
                <small>0,6×Temel + 0,4×Klinik</small>
              </div>
            </div>
            <p className={m.note}>
              Gerçek K/T puanı adayların ortalamasına bağlı standart puandır, burada hesaplanamaz; ağırlıklı başarı (net/soru yüzdesi:
              Temel %{Math.round(netPct(tbt))}, Klinik %{Math.round(netPct(kbt))}) yalnızca kendi denemelerini karşılaştırmak içindir.
            </p>
          </>
        ) : (
          <p className={m.note}>Ağırlıklı başarı (K/T) yalnızca iki testin birlikte çözüldüğü tam denemede hesaplanır.</p>
        )}
      </article>

      <SubjectTable entry={entry} />

      <div className={styles.actions}>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!reviewKeys?.length}
          aria-disabled={!reviewKeys?.length}
          onClick={() => setReview(true)}
        >
          {reviewKeys === null ? 'Hazırlanıyor…' : reviewKeys.length ? `Yanlış ve boşları incele (${reviewKeys.length})` : 'Yanlış ya da boş yok 🎉'}
        </button>
        <Link to={BASE} className="btn btn-secondary">
          Yeni deneme
        </Link>
        <Link to="/dus/istatistik" className="btn btn-ghost">
          📊 İstatistik
        </Link>
      </div>
    </section>
  )
}

export default function DusMock() {
  return (
    <Routes>
      <Route index element={<MockHome />} />
      <Route path="kos" element={<MockRunner />} />
      <Route path="sonuc/:runId" element={<MockResult />} />
      <Route path="*" element={<MockHome />} />
    </Routes>
  )
}
