import { db } from '../db'
import { getGrammarTopic } from '../data/grammar'
import type { NoteEntry } from '../types/database'
import { ALL_SECTIONS } from './ydsSections'

// Notlarım: sayfaya özel not + genel çalışma defteri (metin, sesli not, ekran görüntüsü). Yalnızca cihazda.

const SEASONS: Record<string, string> = {
  ilkbahar: 'İlkbahar',
  sonbahar: 'Sonbahar',
  yaz: 'Yaz',
  kis: 'Kış',
  mart: 'Mart',
  nisan: 'Nisan',
  kasim: 'Kasım',
  aralik: 'Aralık',
  eylul: 'Eylül',
  temmuz: 'Temmuz',
  subat: 'Şubat',
  haziran: 'Haziran',
  sosyal: 'Sosyal',
  saglik: 'Sağlık',
  fen: 'Fen',
}

/** "yds-2018-aralik" → "2018 Aralık YDS", "yokdil-2019-mart-fen" → "2019 Mart YÖKDİL Fen" */
export function prettyExamId(id: string): string {
  const bank = /^banka-[a-z]+-([a-z]+)-(\d+)$/.exec(id)
  if (bank) return `${bank[1].toLocaleUpperCase('tr-TR')} Test ${Number(bank[2])}`
  const parts = id.split('-')
  const kind = parts[0] === 'yokdil' ? 'YÖKDİL' : parts[0] === 'yds' ? 'YDS' : parts[0].toUpperCase()
  const year = parts[1] ?? ''
  const words = parts.slice(2).map((p) => SEASONS[p] ?? p)
  const field = parts[0] === 'yokdil' && words.length > 1 ? ` ${words.pop()}` : ''
  return `${year} ${words.join(' ')} ${kind}${field}`.replace(/\s+/g, ' ').trim()
}

const STATIC: Record<string, string> = {
  '/': 'Ana Sayfa',
  '/calis': 'Çalış',
  '/study': 'Kelime Çalış',
  '/gece': 'Gece Modu',
  '/kelime-ailesi': 'Kelime Ailesi ve Ekler',
  '/words': 'Kelimeler',
  '/stats': 'İstatistik',
  '/settings': 'Ayarlar',
  '/match': 'Eş Anlamlı Eşleştirme',
  '/quiz': 'Mini Kelime Denemesi',
  '/dilbilgisi': 'Dilbilgisi Rehberi',
  '/yds-test': 'Alıştırma Merkezi',
  '/yds-test/ornek': 'Alıştırma Merkezi · Başlangıç',
  '/yds-test/ceviri': 'Çeviri Atölyesi',
  '/yds-sorular': 'Soru Merkezi',
  '/yds-sorular/yanlislar': 'Yanlış Defteri',
  '/yds-sorular/ozel': 'Özel Deneme',
  '/yds-sorular/analiz': 'Hatalarımı Analiz Et',
  '/yds-sorular/okuma': 'Okuma Modu',
  '/yds-sorular/taktik': 'Taktik Kitabı',
  '/yds-sorular/bankalar': 'Soru Bankaları',
  '/koc': 'YZ Koç',
  '/koc/hafiza': 'Hafızam',
  '/koc/oneriler': 'Öneriler',
}

/** Sayfa yolundan okunur özellik adı (genel defter girdilerinin varsayılan başlığı için). */
export function pageLabel(pageKey: string): string {
  // "#Soru 12": notun bağlı olduğu soru (src/services/noteScope.ts)
  const [pathname, sub] = pageKey.split('#')
  const base = basePageLabel(pathname)
  return sub ? `${base} · ${sub}` : base
}

