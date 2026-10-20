import { describe, expect, it } from 'vitest'
import type { CardState, ExamAnswer, MockExamResult, ReviewLog } from '../types/database'
import { buildDailyPlan, planPercent } from './dailyPlan'
import { dayKey, daysUntil, streakFromDays } from './dates'
import { mockAdvice, mockCadence, compareMocks } from './mockPlan'
import { summarizeTimes } from './mockTime'
import { buildTargetPlan } from './targetPlan'
import { isLeech, LEECH_LAPSES } from './leech'
import { pageLabel, prettyExamId } from './notebook'
import { checkWritten } from './studySession'
import { familyOf, stemOf } from '../data/affixes'
import { extractWordsFromText } from './textWords'
import { buildWeeklyReport, reportToText } from './weeklyReport'
import { reasonCounts } from './wrongReasons'
import { isYokdil, rangeIn, sectionOf, ydsScore } from './ydsSections'

describe('ydsSections', () => {
  it('YDS ve YÖKDİL soru numaralarını doğru tipe eşler', () => {
    expect(sectionOf(1).key).toBe('vocab')
    expect(sectionOf(7).key).toBe('grammar')
    expect(sectionOf(50).key).toBe('reading')
    expect(sectionOf(10, 'yokdil-2019-mart-fen').key).toBe('vocgram')
    expect(sectionOf(25, 'yokdil-2019-mart-fen').key).toBe('cloze')
    expect(sectionOf(70, 'yokdil-2019-mart-fen').key).toBe('reading')
  })
  it('aralıkları sınav türüne göre verir', () => {
    expect(rangeIn('grammar', 'yds-2018-aralik')).toEqual([7, 16])
    expect(rangeIn('vocgram', 'yokdil-2018-yaz-sosyal')).toEqual([1, 20])
    expect(rangeIn('vocgram', 'yds-2018-aralik')).toBeNull()
    expect(isYokdil('yokdil-x')).toBe(true)
    expect(isYokdil('yds-x')).toBe(false)
  })
  it('puan: her doğru 1,25', () => {
    expect(ydsScore(80)).toBe(100)
    expect(ydsScore(64)).toBe(80)
  })
})

describe('dates', () => {
  it('dayKey ve daysUntil', () => {
    const now = new Date('2026-10-19T12:00:00').getTime()
    expect(dayKey(now)).toBe('2026-10-19')
    expect(daysUntil('2026-10-29', now)).toBe(10)
    expect(daysUntil('', now)).toBeNull()
    expect(daysUntil('2026-10-01', now)).toBe(0)
  })
  it('seri: bugün çalışılmadıysa dünden sayar', () => {
    const now = new Date('2026-10-19T12:00:00').getTime()
    expect(streakFromDays(new Set(['2026-10-18', '2026-10-17']), now)).toBe(2)
    expect(streakFromDays(new Set(['2026-10-19', '2026-10-18']), now)).toBe(2)
    expect(streakFromDays(new Set(['2026-10-10']), now)).toBe(0)
  })
})

describe('targetPlan', () => {
  const stat = (key: string, answered: number, correct: number) => ({
    key: key as never,
    answered,
    correct,
    percent: answered ? Math.round((correct / answered) * 100) : null,
  })
  it('yeterli veri yoksa plan çıkmaz', () => {
    expect(buildTargetPlan(80, [stat('vocab', 5, 3)])).toBeNull()
  })
  it('gereken doğru sayısı ve eksik', () => {
    const plan = buildTargetPlan(80, [stat('vocab', 20, 10), stat('grammar', 20, 10), stat('reading', 20, 10)])
    expect(plan).not.toBeNull()
    expect(plan!.needCorrect).toBe(64)
    expect(plan!.estCorrect).toBeCloseTo(40, 0)
    expect(plan!.gap).toBeGreaterThan(20)
    const total = plan!.gains.reduce((s, g) => s + g.gain, 0)
    expect(total).toBeCloseTo(plan!.gap, 5)
  })
  it('hedef aşılmışsa eksik 0', () => {
    const plan = buildTargetPlan(40, [stat('vocab', 20, 18), stat('grammar', 20, 18), stat('reading', 20, 18)])
    expect(plan!.gap).toBe(0)
  })
})

describe('mockTime', () => {
  it('tip bazında süre ve yavaş tip', () => {
    // 1-6 kelime: 6 soru x 60 sn; 43-62 okuma: 4 soru x 300 sn
    const times: Record<number, number> = {}
    for (let i = 1; i <= 6; i++) times[i] = 60
    for (let i = 43; i <= 46; i++) times[i] = 300
    const rows = summarizeTimes(times, 'yds-2018-aralik')
    const vocab = rows.find((r) => r.key === 'vocab')!
    const reading = rows.find((r) => r.key === 'reading')!
    expect(vocab.avgSec).toBe(60)
    expect(reading.avgSec).toBe(300)
    expect(reading.slow).toBe(true)
    expect(vocab.slow).toBe(false)
  })
})

