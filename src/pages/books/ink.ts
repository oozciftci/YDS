import { db } from '../../db'
import type { InkStroke } from '../../types/database'

// Kitap sayfasına kalemle çizim: kalem tercihi (renk, tür) ve sayfa başına çizgiler (db.bookInk, eşitlemeye girer).

export type PenKind = 'pen' | 'marker'
export interface Pen {
  on: boolean
  color: string
  kind: PenKind
}
export const PEN_COLORS = [
  { c: '#e11d48', name: 'Kırmızı' },
  { c: '#2563eb', name: 'Mavi' },
  { c: '#16a34a', name: 'Yeşil' },
  { c: '#facc15', name: 'Sarı' },
  { c: '#f97316', name: 'Turuncu' },
  { c: '#9333ea', name: 'Mor' },
  { c: '#111827', name: 'Siyah' },
]
const PEN_KEY = 'yds-book-pen'

export function readPen(): Pen {
  try {
    const p = JSON.parse(localStorage.getItem(PEN_KEY) || '{}') as Partial<Pen>
    return { on: false, color: p.color || PEN_COLORS[0].c, kind: p.kind === 'marker' ? 'marker' : 'pen' }
  } catch {
    return { on: false, color: PEN_COLORS[0].c, kind: 'pen' }
  }
}

export function savePen(p: Pen) {
  try {
    localStorage.setItem(PEN_KEY, JSON.stringify({ color: p.color, kind: p.kind }))
  } catch {
    // yoksay
  }
}

export const inkId = (userId: string, bookId: string, page: number) => `${userId}|${bookId}|${page}`

export async function addStroke(userId: string, bookId: string, page: number, stroke: InkStroke) {
  const id = inkId(userId, bookId, page)
  const old = await db.bookInk.get(id)
  await db.bookInk.put({ id, userId, bookId, page, strokes: [...(old?.strokes ?? []), stroke], updatedAt: new Date().toISOString() })
}

export async function undoStroke(userId: string, bookId: string, page: number) {
  const id = inkId(userId, bookId, page)
  const old = await db.bookInk.get(id)
  if (!old?.strokes.length) return
  await db.bookInk.put({ ...old, strokes: old.strokes.slice(0, -1), updatedAt: new Date().toISOString() })
}

export async function clearPage(userId: string, bookId: string, page: number) {
  const id = inkId(userId, bookId, page)
  const old = await db.bookInk.get(id)
  if (old) await db.bookInk.put({ ...old, strokes: [], updatedAt: new Date().toISOString() })
}