function basePageLabel(pathname: string): string {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (STATIC[path]) return STATIC[path]
  const seg = path.split('/').filter(Boolean)
  if (seg[0] === 'dilbilgisi' && seg[1]) return `Dilbilgisi · ${getGrammarTopic(seg[1])?.title ?? seg[1]}`
  if (seg[0] === 'yds-test' && seg[1]) {
    const [type, n] = seg[1].split('-')
    const label = ALL_SECTIONS.find((s) => s.key === type)?.label ?? type
    return `Alıştırma · ${label}${n ? ` ${Number(n)}` : ''}`
  }
  if (seg[0] === 'yds-sorular') {
    if (seg[1] === 'sinav' && seg[2]) return `Soru Merkezi · ${prettyExamId(seg[2])}`
    if (seg[1] === 'deneme' && seg[2]) return `Deneme · ${prettyExamId(seg[2])}`
    if (seg[1] === 'konu' && seg[2]) return `Konuya Göre · ${ALL_SECTIONS.find((s) => s.key === seg[2])?.label ?? seg[2]}`
    if (seg[1] === 'okuma') return seg[2] ? `Okuma Modu · ${prettyExamId(seg[2])}` : 'Okuma Modu'
    return 'Soru Merkezi'
  }
  if (seg[0] === 'kitap') {
    if (!seg[1]) return 'Kitaptan Çalış'
    const name = seg[1].split('-').map((w) => (w === 'in' ? w : w[0].toUpperCase() + w.slice(1))).join(' ')
    if (seg[2] === 's' && seg[3]) return `${name} · s. ${seg[3]}`
    return seg[2] === 'notlar' ? `${name} · Defter` : name
  }
  if (seg[0] === 'koc') return 'YZ Koç'
  if (seg[0] === 'dus') {
    if (!seg[1]) return 'DUS'
    if (seg[1] === 'yanlislar') return 'DUS · Yanlışlarım'
    if (seg[1] === 'ders') return `DUS · Ders: ${seg[2] ?? ''}`.trim()
    const m = /^(\d{4})(?:-(ilkbahar|sonbahar))?/.exec(seg[1])
    const exam = m ? `${m[1]}${m[2] ? ` ${SEASONS[m[2]]}` : ''}` : seg[1]
    return `DUS ${exam}${seg[2] ? ` · ${seg[2] === 'tbt' ? 'Temel' : 'Klinik'}` : ''}`
  }
  return seg.join(' / ') || 'Ana Sayfa'
}

/** "20.10.2026 05:12" */
export function stamp(iso: string): string {
  return new Date(iso).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/** Yeni girdi: ses/görsel Blob olarak verilir, bayt dizisine çevrilip saklanır. */
export type NewEntry = Pick<NoteEntry, 'kind'> & Partial<Pick<NoteEntry, 'text' | 'mime' | 'durationSec'>> & { blob?: Blob }

async function stored(entry: NewEntry): Promise<Pick<NoteEntry, 'kind'> & Partial<Pick<NoteEntry, 'text' | 'mime' | 'durationSec' | 'bytes'>>> {
  const { blob, ...rest } = entry
  if (!blob) return rest
  return { ...rest, bytes: await blob.arrayBuffer(), mime: rest.mime || blob.type }
}

/**
 * Girdinin sesi/görseli, türü (mime) belli bir Blob olarak. Her çağrıda yeni Blob üretir: bileşende `useMemo` ile kullan.
 * Eski kayıtlardaki Blob da kayıtlı türle yeniden sarılır (iPhone'da veritabanından dönen Blob türünü yitirebiliyor).
 */
export function entryBlob(e: Pick<NoteEntry, 'bytes' | 'blob' | 'mime'>): Blob | undefined {
  if (e.bytes) return new Blob([e.bytes], { type: e.mime || 'application/octet-stream' })
  if (e.blob) return e.mime && e.blob.type !== e.mime ? new Blob([e.blob], { type: e.mime }) : e.blob
  return undefined
}

export async function addGeneralEntry(userId: string, pageKey: string, entry: NewEntry): Promise<NoteEntry> {
  const now = new Date().toISOString()
  const label = pageLabel(pageKey)
  const row: NoteEntry = {
    id: crypto.randomUUID(),
    userId,
    scope: 'general',
    pageKey,
    pageLabel: label,
    title: `${label} · ${stamp(now)}`,
    createdAt: now,
    updatedAt: now,
    ...(await stored(entry)),
  }
  await db.notebook.add(row)
  return row
}

// ---- Yapışkan notlar: kutu (scope 'sticky') + içindeki mesajlar (scope 'stickyItem') ----

const DEFAULT_PLACE = { w: 150, h: 130 }

/**
 * Yeni yapışkan not satırı kurar (veritabanına YAZMAZ; `createSticky` yazar). Eşzamanlı olması bilerek: "Bu sayfa"ya
 * dokunulduğu anda not açılabilsin (iPhone klavyeyi yalnızca dokunma anındaki odaklanmada açar).
 * `index`: sayfadaki kaçıncı not (üst üste binmesin diye biraz kaydırılır).
 */
export function newSticky(userId: string, pageKey: string, color: string, index: number): NoteEntry {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    userId,
    scope: 'sticky',
    pageKey,
    pageLabel: pageLabel(pageKey),
    kind: 'text',
    sticky: { color, x: Math.min(0.6, 0.12 + index * 0.06), y: Math.min(0.6, 0.18 + index * 0.06), ...DEFAULT_PLACE },
    createdAt: now,
    updatedAt: now,
  }
}

