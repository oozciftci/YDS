import Dexie, { type EntityTable } from 'dexie'
import { useEffect, useState } from 'react'

// Telifli yerel içerik (çıkmış sorular, kitap görüntüleri, kaynak metinleri, yerel kelime paketleri).
// Geliştirmede bilgisayardaki sunucudan (/local-api) gelir; yayın sürümünde (GitHub Pages) ise cihaza bir kez yüklenen
// kaynak paketinden (IndexedDB, ayrı veritabanı). Paket dosyası bilgisayarda üretilir (vite.localBundle.ts) ve
// hiçbir zaman yayına/GitHub'a girmez; yayın derlemesinde yalnızca bu okuyucu kod bulunur.
//
// Paket biçimi (.ydsk): "YDSK1\n", sonra her kayıt için tek satır JSON başlık + ham veri:
//   {"manifest":{"parts":[{id,title}],"createdAt"}}\n
//   {"p":"kitap/essential-grammar-in-use/p001.webp","t":"image/webp","n":12345}\n<12345 bayt>
//   {"end":true,"count":N}\n
// "p" = /local-api/ sonrası yol; yayın sürümünde aynı yol bu depodan yanıtlanır.

interface LocalFile {
  path: string
  blob: Blob
}

class LocalContentDb extends Dexie {
  files!: EntityTable<LocalFile, 'path'>
  constructor() {
    super('YdsLocalContent')
    this.version(1).stores({ files: 'path' })
  }
}

let dbInstance: LocalContentDb | null = null
const store = () => (dbInstance ??= new LocalContentDb())

export interface LocalPart {
  id: string
  title: string
}
export interface LocalSummary {
  parts: LocalPart[]
  files: number
  bytes: number
  at: string
}

const FLAG = 'yds-local-content'

/** Cihaza yüklenmiş kaynak paketlerinin özeti (yayın sürümü); yoksa null. */
export function localSummary(): LocalSummary | null {
  try {
    return JSON.parse(localStorage.getItem(FLAG) || 'null') as LocalSummary | null
  } catch {
    return null
  }
}

/** Telifli yerel bölümler açık mı: geliştirmede her zaman, yayında kaynak paketi yüklendiyse. */
export function hasLocalContent(): boolean {
  return import.meta.env.DEV || !!localSummary()
}

