import type { CardState, WordItem } from '../types/database'
import { normalizePartOfSpeech, parseCsvRows } from './importer'
import type { CreateWordInput } from './words'

// Kelime havuzunu CSV (Excel) ve Anki formatlarında dışa / içe aktarma.

const TURKISH_CHARS = /[çğıöşüÇĞİÖŞÜ]/

// ---------------------------------------------------------------------------
// Dışa aktarma
// ---------------------------------------------------------------------------

function csvCell(v: string): string {
  const clean = v.replace(/\r?\n/g, ' ')
  return /[;"\n]/.test(clean) ? `"${clean.replace(/"/g, '""')}"` : clean
}

/**
 * Excel'de Türkçe karakterler bozulmasın diye BOM'lu, noktalı virgül ayırıcılı CSV (Türkçe Excel'in varsayılanı).
 * Sütun adları uygulamanın CSV içe aktarmasıyla uyumludur; dosya geri yüklenebilir.
 */
export function wordsToCsv(words: WordItem[], cards: Map<string, CardState>): string {
  const header = ['term', 'definition', 'partOfSpeech', 'synonyms', 'antonyms', 'collocations', 'sentence', 'sentence_tr', 'tags', 'difficulty', 'notes', 'mastery', 'next_review']
  const rows = words.map((w) => {
    const c = cards.get(w.id)
    const s = w.sentences?.[0]
    return [
      w.term,
      w.definition,
      w.partOfSpeech,
      (w.synonyms || []).join(', '),
      (w.antonyms || []).join(', '),
      (w.collocations || []).join(', '),
      s?.en ?? '',
      s?.tr ?? '',
      (w.tags || []).join(', '),
      String(w.difficulty ?? ''),
      w.notes ?? '',
      c?.reps ? String(c.masteryScore ?? '') : '',
      c?.reps ? c.due.slice(0, 10) : '',
    ]
      .map(csvCell)
      .join(';')
  })
  return '﻿' + [header.join(';'), ...rows].join('\r\n')
}

function html(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/[\t\r\n]+/g, ' ')
}

/**
 * Anki "Notes in Plain Text" biçimi: ön yüz kelime, arka yüz anlam + eş anlamlılar + örnek cümle.
 * Anki'de Dosya > İçe Aktar ile "Basic" not türüne aktarılır; başlık satırları ayarları kendisi tanıtır.
 */
export function wordsToAnki(words: WordItem[]): string {
  const lines = ['#separator:tab', '#html:true', '#tags column:3']
  for (const w of words) {
    const back = [`<b>${html(w.definition)}</b>`, `<small>${html(w.partOfSpeech.replace('_', ' '))}</small>`]
    if (w.synonyms?.length) back.push(`Eş anlamlılar: ${html(w.synonyms.join(', '))}`)
    const s = w.sentences?.[0]
    if (s?.en) back.push(`<i>${html(s.en)}</i>${s.tr ? `<br>${html(s.tr)}` : ''}`)
    const tags = ['YDS', ...(w.tags || [])].map((t) => t.replace(/\s+/g, '_')).join(' ')
    lines.push([html(w.term), back.join('<br>'), tags].join('\t'))
  }
  return lines.join('\n') + '\n'
}

/** Metni dosya olarak indirir. */
export function downloadText(content: string, fileName: string, mime: string): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ---------------------------------------------------------------------------
// İçe aktarma (Anki)
// ---------------------------------------------------------------------------

/** HTML'i düz metne çevirir; <br> ve blok etiketleri satır sonu olur. Anki ses ve cloze işaretlerini temizler. */
function stripHtml(v: string): string {
  const withBreaks = v
    .replace(/\[sound:[^\]]*\]/g, '')
    .replace(/\{\{c\d+::(.*?)(::[^}]*)?\}\}/g, '$1')
    .replace(/<br\s*\/?>|<\/(div|p|li)>/gi, '\n')
  const doc = new DOMParser().parseFromString(withBreaks, 'text/html')
  return (doc.body.textContent || '')
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
}

const SEPARATORS: Record<string, string> = { tab: '\t', comma: ',', semicolon: ';', pipe: '|', space: ' ', colon: ':' }

export function isAnkiText(text: string): boolean {
  return /^#(separator|html|tags column|notetype|deck|guid)/m.test(text.slice(0, 500))
}

export interface AnkiParseResult {
  items: CreateWordInput[]
  /** Ön yüz Türkçe görünüyorsa ön/arka yer değiştirildi. */
  swapped: boolean
}

/**
 * Anki'den dışa aktarılan "Notes in Plain Text" dosyasını okur. İlk alan kelime, ikinci alan anlam sayılır;
 * ön yüz çoğunlukla Türkçe ise (Türkçe → İngilizce deste) yönü otomatik çevirir. `swap` ile elle de çevrilebilir.
 */
export function parseAnkiText(text: string, swap?: boolean): AnkiParseResult {
  let delimiter = '\t'
  let tagsCol = -1
  const metaCols = new Set<number>()
  const body: string[] = []
  for (const line of text.split(/\r?\n/)) {
    const m = /^#([a-z ]+):(.*)$/i.exec(line)
    if (m) {
      const key = m[1].trim().toLowerCase()
      const val = m[2].trim()
      if (key === 'separator') delimiter = SEPARATORS[val.toLowerCase()] ?? val
      else if (key === 'tags column') tagsCol = Number(val) - 1
      else if (/(notetype|deck|guid) column/.test(key)) metaCols.add(Number(val) - 1)
      continue
    }
    body.push(line)
  }

  const rows = parseCsvRows(body.join('\n'), delimiter)
    .map((r) => {
      const fields = r.filter((_, i) => i !== tagsCol && !metaCols.has(i)).map(stripHtml)
      const tags = tagsCol >= 0 && r[tagsCol] ? r[tagsCol].split(/\s+/).filter(Boolean).map((t) => t.replace(/_/g, ' ')) : []
      return { front: fields[0] ?? '', back: fields[1] ?? '', tags }
    })
    .filter((r) => r.front && r.back)

  const trFront = rows.filter((r) => TURKISH_CHARS.test(r.front)).length
  const trBack = rows.filter((r) => TURKISH_CHARS.test(r.back)).length
  const swapped = swap ?? trFront > trBack * 1.5

  const items = rows.map(({ front, back, tags }) => {
    const [termRaw, defRaw] = swapped ? [back, front] : [front, back]
    // Arka yüzün ilk satırı anlam; uygulamanın kendi Anki çıktısındaki ek satırlar da okunur
    const lines = defRaw.split('\n')
    const term = termRaw.split('\n')[0]
    const synLine = lines.find((l) => /^eş anlamlılar:/i.test(l))
    const posLine = lines[1] && /^[a-z ]+$/i.test(lines[1]) && lines[1].length < 20 ? lines[1] : undefined
    const sentenceIdx = lines.findIndex((l, i) => i > 0 && l !== synLine && l !== posLine && /[a-z]{3,}.*\s.*[a-z]/i.test(l) && !TURKISH_CHARS.test(l))
    // Tanınmayan ek satırlar kaybolmasın: Türkçe yüzdeki satırlar anlama, diğerleri nota eklenir
    const trIdx = sentenceIdx > 0 && lines[sentenceIdx + 1] && TURKISH_CHARS.test(lines[sentenceIdx + 1]) ? sentenceIdx + 1 : -1
    const used = new Set([0, lines.indexOf(synLine ?? '\u0000'), posLine ? 1 : -1, sentenceIdx, trIdx])
    const extra = lines.filter((_, i) => !used.has(i))
    const input: CreateWordInput = {
      term,
      definition: swapped ? lines.join(', ') : lines[0],
      notes: !swapped && extra.length ? extra.join(' / ') : undefined,
      partOfSpeech: normalizePartOfSpeech(posLine),
      synonyms: synLine ? synLine.replace(/^eş anlamlılar:\s*/i, '').split(/,\s*/).filter(Boolean) : [],
      sentences:
        sentenceIdx > 0
          ? [{ en: lines[sentenceIdx], tr: trIdx > 0 ? lines[trIdx] : undefined }]
          : [],
      tags: Array.from(new Set(['Anki', ...tags.filter((t) => t.toLowerCase() !== 'yds')])),
    }
    return input
  })
  return { items, swapped }
}