export async function createSticky(row: NoteEntry): Promise<void> {
  await db.notebook.put(row)
}

const itemsOf = (sticky: Pick<NoteEntry, 'id' | 'userId' | 'pageKey'>) =>
  db.notebook
    .where('[userId+pageKey]')
    .equals([sticky.userId, sticky.pageKey])
    .filter((n) => n.scope === 'stickyItem' && n.parentId === sticky.id)

/** Yapışkan nota mesaj (metin / sesli not / görsel) ekler. */
export async function addStickyItem(sticky: NoteEntry, entry: NewEntry): Promise<NoteEntry> {
  const now = new Date().toISOString()
  // Kutu henüz yazılmadıysa (yeni açılmış not) ya da bu arada silindiyse önce o yazılır: mesaj sahipsiz kalmasın
  if (!(await db.notebook.get(sticky.id))) await db.notebook.put(sticky)
  const row: NoteEntry = {
    id: crypto.randomUUID(),
    userId: sticky.userId,
    scope: 'stickyItem',
    parentId: sticky.id,
    pageKey: sticky.pageKey,
    pageLabel: sticky.pageLabel,
    createdAt: now,
    updatedAt: now,
    ...(await stored(entry)),
  }
  await db.notebook.add(row)
  return row
}

/** Yapışkan notu içindeki mesajlarla birlikte siler. */
export async function deleteSticky(sticky: Pick<NoteEntry, 'id' | 'userId' | 'pageKey'>): Promise<void> {
  await db.transaction('rw', db.notebook, async () => {
    await itemsOf(sticky).delete()
    await db.notebook.delete(sticky.id)
  })
}

/** İçine hiçbir şey yazılmamış not sayfada boş kâğıt olarak kalmasın. */
export async function deleteStickyIfEmpty(sticky: Pick<NoteEntry, 'id' | 'userId' | 'pageKey'>): Promise<void> {
  await db.transaction('rw', db.notebook, async () => {
    if ((await itemsOf(sticky).count()) === 0) await db.notebook.delete(sticky.id)
  })
}

export async function updateEntry(id: string, patch: Partial<Pick<NoteEntry, 'text' | 'title' | 'sticky'>>): Promise<void> {
  await db.notebook.update(id, { ...patch, updatedAt: new Date().toISOString() })
}

export async function deleteEntry(id: string): Promise<void> {
  await db.notebook.delete(id)
}

// ---- Eski biçimden yeni biçime ----

/**
 * Satırları yeni biçime getirir (saf: veritabanına dokunmaz). Dönen `puts` yazılır, `deletes` silinir, `boxes` (eski
 * sayfa notundan türeyen kutular) yalnızca veritabanında yoksa eklenir (varsa konumu/rengi ezilmesin).
 * - Blob → bytes (okunabiliyorsa)
 * - scope 'page' (tek metin) → sarı yapışkan not + içinde bir mesaj. Satırın kimliği korunur: karşı cihazdan eski hâli
 *   gelirse daha yeni olan bu satır kazanır, not ikiye katlanmaz.
 * - scope 'sticky' içinde metin/ses (ilk sürüm) → mesaj satırlarına taşınır.
 */
