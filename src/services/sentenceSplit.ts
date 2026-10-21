// İngilizce paragrafı cümlelere böler (okuma kitaplarını hazırlarken: scripts/okuma/kitap_yap.mjs). Kısaltmalar (Mr., Dr.,
// St., e.g.), baş harfler (H. G. Wells) ve tırnak içindeki konuşmalar cümleyi yanlış yerden bölmez. Yalnızca silinebilir TS
// sözdizimi: Node betiği bu dosyayı doğrudan içe aktarır.

const ABBR = /(?:\b(?:Mr|Mrs|Ms|Dr|St|Mt|No|Jr|Sr|Prof|Capt|Col|Gen|Lt|Sgt|Rev|vs|etc|Co|Inc|Ltd|ca|cf|approx)|\b[A-Z]|\be\.g|\bi\.e)\.$/

export function splitSentences(paragraph: string): string[] {
  const text = paragraph.replace(/\s+/g, ' ').trim()
  if (!text) return []
  const out: string[] = []
  // Aday sınırlar: . ! ? (ardından kapanan tırnak/ayraç olabilir), sonra boşluk ve büyük harf / açılan tırnak
  const re = /([.!?]+["”’)\]]*)\s+(?=["“‘([]?[A-Z0-9])/g
  let start = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    const end = m.index + m[1].length
    const piece = text.slice(start, end)
    if (ABBR.test(piece)) continue
    out.push(piece.trim())
    start = end + 1
  }
  const rest = text.slice(start).trim()
  if (rest) out.push(rest)
  return out
}

/** Bir paragrafta art arda gelen konuşmaları (”  “) ayrı paragraflara ayırır; düz tırnaklı metinlerde " " sınırı. */
export function splitDialogue(paragraph: string): string[] {
  return paragraph
    .split(/(?<=[.?!,—-]["”])\s+(?=["“])/)
    .map((p) => p.trim())
    .filter(Boolean)
}
