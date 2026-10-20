// Çalış menüsünün iskeleti: her özellik tek bir kategoride durur (ana sayfa ve Çalış merkezi bunu kullanır).

export interface StudyLink {
  to: string
  label: string
  hint: string
  /** Yalnızca yerel geliştirmede var (çıkmış soru sayfaları yayına girmez). */
  dev?: boolean
}

export interface StudyCategory {
  id: string
  icon: string
  title: string
  desc: string
  links: StudyLink[]
}

const ALL: StudyCategory[] = [
  {
    id: 'kelime',
    icon: '📚',
    title: 'Kelime',
    desc: 'YDS puanının temeli. Her gün tekrar + yeni kelime.',
    links: [
      { to: '/study?preset=due&auto=1', label: 'Günün tekrarları', hint: 'Unutmak üzere olduğun kelimeler' },
      { to: '/study', label: 'Seviye seviye kelime', hint: "20'şer kelimelik gruplar" },
      { to: '/match', label: 'Eş anlamlı eşleştirme', hint: 'Hızlı oyun' },
      { to: '/study?mode=write', label: 'Yazarak kelime', hint: 'Türkçesini gör, İngilizcesini yaz' },
      { to: '/study?mode=cloze', label: 'Cümle içinde kelime', hint: 'Boşluğa doğru kelimeyi seç' },
      { to: '/quiz', label: 'Mini kelime denemesi', hint: '10 soru, ÖSYM biçiminde' },
    ],
  },
  {
    id: 'soru',
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
    icon: '🎧',
    title: 'Dinle & Oku',
    desc: 'Kulaktan öğren: kelime, paragraf, gece modu.',
    links: [
      { to: '/gece', label: 'Gece Modu', hint: 'Yatarken kelime/paragraf dinle' },
      { to: '/study?mode=listen', label: 'Dinleyerek kelime', hint: 'Sesi duy, anlamını seç' },
      { to: '/yds-sorular/okuma', label: 'Okuma Modu', hint: 'Paragraf oku, dinle, süreni ölç', dev: true },
    ],
  },
  {
    id: 'koc',
    icon: '🤖',
    title: 'YZ Koç',
    desc: 'Sohbet pratiği, hata analizi ve öneriler.',
    links: [
      { to: '/koc', label: 'Koçla konuş', hint: 'İngilizce sohbet ya da plan' },
      { to: '/yds-sorular/analiz', label: 'Hatalarımı analiz et', hint: 'Yanlışlarındaki kalıplar', dev: true },
    ],
  },
]

export const STUDY_CATEGORIES: StudyCategory[] = ALL.map((c) => ({
  ...c,
  links: c.links.filter((l) => !l.dev || import.meta.env.DEV),
}))

/** Bu yollar "Çalış" menüsünün altında sayılır (menüde Çalış seçili görünür). */
export function isStudyPath(pathname: string): boolean {
  return /^\/(calis|study|match|quiz|yds-test|yds-sorular|dilbilgisi|koc|gece|kitap)(\/|$)/.test(pathname)
}
