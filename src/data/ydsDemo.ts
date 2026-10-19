// "YDS TEST": üç ÖZGÜN örnek soru (kelime, çeviri, paragraf). Hiçbir çıkmış sınavdan alınmamıştır; bu yüzden yayında da
// gösterilebilir. ÖSYM düzenini gösterir: soru numaraları gerçek sınavdaki bölümlere denk gelir (1-6 kelime, 37-42
// çeviri, 43-62 okuma). Biçim, çıkmış sorularla aynı `ExamBundle`dır; böylece aynı kart bileşeni kullanılır.
import type { ExamBundle } from '../pages/exam/examData'

const passage = [
  'Urban beekeeping has grown rapidly over the past decade, as city dwellers have turned rooftops and balconies into small apiaries.',
  'Supporters argue that bees thrive in cities, where a wide variety of flowering plants in parks and gardens provides food throughout the year.',
  'In contrast, intensive farming in the countryside often leaves bees with a single crop to feed on for only a few weeks.',
  'However, ecologists warn that adding more hives does not automatically help nature.',
  'Honeybees compete for nectar with wild pollinators, and in areas with limited flowers, a crowded rooftop can leave native species with too little to eat.',
  'For this reason, researchers recommend planting more flowers in cities before increasing the number of hives.',
]

