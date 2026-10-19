import { db } from '../db'
import { logger } from './logger'
import { queueBulkChanges } from './sync'
import type { WordItem } from '../types/database'

const FLAG = 'yds-levels-v4'
const CEFR = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
// Havuz kelimelerinde otomatik üretilen etiketler; bunlar yeniden yazılır, kullanıcı etiketleri korunur
const MANAGED_TAGS = new Set([
  ...CEFR, 'Başlangıç', 'Temel-İngilizce', 'Orta', 'Genel-İngilizce', 'İleri', 'YDS-Akademik',
  'Seviye-Tahmini', 'YDS-Çok-Sık', 'YDS-Sık', 'YDS-Ara', 'YÖKDİL-Çok-Sık', 'YÖKDİL-Sık', 'YÖKDİL-Ara',
])

interface PoolWord {
  term: string
  tags: string[]
  difficulty: number
}

/**
 * Daha önce içe aktarılmış havuz kelimelerinin seviye/sıklık etiketlerini düzeltilmiş
 * veriyle günceller (içe aktarma mükerrer kelimeleri atladığı için yeniden yükleme yetmez).
 * Yalnızca CEFR etiketi taşıyan, yani havuzdan gelmiş kelimelere dokunur. Bir kez çalışır.
 */
export async function migrateWordLevels(): Promise<void> {
  try {
    if (localStorage.getItem(FLAG)) return
  } catch {
    // depolama kapalı: her açılışta denemek zararsız
  }

  const res = await fetch(`${import.meta.env.BASE_URL}data/oxford3000_tr.json`)
  if (!res.ok) throw new Error('Havuz verisi okunamadı: ' + res.status)
  const pool = new Map<string, PoolWord>()
  for (const w of (await res.json()) as PoolWord[]) pool.set(w.term.toLowerCase().trim(), w)

  const now = new Date().toISOString()
  const updated: WordItem[] = []
  await db.words.each((w) => {
    const fresh = pool.get(w.term.toLowerCase().trim())
    if (!fresh || !(w.tags || []).some((t) => CEFR.includes(t))) return
    const oldTags = w.tags || []
    const kept = oldTags.filter((t) => !MANAGED_TAGS.has(t))
    const tags = [...fresh.tags.filter((t) => MANAGED_TAGS.has(t)), ...kept]
    const same =
      tags.length === oldTags.length && tags.every((t, i) => t === oldTags[i]) && w.difficulty === fresh.difficulty
    if (!same) updated.push({ ...w, tags, difficulty: fresh.difficulty, updatedAt: now })
  })

  if (updated.length > 0) {
    await db.words.bulkPut(updated)
    await queueBulkChanges(
      updated.map((w) => ({
        table: 'words' as const,
        action: 'update' as const,
        recordId: w.id,
        payload: w as unknown as Record<string, unknown>,
        userId: w.userId,
      })),
    )
  }
  logger.info('study', `Kelime seviyeleri düzeltildi: ${updated.length} kelime güncellendi`)
  try {
    localStorage.setItem(FLAG, '1')
  } catch {
    // yoksay
  }
}
