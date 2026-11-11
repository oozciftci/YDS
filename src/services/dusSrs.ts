import { State } from 'ts-fsrs'
import type { CardState, MasteryLevel } from '../types/database'
import { dayKey, streakFromDays } from './dates'
import {
  DUS_SUBJECTS,
  answerKey,
  readDusAnswers,
  saveDusAnswer,
  setDusFlag,
  subjectSummary,
  type DusAnswers,
  type DusSubject,
} from './dus'
import { formatInterval, scheduleCard } from './fsrs'

// DUS soruları için aralıklı tekrar. Zamanlama kelime kartlarındaki FSRS çekirdeğiyle aynı (fsrs.ts › scheduleCard);
// durum tarayıcı deposunda, kullanıcı başına: localStorage["yds-dus-srs:<kullanıcı>"], kart kimliği "<sınav>/<test>/<no>".
// Kurallar: yanlış cevaplanan ya da ⭐ işaretlenen soru desteye girer, vadesi ertesi gün. Tekrarda doğru cevaptan sonra
// kullanıcı Zor / İyi / Kolay seçer, yanlışta otomatik "Tekrar". Soru tekrarında dakika adımı anlamsız: vade en erken
// ertesi gün, gün başına yuvarlanır. Desteden çıkarılan kart silinmez, işaretlenir (x) ki öbür cihazdan geri gelmesin.

export type DusGrade = 'tekrar' | 'zor' | 'iyi' | 'kolay'
const GRADE_MASTERY: Record<DusGrade, MasteryLevel> = { tekrar: 1, zor: 2, iyi: 3, kolay: 5 }
export const DUS_GRADES: { grade: DusGrade; label: string }[] = [
  { grade: 'zor', label: 'Zor' },
  { grade: 'iyi', label: 'İyi' },
  { grade: 'kolay', label: 'Kolay' },
]

export interface DusCard {
  /** Vade (yerel gün başı, ISO) */
  due: string
  /** FSRS: kararlılık, zorluk, aşama, tekrar sayısı, yanılma, öğrenme adımı, planlanan gün, son değerlendirme */
  s: number
  d: number
  st: number
  r: number
  l: number
  ls?: number
  sd?: number
  lr?: string
  /** Desteye neden girdi */
  src: 'yanlis' | 'isaret'
  /** Tekrar ekranında son derecelendirme zamanı */
  g?: string
  /** Son değişiklik (eşitlemede daha yeni t kazanır) */
  t: string
  /** Desteden çıkarıldı */
  x?: true
}
export type DusDeck = Record<string, DusCard>

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
/** Vade: hesaplanan günün başı, en erken yarın. */
const dueFrom = (raw: Date, now: Date) => {
  const tomorrow = addDays(now, 1)
  const day = startOfDay(raw)
  return (day > tomorrow ? day : tomorrow).toISOString()
}

function toCardState(key: string, c: DusCard | undefined): CardState {
  return {
    id: key,
    wordId: key,
    userId: '',
    state: c?.st ?? State.New,
    due: c?.due ?? new Date(0).toISOString(),
    stability: c?.s ?? 0,
    difficulty: c?.d ?? 0,
    elapsedDays: 0,
    scheduledDays: c?.sd ?? 0,
    learningSteps: c?.ls,
    reps: c?.r ?? 0,
    lapses: c?.l ?? 0,
    lastReview: c?.lr,
    updatedAt: c?.t ?? '',
  }
}

/** FSRS ile bir sonraki durumu hesaplar (saf). */
function schedule(key: string, prev: DusCard | undefined, grade: DusGrade, now: Date): Omit<DusCard, 'src' | 't'> {
  const { card, scheduledDays } = scheduleCard(toCardState(key, prev), GRADE_MASTERY[grade], now)
  return {
    due: dueFrom(card.due, now),
    s: card.stability,
    d: card.difficulty,
    st: card.state,
    r: card.reps,
    l: (prev?.l ?? 0) + (grade === 'tekrar' ? 1 : 0),
    ls: card.learning_steps,
    sd: scheduledDays,
    lr: now.toISOString(),
  }
}

const active = (c: DusCard | undefined): c is DusCard => !!c && !c.x

/**
 * Soruyu desteye koyar (saf): yoksa yeni kart (vade yarın); zaten varsa yeni yanlış vadeyi en geç yarına çeker.
 * Yanlış cevap "Tekrar", ⭐ "Zor" derecesiyle başlar.
 */
export function addToDusDeck(deck: DusDeck, key: string, src: DusCard['src'], now = new Date()): DusDeck {
  const prev = deck[key]
  const t = now.toISOString()
  if (active(prev)) {
    const tomorrow = addDays(now, 1).toISOString()
    // ⭐ zaten destedeki karta dokunmaz
    if (src === 'isaret') return deck
    return { ...deck, [key]: { ...prev, due: prev.due < tomorrow ? prev.due : tomorrow, l: prev.l + (src === 'yanlis' ? 1 : 0), t } }
  }
  return { ...deck, [key]: { ...schedule(key, undefined, src === 'yanlis' ? 'tekrar' : 'zor', now), src, t } }
}

