import { describe, expect, it, vi } from 'vitest'

// fsrs.ts → sync.ts açılışta localStorage okur; Node'da bellek içi bir taklit yeterli
vi.hoisted(() => {
  const m = new Map<string, string>()
  globalThis.localStorage = {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() {
      return m.size
    },
  } as Storage
})

import { answerKey, dusAttempts, nextDusAnswer, type DusAnswer, type DusAnswers } from './dus'
import {
  addToDusDeck,
  clampDusGoal,
  dueDusKeys,
  dusDailyPlan,
  dusDeckCounts,
  dusStreak,
  dusSubjectPriority,
  gradeDusCard,
  pickDusNewKeys,
  removeFromDusDeck,
  type DusDeck,
} from './dusSrs'

const at = (s: string) => new Date(s)
const NOW = at('2026-11-11T10:00:00')
const K = '2021/kbt/5'

describe('DUS cevap kaydı', () => {
  it('eski biçimli kaydı ({c,ok,w,t}) sorunsuz okur ve günceller', () => {
    const old: DusAnswer = { c: 'B', ok: false, w: 2, t: '2026-10-01T08:00:00.000Z' }
    expect(dusAttempts(old)).toBe(2)
    const next = nextDusAnswer(old, 'C', true, '2026-11-11T08:00:00.000Z')
    expect(next).toEqual({ c: 'C', ok: true, w: 2, t: '2026-11-11T08:00:00.000Z', n: 3, f: '2026-10-01T08:00:00.000Z' })
  })

  it('ilk cevapta n=1, f=t; ⭐ işareti yeni cevapta korunur', () => {
    const first = nextDusAnswer(undefined, 'A', false, 'T1')
    expect(first).toEqual({ c: 'A', ok: false, w: 1, t: 'T1', n: 1, f: 'T1' })
    const second = nextDusAnswer({ ...first, flag: true }, 'B', true, 'T2')
    expect(second).toMatchObject({ n: 2, f: 'T1', w: 1, flag: true })
  })
})

describe('DUS aralıklı tekrar', () => {
  it('yanlış cevaplanan soru desteye girer, vadesi ertesi gün başı', () => {
    const deck = addToDusDeck({}, K, 'yanlis', NOW)
    expect(deck[K].due).toBe(at('2026-11-12T00:00:00').toISOString())
    expect(deck[K].src).toBe('yanlis')
    expect(dueDusKeys(deck, NOW)).toEqual([])
    expect(dueDusKeys(deck, at('2026-11-12T07:00:00'))).toEqual([K])
    expect(dusDeckCounts(deck, NOW)).toEqual({ due: 0, tomorrow: 1, week: 1, total: 1 })
  })

  it('İyi/Kolay vadeyi ileri atar, Kolay en uzağa; Tekrar ertesi güne', () => {
    const day2 = at('2026-11-12T09:00:00')
    const deck = addToDusDeck({}, K, 'yanlis', NOW)
    const good = gradeDusCard(deck, K, 'iyi', day2)[K]
    const easy = gradeDusCard(deck, K, 'kolay', day2)[K]
    const again = gradeDusCard(deck, K, 'tekrar', day2)[K]
    expect(again.due).toBe(at('2026-11-13T00:00:00').toISOString())
    expect(good.due >= again.due).toBe(true)
    expect(easy.due > good.due).toBe(true)
    expect(again.l).toBe(deck[K].l + 1)
    expect(good.g).toBe(day2.toISOString())
    // vade her zaman gün başı
    expect(new Date(easy.due).getHours()).toBe(0)
  })

  it('zaten destede olan soruya yeni yanlış vadeyi yarına çeker; ⭐ dokunmaz', () => {
    let deck: DusDeck = addToDusDeck({}, K, 'yanlis', NOW)
    deck = gradeDusCard(deck, K, 'kolay', at('2026-11-12T09:00:00'))
    const far = deck[K].due
    expect(addToDusDeck(deck, K, 'isaret', at('2026-11-12T10:00:00'))[K].due).toBe(far)
    expect(addToDusDeck(deck, K, 'yanlis', at('2026-11-12T10:00:00'))[K].due).toBe(at('2026-11-13T00:00:00').toISOString())
  })

  it('desteden çıkarılan kart vadesi gelse de sorulmaz, yeniden eklenebilir', () => {
    let deck = addToDusDeck({}, K, 'yanlis', NOW)
    deck = removeFromDusDeck(deck, K, NOW)
    expect(deck[K].x).toBe(true)
    expect(dueDusKeys(deck, at('2026-12-01'))).toEqual([])
    expect(dusDeckCounts(deck, NOW).total).toBe(0)
    deck = addToDusDeck(deck, K, 'isaret', NOW)
    expect(deck[K].x).toBeUndefined()
    expect(deck[K].src).toBe('isaret')
  })

  it('vadesi gelenler en eski vadeden sıralanır', () => {
    let deck = addToDusDeck({}, 'b/kbt/1', 'yanlis', at('2026-11-05T10:00:00'))
    deck = addToDusDeck(deck, 'a/kbt/1', 'yanlis', at('2026-11-08T10:00:00'))
    expect(dueDusKeys(deck, NOW)).toEqual(['b/kbt/1', 'a/kbt/1'])
  })
})

