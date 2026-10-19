// Özgün (telifsiz) alıştırma soruları: public/data/ozgun/<tip>.json. Tüm sorular bu projede yazılmıştır;
// hiçbiri çıkmış sınavlardan alınmamıştır, bu yüzden yayında da gösterilebilir.
import type { SectionKey } from '../services/ydsSections'

export interface OzgunQ {
  /** Soru gövdesi. Dizi ise (diyalog, paragraf, anlam bütünlüğü) her eleman bir cümle/satırdır. Boşluk: ---- */
  s?: string | string[]
  /** Şıklar (A-E sırasıyla, 5 adet). Anlam bütünlüğünde boş bırakılırsa I-V olur. */
  o: string[]
  /** Doğru şıkkın sırası (0 = A). */
  a: number
  /** Gövdenin Türkçesi (s ile aynı biçimde). */
  t?: string | string[]
  /** Şıkların Türkçesi (kelime sorularında anlamlar). */
  ot?: string[]
  /** Her şık için kısa Türkçe açıklama (doğru şık "Doğru: …" ile başlar). */
  x: string[]
  /** Genel çözüm ipucu (isteğe bağlı). */
  tip?: string
}

export interface OzgunSet {
  id: string
  title: string
  /** Paragraflı setler (cloze, okuma): cümle listesi. Cloze’da boşluk [[n]] (n = sorunun set içindeki sırası, 1’den). */
  passage?: { sentences: string[]; tr?: string[]; kind: 'cloze' | 'reading' }
  qs: OzgunQ[]
}

export interface OzgunFile {
  type: SectionKey
  sets: OzgunSet[]
}

/** Dosya adı → tip. Alıştırma Merkezi bu listedeki dosyaları okur. */
export const OZGUN_FILES: { file: string; type: SectionKey }[] = [
  { file: 'vocab', type: 'vocab' },
  { file: 'grammar', type: 'grammar' },
  { file: 'cloze', type: 'cloze' },
  { file: 'completion', type: 'completion' },
  { file: 'translation', type: 'translation' },
  { file: 'reading', type: 'reading' },
  { file: 'dialogue', type: 'dialogue' },
  { file: 'paraphrase', type: 'paraphrase' },
  { file: 'paragraph', type: 'paragraph' },
  { file: 'irrelevant', type: 'irrelevant' },
]
