import { db } from '../db'
import { logger } from './logger'
import { exportNotebook, importNotebook } from './notebook'

// Bilgisayar ↔ telefon eşitleme (yalnızca geliştirme sunucusu; `npm run telefon`).
// Ortak kopya bilgisayarda durur (/local-api/esitle). "Eşitle" deyince cihaz ortak kopyayı alır, kendi verisiyle
// kayıt kayıt birleştirir (yeni olan kazanır), sonucu geri gönderir. Böylece iki cihaz sırayla eşitleyince ikisi de aynı olur.
// Aynı kelime iki cihazda farklı kimlikle eklenmişse (kelime kimlikleri rastgele) ortak kopyadaki kimlik esas alınır;
// yerel kart durumu, tekrar kayıtları ve gruplar o kimliğe taşınır.
// Bilinen sınır: kalıcı silmeler (ör. silinen defter notu) karşı cihazdan geri gelir; kelime silme (isDeleted) eşitlenir.

export const SYNC_TABLES = [
  'users',
  'words',
  'cardStates',
  'reviewLogs',
  'wordGroups',
  'sessionLogs',
  'levelProgress',
  'examAnswers',
  'mockResults',
  'memoryNotes',
  'coachChats',
  'suggestions',
  'aiNotes',
  'notebook',
  'bookInk',
] as const
export type SyncTable = (typeof SYNC_TABLES)[number]
export type Row = { id: string } & Record<string, unknown>
export type Tables = Partial<Record<SyncTable, Row[]>>

const str = (v: unknown) => (typeof v === 'string' ? v : '')

/** Hangi kayıt daha yeni: büyük olan kazanır; eşitse yerel kalır. Boş = karşı taraf yalnızca eksik kaydı ekler. */
const STAMP: Record<SyncTable, (r: Row) => string> = {
  users: () => '',
  words: (r) => str(r.updatedAt),
  cardStates: (r) => str(r.updatedAt),
  reviewLogs: () => '',
  wordGroups: (r) => str(r.updatedAt),
  sessionLogs: (r) => str(r.completedAt) || str(r.startedAt),
  levelProgress: (r) => str(r.lastStudiedAt),
  examAnswers: (r) => str(r.answeredAt),
  mockResults: (r) => str(r.finishedAt),
  memoryNotes: (r) => str(r.updatedAt),
  coachChats: (r) => str(r.updatedAt),
  suggestions: (r) => str(r.updatedAt),
  // YZ sohbeti uzadıkça kayıt büyür; önce mesaj sayısı
  aiNotes: (r) => `${String(Array.isArray(r.messages) ? r.messages.length : 0).padStart(5, '0')}|${str(r.createdAt)}`,
  notebook: (r) => str(r.updatedAt),
  bookInk: (r) => str(r.updatedAt),
}

const wordKey = (r: Row) => `${str(r.userId)}|${str(r.term).trim().toLowerCase()}`

/**
 * Yerel ve ortak kopyayı birleştirir (saf işlev). Dönen `puts` yerel veritabanına yazılır, `deletes` silinir;
 * `received` ortak kopyadan gelen (yeni ya da daha yeni) kayıt sayısıdır.
 */