export const YDS_DEMO: ExamBundle = {
  exam: {
    id: 'yds-test',
    title: 'YDS TEST (örnek)',
    passages: [
      {
        id: 'p1',
        kind: 'reading',
        text: passage.join(' '),
        sentences: passage.map((en, i) => ({ id: `p1s${i + 1}`, en })),
      },
    ],
    questions: [
      {
        no: 4,
        passage: null,
        stem: [{ id: 'q4s', en: 'Despite the initial scepticism of investors, the start-up’s innovative approach to renewable energy proved ----, attracting millions in funding within a year.' }],
        options: {
          A: { id: 'q4a', en: 'detrimental' },
          B: { id: 'q4b', en: 'lucrative' },
          C: { id: 'q4c', en: 'negligible' },
          D: { id: 'q4d', en: 'ambiguous' },
          E: { id: 'q4e', en: 'redundant' },
        },
        answer: 'B',
      },
      {
        no: 38,
        passage: null,
        stem: [
          {
            id: 'q38s',
            en: 'Although the new policy was designed to reduce traffic congestion, it has inadvertently encouraged more people to drive into the city centre.',
          },
        ],
        options: {
          A: { id: 'q38a', en: 'Yeni politika trafik sıkışıklığını azaltmak için tasarlanmış olsa da, istemeden daha fazla insanın şehir merkezine araçla gelmesini teşvik etmiştir.' },
          B: { id: 'q38b', en: 'Trafik sıkışıklığını azaltmayı amaçlayan yeni politika sayesinde, daha fazla insan bilinçli olarak şehir merkezine araçla gitmekten vazgeçmiştir.' },
          C: { id: 'q38c', en: 'Yeni politika, şehir merkezine araçla gelenlerin sayısını artırmak amacıyla trafik sıkışıklığını önlemek üzere hazırlanmıştır.' },
          D: { id: 'q38d', en: 'Trafik sıkışıklığı azaltılmak istendiği için hazırlanan yeni politikaya rağmen, insanlar şehir merkezine toplu taşımayla gitmeyi tercih etmiştir.' },
          E: { id: 'q38e', en: 'Daha fazla insan şehir merkezine araçla geldiğinden, yeni politikanın trafik sıkışıklığını azaltması planlanmıştır.' },
        },
        answer: 'A',
      },
      {
        no: 45,
        passage: 'p1',
        stem: [{ id: 'q45s', en: 'According to the passage, a rapid increase in the number of rooftop hives ----.' }],
        options: {
          A: { id: 'q45a', en: 'has made it more difficult for bees to find flowers in the countryside' },
          B: { id: 'q45b', en: 'may harm wild pollinators where flowers are scarce' },
          C: { id: 'q45c', en: 'is the most effective way of protecting native species' },
          D: { id: 'q45d', en: 'is only possible in cities with large parks and gardens' },
          E: { id: 'q45e', en: 'shows that honeybees no longer need nectar from wild plants' },
        },
        answer: 'B',
      },
    ],
  },
  tr: {
    q4s: 'Yatırımcıların başlangıçtaki kuşkucu tutumuna rağmen, girişimin yenilenebilir enerjiye yönelik yenilikçi yaklaşımı kârlı çıktı ve bir yıl içinde milyonlarca liralık fon çekti.',
    q4a: 'zararlı',
    q4b: 'kârlı',
    q4c: 'ihmal edilebilir',
    q4d: 'belirsiz, iki anlamlı',
    q4e: 'gereksiz, fazlalık',
    q38s: 'Yeni politika trafik sıkışıklığını azaltmak için tasarlanmış olsa da, istemeden daha fazla insanın şehir merkezine araçla gelmesini teşvik etmiştir.',
    q45s: 'Parçaya göre, çatı kovanlarının sayısındaki hızlı artış ----.',
    q45a: 'arıların kırsalda çiçek bulmasını zorlaştırmıştır',
    q45b: 'çiçeklerin az olduğu yerlerde yabani tozlaştırıcılara zarar verebilir',
    q45c: 'yerli türleri korumanın en etkili yoludur',
    q45d: 'yalnızca geniş park ve bahçeleri olan şehirlerde mümkündür',
    q45e: 'bal arılarının artık yabani bitkilerin nektarına ihtiyaç duymadığını gösterir',
    p1s1: 'Kentsel arıcılık, şehirde yaşayanların çatıları ve balkonları küçük arılıklara dönüştürmesiyle son on yılda hızla büyüdü.',
    p1s2: 'Destekçiler, parklarda ve bahçelerde yetişen çok çeşitli çiçekli bitkilerin yıl boyunca besin sağladığı şehirlerde arıların iyi geliştiğini savunuyor.',
    p1s3: 'Buna karşılık, kırsaldaki yoğun tarım çoğu zaman arıları yalnızca birkaç hafta boyunca tek bir ürünle beslenmeye mahkûm bırakır.',
    p1s4: 'Ancak ekologlar, daha fazla kovan eklemenin doğaya kendiliğinden yardım etmediği konusunda uyarıyor.',
    p1s5: 'Bal arıları nektar için yabani tozlaştırıcılarla yarışır; çiçeklerin sınırlı olduğu bölgelerde kalabalık bir çatı arılığı yerli türleri yeterli besinden yoksun bırakabilir.',
    p1s6: 'Bu nedenle araştırmacılar, kovan sayısını artırmadan önce şehirlerde daha fazla çiçek ekilmesini öneriyor.',
  },
}

/** Her sorunun çözüm ipucu (cevaptan sonra gösterilir). */
export const YDS_DEMO_HINTS: Record<number, string> = {
  4: 'Boşluktan sonra “attracting millions in funding” geliyor: para çekmek olumlu bir sonuçtur. “Despite scepticism” de başlangıçtaki kuşkunun yanlış çıktığını söyler. Olumlu anlamlı tek seçenek “lucrative” (kârlı).',
  38: 'Çeviri sorularında önce yan cümleyi (“Although … designed to reduce”), sonra ana cümleyi (“inadvertently encouraged”) ayrı ayrı çevir. “Inadvertently” = istemeden; “although” zıtlık kurar. Diğer şıklar amacı, nedeni ya da sonucu tersine çeviriyor.',
  45: 'Cevap 4-5. cümlede: bal arıları nektar için yabani tozlaştırıcılarla yarışır ve çiçek azsa yerli türler yeterli besin bulamaz. Şıkta “may harm … where flowers are scarce” bunu aynen karşılar; diğer şıklar metinde söylenmeyeni ya da tersini iddia ediyor.',
}
