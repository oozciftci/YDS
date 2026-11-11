import { DUS_SUBJECTS, dusNet, subjectOf, type DusAnswers, type DusExam, type DusTestKey } from './dus'

// DUS süreli deneme: saf mantık (seçim, puanlama, ders dökümü, geçmiş). Arayüz: src/pages/DusMock.tsx.
// Yarıdaki deneme `yds-dusmock:<kullanıcı>`, biten denemeler `yds-dus-mocklog:<kullanıcı>` anahtarında durur.
// İkisi de deviceSync'in `yds-*:user_*` deseniyle cihazlar arasında taşınır. Biten deneme anahtardan silinmez,
// `done` damgasıyla kapatılır: silinseydi eşitleme eski (yarım) kopyayı geri getirir, deneme ikinci kez bitirilirdi.

export type DusMockScope = 'tam' | 'tbt' | 'kbt'
export type DusMockKind = 'sinav' | 'karma'

export const DUS_MOCK_SCOPES: { key: DusMockScope; label: string; minutes: number; tests: DusTestKey[] }[] = [
  { key: 'tam', label: 'Tam deneme (120 soru, 150 dk)', minutes: 150, tests: ['tbt', 'kbt'] },
  { key: 'tbt', label: 'Yalnızca Temel (40 soru, 50 dk)', minutes: 50, tests: ['tbt'] },
  { key: 'kbt', label: 'Yalnızca Klinik (80 soru, 100 dk)', minutes: 100, tests: ['kbt'] },
]
export const scopeInfo = (s: DusMockScope) => DUS_MOCK_SCOPES.find((x) => x.key === s) ?? DUS_MOCK_SCOPES[0]

/** Yarıdaki (ya da `done` ile kapanmış) deneme. Soru anahtarları dus.ts'teki `answerKey` biçiminde: sınav/test/no. */
export interface DusMockRun {
  v: 1
  id: string
  kind: DusMockKind
  scope: DusMockScope
  /** Çıkmış sınav denemesinde sınav kimliği */
  examId?: string
  title: string
  startedAt: string
  durationSec: number
  items: string[]
  /** anahtar → seçilen şık */
  choices: Record<string, string>
  /** İşaretlenen (sonra dönülecek) sorular */
  flags: string[]
  /** anahtar → o soruda geçen saniye */
  times: Record<string, number>
  /** Açık soru sırası (kaldığı yerden devam) */
  pos: number
  /** Bitiş zamanı ve biten denemenin kimliği: ikisi de doluysa ve kimlik tutuyorsa deneme kapanmıştır.
   * (Eşitlemede iki farklı deneme nesne olarak birleşirse eskisinin `done`u yenisini kapatmasın diye kimlik de tutulur.) */
  done?: string
  doneId?: string
}

/** Deneme bitmiş mi? */
export const isDone = (r: DusMockRun) => Boolean(r.done) && r.doneId === r.id

/** Denemeyi kapatır (kayıt silinmez; bkz. dosya başı). */
export const closeRun = (r: DusMockRun, at: Date): DusMockRun => ({ ...r, done: at.toISOString(), doneId: r.id })

// --- Tohumlanabilir rastgele ---------------------------------------------

