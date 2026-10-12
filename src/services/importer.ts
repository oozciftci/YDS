import type { PartOfSpeech } from '../types/database'
import type { CreateWordInput } from './words'

/**
 * Kelime türünü güvenli bir şekilde PartOfSpeech tipine normalize eder.
 */
export function normalizePartOfSpeech(raw?: string): PartOfSpeech {
  if (!raw) return 'noun'
  const lower = raw.trim().toLowerCase()

  if (lower.startsWith('v') || lower === 'fiil') return 'verb'
  if (lower.startsWith('n') || lower === 'isim') return 'noun'
  if (lower.startsWith('adj') || lower === 'sıfat' || lower === 'sifat') return 'adjective'
  if (lower.startsWith('adv') || lower === 'zarf') return 'adverb'
  if (lower.includes('phrasal') || lower.includes('deyimsel')) return 'phrasal_verb'
  if (lower.includes('conj') || lower.includes('bağlaç') || lower.includes('baglac')) return 'conjunction'
  if (lower.includes('prep') || lower.includes('edat')) return 'preposition'
  if (lower.includes('idiom') || lower.includes('deyim')) return 'idiom'

  return 'other'
}

/**
 * Yapıştırılan metni (düz metin, pipe formatı, tire formatı veya JSON) ayrıştırır.
 */
export function parsePastedText(text: string): CreateWordInput[] {
  const trimmed = text.trim()
  if (!trimmed) return []

  // 1. JSON dizisi kontrolü
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed) as Array<Record<string, unknown>>
      if (Array.isArray(parsed)) {
        return parsed
          .filter((item) => item && typeof item === 'object' && item.term && item.definition)
          .map((item) => ({
            term: String(item.term),
            definition: String(item.definition),
            partOfSpeech: normalizePartOfSpeech(item.partOfSpeech as string),
            synonyms: Array.isArray(item.synonyms) ? item.synonyms.map(String) : [],
            antonyms: Array.isArray(item.antonyms) ? item.antonyms.map(String) : [],
            collocations: Array.isArray(item.collocations) ? item.collocations.map(String) : [],
            sentences: Array.isArray(item.sentences)
              ? (item.sentences as Array<{ en: string; tr?: string }>)
              : [],
            tags: Array.isArray(item.tags) ? item.tags.map(String) : [],
            difficulty: typeof item.difficulty === 'number' ? item.difficulty : 2,
            notes: item.notes ? String(item.notes) : undefined,
          }))
      }
    } catch {
      // JSON değilse satır satır ayrıştırmaya devam et
    }
  }

  // 2. Satır satır ayrıştırma
  const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const results: CreateWordInput[] = []

  for (const line of lines) {
    // Pipe formatı: term = definition | synonyms | pos | tags
    if (line.includes('|')) {
      const parts = line.split('|').map((p) => p.trim())
      const firstPart = parts[0] || ''
      const [term, def] = firstPart.includes('=')
        ? firstPart.split('=').map((s) => s.trim())
        : firstPart.includes('-')
          ? firstPart.split('-').map((s) => s.trim())
          : [firstPart, '']

      if (term && def) {
        const synonyms = parts[1] ? parts[1].split(/[,;]/).map((s) => s.trim()).filter(Boolean) : []
        const pos = normalizePartOfSpeech(parts[2])
        const tags = parts[3] ? parts[3].split(/[,;]/).map((s) => s.trim()).filter(Boolean) : []

        results.push({
          term,
          definition: def,
          partOfSpeech: pos,
          synonyms,
          tags,
          difficulty: 2,
        })
        continue
      }
    }

    // Eşittir formatı: term = definition
    if (line.includes('=')) {
      const [term, defWithExtra] = line.split('=').map((s) => s.trim())
      if (term && defWithExtra) {
        // örn: "kötüleşmek (syn: worsen, decline)"
        const matchSyn = defWithExtra.match(/\((?:syn|eş|eş anlamlılar)?:?\s*([^)]+)\)/i)
        const synonyms = matchSyn ? matchSyn[1].split(/[,;]/).map((s) => s.trim()) : []
        const cleanDef = defWithExtra.replace(/\([^)]+\)/g, '').trim()

        results.push({
          term,
          definition: cleanDef || defWithExtra,
          partOfSpeech: 'noun',
          synonyms,
          difficulty: 2,
        })
        continue
      }
    }

    // Tire veya Tab formatı: term - definition veya term \t definition
    const sep = line.includes('\t') ? '\t' : line.includes(' - ') ? ' - ' : line.includes(',') ? ',' : null
    if (sep) {
      const parts = line.split(sep).map((s) => s.trim())
      if (parts.length >= 2 && parts[0] && parts[1]) {
        results.push({
          term: parts[0],
          definition: parts[1],
          partOfSpeech: normalizePartOfSpeech(parts[2]),
          synonyms: parts[3] ? parts[3].split(/[,;]/).map((s) => s.trim()).filter(Boolean) : [],
          difficulty: 2,
        })
      }
    }
  }

  return results
}

/**
 * CSV / Excel dosya içeriğini ayrıştırır.
 */
