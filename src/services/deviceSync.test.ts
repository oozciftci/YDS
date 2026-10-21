import { describe, expect, it } from 'vitest'
import { mergeSnapshots, mergeStorage, type Tables } from './deviceSync'

const word = (id: string, term: string, updatedAt: string) => ({ id, userId: 'user_ozgur', term, updatedAt })
const card = (wordId: string, updatedAt: string, reps: number) => ({ id: `${wordId}_user_ozgur`, wordId, userId: 'user_ozgur', updatedAt, reps })

describe('cihazlar arası eşitleme', () => {
  it('eksik ve daha yeni kayıtları alır, eskiyi almaz', () => {
    const local: Tables = { words: [word('a', 'apple', '2026-10-20'), word('b', 'book', '2026-10-21')] }
    const remote: Tables = { words: [word('a', 'apple', '2026-10-21'), word('b', 'book', '2026-10-19'), word('c', 'cat', '2026-10-01')] }
    const m = mergeSnapshots(local, remote)
    expect(m.puts.words.map((w) => w.id).sort()).toEqual(['a', 'c'])
    expect(m.received).toBe(2)
    expect(m.deletes.words).toEqual([])
  })

  it('aynı kelime farklı kimlikteyse ortak kimliğe taşır, kart ve tekrar kayıtlarını da taşır', () => {
    const local: Tables = {
      words: [word('tel-1', 'Abandon ', '2026-10-21')],
      cardStates: [card('tel-1', '2026-10-21', 3)],
      reviewLogs: [{ id: 'log1', wordId: 'tel-1' }],
      sessionLogs: [{ id: 's1', wordIds: ['tel-1', 'x'] }],
    }
    const remote: Tables = { words: [word('pc-1', 'abandon', '2026-10-01')], cardStates: [card('pc-1', '2026-10-02', 1)] }
    const m = mergeSnapshots(local, remote)
    expect(m.remapped).toBe(1)
    expect(m.deletes.words).toEqual(['tel-1'])
    expect(m.deletes.cardStates).toEqual(['tel-1_user_ozgur'])
    // Yerel kart daha yeni: ortak kimlikle yerel kart kalır
    expect(m.puts.cardStates).toEqual([{ ...card('pc-1', '2026-10-21', 3) }])
    expect(m.puts.words[0]).toMatchObject({ id: 'pc-1', term: 'Abandon ' })
    expect(m.puts.reviewLogs[0]).toMatchObject({ id: 'log1', wordId: 'pc-1' })
    expect(m.puts.sessionLogs[0].wordIds).toEqual(['pc-1', 'x'])
  })

  it('kullanıcıları yalnızca eksikse ekler', () => {
    const m = mergeSnapshots({ users: [{ id: 'user_ozgur', displayName: 'Yerel' }] }, { users: [{ id: 'user_ozgur', displayName: 'Uzak' }, { id: 'user_x' }] })
    expect(m.puts.users.map((u) => u.id)).toEqual(['user_x'])
  })

  it('tarayıcı deposu: tek taraf değiştiyse o kazanır, ikisi değiştiyse nesneler birleşir', () => {
    const base = { 'yds-book-pos:user_ozgur:ess': '10', 'yds-book-units:user_ozgur:ess': '{"1":"a"}', 'yds-x:user_ozgur': '"l"' }
    const local = { 'yds-book-pos:user_ozgur:ess': '10', 'yds-book-units:user_ozgur:ess': '{"1":"a","2":"b"}', 'yds-x:user_ozgur': '"yerel"' }
    const remote = {
      'yds-book-pos:user_ozgur:ess': '25',
      'yds-book-units:user_ozgur:ess': '{"1":"a","3":"c"}',
      'yds-x:user_ozgur': '"uzak"',
      'yds-saved:user_ozgur': '[]',
    }
    expect(mergeStorage(local, remote, base)).toEqual({
      'yds-book-pos:user_ozgur:ess': '25',
      'yds-book-units:user_ozgur:ess': '{"1":"a","2":"b","3":"c"}',
      'yds-saved:user_ozgur': '[]',
    })
  })
})
