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
  '/koc': 'YZ Koç',
  '/koc/hafiza': 'Hafızam',
  '/koc/oneriler': 'Öneriler',
}

/** Sayfa yolundan okunur özellik adı (genel defter girdilerinin varsayılan başlığı için). */
export function pageLabel(pathname: string): string {
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
  if (seg[0] === 'koc') return 'YZ Koç'
  return seg.join(' / ') || 'Ana Sayfa'
}

/** "20.10.2026 05:12" */
export function stamp(iso: string): string {
  return new Date(iso).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export const pageNoteId = (userId: string, pageKey: string) => `page:${userId}:${pageKey}`

export async function savePageNote(userId: string, pageKey: string, text: string): Promise<void> {
  const id = pageNoteId(userId, pageKey)
  const now = new Date().toISOString()
  if (!text.trim()) {
    await db.notebook.delete(id)
    return
  }
  const prev = await db.notebook.get(id)
  await db.notebook.put({
    id,
    userId,
    scope: 'page',
    pageKey,
    pageLabel: pageLabel(pageKey),
    kind: 'text',
    text,
    createdAt: prev?.createdAt ?? now,
    updatedAt: now,
  })
}

export async function addGeneralEntry(
  userId: string,
  pageKey: string,
  entry: Pick<NoteEntry, 'kind'> & Partial<Pick<NoteEntry, 'text' | 'blob' | 'mime' | 'durationSec'>>,
): Promise<NoteEntry> {
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
    ...entry,
  }
  await db.notebook.add(row)
  return row
}

export async function updateEntry(id: string, patch: Partial<Pick<NoteEntry, 'text' | 'title'>>): Promise<void> {
  await db.notebook.update(id, { ...patch, updatedAt: new Date().toISOString() })
}

export async function deleteEntry(id: string): Promise<void> {
  await db.notebook.delete(id)
}

// ---- Yedek: Blob'lar JSON'a data URL olarak yazılır ----

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
  return Promise.all(rows.map(async ({ blob, ...rest }) => (blob ? { ...rest, blobData: await blobToDataUrl(blob) } : rest)))
}

export async function importNotebook(rows: unknown[]): Promise<number> {
  const out: NoteEntry[] = []
  for (const r of rows as (NoteEntry & { blobData?: string })[]) {
    if (!r?.id || !r.userId) continue
    const { blobData, ...rest } = r
    if (blobData) {
      const res = await fetch(blobData)
      out.push({ ...rest, blob: await res.blob() })
    } else out.push(rest)
  }
  if (out.length) await db.notebook.bulkPut(out)
  return out.length
}
