import { describe, expect, it } from 'vitest'
import { countTokens, coverage, coverageOfCounts, emptyIndex, poolStatus, statusOf, wordsOf } from './wordStatus'

const ix = () => {
  const x = emptyIndex()
  x.pool.set('country', 'learning')
  x.pool.set('deteriorate', 'known')
  x.pool.set('obscure', 'pool')
  x.marks.set('holmes', 'ignored')
  x.marks.set('whisper', 'known')
  x.marks.set('clue', 'new') // kaldırılmış işaret
  return x
}

describe('statusOf', () => {
  it('kök adaylarıyla havuz durumunu bulur', () => {
    expect(statusOf(ix(), 'countries')).toBe('learning')
    expect(statusOf(ix(), 'deteriorated')).toBe('known')
  })
  it('elle işaret havuzdan önce gelir; "new" işareti yok sayılır', () => {
    expect(statusOf(ix(), 'whispered')).toBe('known')
    expect(statusOf(ix(), 'Holmes')).toBe('ignored')
    expect(statusOf(ix(), 'clues')).toBe('new')
  })
  it('havuzda olup çalışılmamış kelime yeni sayılır; en sık kelimeler biliniyor', () => {
    expect(statusOf(ix(), 'obscure')).toBe('new')
    expect(statusOf(ix(), 'the')).toBe('known')
    expect(statusOf(ix(), "don't")).toBe('known')
  })
  it('cümle ortasında büyük harfli, havuzda olmayan kelime özel ad sayılır', () => {
    expect(statusOf(ix(), 'Baskerville', true)).toBe('ignored')
    expect(statusOf(ix(), 'Baskerville', false)).toBe('new')
    expect(statusOf(ix(), 'Country', true)).toBe('learning')
  })
})

describe('wordsOf', () => {
  it('ilk kelime dışında büyük harfi işaretler, "I" hariç', () => {
    expect(wordsOf('Then I saw Watson.')).toEqual([
      { w: 'Then', midCap: false },
      { w: 'I', midCap: false },
      { w: 'saw', midCap: false },
      { w: 'Watson', midCap: true },
    ])
  })
})

describe('coverage', () => {
  const s = ['The obscure countries deteriorated.', 'Holmes saw the obscure clue.']
  it('geçiş üzerinden oran, benzersiz yeni kelimeler; yok sayılanlar sayılmaz', () => {
    const c = coverage(ix(), s)
    // the, deteriorated, saw, the = bilinen 4; countries öğreniliyor; obscure×2, clue yeni; Holmes yok
    expect(c.total).toBe(8)
    expect(c.known).toBe(4)
    expect(c.learning).toBe(1)
    expect(c.pct).toBe(50)
    expect(c.newWords.sort()).toEqual(['clue', 'obscure'])
  })
  it('sayımlı sürüm aynı sonucu verir', () => {
    expect(coverageOfCounts(ix(), countTokens(s))).toEqual(coverage(ix(), s))
  })
})

describe('poolStatus', () => {
  it('çalışılmış: 4-5 biliniyor, altı öğreniliyor; çalışılmamış toplanmış öğreniliyor', () => {
    expect(poolStatus({ tags: [] }, { reps: 3, masteryScore: 4 })).toBe('known')
    expect(poolStatus({ tags: [] }, { reps: 2, masteryScore: 2 })).toBe('learning')
    expect(poolStatus({ tags: ['Okumadan'] }, { reps: 0 })).toBe('learning')
    expect(poolStatus({ tags: ['Oxford'] }, { reps: 0 })).toBe('pool')
  })
})