describe('Bugünün seti', () => {
  const ans = (ok: boolean, t = '2026-11-01T10:00:00.000Z'): DusAnswer => ({ c: 'A', ok, w: ok ? 0 : 1, t })

  it('hiç veri yokken klinik dersler öne alınır', () => {
    const p = dusSubjectPriority({})
    expect(p[0].subject.test).toBe('kbt')
    expect(p.slice(0, 8).every((x) => x.subject.test === 'kbt')).toBe(true)
  })

  it('zayıf ders öne geçer (Temel olsa bile çok zayıfsa)', () => {
    const answers: DusAnswers = {}
    // Anatomi (tbt 1-6): 6 yanlış; klinik dersler: hepsi doğru
    for (let n = 1; n <= 6; n++) answers[answerKey('2021', 'tbt', n)] = ans(false)
    for (let n = 1; n <= 80; n++) answers[answerKey('2021', 'kbt', n)] = ans(true)
    expect(dusSubjectPriority(answers)[0].subject.id).toBe('anatomi')
  })

  it('yeni adaylar: çözülmüşler atlanır, en zayıf dersten turlar hâlinde', () => {
    const answers: DusAnswers = { [answerKey('2021', 'kbt', 1)]: ans(false) }
    const keys = pickDusNewKeys(answers, ['2021', '2020'], 12, 5)
    expect(keys).toHaveLength(12)
    expect(keys).not.toContain('2021/kbt/1')
    // Restoratif (kbt 1-10) yanlışla en zayıf: ilk 5 ondan, yeni sınav önce
    expect(keys.slice(0, 5)).toEqual(['2021/kbt/2', '2021/kbt/3', '2021/kbt/4', '2021/kbt/5', '2021/kbt/6'])
    expect(new Set(keys).size).toBe(12)
    expect(pickDusNewKeys(answers, ['2021'], 0)).toEqual([])
  })

  it('özet: vadesi gelen, kalan yeni, ilerleme ve seri', () => {
    const answers: DusAnswers = {
      'x/kbt/1': { ...ans(true, at('2026-11-11T08:00:00').toISOString()), f: at('2026-11-11T08:00:00').toISOString() },
      'x/kbt/2': { ...ans(true, at('2026-11-10T08:00:00').toISOString()) },
      'x/kbt/3': { ...ans(false, at('2026-11-09T08:00:00').toISOString()) },
    }
    const deck = addToDusDeck({}, 'x/kbt/3', 'yanlis', at('2026-11-09T08:00:00'))
    const plan = dusDailyPlan(answers, deck, 20, NOW)
    expect(plan.due).toBe(1)
    expect(plan.newLeft).toBe(19)
    expect(plan.done).toBe(1)
    expect(plan.target).toBe(21)
    expect(plan.streak).toBe(3)
    expect(dusStreak({}, {}, NOW)).toBe(0)
  })

  it('günlük hedef 5-100 arasında, 5’in katı', () => {
    expect(clampDusGoal(2)).toBe(5)
    expect(clampDusGoal(23)).toBe(25)
    expect(clampDusGoal(500)).toBe(100)
  })
})