const mock = (finishedAt: string, sections: Record<string, [number, number]>): MockExamResult => ({
  id: finishedAt,
  userId: 'u',
  examId: 'e',
  examTitle: 'T',
  startedAt: finishedAt,
  finishedAt,
  durationSec: 1,
  correct: 0,
  wrong: 0,
  empty: 0,
  score: 0,
  sections,
  choices: {},
})

describe('mockPlan', () => {
  it('sınava kalan güne göre sıklık', () => {
    expect(mockCadence(200).everyDays).toBe(30)
    expect(mockCadence(60).everyDays).toBe(7)
    expect(mockCadence(10).everyDays).toBe(3)
    expect(mockCadence(null).everyDays).toBe(14)
  })
  it('deneme zamanı geldi mi', () => {
    const now = new Date('2026-10-19T12:00:00Z').getTime()
    expect(mockAdvice([], 60, now).due).toBe(true)
    const recent = mock('2026-10-17T12:00:00Z', {})
    expect(mockAdvice([recent], 60, now).due).toBe(false)
    const old = mock('2026-10-01T12:00:00Z', {})
    expect(mockAdvice([old], 60, now).due).toBe(true)
  })
  it('tip karşılaştırması ve fark', () => {
    const rows = compareMocks([
      mock('2026-10-01T00:00:00Z', { vocab: [3, 6] }),
      mock('2026-10-10T00:00:00Z', { vocab: [5, 6] }),
    ])
    const vocab = rows.find((r) => r.key === 'vocab')!
    expect(vocab.pcts).toEqual([50, 83])
    expect(vocab.delta).toBe(33)
  })
})

describe('wrongReasons', () => {
  const ans = (over: Partial<ExamAnswer>): ExamAnswer => ({
    id: 'a',
    userId: 'u',
    examId: 'e',
    no: 1,
    section: 'vocab',
    choice: 'A',
    correct: false,
    attempts: 1,
    wrongCount: 1,
    inWrongBook: true,
    firstAnsweredAt: '2026-10-18T00:00:00Z',
    answeredAt: '2026-10-18T00:00:00Z',
    ...over,
  })
  it('neden dağılımı ve zaman süzgeci', () => {
    const now = new Date('2026-10-19T00:00:00Z').getTime()
    const list = [
      ans({ wrongReason: 'bilmiyordum' }),
      ans({ wrongReason: 'dikkatsizlik', answeredAt: '2026-09-01T00:00:00Z' }),
      ans({}),
      ans({ correct: true, wrongReason: 'sure' }),
    ]
    const all = reasonCounts(list, undefined, now)
    expect(all.counts.bilmiyordum).toBe(1)
    expect(all.counts.dikkatsizlik).toBe(1)
    expect(all.counts.sure).toBe(0)
    expect(all.untagged).toBe(1)
    const week = reasonCounts(list, 7, now)
    expect(week.tagged).toBe(1)
  })
})

describe('dailyPlan', () => {
  const card = (id: string, state: number, due: string): CardState =>
    ({ wordId: id, userId: 'u', state, due, reps: state ? 1 : 0 }) as unknown as CardState
  it('tekrar ve yeni kelime görevleri', () => {
    const now = new Date('2026-10-19T12:00:00Z').getTime()
    const cards = [
      card('a', 2, '2026-10-18T00:00:00Z'),
      card('b', 2, '2026-10-19T00:00:00Z'),
      card('c', 2, '2026-12-01T00:00:00Z'),
      ...Array.from({ length: 40 }, (_, i) => card(`n${i}`, 0, '2026-10-19T00:00:00Z')),
    ]
    const tasks = buildDailyPlan({ cards, logs: [] as ReviewLog[], answers: [], daysLeft: 10, newWordCap: 20, now })
    const review = tasks.find((t) => t.key === 'review')!
    const newT = tasks.find((t) => t.key === 'new')!
    expect(review.target).toBe(2)
    expect(newT.target).toBe(5) // günde en az 5 yeni kelime
    expect(tasks.find((t) => t.key === 'questions')).toBeUndefined()
    expect(planPercent(tasks)).toBe(0)
  })
  it('soru görevi yalnızca havuz bilinirse çıkar', () => {
    const tasks = buildDailyPlan({ cards: [], logs: [], answers: [], daysLeft: 10, newWordCap: 20, unansweredQuestions: 300 })
    expect(tasks.find((t) => t.key === 'questions')!.target).toBe(30)
  })
})