const keyOf = (apiPath: string) => decodeURIComponent(apiPath.replace(/^\/local-api\//, '').replace(/[?#].*$/, ''))

/** `fetch('/local-api/…')` yerine: geliştirmede sunucuya, yayında cihazdaki pakete gider. */
export async function localFetch(apiPath: string, init?: RequestInit): Promise<Response> {
  if (import.meta.env.DEV) return fetch(apiPath, init)
  const key = keyOf(apiPath)
  try {
    if (init?.method === 'PUT') {
      await store().files.put({ path: key, blob: new Blob([String(init.body ?? '')], { type: 'application/json' }) })
      return new Response('{"ok":true}', { headers: { 'Content-Type': 'application/json' } })
    }
    const f = await store().files.get(key)
    if (f) return new Response(f.blob, { headers: { 'Content-Type': f.blob.type || 'application/octet-stream' } })
  } catch {
    // depo açılamadı: bulunamadı say
  }
  return new Response('', { status: 404 })
}

/** Görüntü adresi: geliştirmede doğrudan sunucu yolu, yayında depodaki görüntüden geçici adres. */
export function useLocalUrl(apiPath: string | null): string | undefined {
  const [url, setUrl] = useState<{ path: string; url: string } | undefined>(undefined)
  useEffect(() => {
    if (!apiPath || import.meta.env.DEV) return
    let alive = true
    let made: string | undefined
    void store()
      .files.get(keyOf(apiPath))
      .then((f) => {
        if (!f || !alive) return
        made = URL.createObjectURL(f.blob)
        setUrl({ path: apiPath, url: made })
      })
    return () => {
      alive = false
      if (made) URL.revokeObjectURL(made)
    }
  }, [apiPath])
  if (!apiPath) return undefined
  if (import.meta.env.DEV) return apiPath
  return url?.path === apiPath ? url.url : undefined
}


// Liste yanıtları birden çok paketle gelebilir: kimliğe göre birleştirilir
const LIST_KEYS = new Set(['yds/', 'kitap/', 'paket', 'okuma-kitap/'])

async function mergeList(key: string, blob: Blob): Promise<Blob> {
  const old = await store().files.get(key)
  if (!old) return blob
  try {
    const a = JSON.parse(await old.blob.text()) as { id: string }[]
    const b = JSON.parse(await blob.text()) as { id: string }[]
    const byId = new Map([...a, ...b].map((x) => [x.id, x]))
    return new Blob([JSON.stringify([...byId.values()])], { type: 'application/json' })
  } catch {
    return blob
  }
}

const decoder = new TextDecoder()

async function readHeader(file: Blob, offset: number): Promise<{ header: Record<string, unknown>; next: number }> {
  const buf = new Uint8Array(await file.slice(offset, offset + 64 * 1024).arrayBuffer())
  const nl = buf.indexOf(10)
  if (nl < 0) throw new Error('Paket dosyası bozuk (başlık okunamadı).')
  return { header: JSON.parse(decoder.decode(buf.subarray(0, nl))) as Record<string, unknown>, next: offset + nl + 1 }
}

/** Kaynak paketini (.ydsk) cihaza yükler; aynı yoldaki eski kayıtların yerine geçer. */
export async function importLocalBundle(file: File, onProgress: (ratio: number) => void): Promise<LocalSummary> {
  const magic = decoder.decode(new Uint8Array(await file.slice(0, 6).arrayBuffer()))
  if (magic !== 'YDSK1\n') throw new Error('Bu bir YDS kaynak paketi değil (.ydsk).')
  // Tarayıcı depoyu yer darlığında silmesin
  void navigator.storage?.persist?.().catch(() => false)

  let offset = 6
  let parts: LocalPart[] = []
  let batch: LocalFile[] = []
  let batchBytes = 0
  const flush = async () => {
    if (batch.length) await store().files.bulkPut(batch)
    batch = []
    batchBytes = 0
  }
  for (;;) {
    const { header, next } = await readHeader(file, offset)
    offset = next
    if (header.end) break
    if (header.manifest) {
      parts = ((header.manifest as { parts?: LocalPart[] }).parts ?? []).map(({ id, title }) => ({ id, title }))
      continue
    }
    const path = String(header.p)
    const n = Number(header.n)
    let blob = new Blob([await file.slice(offset, offset + n).arrayBuffer()], { type: String(header.t || '') })
    offset += n
    if (LIST_KEYS.has(path)) {
      await flush()
      blob = await mergeList(path, blob)
    }
    batch.push({ path, blob })
    batchBytes += n
    if (batch.length >= 60 || batchBytes > 8 * 1024 * 1024) {
      await flush()
      onProgress(offset / file.size)
    }
  }
  await flush()
  onProgress(1)

  let files = 0
  let bytes = 0
  await store().files.each((f) => {
    files++
    bytes += f.blob.size
  })
  const prev = localSummary()?.parts ?? []
  const summary: LocalSummary = {
    parts: [...new Map([...prev, ...parts].map((p) => [p.id, p])).values()],
    files,
    bytes,
    at: new Date().toISOString(),
  }
  localStorage.setItem(FLAG, JSON.stringify(summary))
  return summary
}

/** Cihazdaki tüm kaynak paketlerini siler (ilerleme ve kelimeler etkilenmez). */
export async function deleteLocalContent(): Promise<void> {
  store().close()
  await Dexie.delete('YdsLocalContent')
  dbInstance = null
  localStorage.removeItem(FLAG)
}
