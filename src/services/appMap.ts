import { GRAMMAR_TOPICS } from '../data/grammar'
import { YDS_SECTIONS } from './ydsSections'

// Uygulama haritası: YZ koçunun öğrenciyi yönlendirebileceği sayfalar. Modele bu liste verilir;
// yanıttaki bağlantılar yalnızca bu listedeki adreslere tıklanabilir olur (bilinmeyenler düz metin kalır).

export interface AppLink {
  href: string
  label: string
  desc: string
}

export function appLinks(): AppLink[] {
  const links: AppLink[] = [
    { href: '/', label: 'Ana Sayfa', desc: 'bugünkü plan (tekrar + yeni kelime + soru)' },
    { href: '/study?preset=due&auto=1', label: 'Günün tekrarları', desc: 'zamanı gelen kelime tekrarlarını hemen başlatır' },
    { href: '/study?group=new_words&auto=1', label: 'Yeni kelimeler', desc: 'YDS’de en sık çıkan yeni kelimelerle 20’lik bir tur' },
    { href: '/study?group=weak_words&auto=1', label: 'Zorlandıklarım', desc: 'sık yanılınan kelimeler destesi' },
    { href: '/study?group=yds_collected', label: 'Sınavdan topladıklarım', desc: 'sorulardan toplanan kelimeler' },
    { href: '/study?mode=cloze&auto=1', label: 'Cümle içi boşluk', desc: 'kelimeleri cümle bağlamında çalışma' },
    { href: '/study', label: 'Kelime çalışma merkezi', desc: 'seviye desteleri (A, B, C), phrasal verbs, bağlaçlar' },
    { href: '/match', label: 'Eş anlamlı eşleştirme', desc: 'eş anlamlı kelime oyunu' },
    { href: '/quiz', label: 'Mini kelime denemesi', desc: '10 soruluk kelime testi' },
    { href: '/words', label: 'Kelime havuzu', desc: 'tüm kelimeler, ekleme, içe/dışa aktarma' },
    { href: '/stats', label: 'İstatistik', desc: 'çalışma takvimi, kilometre taşları, seviye dağılımı' },
    { href: '/dilbilgisi', label: 'Dilbilgisi rehberi', desc: '14 YDS dilbilgisi konusu, anlatım ve alıştırma' },
    ...GRAMMAR_TOPICS.map((t) => ({ href: `/dilbilgisi/${t.id}`, label: t.title, desc: 'dilbilgisi konusu + 5 alıştırma' })),
    { href: '/koc', label: 'İngilizce pratik', desc: 'YZ ile İngilizce sohbet ve rol yapma' },
    { href: '/koc/hafiza', label: 'Hafızam', desc: 'profil ve YZ hafıza notları' },
  ]
  // Çıkmış soru sayfaları yalnızca yerel geliştirmede vardır
  if (import.meta.env.DEV) {
    links.push(
      { href: '/yds-sorular', label: 'Soru Merkezi', desc: '27 çıkmış YDS; sınav çöz, deneme, konu bazlı çalışma' },
      ...YDS_SECTIONS.map((s) => ({ href: `/yds-sorular/konu/${s.key}`, label: `${s.label} soruları`, desc: `tüm sınavlardan ${s.label.toLowerCase()} soruları (${s.from}-${s.to}. sorular)` })),
      { href: '/yds-sorular/yanlislar', label: 'Yanlış Defteri', desc: 'yanlış yapılan soruları doğru çözene kadar tekrar' },
      { href: '/yds-sorular/okuma', label: 'Okuma modu', desc: 'okuma paragrafları, okuma hızı, dinleme' },
    )
  }
  return links
}

/** Modele verilecek harita metni. */
export function appMapText(): string {
  return appLinks()
    .map((l) => `- [${l.label}](${l.href}) — ${l.desc}`)
    .join('\n')
}

let allowed: Set<string> | null = null
/** Yanıttaki bağlantı uygulamada gerçekten var mı? */
export function isKnownRoute(href: string): boolean {
  allowed ??= new Set(appLinks().map((l) => l.href))
  return allowed.has(href)
}
