import { hasLocalContent } from './localContent'
// Çalış menüsünün iskeleti: her özellik tek bir kategoride durur (ana sayfa ve Çalış merkezi bunu kullanır).

export interface StudyLink {
  to: string
  label: string
  hint: string
  /** Yalnızca yerel geliştirmede var (çıkmış soru sayfaları yayına girmez). */
  dev?: boolean
}

/** Hazırlanılan sınav: Çalış sayfası önce bunu sorar, kategoriler ona göre gelir. */
export type ExamId = 'yds' | 'dus' | 'kpss'

export interface ExamInfo {
  id: ExamId
  icon: string
  title: string
  desc: string
}

export const EXAMS: ExamInfo[] = [
  { id: 'yds', icon: '🔤', title: 'YDS', desc: 'Yabancı dil' },
  { id: 'dus', icon: '🦷', title: 'DUS', desc: 'Diş hekimliği' },
  { id: 'kpss', icon: '🏛️', title: 'KPSS', desc: 'Hazırlanıyor' },
]

const EXAM_KEY = 'yds-exam'

/** Son seçilen sınav (cihazda hatırlanır); yoksa YDS. */
export function activeExam(): ExamId {
  try {
    const v = localStorage.getItem(EXAM_KEY)
    if (v === 'dus' || v === 'kpss') return v
  } catch {
    // yoksay
  }
  return 'yds'
}

export function setActiveExam(id: ExamId) {
  try {
    localStorage.setItem(EXAM_KEY, id)
  } catch {
    // yoksay
  }
}

export interface StudyCategory {
  id: string
  exam: ExamId
  icon: string
  title: string
  desc: string
  links: StudyLink[]
}

