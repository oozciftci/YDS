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

const BY_KEY = new Map(YDS_SECTIONS.map((s) => [s.key, s]))

export function sectionOf(no: number): YdsSection {
  return YDS_SECTIONS.find((s) => no >= s.from && no <= s.to) ?? YDS_SECTIONS[0]
}

export function getSection(key: SectionKey): YdsSection {
  return BY_KEY.get(key) ?? YDS_SECTIONS[0]
}

/** YDS puanı: her doğru 1,25 puan (yanlış doğruyu götürmez). */
export function ydsScore(correct: number): number {
  return Math.round(correct * 1.25 * 100) / 100
}
