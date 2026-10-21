import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { countWords, glossFor, READING_LEVELS, type LibText } from './readingLibrary'
import { readingStats } from './readingLog'

describe('readingLibrary', () => {
  it('kelime sayar, metnin kendi anlamını büyük harf/noktalama/iyelik ekinden bağımsız bulur', () => {
    expect(countWords([{ en: "Bees aren't big." }, { en: 'However, they work.' }])).toBe(6)
    const g = { however: 'ancak', bee: 'arı' }
    expect(glossFor(g, 'However,')).toBe('ancak')
    expect(glossFor(g, "bee's")).toBe('arı')
    expect(glossFor(g, 'honey')).toBeUndefined()
  })

  it('okuma ortalamasına göz gezdirmeler girmez', () => {
    const at = '2026-10-21T10:00:00Z'
    expect(readingStats([{ sec: 60, words: 120, at }, { sec: 10, words: 200, at, skim: true }])).toEqual({ count: 2, wpm: 120 })
    expect(readingStats([])).toEqual({ count: 0, wpm: null })
  })

  it('yayındaki metin dosyaları geçerli (anlamlar metinde geçer, sorular tutarlı)', () => {
    const dir = path.join(__dirname, '..', '..', 'public', 'data', 'okuma')
    const ids = new Set<string>()
    for (const { file } of READING_LEVELS) {
      const p = path.join(dir, `${file}.json`)
      if (!fs.existsSync(p)) continue
      const { texts } = JSON.parse(fs.readFileSync(p, 'utf8')) as { texts: LibText[] }
      for (const t of texts) {
        expect(ids.has(t.id), t.id).toBe(false)
        ids.add(t.id)
        const tokens = new Set(t.sentences.flatMap((s) => (s.en.match(/[A-Za-z]+(?:['’][A-Za-z]+)?/g) || []).map((w) => w.toLowerCase())))
        for (const k of Object.keys(t.glosses)) expect(tokens.has(k), `${t.id}: ${k}`).toBe(true)
        expect(t.sentences.every((s) => s.en && s.tr)).toBe(true)
        for (const q of t.qs) {
          expect(q.o).toHaveLength(4)
          expect(q.a).toBeGreaterThanOrEqual(0)
          expect(q.a).toBeLessThan(4)
        }
      }
    }
    expect(ids.size).toBeGreaterThanOrEqual(8)
  })
})

describe('okuma kitapları', () => {
  it('cümlelere böler: kısaltma, baş harf ve tırnak cümleyi yanlış yerden bölmez', async () => {
    const { splitSentences, splitDialogue } = await import('./sentenceSplit')
    expect(splitSentences('Mr. Holmes met Dr. Watson. They talked. "Is it true?" he asked. Yes!')).toEqual([
      'Mr. Holmes met Dr. Watson.',
      'They talked.',
      '"Is it true?" he asked.',
      'Yes!',
    ])
    expect(splitSentences('H. G. Wells wrote it in 1895. It was short.')).toEqual(['H. G. Wells wrote it in 1895.', 'It was short.'])
    expect(splitDialogue('"Frequently." "How often?" "Well, some hundreds of times."')).toEqual(['"Frequently."', '"How often?"', '"Well, some hundreds of times."'])
  })

  it('sayfalara böler: bölüm başı yeni sayfa, paragraf bölünmez', async () => {
    const { paginate } = await import('./readingBooks')
    const para = (n: number) => [Array.from({ length: n }, () => 'word').join(' ')]
    const pages = paginate({ chapters: [{ title: 'A', paras: [para(210), para(200), para(50)] }, { title: 'B', paras: [{ h: 'x' }, para(100)] }] }, 320)
    expect(pages.map((p) => [p.chapter, p.from, p.to, p.lastOfChapter])).toEqual([
      [0, 0, 1, false],
      [0, 1, 3, true],
      [1, 0, 2, true],
    ])
  })
})