async function upgrade(rows: NoteEntry[]): Promise<{ puts: NoteEntry[]; deletes: string[]; boxes: NoteEntry[] }> {
  const puts: NoteEntry[] = []
  const deletes: string[] = []
  const boxes: NoteEntry[] = []
  const now = new Date().toISOString()
  for (const row of rows) {
    let r = row
    let changed = false
    if (r.blob && !r.bytes) {
      try {
        const bytes = await r.blob.arrayBuffer()
        const { blob, ...rest } = r
        r = { ...rest, bytes, mime: r.mime || blob.type }
        changed = true
      } catch {
        // Okunamıyor (iPhone'da bozulmuş eski kayıt): olduğu gibi kalır
      }
    }
    if (r.scope === 'page') {
      if (!r.text?.trim()) {
        deletes.push(r.id)
        continue
      }
      const boxId = `sticky:${r.id}`
      boxes.push({
        id: boxId,
        userId: r.userId,
        scope: 'sticky',
        pageKey: r.pageKey,
        pageLabel: r.pageLabel,
        kind: 'text',
        sticky: { color: 'sari', x: 0.12, y: 0.18, ...DEFAULT_PLACE },
        createdAt: r.createdAt,
        updatedAt: now,
      })
      puts.push({ ...r, scope: 'stickyItem', parentId: boxId, updatedAt: now })
      continue
    }
    if (r.scope === 'sticky' && (r.text?.trim() || r.bytes || r.blob)) {
      const { text, bytes, blob, mime, durationSec, ...box } = r
      const item = { userId: r.userId, scope: 'stickyItem' as const, parentId: r.id, pageKey: r.pageKey, pageLabel: r.pageLabel, updatedAt: now }
      if (text?.trim()) puts.push({ ...item, id: `${r.id}:t`, kind: 'text', text, createdAt: r.createdAt })
      if (bytes || blob) puts.push({ ...item, id: `${r.id}:a`, kind: 'audio', bytes, blob, mime, durationSec, createdAt: r.updatedAt })
      puts.push({ ...box, kind: 'text', updatedAt: now })
      continue
    }
    if (changed) puts.push(r)
  }
  return { puts, deletes, boxes }
}

async function apply(res: Awaited<ReturnType<typeof upgrade>>): Promise<void> {
  await db.transaction('rw', db.notebook, async () => {
    if (res.deletes.length) await db.notebook.bulkDelete(res.deletes)
    if (res.puts.length) await db.notebook.bulkPut(res.puts)
    if (res.boxes.length) {
      const have = await db.notebook.bulkGet(res.boxes.map((b) => b.id))
      const fresh = res.boxes.filter((_, i) => !have[i])
      if (fresh.length) await db.notebook.bulkAdd(fresh)
    }
  })
}

const MIGRATED_KEY = 'yds-notebook-v2'

/** Açılışta bir kez: eski notları yeni biçime getirir (bkz. `upgrade`). */
export async function migrateNotebook(): Promise<void> {
  try {
    if (localStorage.getItem(MIGRATED_KEY)) return
  } catch {
    // depolama kapalıysa her açılışta dener (zararsız: ikinci kez yapılacak iş kalmaz)
  }
  await apply(await upgrade(await db.notebook.toArray()))
  try {
    localStorage.setItem(MIGRATED_KEY, '1')
  } catch {
    // yoksay
  }
}

// ---- Yedek: ses/görsel JSON'a data URL olarak yazılır ----

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

export async function exportNotebook(): Promise<unknown[]> {
  const rows = await db.notebook.toArray()
  return Promise.all(
    rows.map(async ({ blob, bytes, ...rest }) => {
      const b = entryBlob({ blob, bytes, mime: rest.mime })
      if (!b) return rest
      try {
        return { ...rest, blobData: await blobToDataUrl(b) }
      } catch {
        // Okunamayan eski kayıt yedeği durdurmasın
        return rest
      }
    }),
  )
}

/** Yedekten / karşı cihazdan gelen satırlar: eski biçimdekiler de yeni biçime getirilerek yazılır. */
export async function importNotebook(rows: unknown[]): Promise<number> {
  const out: NoteEntry[] = []
  for (const r of rows as (NoteEntry & { blobData?: string })[]) {
    if (!r?.id || !r.userId) continue
    const { blobData, ...rest } = r
    if (blobData) {
      const res = await fetch(blobData)
      const blob = await res.blob()
      out.push({ ...rest, bytes: await blob.arrayBuffer(), mime: rest.mime || blob.type })
    } else out.push(rest)
  }
  if (!out.length) return 0
  const res = await upgrade(out)
  const touched = new Set([...res.puts.map((p) => p.id), ...res.deletes])
  // upgrade yalnızca değişenleri döndürür; değişmeyenler olduğu gibi yazılır
  res.puts.push(...out.filter((r) => !touched.has(r.id)))
  await apply(res)
  return out.length
}