/** mulberry32: aynı tohum → aynı dizi. */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle<T>(list: T[], rand: () => number): T[] {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// --- Soru seçimi ------------------------------------------------------------

/** Çıkmış sınav denemesi: kapsamdaki testlerin iptal edilmemiş soruları, kitapçık sırasıyla. */
export function examItems(exam: DusExam, scope: DusMockScope): string[] {
  const tests = scopeInfo(scope).tests
  return tests.flatMap((tk) => {
    const t = exam.tests.find((x) => x.key === tk)
    return t ? t.questions.filter((q) => q.answer !== 'X').map((q) => `${exam.id}/${tk}/${q.n}`) : []
  })
}

/**
 * Karma deneme: her dersten resmi sayıda soru (Temel 6-4-6-6-6-4-4-4, Klinik 10'ar), mümkün olduğunca farklı
 * sınavlardan; iptal ('X') sorular hariç. Aynı tohum aynı denemeyi verir. Ders sırası kitapçıktaki gibidir.
 */
export function pickMixed(exams: DusExam[], scope: DusMockScope, seed: number): string[] {
  const rand = rng(seed)
  const tests = scopeInfo(scope).tests
  const out: string[] = []
  for (const s of DUS_SUBJECTS) {
    if (!tests.includes(s.test)) continue
    const need = s.to - s.from + 1
    const pool: { exam: string; key: string }[] = []
    for (const e of exams) {
      const t = e.tests.find((x) => x.key === s.test)
      for (const q of t?.questions ?? []) {
        if (q.n >= s.from && q.n <= s.to && q.answer !== 'X') pool.push({ exam: e.id, key: `${e.id}/${s.test}/${q.n}` })
      }
    }
    // Karıştır, sonra her sınavın 1., 2. … sorusu sırasıyla al → önce farklı sınavlar
    const seen = new Map<string, number>()
    const ranked = shuffle(pool, rand).map((p, i) => {
      const r = seen.get(p.exam) ?? 0
      seen.set(p.exam, r + 1)
      return { ...p, r, i }
    })
    ranked.sort((a, b) => a.r - b.r || a.i - b.i)
    out.push(...ranked.slice(0, need).map((p) => p.key))
  }
  return out
}

// --- Puanlama ---------------------------------------------------------------

export interface DusTally {
  correct: number
  wrong: number
  empty: number
  count: number
  net: number
}
export interface DusSubjectRow {
  c: number
  w: number
  e: number
  /** Bu dersin sorularında geçen toplam saniye */
  s: number
}
export interface DusMockScore {
  tests: Partial<Record<DusTestKey, DusTally>>
  total: DusTally
  subjects: Record<string, DusSubjectRow>
  /** Ağırlıklı başarı (%): yalnızca iki test de varsa */
  weighted: { K: number; T: number } | null
}

const emptyTally = (): DusTally => ({ correct: 0, wrong: 0, empty: 0, count: 0, net: 0 })

export function parseKey(key: string): { examId: string; test: DusTestKey; n: number } {
  const [examId, test, n] = key.split('/')
  return { examId, test: test as DusTestKey, n: Number(n) }
}

/** Testin net yüzdesi (net / soru sayısı); negatif net 0 sayılmaz, olduğu gibi kalır. */
export const netPct = (t: DusTally | undefined) => (t && t.count ? (t.net / t.count) * 100 : 0)
const round1 = (x: number) => Math.round(x * 10) / 10

/**
 * Denemeyi puanlar. `answerOf` anahtarın doğru şıkkını verir (bilinmiyorsa undefined: soru sayılmaz).
 * Net test başına ayrı: doğru − yanlış/4.
 */
export function scoreMock(
  items: string[],
  choices: Record<string, string>,
  answerOf: (key: string) => string | undefined,
  times: Record<string, number> = {},
): DusMockScore {
  const tests: Partial<Record<DusTestKey, DusTally>> = {}
  const subjects: Record<string, DusSubjectRow> = {}
  for (const key of items) {
    const ans = answerOf(key)
    if (!ans || ans === 'X') continue
    const { test, n } = parseKey(key)
    const t = (tests[test] ??= emptyTally())
    const sub = subjectOf(test, n)
    const row = sub ? (subjects[sub.id] ??= { c: 0, w: 0, e: 0, s: 0 }) : null
    t.count++
    if (row) row.s += times[key] ?? 0
    const c = choices[key]
    if (!c) {
      t.empty++
      if (row) row.e++
    } else if (c === ans) {
      t.correct++
      if (row) row.c++
    } else {
      t.wrong++
      if (row) row.w++
    }
  }
  const total = emptyTally()
  for (const t of Object.values(tests)) {
    t.net = dusNet(t.correct, t.wrong)
    total.correct += t.correct
    total.wrong += t.wrong
    total.empty += t.empty
    total.count += t.count
    total.net += t.net
  }
  total.net = Math.round(total.net * 100) / 100
  const tb = tests.tbt
  const kb = tests.kbt
  const weighted =
    tb?.count && kb?.count
      ? { K: round1(0.4 * netPct(tb) + 0.6 * netPct(kb)), T: round1(0.6 * netPct(tb) + 0.4 * netPct(kb)) }
      : null
  return { tests, total, subjects, weighted }
}

// --- Yarıdaki deneme ----------------------------------------------------------

type Store = Pick<Storage, 'getItem' | 'setItem'>
const ls = (): Store | null => {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

export const runKey = (userId: string) => `yds-dusmock:${userId}`
export const logKey = (userId: string) => `yds-dus-mocklog:${userId}`

export function readRun(userId: string, store: Store | null = ls()): DusMockRun | null {
  try {
    const r = JSON.parse(store?.getItem(runKey(userId)) || 'null') as DusMockRun | null
    return r && r.v === 1 && Array.isArray(r.items) ? r : null
  } catch {
    return null
  }
}

/** Süren (bitmemiş) deneme. */
export function activeRun(userId: string, store: Store | null = ls()): DusMockRun | null {
  const r = readRun(userId, store)
  return r && !isDone(r) ? r : null
}

export function writeRun(userId: string, run: DusMockRun, store: Store | null = ls()) {
  try {
    store?.setItem(runKey(userId), JSON.stringify(run))
  } catch {
    // depo kapalı/dolu: deneme bu sekmede sürer, yenilenince kaybolur
  }
}

export function newRun(p: {
  kind: DusMockKind
  scope: DusMockScope
  title: string
  items: string[]
  examId?: string
  now?: Date
  id?: string
}): DusMockRun {
  return {
    v: 1,
    id: p.id ?? `${(p.now ?? new Date()).getTime().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    kind: p.kind,
    scope: p.scope,
    examId: p.examId,
    title: p.title,
    startedAt: (p.now ?? new Date()).toISOString(),
    durationSec: scopeInfo(p.scope).minutes * 60,
    items: p.items,
    choices: {},
    flags: [],
    times: {},
    pos: 0,
  }
}

/** Kalan saniye (negatif olabilir). */
export const remainingSec = (run: DusMockRun, now = Date.now()) => run.durationSec - (now - new Date(run.startedAt).getTime()) / 1000

// --- Geçmiş -------------------------------------------------------------------

export interface DusMockLogEntry {
  id: string
  kind: DusMockKind
  scope: DusMockScope
  examId?: string
  title: string
  startedAt: string
  finishedAt: string
  /** Geçen süre (sn) ve süre sınırı */
  durationSec: number
  limitSec: number
  tests: DusMockScore['tests']
  total: DusTally
  subjects: DusMockScore['subjects']
  weighted: DusMockScore['weighted']
  items: string[]
  choices: Record<string, string>
}

/** Bitmiş denemenin geçmiş kaydı. */
export function logEntryOf(run: DusMockRun, score: DusMockScore, finishedAt: Date): DusMockLogEntry {
  const elapsed = Math.round((finishedAt.getTime() - new Date(run.startedAt).getTime()) / 1000)
  return {
    id: run.id,
    kind: run.kind,
    scope: run.scope,
    examId: run.examId,
    title: run.title,
    startedAt: run.startedAt,
    finishedAt: finishedAt.toISOString(),
    durationSec: Math.max(0, Math.min(run.durationSec, elapsed)),
    limitSec: run.durationSec,
    tests: score.tests,
    total: score.total,
    subjects: score.subjects,
    weighted: score.weighted,
    items: run.items,
    choices: run.choices,
  }
}

const LOG_MAX = 60

/** Geçmiş, eskiden yeniye (eşitlemede diziler birleştiği için kimliğe göre tekilleştirilir). */
export function readMockLog(userId: string, store: Store | null = ls()): DusMockLogEntry[] {
  try {
    const list = JSON.parse(store?.getItem(logKey(userId)) || '[]') as DusMockLogEntry[]
    if (!Array.isArray(list)) return []
    const byId = new Map<string, DusMockLogEntry>()
    for (const e of list) if (e && typeof e.id === 'string' && e.finishedAt) byId.set(e.id, e)
    return [...byId.values()].sort((a, b) => a.finishedAt.localeCompare(b.finishedAt))
  } catch {
    return []
  }
}

/** Kaydı ekler (aynı kimlik varsa değiştirir); en fazla son 60 deneme tutulur. */
export function addMockLog(userId: string, entry: DusMockLogEntry, store: Store | null = ls()): DusMockLogEntry[] {
  const list = readMockLog(userId, store).filter((e) => e.id !== entry.id)
  list.push(entry)
  list.sort((a, b) => a.finishedAt.localeCompare(b.finishedAt))
  const kept = list.slice(-LOG_MAX)
  try {
    store?.setItem(logKey(userId), JSON.stringify(kept))
  } catch {
    // depo dolu
  }
  return kept
}

/** Bir sınavın en iyi tam/kısa deneme kaydı (sınav listesinde işaret için): toplam nete göre. */
export function bestByExam(log: DusMockLogEntry[]): Map<string, DusMockLogEntry> {
  const out = new Map<string, DusMockLogEntry>()
  for (const e of log) {
    if (e.kind !== 'sinav' || !e.examId) continue
    const prev = out.get(e.examId)
    if (!prev || e.total.net > prev.total.net) out.set(e.examId, e)
  }
  return out
}

// --- İstatistik ----------------------------------------------------------------

export interface DusSubjectStat {
  id: string
  answered: number
  correct: number
  wrong: number
  /** Doğruluk %, çözülen yoksa null */
  pct: number | null
}

/** Tüm cevap kaydından ders ders özet. */
export function subjectStats(all: DusAnswers): DusSubjectStat[] {
  const rows = new Map(DUS_SUBJECTS.map((s) => [s.id, { id: s.id, answered: 0, correct: 0, wrong: 0, pct: null as number | null }]))
  for (const [k, a] of Object.entries(all)) {
    const { test, n } = parseKey(k)
    const s = subjectOf(test, n)
    const r = s && rows.get(s.id)
    if (!r) continue
    r.answered++
    if (a.ok) r.correct++
    else r.wrong++
  }
  for (const r of rows.values()) r.pct = r.answered ? Math.round((r.correct / r.answered) * 100) : null
  return [...rows.values()]
}

/**
 * En zayıf dersler: doğruluğu en düşük olanlar. Önce en az `minAnswered` soru çözülmüş dersler; yetmezse
 * çözülmüş olan her ders. Hiç çözülmemiş ders zayıf sayılmaz.
 */
export function weakestSubjects(stats: DusSubjectStat[], count = 3, minAnswered = 5): string[] {
  const byPct = (a: DusSubjectStat, b: DusSubjectStat) => (a.pct ?? 0) - (b.pct ?? 0) || b.answered - a.answered
  const firm = stats.filter((s) => s.answered >= minAnswered).sort(byPct)
  const loose = stats.filter((s) => s.answered > 0 && s.answered < minAnswered).sort(byPct)
  return [...firm, ...loose].slice(0, count).map((s) => s.id)
}