/** Tekrar ekranında derecelendirme (saf). */
export function gradeDusCard(deck: DusDeck, key: string, grade: DusGrade, now = new Date()): DusDeck {
  const prev = active(deck[key]) ? deck[key] : undefined
  const t = now.toISOString()
  return { ...deck, [key]: { ...schedule(key, prev, grade, now), src: prev?.src ?? 'yanlis', g: t, t } }
}

/** Desteden çıkarır (saf; silinmiş diye işaretler). */
export function removeFromDusDeck(deck: DusDeck, key: string, now = new Date()): DusDeck {
  const prev = deck[key]
  if (!active(prev)) return deck
  return { ...deck, [key]: { ...prev, x: true, t: now.toISOString() } }
}

/** Vadesi gelen kart kimlikleri, en eski vadeden. */
export function dueDusKeys(deck: DusDeck, now = new Date()): string[] {
  const iso = now.toISOString()
  return Object.entries(deck)
    .filter(([, c]) => active(c) && c.due <= iso)
    .sort((a, b) => a[1].due.localeCompare(b[1].due) || a[0].localeCompare(b[0]))
    .map(([k]) => k)
}

/** Deste özeti: şimdi vadesi gelen, yarın gelecek, 7 gün içinde gelecek (şimdikiler hariç), toplam etkin kart. */
export function dusDeckCounts(deck: DusDeck, now = new Date()) {
  const iso = now.toISOString()
  const endTomorrow = addDays(now, 2).toISOString()
  const endWeek = addDays(now, 8).toISOString()
  let due = 0
  let tomorrow = 0
  let week = 0
  let total = 0
  for (const c of Object.values(deck)) {
    if (!active(c)) continue
    total++
    if (c.due <= iso) due++
    else {
      if (c.due < endTomorrow) tomorrow++
      if (c.due < endWeek) week++
    }
  }
  return { due, tomorrow, week, total }
}

/** Derecelendirme düğmelerinde gösterilecek aralıklar ("3 gün"). */
export function previewDusGrades(deck: DusDeck, key: string, now = new Date()): Record<DusGrade, string> {
  const out = {} as Record<DusGrade, string>
  const prev = active(deck[key]) ? deck[key] : undefined
  for (const g of Object.keys(GRADE_MASTERY) as DusGrade[]) out[g] = formatInterval(now, new Date(schedule(key, prev, g, now).due))
  return out
}

/** Bugün tekrar ekranında derecelendirilen kart sayısı. */
export function reviewedTodayCount(deck: DusDeck, now = new Date()): number {
  const today = dayKey(now)
  return Object.values(deck).filter((c) => c.g && dayKey(c.g) === today).length
}

// --- Depo ---------------------------------------------------------------------

export const dusSrsKey = (userId: string) => `yds-dus-srs:${userId}`

export function readDusDeck(userId: string): DusDeck {
  try {
    return JSON.parse(localStorage.getItem(dusSrsKey(userId)) || '{}') as DusDeck
  } catch {
    return {}
  }
}

function writeDeck(userId: string, deck: DusDeck) {
  try {
    localStorage.setItem(dusSrsKey(userId), JSON.stringify(deck))
  } catch {
    // depo dolu ya da kapalı
  }
}

export function dusDeckGrade(userId: string, key: string, grade: DusGrade): DusDeck {
  const deck = gradeDusCard(readDusDeck(userId), key, grade)
  writeDeck(userId, deck)
  return deck
}

export function dusDeckRemove(userId: string, key: string): DusDeck {
  const deck = removeFromDusDeck(readDusDeck(userId), key)
  writeDeck(userId, deck)
  return deck
}

/** Normal çözümde cevabı kaydeder; yanlışsa soru tekrar destesine girer. */
export function recordDusAnswer(userId: string, key: string, choice: string, ok: boolean): DusAnswers {
  const all = saveDusAnswer(userId, key, choice, ok)
  if (!ok) writeDeck(userId, addToDusDeck(readDusDeck(userId), key, 'yanlis'))
  return all
}

/** ⭐ işareti: açılınca soru desteye girer; kapanınca yalnızca işaretle girip hiç tekrarlanmamışsa çıkar. */
export function flagDusQuestion(userId: string, key: string, flag: boolean): DusAnswers {
  const all = setDusFlag(userId, key, flag)
  const deck = readDusDeck(userId)
  if (flag) writeDeck(userId, addToDusDeck(deck, key, 'isaret'))
  else if (active(deck[key]) && deck[key].src === 'isaret' && !deck[key].g) writeDeck(userId, removeFromDusDeck(deck, key))
  return all
}

