/**
 * YDS (ÖSYM) 80 soruluk sınav düzeni. Soru numarası, sorunun tipini belirler.
 * Yalnızca yapı bilgisidir; soru içeriği içermez (yayın derlemesine girmesi sorun değildir).
 */
export type SectionKey =
  | 'vocab'
  | 'grammar'
  | 'cloze'
  | 'completion'
  | 'translation'
  | 'reading'
  | 'dialogue'
  | 'paraphrase'
  | 'paragraph'
  | 'irrelevant'
  | 'vocgram'

export interface YdsSection {
  key: SectionKey
  label: string
  icon: string
  from: number
  to: number
  /** Bir cümlelik açıklama: ne sorulur, nasıl yaklaşılır. */
  hint: string
}

export const YDS_SECTIONS: YdsSection[] = [
  { key: 'vocab', label: 'Kelime', icon: '🔤', from: 1, to: 6, hint: 'Cümledeki boşluğa anlamca uyan kelime veya phrasal verb seçilir.' },
  { key: 'grammar', label: 'Dilbilgisi', icon: '🧩', from: 7, to: 16, hint: 'Zaman, edat, bağlaç ve yapı bilgisi; önce boşluğun çevresindeki ipuçlarına bak.' },
  { key: 'cloze', label: 'Cloze Test', icon: '📝', from: 17, to: 26, hint: 'Paragraftaki boşluklar; akışı ve bağlaçları paragrafın bütününe göre seç.' },
  { key: 'completion', label: 'Cümle Tamamlama', icon: '➗', from: 27, to: 36, hint: 'Yarım cümleyi anlam ve dilbilgisi olarak tamamlayan seçenek bulunur.' },
  { key: 'translation', label: 'Çeviri', icon: '🔁', from: 37, to: 42, hint: '37-39 İngilizce→Türkçe, 40-42 Türkçe→İngilizce; anlamı tam karşılayan seçenek.' },
  { key: 'reading', label: 'Okuma', icon: '📖', from: 43, to: 62, hint: 'Beş paragraf, her birine dört soru; cevabı paragrafta kanıtıyla ara.' },
  { key: 'dialogue', label: 'Diyalog', icon: '💬', from: 63, to: 67, hint: 'Konuşmadaki boşluğa, öncesi ve sonrasıyla uyumlu cümle seçilir.' },
  { key: 'paraphrase', label: 'Yakın Anlam', icon: '≈', from: 68, to: 71, hint: 'Verilen cümleye anlamca en yakın cümle bulunur.' },
  { key: 'paragraph', label: 'Paragraf Tamamlama', icon: '¶', from: 72, to: 75, hint: 'Paragraftaki boşluğa akışı bozmadan uyan cümle seçilir.' },
  { key: 'irrelevant', label: 'Anlam Bütünlüğü', icon: '🚫', from: 76, to: 80, hint: 'Paragrafın akışını bozan, konudan sapan cümle bulunur.' },
]

/** YÖKDİL'e özgü tip: ilk 20 soru kelime ve dilbilgisi karışık gelir. */
export const VOCGRAM_SECTION: YdsSection = {
  key: 'vocgram',
  label: 'Kelime ve Dilbilgisi',
  icon: '🔤',
  from: 1,
  to: 20,
  hint: 'YÖKDİL’in ilk 20 sorusu: boşluğa anlamca ya da dilbilgisi olarak uyan seçenek bulunur.',
}

/** Tüm soru tipleri (YDS + YÖKDİL’e özgü olanlar). */
export const ALL_SECTIONS: YdsSection[] = [...YDS_SECTIONS, VOCGRAM_SECTION]

const BY_KEY = new Map(ALL_SECTIONS.map((s) => [s.key, s]))

/** YÖKDİL 80 soru düzeni: soru numarası aralığı → tip (kesin sınır ÖSYM düzenine göre). */
const YOKDIL_RANGES: [number, number, SectionKey][] = [
  [1, 20, 'vocgram'],
  [21, 30, 'cloze'],
  [31, 41, 'completion'],
  [42, 53, 'translation'],
  [54, 59, 'paragraph'],
  [60, 65, 'irrelevant'],
  [66, 80, 'reading'],
]

export const isYokdil = (examId?: string | null) => Boolean(examId && examId.startsWith('yokdil-'))

/** Soru numarasının tipi. YÖKDİL sınavlarında düzen farklı olduğu için sınav kimliği verilmelidir. */
export function sectionOf(no: number, examId?: string | null): YdsSection {
  if (isYokdil(examId)) {
    const r = YOKDIL_RANGES.find(([a, b]) => no >= a && no <= b)
    if (r) return getSection(r[2])
  }
  return YDS_SECTIONS.find((s) => no >= s.from && no <= s.to) ?? YDS_SECTIONS[0]
}

/** Bir tipin, verilen sınavdaki soru numarası aralığı (YDS ve YÖKDİL farklıdır). */
export function rangeIn(key: SectionKey, examId?: string | null): [number, number] | null {
  if (isYokdil(examId)) {
    const rs = YOKDIL_RANGES.filter((r) => r[2] === key)
    return rs.length ? [rs[0][0], rs[rs.length - 1][1]] : null
  }
  const s = YDS_SECTIONS.find((x) => x.key === key)
  return s ? [s.from, s.to] : null
}

export function getSection(key: SectionKey): YdsSection {
  return BY_KEY.get(key) ?? YDS_SECTIONS[0]
}

/** YDS puanı: her doğru 1,25 puan (yanlış doğruyu götürmez). */
export function ydsScore(correct: number): number {
  return Math.round(correct * 1.25 * 100) / 100
}