export function mergeSnapshots(local: Tables, remote: Tables) {
  const puts = new Map<SyncTable, Map<string, Row>>(SYNC_TABLES.map((t) => [t, new Map()]))
  const deletes = new Map<SyncTable, Set<string>>(SYNC_TABLES.map((t) => [t, new Set()]))
  const eff = new Map<SyncTable, Map<string, Row>>(SYNC_TABLES.map((t) => [t, new Map((local[t] ?? []).map((r) => [r.id, r]))]))
  const changeLocal = (t: SyncTable, oldId: string, row: Row) => {
    const m = eff.get(t)!
    if (oldId !== row.id) {
      m.delete(oldId)
      deletes.get(t)!.add(oldId)
      const other = m.get(row.id)
      if (other && STAMP[t](other) >= STAMP[t](row)) return
    }
    m.set(row.id, row)
    puts.get(t)!.set(row.id, row)
  }

  // 1) Aynı kelime, farklı kimlik: yerel kimliği ortak kopyadakine taşı
  const remoteWordIds = new Set((remote.words ?? []).map((r) => r.id))
  const localByKey = new Map<string, Row>()
  for (const w of local.words ?? []) if (!remoteWordIds.has(w.id)) localByKey.set(wordKey(w), w)
  const remap = new Map<string, string>()
  for (const r of remote.words ?? []) {
    const l = localByKey.get(wordKey(r))
    if (l && l.id !== r.id && !remap.has(l.id)) remap.set(l.id, r.id)
  }
  if (remap.size) {
    for (const [oldId, newId] of remap) {
      const w = eff.get('words')!.get(oldId)
      if (w) changeLocal('words', oldId, { ...w, id: newId })
    }
    for (const c of [...eff.get('cardStates')!.values()]) {
      const to = remap.get(str(c.wordId))
      if (to) changeLocal('cardStates', c.id, { ...c, wordId: to, id: `${to}_${str(c.userId)}` })
    }
    for (const l of [...eff.get('reviewLogs')!.values()]) {
      const to = remap.get(str(l.wordId))
      if (to) changeLocal('reviewLogs', l.id, { ...l, wordId: to })
    }
    for (const t of ['sessionLogs', 'wordGroups'] as const) {
      for (const r of [...eff.get(t)!.values()]) {
        const ids = r.wordIds
        if (Array.isArray(ids) && ids.some((x) => remap.has(x as string))) {
          changeLocal(t, r.id, { ...r, wordIds: [...new Set(ids.map((x) => remap.get(x as string) ?? x))] })
        }
      }
    }
  }

  // 2) Kayıt kayıt: yerelde olmayan ya da daha yeni olan ortak kayıt kazanır
  let received = 0
  for (const t of SYNC_TABLES) {
    const m = eff.get(t)!
    for (const r of remote[t] ?? []) {
      const l = m.get(r.id)
      if (!l || STAMP[t](r) > STAMP[t](l)) {
        puts.get(t)!.set(r.id, r)
        deletes.get(t)!.delete(r.id)
        received++
      }
    }
  }

  return {
    puts: Object.fromEntries(SYNC_TABLES.map((t) => [t, [...puts.get(t)!.values()]])) as Record<SyncTable, Row[]>,
    deletes: Object.fromEntries(SYNC_TABLES.map((t) => [t, [...deletes.get(t)!]])) as Record<SyncTable, string[]>,
    received,
    remapped: remap.size,
  }
}

// Tarayıcı deposundaki kişiye özel ilerleme (kitapta kaldığın yer, biten üniteler, dilbilgisi puanları, kaydedilenler …)
const STORAGE_KEY = /^yds-[a-z-]+:user_/
const STORAGE_SKIP = /^yds-mock:/ // yarıdaki süreli deneme cihazda kalır
const BASE_KEY = 'yds-sync-base'
const LAST_KEY = 'yds-sync-last'

/** Üç yollu birleştirme: son eşitlemeden beri yalnızca bir taraf değiştiyse o kazanır; ikisi de değiştiyse nesneler/diziler birleşir, yoksa yerel kalır. */
export function mergeStorage(local: Record<string, string>, remote: Record<string, string>, base: Record<string, string>) {
  const set: Record<string, string> = {}
  for (const [k, rv] of Object.entries(remote)) {
    const lv = local[k]
    if (lv === undefined || (lv === base[k] && rv !== lv)) {
      set[k] = rv
      continue
    }
    if (lv === rv || rv === base[k]) continue
    try {
      const l = JSON.parse(lv) as unknown
      const r = JSON.parse(rv) as unknown
      if (Array.isArray(l) && Array.isArray(r)) {
        const seen = new Set<string>()
        set[k] = JSON.stringify([...r, ...l].filter((x) => !seen.has(JSON.stringify(x)) && !!seen.add(JSON.stringify(x))))
      } else if (l && r && typeof l === 'object' && typeof r === 'object' && !Array.isArray(l) && !Array.isArray(r)) {
        set[k] = JSON.stringify({ ...r, ...l })
      }
    } catch {
      // düz metin: yerel kalır
    }
  }
  return set
}

function readStorage() {
  const out: Record<string, string> = {}
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && STORAGE_KEY.test(k) && !STORAGE_SKIP.test(k)) out[k] = localStorage.getItem(k) ?? ''
  }
  return out
}

interface Snapshot {
  tables: Tables
  storage: Record<string, string>
}

