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
              ? (item.sentences as Array<{ en: string; tr?: string; wordGlosses?: Record<string, string> }>).map((s) => ({
                  en: String(s?.en || ''),
                  tr: s?.tr ? String(s.tr) : undefined,
                  wordGlosses: s?.wordGlosses && typeof s.wordGlosses === 'object' ? s.wordGlosses : undefined,
                }))
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
 * Ayırıcılı metni satır ve hücrelere böler (RFC 4180): tırnak içindeki ayırıcı ve satır sonları korunur,
 * "" bir tırnak işaretidir. Boş satırlar atlanır.
 */
export function parseCsvRows(text: string, delimiter: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false
  const src = text.replace(/^\uFEFF/, '')
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"'
          i++
        } else inQuotes = false
      } else cell += ch
      continue
    }
    if (ch === '"' && cell.trim() === '') {
      inQuotes = true
      cell = ''
    } else if (ch === delimiter) {
      row.push(cell.trim())
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(cell.trim())
      if (row.some((c) => c !== '')) rows.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  row.push(cell.trim())
  if (row.some((c) => c !== '')) rows.push(row)
  return rows
}

/** İlk satıra bakarak ayırıcıyı tahmin eder: noktalı virgül, sekme ya da virgül. */
function detectDelimiter(text: string): string {
  const first = text.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0] ?? ''
  const count = (d: string) => first.split(d).length - 1
  const best = [';', '\t', ','].sort((a, b) => count(b) - count(a))[0]
  return count(best) > 0 ? best : ','
}

const splitList = (v?: string) => (v ? v.split(/[,;|]/).map((s) => s.trim()).filter(Boolean) : [])

/**
 * CSV / Excel dosya içeriğini ayrıştırır. Başlık satırı varsa sütunlar adına göre, yoksa sırayla
 * (kelime, anlam, tür, eş anlamlılar) okunur. Uygulamanın kendi CSV çıktısı da geri yüklenebilir.
 */
export function parseCsvText(csvContent: string): CreateWordInput[] {
  const rows = parseCsvRows(csvContent, detectDelimiter(csvContent))
  if (rows.length === 0) return []

  const headers = rows[0].map((h) => h.toLowerCase().trim())
  const col = (...names: string[]) => headers.findIndex((h) => names.includes(h))
  const colIdx = {
    term: col('term', 'kelime', 'word', 'english'),
    def: col('definition', 'anlam', 'turkce', 'türkçe', 'turkish', 'meaning'),
    pos: col('partofspeech', 'pos', 'tur', 'tür'),
    syn: col('synonyms', 'esanlam', 'eşanlam', 'es_anlam', 'synonym'),
    ant: col('antonyms', 'zitanlam', 'zıtanlam', 'antonym'),
    colloc: col('collocations', 'kalip', 'kalıplar', 'collocation'),
    sentence: col('sentence', 'cumle', 'cümle', 'example'),
    sentenceTr: col('sentence_tr', 'cumle_tr', 'cümle_tr', 'example_tr'),
    tags: col('tags', 'etiket', 'etiketler', 'category'),
    diff: col('difficulty', 'zorluk', 'seviye'),
    notes: col('notes', 'not', 'notlar'),
  }

  // Başlık satırı eşleştiyse 1. satırdan başla, eşleşmediyse 0. satırdan başla
  const hasHeader = colIdx.term !== -1 || colIdx.def !== -1
  const get = (row: string[], idx: number, fallback?: number) => row[idx !== -1 ? idx : (fallback ?? -1)]
  const results: CreateWordInput[] = []

  for (const row of rows.slice(hasHeader ? 1 : 0)) {
    const term = get(row, colIdx.term, 0)
    const def = get(row, colIdx.def, 1)
    if (!term || !def) continue

    const sentence = get(row, colIdx.sentence)
    const diffRaw = Number(get(row, colIdx.diff))
    results.push({
      term: term.trim(),
      definition: def.trim(),
      partOfSpeech: normalizePartOfSpeech(get(row, colIdx.pos, hasHeader ? -1 : 2)),
      synonyms: splitList(get(row, colIdx.syn, hasHeader ? -1 : 3)),
      antonyms: splitList(get(row, colIdx.ant)),
      collocations: splitList(get(row, colIdx.colloc)),
      sentences: sentence ? [{ en: sentence.trim(), tr: get(row, colIdx.sentenceTr)?.trim() || undefined }] : [],
      tags: splitList(get(row, colIdx.tags)),
      difficulty: Number.isFinite(diffRaw) && diffRaw > 0 ? Math.min(5, Math.max(1, Math.round(diffRaw))) : 2,
      notes: get(row, colIdx.notes)?.trim() || undefined,
    })
  }

  return results
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
      {
        "en": "The patient's condition deteriorated overnight.",
        "tr": "Hastanın durumu bir gecede kötüleşti.",
        "wordGlosses": {
          "patient": "hasta",
          "condition": "durum",
          "deteriorated": "kötüleşti / fenalaştı",
          "overnight": "bir gecede / aniden"
        }
      }
    ],
    "tags": ["Sağlık", "YDS"],
    "difficulty": 2
  }
]

Kurallar:
1. "partOfSpeech" değeri şunlardan biri olmalıdır: "verb", "noun", "adjective", "adverb", "phrasal_verb", "conjunction", "preposition", "idiom".
2. YDS için eş anlamlılar (synonyms) ve birlikte kullanılan kalıplar (collocations) en kritik alanlardır, zengin tut.
3. "wordGlosses": Örnek cümledeki her bir kelimenin Türkçe karşılıklarını (özellikle anahtar kelimeleri) bir sözlük haritası olarak ekle. Uygulama içinde cümleyi okurken tıklanan her kelimenin anlamı bu sayede anında açılacaktır.
4. Yalnızca geçerli JSON dizisini ver, fazladan markdown yorumu ekleme.

Kelime Listem:
[BURAYA KELİMELERİNİ VEYA METNİNİ YAPIŞTIR]`;