describe('weeklyReport', () => {
  const now = new Date('2026-10-19T12:00:00Z').getTime()
  const log = (wordId: string, at: string, rating: number) => ({ id: wordId + at, wordId, userId: 'u', rating, reviewedAt: at }) as unknown as ReviewLog
  const answer = (section: string, correct: boolean, at: string) =>
    ({ id: section + at + correct, userId: 'u', examId: 'e', no: 1, section, choice: 'A', correct, attempts: 1, wrongCount: 0, inWrongBook: false, firstAnsweredAt: at, answeredAt: at }) as ExamAnswer
  it('bu hafta ve geçen hafta ayrı sayılır', () => {
    const logs = [
      log('a', '2026-10-18T10:00:00Z', 3),
      log('a', '2026-10-17T10:00:00Z', 1),
      log('b', '2026-10-10T10:00:00Z', 4),
    ]
    const r = buildWeeklyReport(logs, [], [], now)
    expect(r.thisWeek.reviews).toBe(2)
    expect(r.thisWeek.successRate).toBe(50)
    expect(r.lastWeek.reviews).toBe(1)
    expect(r.thisWeek.activeDays).toBe(2)
    expect(r.thisWeek.newWords).toBe(1)
  })
  it('en zayıf tip en az 5 soruyla belirlenir', () => {
    const answers = [
      ...Array.from({ length: 5 }, (_, i) => answer('grammar', i < 4, '2026-10-18T10:00:00Z')),
      ...Array.from({ length: 5 }, (_, i) => answer('vocab', i < 2, '2026-10-18T11:00:00Z')),
      answer('reading', false, '2026-10-18T12:00:00Z'),
    ]
    const r = buildWeeklyReport([], answers, [], now)
    expect(r.weakest?.key).toBe('vocab')
    expect(r.weakest?.pct).toBe(40)
    expect(reportToText(r)).toContain('En zayıf soru tipi')
  })
})

describe('textWords', () => {
  const dict = [
    { term: 'abandon', definition: 'terk etmek', partOfSpeech: 'verb', tags: ['B2', 'YDS-Sık'] },
    { term: 'cat', definition: 'kedi', partOfSpeech: 'noun', tags: ['A1'] },
    { term: 'scrutinize', definition: 'incelemek', partOfSpeech: 'verb', tags: ['C1', 'YDS-Çok-Sık'] },
  ] as never[]
  it('çekimli biçimleri bulur, havuzdakini atlar, sıklığa göre sıralar', () => {
    const r = extractWordsFromText('They abandoned the cat. Experts scrutinize results; abandoning is rare. Zorbax appears.', dict, new Set(['cat']))
    expect(r.found.map((f) => f.word.term)).toEqual(['scrutinize', 'abandon'])
    expect(r.found.find((f) => f.word.term === 'abandon')?.count).toBe(2)
    expect(r.owned).toBe(1)
    expect(r.unknown).toBeGreaterThan(0)
  })
})

describe('leech', () => {
  it('5 ve üzeri unutma inatçı kelime sayılır', () => {
    expect(isLeech({ lapses: LEECH_LAPSES - 1 })).toBe(false)
    expect(isLeech({ lapses: LEECH_LAPSES })).toBe(true)
    expect(isLeech(undefined)).toBe(false)
  })
})

describe('notebook', () => {
  it('sınav kimliğini okunur yapar', () => {
    expect(prettyExamId('yds-2018-aralik')).toBe('2018 Aralık YDS')
    expect(prettyExamId('yokdil-2019-mart-fen')).toBe('2019 Mart YÖKDİL Fen')
  })
  it('sayfa yolundan özellik adı', () => {
    expect(pageLabel('/')).toBe('Ana Sayfa')
    expect(pageLabel('/yds-sorular/sinav/yds-2018-aralik')).toBe('Soru Merkezi · 2018 Aralık YDS')
    expect(pageLabel('/yds-sorular/konu/grammar')).toBe('Konuya Göre · Dilbilgisi')
    expect(pageLabel('/yds-test/vocab-03')).toBe('Alıştırma · Kelime 3')
    expect(pageLabel('/yds-test/ceviri/')).toBe('Çeviri Atölyesi')
  })
})

describe('yazarak cevap', () => {
  it('büyük/küçük harf ve noktalama önemsiz', () => {
    expect(checkWritten('  Deteriorate. ', 'deteriorate')).toBe('correct')
    expect(checkWritten('give up', 'Give up')).toBe('correct')
  })
  it('tek harflik hata neredeyse sayılır, kısa kelimede sayılmaz', () => {
    expect(checkWritten('deteriorte', 'deteriorate')).toBe('almost')
    expect(checkWritten('dg', 'dog')).toBe('wrong')
    expect(checkWritten('improve', 'deteriorate')).toBe('wrong')
  })
})

describe('kelime ailesi', () => {
  it('ortak kök', () => {
    expect(stemOf('development')).toBe(stemOf('develop'))
    expect(stemOf('creation')).toBe(stemOf('create'))
  })
  it('havuzdaki aile', () => {
    expect(familyOf('develop', ['development', 'developer', 'deep', 'develop']).sort()).toEqual(['developer', 'development'])
  })
})
