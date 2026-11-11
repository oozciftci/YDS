import { describe, expect, it } from 'vitest'
import type { DusExam } from './dus'
import {
  activeRun,
  addMockLog,
  bestByExam,
  closeRun,
  examItems,
  logEntryOf,
  newRun,
  parseKey,
  pickMixed,
  readMockLog,
  readRun,
  remainingSec,
  rng,
  scoreMock,
  subjectStats,
  weakestSubjects,
  writeRun,
} from './dusMock'

/** Sahte sınav: Temel 40, Klinik 80 soru; cevap hep 'A', `cancel` listesi iptal. */
function fakeExam(id: string, cancel: string[] = []): DusExam {
  const qs = (test: string, n: number) =>
    Array.from({ length: n }, (_, i) => ({
      n: i + 1,
      page: 1,
      box: [0, 0, 1, 1] as [number, number, number, number],
      answer: cancel.includes(`${test}/${i + 1}`) ? 'X' : 'A',
      text: '',
    }))
  return {
    id,
    title: id,
    year: 2020,
    pages: [{ w: 100, h: 100 }],
    tests: [
      { key: 'tbt', title: 'Temel', questions: qs('tbt', 40) },
      { key: 'kbt', title: 'Klinik', questions: qs('kbt', 80) },
    ],
  }
}

function memStore() {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m }
}

const exams = Array.from({ length: 12 }, (_, i) => fakeExam(`dus-${2010 + i}`, i === 0 ? ['tbt/1', 'kbt/5'] : []))

describe('DUS deneme seçimi', () => {
  it('rastgele tohumlanabilir', () => {
    const a = rng(42)
    const b = rng(42)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })

  it('sınav denemesi iptal soruları atlar, kapsamı uygular', () => {
    expect(examItems(exams[0], 'tam')).toHaveLength(118)
    expect(examItems(exams[1], 'tbt')).toHaveLength(40)
    expect(examItems(exams[1], 'kbt').every((k) => k.includes('/kbt/'))).toBe(true)
  })

  it('karma deneme resmi dağılımı tutturur, farklı sınavlardan seçer, iptalleri almaz', () => {
    const keys = pickMixed(exams, 'tam', 7)
    expect(keys).toHaveLength(120)
    expect(new Set(keys).size).toBe(120)
    expect(keys).not.toContain('dus-2010/tbt/1')
    expect(keys).not.toContain('dus-2010/kbt/5')
    // Anatomi (Temel 1-6): 6 soru, 6 ayrı sınav
    const anat = keys.filter((k) => parseKey(k).test === 'tbt' && parseKey(k).n <= 6)
    expect(anat).toHaveLength(6)
    expect(new Set(anat.map((k) => parseKey(k).examId)).size).toBe(6)
    // Restoratif (Klinik 1-10): 10 soru, 10 ayrı sınav
    const rest = keys.filter((k) => parseKey(k).test === 'kbt' && parseKey(k).n <= 10)
    expect(new Set(rest.map((k) => parseKey(k).examId)).size).toBe(10)
    // Aynı tohum aynı deneme, farklı tohum farklı
    expect(pickMixed(exams, 'tam', 7)).toEqual(keys)
    expect(pickMixed(exams, 'tam', 8)).not.toEqual(keys)
    expect(pickMixed(exams, 'tbt', 1)).toHaveLength(40)
    expect(pickMixed(exams, 'kbt', 1)).toHaveLength(80)
  })

  it('soru havuzu yetmezse olanı alır', () => {
    expect(pickMixed([exams[1]], 'tbt', 3)).toHaveLength(40)
  })
})

describe('DUS deneme puanlama', () => {
  const answerOf = (k: string) => (k.endsWith('/kbt/80') ? 'X' : 'A')

  it('neti test başına ayrı hesaplar, ders dökümü ve ağırlıklı başarı', () => {
    const items = examItems(exams[1], 'tam')
    const choices: Record<string, string> = {}
    // Temel: 20 doğru, 8 yanlış (anatomi 1-6 doğru)
    for (let n = 1; n <= 20; n++) choices[`dus-2011/tbt/${n}`] = 'A'
    for (let n = 21; n <= 28; n++) choices[`dus-2011/tbt/${n}`] = 'B'
    // Klinik: 40 doğru, 4 yanlış
    for (let n = 1; n <= 40; n++) choices[`dus-2011/kbt/${n}`] = 'A'
    for (let n = 41; n <= 44; n++) choices[`dus-2011/kbt/${n}`] = 'C'
    const s = scoreMock(items, choices, answerOf, { 'dus-2011/tbt/1': 30, 'dus-2011/tbt/2': 15 })
    expect(s.tests.tbt).toEqual({ correct: 20, wrong: 8, empty: 12, count: 40, net: 18 })
    // kbt/80 iptal sayıldı → 79 soru
    expect(s.tests.kbt).toEqual({ correct: 40, wrong: 4, empty: 35, count: 79, net: 39 })
    expect(s.total.net).toBe(57)
    expect(s.subjects.anatomi).toEqual({ c: 6, w: 0, e: 0, s: 45 })
    expect(s.subjects.pedodonti.e).toBe(9)
    // Temel %45, Klinik %49,37 → K = 0,4×45 + 0,6×49,37
    expect(s.weighted?.K).toBeCloseTo(47.6, 1)
    expect(s.weighted?.T).toBeCloseTo(46.7, 1)
  })

  it('tek testli denemede ağırlıklı başarı yok', () => {
    const s = scoreMock(examItems(exams[1], 'tbt'), {}, answerOf)
    expect(s.weighted).toBeNull()
    expect(s.tests.tbt?.empty).toBe(40)
    expect(s.tests.kbt).toBeUndefined()
  })
})

