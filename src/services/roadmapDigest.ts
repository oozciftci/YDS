import roadmapMd from '../../YOL_HARITASI.md?raw'

// Geliştirici danışmanı için YOL_HARITASI.md'nin kısa özeti. Dosyanın tamamı (~20 KB) her istekte gönderilirse
// pahalı olur; yalnızca güncel durum, sıradakiler, ilkeler, envanter ve faz tablolarının iş + durum sütunları alınır.

const KEEP = ['## Şu an', '## Sıradakiler', '## Tasarım ilkeleri', '## Mevcut durum envanteri']

export function roadmapDigest(md: string = roadmapMd): string {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const out: string[] = []
  let mode: 'keep' | 'phase' | 'skip' = 'skip'
  for (const line of lines) {
    if (line.startsWith('## ')) {
      mode = KEEP.some((k) => line.startsWith(k)) ? 'keep' : line.startsWith('## Faz ') ? 'phase' : 'skip'
      if (mode !== 'skip') out.push('', line)
      continue
    }
    if (mode === 'keep') {
      if (line.trim() && !line.startsWith('---')) out.push(line)
    } else if (mode === 'phase') {
      // Tablo satırı: | # | İş | Durum | Açıklama | → "1.1 İş [durum]"
      const cells = line.split('|').map((c) => c.trim())
      if (cells.length >= 5 && /^\d/.test(cells[1])) out.push(`- ${cells[1]} ${cells[2]} [${cells[3]}]`)
    }
  }
  return out.join('\n').trim()
}