export function parseCsvText(csvContent: string): CreateWordInput[] {
  const lines = csvContent.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (lines.length === 0) return []

  // Ayırıcıyı belirle (virgül, noktalı virgül veya tab)
  const firstLine = lines[0]
  const delimiter = firstLine.includes(';') ? ';' : firstLine.includes('\t') ? '\t' : ','

  const headers = splitCsvLine(firstLine, delimiter).map((h) => h.toLowerCase().trim())

  const colIdx = {
    term: headers.findIndex((h) => ['term', 'kelime', 'word', 'english'].includes(h)),
    def: headers.findIndex((h) => ['definition', 'anlam', 'turkce', 'turkish', 'meaning'].includes(h)),
    pos: headers.findIndex((h) => ['partofspeech', 'pos', 'tur', 'tür'].includes(h)),
    syn: headers.findIndex((h) => ['synonyms', 'esanlam', 'eşanlam', 'es_anlam', 'synonym'].includes(h)),
    colloc: headers.findIndex((h) => ['collocations', 'kalip', 'kalıplar', 'collocation'].includes(h)),
    sentence: headers.findIndex((h) => ['sentence', 'cumle', 'cümle', 'example'].includes(h)),
    tags: headers.findIndex((h) => ['tags', 'etiket', 'etiketler', 'category'].includes(h)),
    diff: headers.findIndex((h) => ['difficulty', 'zorluk', 'seviye'].includes(h)),
  }

  // Başlık satırı eşleştiyse 1. satırdan başla, eşleşmediyse 0. satırdan başla
  const hasHeader = colIdx.term !== -1 || colIdx.def !== -1
  const startIndex = hasHeader ? 1 : 0

  const results: CreateWordInput[] = []

  for (let i = startIndex; i < lines.length; i++) {
    const row = splitCsvLine(lines[i], delimiter)
    if (row.length === 0) continue

    const term = row[colIdx.term !== -1 ? colIdx.term : 0]
    const def = row[colIdx.def !== -1 ? colIdx.def : 1]

    if (!term || !def) continue

    const posRaw = colIdx.pos !== -1 ? row[colIdx.pos] : row[2]
    const synRaw = colIdx.syn !== -1 ? row[colIdx.syn] : row[3]
    const collocRaw = colIdx.colloc !== -1 ? row[colIdx.colloc] : undefined
    const sentenceRaw = colIdx.sentence !== -1 ? row[colIdx.sentence] : undefined
    const tagsRaw = colIdx.tags !== -1 ? row[colIdx.tags] : undefined
    const diffRaw = colIdx.diff !== -1 ? Number(row[colIdx.diff]) : 2

    results.push({
      term: term.trim(),
      definition: def.trim(),
      partOfSpeech: normalizePartOfSpeech(posRaw),
      synonyms: synRaw ? synRaw.split(/[,;|]/).map((s) => s.trim()).filter(Boolean) : [],
      collocations: collocRaw ? collocRaw.split(/[,;|]/).map((s) => s.trim()).filter(Boolean) : [],
      sentences: sentenceRaw ? [{ en: sentenceRaw.trim() }] : [],
      tags: tagsRaw ? tagsRaw.split(/[,;|]/).map((s) => s.trim()).filter(Boolean) : [],
      difficulty: isNaN(diffRaw) ? 2 : Math.min(3, Math.max(1, diffRaw)),
    })
  }

  return results
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === delimiter && !inQuotes) {
      result.push(current.replace(/^"|"$/g, '').trim())
      current = ''
    } else {
      current += char
    }
  }
  result.push(current.replace(/^"|"$/g, '').trim())
  return result
}

/**
 * Kullanıcının ChatGPT veya Claude'a yapıştırıp mükemmel YDS listesi alabilmesi için
 * hazır istem (prompt) şablonu.
 */
export const AI_PROMPT_TEMPLATE = `Sen bir YDS İngilizce kelime uzmanısın. Sana vereceğim kelimeleri YDS Kelime uygulamama doğrudan tek tıkla yükleyebilmem için aşağıdaki JSON formatında oluştur.

JSON Formatı Örneği:
[
  {
    "term": "deteriorate",
    "definition": "kötüleşmek, bozulmak",
    "partOfSpeech": "verb",
    "synonyms": ["worsen", "decline", "degenerate"],
    "antonyms": ["improve", "recover"],
    "collocations": ["deteriorate rapidly", "health deteriorates"],
    "sentences": [
      { "en": "The patient's condition deteriorated overnight.", "tr": "Hastanın durumu bir gecede kötüleşti." }
    ],
    "tags": ["Sağlık", "YDS"],
    "difficulty": 2
  }
]

Kurallar:
1. "partOfSpeech" değeri şunlardan biri olmalıdır: "verb", "noun", "adjective", "adverb", "phrasal_verb", "conjunction", "preposition", "idiom".
2. YDS için eş anlamlılar (synonyms) ve birlikte kullanılan kalıplar (collocations) en kritik alanlardır, zengin tut.
3. Yalnızca geçerli JSON dizisini ver, fazladan markdown yorumu ekleme.

Kelime Listem:
[BURAYA KELİMELERİNİ VEYA METNİNİ YAPIŞTIR]`;