// --- Bugünün seti -------------------------------------------------------------

export const DUS_GOAL_KEY = 'yds-dus-goal'
export const DUS_GOAL_DEFAULT = 20
export const clampDusGoal = (n: number) => (Number.isFinite(n) ? Math.min(100, Math.max(5, Math.round(n / 5) * 5)) : DUS_GOAL_DEFAULT)

export function readDusGoal(): number {
  try {
    const v = Number(localStorage.getItem(DUS_GOAL_KEY))
    return v ? clampDusGoal(v) : DUS_GOAL_DEFAULT
  } catch {
    return DUS_GOAL_DEFAULT
  }
}
export function writeDusGoal(n: number) {
  try {
    localStorage.setItem(DUS_GOAL_KEY, String(clampDusGoal(n)))
  } catch {
    // yoksay
  }
}

/** Klinik testin K puanındaki ağırlığı (0,6) Temel'inkine (0,4) oranla: klinik dersler öne alınır. */
const TEST_WEIGHT = { tbt: 1, kbt: 1.5 } as const

/**
 * Ders önceliği (saf): zayıflık = 1 − doğruluk (az veride 0,5'e çekilir: (doğru+1)/(çözülen+2)), klinikte ×1,5.
 * En öncelikli ders başta.
 */
export function dusSubjectPriority(answers: DusAnswers): { subject: DusSubject; acc: number; score: number }[] {
  return DUS_SUBJECTS.map((subject, i) => {
    const st = subjectSummary(answers, subject)
    const acc = (st.correct + 1) / (st.answered + 2)
    return { subject, acc, score: (1 - acc) * TEST_WEIGHT[subject.test], i }
  })
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map(({ subject, acc, score }) => ({ subject, acc, score }))
}

/**
 * Çözülmemiş yeni soru adayları (saf), öncelik sırasıyla: en zayıf dersten başlayıp her turda dersten en çok `chunk`
 * soru (çeşit olsun), sonra sıradaki ders. Ders içinde yeni sınav önce (examIds verilen sırada), soru sırasıyla.
 * İptal edilen sorular burada bilinmez; çağıran yüklerken eler (dusItemsOf), o yüzden birkaç fazla aday istenmeli.
 */
export function pickDusNewKeys(answers: DusAnswers, examIds: string[], limit: number, chunk = 5): string[] {
  if (limit <= 0) return []
  const queues = dusSubjectPriority(answers).map(({ subject }) => {
    const keys: string[] = []
    for (const id of examIds)
      for (let n = subject.from; n <= subject.to; n++) {
        const k = answerKey(id, subject.test, n)
        if (!answers[k]) keys.push(k)
      }
    return keys
  })
  const out: string[] = []
  while (out.length < limit && queues.some((q) => q.length)) {
    for (const q of queues) {
      out.push(...q.splice(0, Math.min(chunk, limit - out.length)))
      if (out.length >= limit) break
    }
  }
  return out
}

/** Bugünkü sayılar (saf): çözülen (son cevabı bugün), yeni çözülen (ilk cevabı bugün). */
export function dusTodayCounts(answers: DusAnswers, now = new Date()) {
  const today = dayKey(now)
  let solved = 0
  let fresh = 0
  for (const a of Object.values(answers)) {
    if (dayKey(a.t) === today) solved++
    if (dayKey(a.f ?? a.t) === today) fresh++
  }
  return { solved, fresh }
}

/** Seri: art arda DUS çalışılan gün (cevap ve tekrar zamanlarından; bugün çalışılmadıysa dünden geriye). */
export function dusStreak(answers: DusAnswers, deck: DusDeck, now = new Date()): number {
  const days = new Set<string>()
  for (const a of Object.values(answers)) {
    days.add(dayKey(a.t))
    if (a.f) days.add(dayKey(a.f))
  }
  for (const c of Object.values(deck)) if (c.g) days.add(dayKey(c.g))
  return streakFromDays(days, now.getTime())
}

/** Bugünün seti özeti: vadesi gelen tekrar, kalan yeni soru, ilerleme (çözülen / hedef). */
export function dusDailyPlan(answers: DusAnswers, deck: DusDeck, goal: number, now = new Date()) {
  const due = dueDusKeys(deck, now).length
  const { solved, fresh } = dusTodayCounts(answers, now)
  const reviewed = reviewedTodayCount(deck, now)
  const newLeft = Math.max(0, goal - fresh)
  return { due, newLeft, done: fresh + reviewed, target: goal + reviewed + due, solved, streak: dusStreak(answers, deck, now) }
}

/** Kullanıcının güncel verisiyle (depodan) aynı özet. */
export function readDusDailyPlan(userId: string, goal: number) {
  return dusDailyPlan(readDusAnswers(userId), readDusDeck(userId), goal)
}