describe('DUS deneme kaydı', () => {
  it('yarıdaki deneme okunur/yazılır, bitince done ile kapanır', () => {
    const st = memStore()
    const run = newRun({ kind: 'karma', scope: 'tbt', title: 'Karma', items: ['a/tbt/1'], now: new Date('2026-11-11T10:00:00Z'), id: 'r1' })
    expect(run.durationSec).toBe(3000)
    expect(remainingSec(run, new Date('2026-11-11T10:10:00Z').getTime())).toBe(2400)
    writeRun('user_x', run, st)
    expect(st.m.has('yds-dusmock:user_x')).toBe(true)
    expect(activeRun('user_x', st)?.id).toBe('r1')
    writeRun('user_x', closeRun(run, new Date('2026-11-11T10:30:00Z')), st)
    expect(activeRun('user_x', st)).toBeNull()
    expect(readRun('user_x', st)?.done).toBe('2026-11-11T10:30:00.000Z')
    // Eşitlemede eski denemenin `done` alanı yeni denemeye karışırsa yenisi kapanmaz
    const other = newRun({ kind: 'karma', scope: 'tam', title: 'Yeni', items: ['a/kbt/1'], id: 'r2' })
    writeRun('user_x', { ...closeRun(run, new Date()), ...other }, st)
    expect(activeRun('user_x', st)?.id).toBe('r2')
  })

  it('geçmiş sıralı, kimliğe göre tekil, en iyi sınav denemesi', () => {
    const st = memStore()
    const mk = (id: string, at: string, net: number) => {
      const run = newRun({ kind: 'sinav', scope: 'tam', title: 'x', items: [], examId: 'dus-2011', now: new Date(at), id })
      const score = scoreMock([], {}, () => 'A')
      return logEntryOf(run, { ...score, total: { ...score.total, net } }, new Date(new Date(at).getTime() + 3600_000))
    }
    addMockLog('user_x', mk('b', '2026-11-02T10:00:00Z', 50), st)
    addMockLog('user_x', mk('a', '2026-11-01T10:00:00Z', 70), st)
    addMockLog('user_x', mk('b', '2026-11-02T10:00:00Z', 50), st)
    const log = readMockLog('user_x', st)
    expect(log.map((e) => e.id)).toEqual(['a', 'b'])
    expect(log[0].durationSec).toBe(3600)
    expect(bestByExam(log).get('dus-2011')?.id).toBe('a')
    // Eşitlemede çift gelen kayıt tekilleşir
    st.setItem('yds-dus-mocklog:user_x', JSON.stringify([...log, log[0]]))
    expect(readMockLog('user_x', st)).toHaveLength(2)
  })
})

describe('DUS istatistik', () => {
  it('ders özeti ve en zayıf dersler', () => {
    const t = '2026-11-11T10:00:00Z'
    const all = {
      // Anatomi: 6 çözüldü, 1 doğru
      ...Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`e/tbt/${i + 1}`, { c: 'A', ok: i === 0, w: 0, t }])),
      // Fizyoloji (11-16): 6 çözüldü, 5 doğru
      ...Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`e/tbt/${i + 11}`, { c: 'A', ok: i > 0, w: 0, t }])),
      // Restoratif: 2 çözüldü, 0 doğru (az soru)
      'e/kbt/1': { c: 'A', ok: false, w: 1, t },
      'e/kbt/2': { c: 'A', ok: false, w: 1, t },
    }
    const st = subjectStats(all)
    expect(st.find((s) => s.id === 'anatomi')).toMatchObject({ answered: 6, correct: 1, pct: 17 })
    expect(st.find((s) => s.id === 'histoloji')?.pct).toBeNull()
    expect(weakestSubjects(st)).toEqual(['anatomi', 'fizyoloji', 'restoratif'])
    expect(weakestSubjects(st, 1)).toEqual(['anatomi'])
  })
})
