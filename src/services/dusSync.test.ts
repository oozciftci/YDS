import { describe, expect, it } from 'vitest'
import { mergeDusStorage } from './backup'
import { isSyncedStorageKey, mergeStamped, mergeStorage } from './deviceSync'

const a = (c: string, t: string) => ({ c, ok: c === 'A', w: c === 'A' ? 0 : 1, t })

describe('DUS kayıtlarının eşitlenmesi', () => {
  it('iki cihaz da değiştirdiyse kayıt kayıt daha yeni t kazanır', () => {
    const K = 'yds-dus:user_ozgur'
    const base = { [K]: JSON.stringify({ '2021/kbt/1': a('B', '2026-11-01') }) }
    const local = { [K]: JSON.stringify({ '2021/kbt/1': a('B', '2026-11-01'), '2021/kbt/2': a('A', '2026-11-05'), '2021/kbt/3': a('C', '2026-11-09') }) }
    const remote = { [K]: JSON.stringify({ '2021/kbt/1': a('A', '2026-11-03'), '2021/kbt/3': a('A', '2026-11-08'), '2021/kbt/4': a('D', '2026-11-02') }) }
    const out = JSON.parse(mergeStorage(local, remote, base)[K]) as Record<string, { c: string }>
    expect(out['2021/kbt/1'].c).toBe('A') // uzak daha yeni
    expect(out['2021/kbt/2'].c).toBe('A') // yalnız yerelde
    expect(out['2021/kbt/3'].c).toBe('C') // yerel daha yeni (yüzeysel birleşmede de yerel kalırdı)
    expect(out['2021/kbt/4'].c).toBe('D') // yalnız uzakta
  })

  it('tekrar destesi anahtarı da eşitlenir ve damgayla birleşir; çıkarılan kart (x) daha yeniyse kazanır', () => {
    const K = 'yds-dus-srs:user_ozgur'
    const local = { [K]: JSON.stringify({ k: { due: '2026-11-12', t: '2026-11-10', src: 'yanlis' } }) }
    const remote = { [K]: JSON.stringify({ k: { due: '2026-11-12', t: '2026-11-11', src: 'yanlis', x: true } }) }
    expect(JSON.parse(mergeStorage(local, remote, {})[K])).toEqual({ k: { due: '2026-11-12', t: '2026-11-11', src: 'yanlis', x: true } })
    // Eşitleme regex'i (yds-<ad>:user_) iki anahtarı da kapsar; yerelde yoksa doğrudan alınır
    expect(isSyncedStorageKey(K)).toBe(true)
    expect(isSyncedStorageKey('yds-dus:user_ozgur')).toBe(true)
    expect(isSyncedStorageKey('yds-dus-goal')).toBe(false)
    expect(mergeStorage({}, local, {})).toEqual(local)
  })

  it('mergeStamped: eşit damgada yerel kalır', () => {
    expect(mergeStamped({ x: { t: '1', v: 'l' } }, { x: { t: '1', v: 'r' } })).toEqual({ x: { t: '1', v: 'l' } })
  })

  it('JSON yedekten DUS: yeni t kazanır, tanınmayan/bozuk anahtar atlanır, eski yedek (alan yok) bir şey yazmaz', () => {
    const K = 'yds-dus:user_ozgur'
    const local = { [K]: JSON.stringify({ q1: a('A', '2026-11-10'), q2: a('B', '2026-11-01') }) }
    const incoming = {
      [K]: JSON.stringify({ q1: a('C', '2026-11-05'), q2: a('A', '2026-11-02') }),
      'yds-dus-srs:user_ozgur': 'bozuk{',
      'yds-baska:user_ozgur': '{}',
    }
    const out = mergeDusStorage(local, incoming)
    expect(Object.keys(out)).toEqual([K])
    expect(JSON.parse(out[K])).toEqual({ q1: a('A', '2026-11-10'), q2: a('A', '2026-11-02') })
    expect(mergeDusStorage(local, undefined)).toEqual({})
    // Yerelde hiç yoksa yedek olduğu gibi
    expect(JSON.parse(mergeDusStorage({ [K]: null }, incoming)[K])).toEqual(JSON.parse(incoming[K]))
  })
})