const ALL: StudyCategory[] = [
  {
    id: 'kelime',
    exam: 'yds',
    icon: '📚',
    title: 'Kelime',
    desc: 'YDS puanının temeli. Her gün tekrar + yeni kelime.',
    links: [
      { to: '/study?preset=due&auto=1', label: 'Günün tekrarları', hint: 'Unutmak üzere olduğun kelimeler' },
      { to: '/study', label: 'Seviye seviye kelime', hint: "20'şer kelimelik gruplar" },
      { to: '/match', label: 'Eş anlamlı eşleştirme', hint: 'Hızlı oyun' },
      { to: '/study?mode=write', label: 'Yazarak kelime', hint: 'Türkçesini gör, İngilizcesini yaz' },
      { to: '/study?mode=cloze', label: 'Cümle içinde kelime', hint: 'Boşluğa doğru kelimeyi seç' },
      { to: '/kelime-ailesi', label: 'Kelime ailesi ve ekler', hint: 'Kök + ek: develop → development' },
      { to: '/quiz', label: 'Mini kelime denemesi', hint: '10 soru, ÖSYM biçiminde' },
    ],
  },
  {
    id: 'soru',
    exam: 'yds',
    icon: '📝',
    title: 'Soru çöz',
    desc: 'Soru tiplerini tanı, sonra deneme çöz.',
    links: [
      { to: '/yds-test', label: 'Alıştırma Merkezi', hint: 'Tipe göre özgün sorular' },
      { to: '/yds-sorular', label: 'Çıkmış sınavlar', hint: 'Sınav sınav çöz, deneme yap', dev: true },
      { to: '/yds-sorular/yanlislar', label: 'Yanlış Defteri', hint: 'Yanlışlarını tekrar çöz', dev: true },
      { to: '/yds-test/ceviri', label: 'Çeviri Atölyesi', hint: 'EN↔TR çeviri soruları' },
    ],
  },
  {
    id: 'dilbilgisi',
    exam: 'yds',
    icon: '📘',
    title: 'Dilbilgisi',
    desc: 'Sınavda sorulan konular, kısa anlatım ve alıştırma.',
    links: [
      { to: '/kitap', label: 'Kitaptan çalış', hint: 'Murphy: ünite ünite, sayfa sayfa', dev: true },
      { to: '/dilbilgisi', label: 'Dilbilgisi Rehberi', hint: 'Konu konu anlatım' },
      { to: '/yds-sorular/bankalar', label: 'Gramer soru bankası', hint: 'Test test, kitabın çözümüyle', dev: true },
      { to: '/yds-sorular/taktik', label: 'Taktik Kitabı', hint: 'Soru tiplerine göre ipuçları', dev: true },
    ],
  },
  {
    id: 'dinle',
    exam: 'yds',
    icon: '🎧',
    title: 'Dinle & Oku',
    desc: 'Seviyene göre oku, kulaktan öğren: metin, kelime, gece modu.',
    links: [
      { to: '/okuma', label: 'Okuma Kütüphanesi', hint: 'A2–B1 metinler; kelimeye dokun, anlamını gör' },
      { to: '/gece', label: 'Gece Modu', hint: 'Yatarken kelime/paragraf dinle' },
      { to: '/study?mode=listen', label: 'Dinleyerek kelime', hint: 'Sesi duy, anlamını seç' },
      { to: '/yds-sorular/okuma', label: 'Okuma Modu', hint: 'Paragraf oku, dinle, süreni ölç', dev: true },
    ],
  },
  {
    id: 'koc',
    exam: 'yds',
    icon: '🤖',
    title: 'YZ Koç',
    desc: 'Sohbet pratiği, hata analizi ve öneriler.',
    links: [
      { to: '/koc', label: 'Koçla konuş', hint: 'İngilizce sohbet ya da plan' },
      { to: '/yds-sorular/analiz', label: 'Hatalarımı analiz et', hint: 'Yanlışlarındaki kalıplar', dev: true },
    ],
  },
  {
    id: 'dus-bugun',
    exam: 'dus',
    icon: '📅',
    title: 'Bugün',
    desc: 'Günlük set ve zamanı gelen tekrarlar.',
    links: [
      { to: '/dus/bugun', label: 'Bugünün seti', hint: 'Tekrarlar + en zayıf dersten yeni sorular', dev: true },
      { to: '/dus/tekrar', label: 'Tekrar destesi', hint: 'Yanlış ve işaretli sorular, aralıklı tekrar', dev: true },
    ],
  },
  {
    id: 'dus',
    exam: 'dus',
    icon: '📝',
    title: 'Soru çöz',
    desc: 'ÖSYM’nin çıkmış soruları: sınav sınav ya da derse göre.',
    links: [
      { to: '/dus', label: 'Çıkmış DUS soruları', hint: 'Sınav sınav, derse göre; Temel ve Klinik', dev: true },
      { to: '/dus/deneme', label: 'Süreli deneme', hint: '120 soru / 150 dk, net ve ders dökümü', dev: true },
      { to: '/dus/yanlislar', label: 'DUS yanlışlarım', hint: 'Yanlış yaptığın soruları tekrar çöz', dev: true },
    ],
  },
  {
    id: 'dus-kavram',
    exam: 'dus',
    icon: '📖',
    title: 'Kavramlar',
    desc: 'Terimler sade Türkçeyle, konu konu kısa bilgi kartları.',
    links: [
      { to: '/dus/kavramlar', label: 'Kavram sözlüğü', hint: 'Terimi ara, sade açıklamasını oku', dev: true },
      { to: '/dus/kavramlar/terimler', label: 'Terim kartları', hint: 'Ders ders, 20’lik seviyeler; çevir ve puanla', dev: true },
      { to: '/dus/kavramlar/kartlar', label: 'Bilgi kartları', hint: 'Soru–cevap kartları, ders ve konuya göre', dev: true },
    ],
  },
  {
    id: 'dus-takip',
    exam: 'dus',
    icon: '📊',
    title: 'Takip',
    desc: 'Ders ders başarı ve deneme netleri.',
    links: [{ to: '/dus/istatistik', label: 'DUS istatistik', hint: 'En zayıf dersler, ısı haritası', dev: true }],
  },
]

export const STUDY_CATEGORIES: StudyCategory[] = ALL.map((c) => ({
  ...c,
  links: c.links.filter((l) => !l.dev || hasLocalContent()),
})).filter((c) => c.links.length > 0)

export const categoriesOf = (exam: ExamId) => STUDY_CATEGORIES.filter((c) => c.exam === exam)

/** Bu yollar "Çalış" menüsünün altında sayılır (menüde Çalış seçili görünür). */
export function isStudyPath(pathname: string): boolean {
  return /^\/(calis|study|match|quiz|yds-test|yds-sorular|dilbilgisi|koc|gece|kitap|kelime-ailesi|okuma|dus)(\/|$)/.test(pathname)
}