async function readLocal(): Promise<Snapshot> {
  const tables: Tables = {}
  for (const t of SYNC_TABLES) {
    if (t === 'notebook') tables.notebook = (await exportNotebook()) as Row[]
    else tables[t] = (await db.table(t).toArray()) as Row[]
  }
  return { tables, storage: readStorage() }
}

export function lastDeviceSync(): string | null {
  try {
    return localStorage.getItem(LAST_KEY)
  } catch {
    return null
  }
}

export interface DeviceSyncResult {
  received: number
  storageReceived: number
  remapped: number
  sentRecords: number
}

/** Gelen kopyayı yerel veriyle birleştirir (veritabanı + tarayıcı deposu). */
async function applyRemote(local: Snapshot, remote: Snapshot, base: Record<string, string>) {
  const merged = mergeSnapshots(local.tables, remote.tables ?? {})
  const tables = SYNC_TABLES.filter((t) => t !== 'notebook').map((t) => db.table(t))
  await db.transaction('rw', tables, async () => {
    for (const t of SYNC_TABLES) {
      if (t === 'notebook') continue
      if (merged.deletes[t].length) await db.table(t).bulkDelete(merged.deletes[t])
      if (merged.puts[t].length) await db.table(t).bulkPut(merged.puts[t])
    }
  })
  // Defter görselleri/sesleri data URL'den Blob'a (işlem dışında)
  if (merged.deletes.notebook.length) await db.notebook.bulkDelete(merged.deletes.notebook)
  if (merged.puts.notebook.length) await importNotebook(merged.puts.notebook)

  const storageSet = mergeStorage(local.storage, remote.storage ?? {}, base)
  for (const [k, v] of Object.entries(storageSet)) localStorage.setItem(k, v)
  return { received: merged.received, storageReceived: Object.keys(storageSet).length, remapped: merged.remapped }
}

/** Ortak kopyayla eşitler; araya başka cihaz girerse (409) baştan dener. */
export async function syncDevices(): Promise<DeviceSyncResult> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const got = (await (await fetch('/local-api/esitle', { cache: 'no-store' })).json()) as { rev: number; data?: Snapshot }
    let base: Record<string, string> = {}
    try {
      base = JSON.parse(localStorage.getItem(BASE_KEY) || '{}') as Record<string, string>
    } catch {
      // ilk eşitleme
    }
    const applied = await applyRemote(await readLocal(), got.data ?? { tables: {}, storage: {} }, base)

    const out = await readLocal()
    const res = await fetch('/local-api/esitle', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ baseRev: got.rev, data: out }),
    })
    if (res.status === 409) continue
    if (!res.ok) throw new Error(`Bilgisayara gönderilemedi (${res.status})`)
    const now = new Date().toISOString()
    localStorage.setItem(BASE_KEY, JSON.stringify(out.storage))
    localStorage.setItem(LAST_KEY, now)
    const result = { ...applied, sentRecords: SYNC_TABLES.reduce((n, t) => n + (out.tables[t]?.length ?? 0), 0) }
    logger.interaction('storage', 'Cihazlar arası eşitleme yapıldı.', { ...result })
    return result
  }
  throw new Error('Başka bir cihaz aynı anda eşitliyor; biraz sonra tekrar dene.')
}

// ---- İlerleme dosyası: sunucu olmadan (ör. yayın sürümü ↔ bilgisayar ya da iki tarayıcı arasında) taşıma ----

const FILE_KIND = 'yds-ilerleme'

/** Tüm ilerlemeyi tek dosya olarak indirir (öbür cihazda "Dosyadan birleştir" ile açılır). */
export async function downloadProgressFile(): Promise<void> {
  const data = await readLocal()
  const blob = new Blob([JSON.stringify({ kind: FILE_KIND, v: 1, exportedAt: new Date().toISOString(), data })], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `yds-ilerleme-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** İlerleme dosyasını bu cihazdaki veriyle birleştirir (yeni olan kazanır; hiçbir şey silinmez). */
export async function mergeProgressFile(file: File) {
  const parsed = JSON.parse(await file.text()) as { kind?: string; data?: Snapshot }
  if (parsed.kind !== FILE_KIND || !parsed.data) throw new Error('Bu bir ilerleme dosyası değil.')
  const result = await applyRemote(await readLocal(), parsed.data, {})
  logger.interaction('storage', 'İlerleme dosyası birleştirildi.', { ...result })
  return result
}
