// YDS dilbilgisi rehberi. Tüm anlatımlar, örnekler ve alıştırmalar özgündür (çıkmış sorulardan alıntı yoktur);
// bu yüzden yayın derlemesinde de bulunabilir.

export interface GrammarExample {
  en: string
  tr: string
}

export interface GrammarSection {
  heading: string
  points: string[]
  examples?: GrammarExample[]
}

export interface GrammarExercise {
  q: string
  options: string[]
  answer: number
  why: string
}

export interface GrammarTopic {
  id: string
  title: string
  icon: string
  /** Tek cümlelik özet (listede görünür). */
  summary: string
  /** Sınavda bu konunun sorusunu nasıl tanıyıp çözeceğin. */
  ydsTip: string
  sections: GrammarSection[]
  traps: string[]
  exercises: GrammarExercise[]
  /** Çıkmış soru şıklarından konuyu tahmin etmek için (bkz. guessGrammarTopics). */
  patterns: RegExp[]
}

export const GRAMMAR_TOPICS: GrammarTopic[] = [
  {
    id: 'zamanlar',
    title: 'Zamanlar (Tenses)',
    icon: '⏳',
    summary: 'Perfect zamanlar ve zaman ifadeleri: YDS dilbilgisi sorularının en sık konusu.',
    ydsTip:
      'Önce cümledeki zaman ifadesini bul: "since / for / over the last …" → have V3; "by the time + V2" → had V3; "by + gelecek zaman" → will have V3; belirli geçmiş zaman (in 1990, ago) → V2. İki boşluklu sorularda iki fiilin birbirine uyumunu kontrol et.',
    sections: [
      {
        heading: 'Present Perfect (have / has V3)',
        points: [
          'Geçmişte başlayıp şimdiye uzanan ya da sonucu şimdi önemli olan durumlar.',
          'İpuçları: since + başlangıç noktası, for + süre, so far, up to now, recently, over the past decade, in recent years.',
          'Süreç vurgusu varsa: have been V-ing (present perfect continuous).',
        ],
        examples: [
          { en: 'Since the 1990s, the number of urban gardens has increased dramatically.', tr: '1990’lardan bu yana kentsel bahçelerin sayısı çarpıcı biçimde arttı.' },
          { en: 'Researchers have been studying the effects of sleep loss for decades.', tr: 'Araştırmacılar onlarca yıldır uykusuzluğun etkilerini inceliyor.' },
        ],
      },
      {
        heading: 'Past Perfect (had V3)',
        points: [
          'Geçmişteki bir olaydan daha önce tamamlanmış eylem.',
          'İpuçları: by the time + V2, before / after + V2, when + V2 (önce olan eylem had V3 olur).',
        ],
        examples: [
          { en: 'By the time the rescue team arrived, the fire had already spread to the forest.', tr: 'Kurtarma ekibi geldiğinde yangın çoktan ormana yayılmıştı.' },
        ],
      },
      {
        heading: 'Future Perfect (will have V3)',
        points: ['Gelecekte belirli bir zamana kadar tamamlanmış olacak eylem.', 'İpucu: by + gelecek zaman (by 2040, by the end of next year), by the time + present.'],
        examples: [{ en: 'By 2040, scientists will have mapped most of the ocean floor.', tr: '2040’a kadar bilim insanları okyanus tabanının çoğunu haritalamış olacak.' }],
      },
      {
        heading: 'Zaman uyumu',
        points: [
          'when, as soon as, until, before, after, once ile kurulan zaman cümlelerinde gelecek anlam için will değil geniş zaman kullanılır: "as soon as the results arrive".',
          'Ana cümle geçmişteyse yan cümle de geçmiş zaman ailesinden seçilir.',
        ],
      },
    ],
    traps: [
      '"ago" ve "in 2010" gibi belirli geçmiş zaman ifadeleriyle present perfect kullanılmaz; V2 gelir.',
      '"by the time" geçmişle (V2) kullanıldığında diğer eylem had V3, gelecekle (present) kullanıldığında will have V3 olur.',
    ],
    exercises: [
      { q: 'Over the past two decades, the use of renewable energy ---- steadily in many developing countries.', options: ['rose', 'has risen', 'had risen', 'was rising', 'will rise'], answer: 1, why: '"Over the past two decades" geçmişten şimdiye uzanan bir süre bildirir → present perfect.' },
      { q: 'By the time the vaccine became widely available, the virus ---- to more than fifty countries.', options: ['spreads', 'has spread', 'had spread', 'would spread', 'is spreading'], answer: 2, why: '"By the time + V2 (became)": ondan önce tamamlanan eylem past perfect olur.' },
      { q: 'By the end of this decade, engineers ---- the first commercial fusion reactor, according to some forecasts.', options: ['will have built', 'have built', 'had built', 'built', 'are building'], answer: 0, why: '"By the end of this decade" gelecekte bir noktaya kadar tamamlanmayı anlatır → future perfect.' },
      { q: 'The ancient city ---- by an earthquake in 365 AD and never fully recovered.', options: ['has been destroyed', 'was destroyed', 'had been destroyed', 'is destroyed', 'will be destroyed'], answer: 1, why: 'Belirli geçmiş zaman (365 AD) → past simple; şehir yıkılan olduğu için edilgen.' },
      { q: 'Scientists ---- the migration of these birds since 1985, and the study is still continuing.', options: ['studied', 'had studied', 'have been studying', 'were studying', 'will study'], answer: 2, why: '"since 1985" + "still continuing": geçmişten bugüne süren süreç → present perfect continuous.' },
    ],
    patterns: [/\b(has|have|had|will have)( been)? \w+(ed|en|wn|ne|un|ght|lt)\b/, /\bwill (be|have)\b/, /\b(was|were|is|are) \w+ing\b/],
  },
  {
    id: 'kipler',
    title: 'Kipler (Modals)',
    icon: '🔮',
    summary: 'must have, can’t have, should have, needn’t have: geçmişe yönelik tahmin ve eleştiri.',
    ydsTip:
      'Cümlenin geri kalanı geçmişteyse (V2, "in ancient times") kip + have V3 ara. Kanıt güçlüyse must have, kanıt tersini gösteriyorsa can’t / couldn’t have, belirsizlik varsa may / might / could have, "yapmalıydı ama yapmadı" ise should have.',
    sections: [
      {
        heading: 'Geçmişe yönelik tahmin',
        points: [
          'must have V3: kesine yakın çıkarım ("-mış olmalı").',
          'can’t / couldn’t have V3: imkânsızlık ("-mış olamaz").',
          'may / might / could have V3: olasılık ("-mış olabilir").',
        ],
        examples: [
          { en: 'The ground is wet; it must have rained during the night.', tr: 'Yer ıslak; gece yağmur yağmış olmalı.' },
          { en: 'The manuscript can’t have been written in the 12th century, as that type of paper did not exist yet.', tr: 'O tür kâğıt henüz olmadığından el yazması 12. yüzyılda yazılmış olamaz.' },
        ],
      },
      {
        heading: 'Geçmişe yönelik eleştiri ve gereklilik',
        points: [
          'should have / ought to have V3: yapılması gerekirdi ama yapılmadı.',
          'needn’t have V3: gereksiz yere yapıldı.',
          'didn’t need to V1: gerek yoktu (büyük olasılıkla yapılmadı).',
        ],
        examples: [
          { en: 'You should have backed up your files before installing the update.', tr: 'Güncellemeyi kurmadan önce dosyalarını yedeklemeliydin.' },
          { en: 'We needn’t have booked a table; the restaurant was almost empty.', tr: 'Masa ayırtmamıza gerek yokmuş; restoran neredeyse boştu.' },
        ],
      },
      {
        heading: 'Şimdi ve gelecek',
        points: [
          'must: zorunluluk ya da güçlü çıkarım; have to: dış zorunluluk.',
          'may / might / could: olasılık; be able to: yetenek (tüm zamanlarda).',
          'had better V1: "-se iyi olur" (uyarı); would rather V1: tercih.',
        ],
      },
    ],
    traps: ['must not = yasak; don’t have to = gerek yok.', 'could have V3 "yapabilirdi" anlamında da kullanılır: fırsat vardı ama değerlendirilmedi.'],
    exercises: [
      { q: 'The dinosaurs ---- by a sudden catastrophe, since their fossils disappear abruptly from the geological record.', options: ['should have been wiped out', 'must have been wiped out', 'needn’t have been wiped out', 'would rather be wiped out', 'had better be wiped out'], answer: 1, why: 'Fosillerin aniden yok olması güçlü bir kanıt → must have V3 (çıkarım).' },
      { q: 'The painting ---- by Rembrandt himself; tests show that the canvas dates from fifty years after his death.', options: ['can’t have been painted', 'must have been painted', 'should have been painted', 'may be painted', 'had to be painted'], answer: 0, why: 'Kanıt tam tersini gösteriyor → can’t have V3 (imkânsızlık).' },
      { q: 'The engineers ---- the bridge more carefully; the cracks were visible long before it collapsed.', options: ['must have inspected', 'should have inspected', 'can’t have inspected', 'needn’t have inspected', 'would inspect'], answer: 1, why: 'Yapılması gereken ama yapılmayan bir iş → should have V3 (eleştiri).' },
      { q: 'It is not clear why the ship sank; it ---- an iceberg, or there ---- a fault in the hull.', options: ['may have hit / might have been', 'must hit / should be', 'should have hit / had been', 'can’t have hit / could be', 'had to hit / would have been'], answer: 0, why: '"It is not clear" belirsizlik bildirir → iki boşlukta da olasılık: may / might have V3.' },
      { q: 'We ---- so much food; only half of the guests turned up.', options: ['mustn’t have prepared', 'needn’t have prepared', 'can’t have prepared', 'may have prepared', 'would have prepared'], answer: 1, why: 'Yemek hazırlandı ama gereksizdi → needn’t have V3.' },
    ],
    patterns: [/\b(must|might|may|could|should|can'?t|can’t|cannot|couldn'?t|couldn’t|needn'?t|needn’t|ought to|would)( not)? (have|be)\b/, /^(must|might|may|could|should|can|would|ought to|had better|would rather)\b/],
  },
  {
    id: 'edilgen',
    title: 'Edilgen Yapı (Passive)',
    icon: '🔄',
    summary: 'be + V3: eylemi yapan değil, eylemden etkilenen öne çıkar.',
    ydsTip:
      'Boşluktan sonra nesne yoksa ve özne eylemi yapan değil etkilenen ise (bir köprü inşa edilir, bir ilaç keşfedilir) edilgen seçenek ara. "by …" ifadesi güçlü bir ipucudur. Sonra zamanı ayrıca kontrol et.',
    sections: [
      {
        heading: 'Kuruluş',
        points: [
          'Her zamanda: be’nin o zamandaki hâli + V3 (is built, was built, has been built, will be built, is being built).',
          'Kiplerle: must be done, should have been done.',
          'Eylemi yapan önemliyse by ile eklenir: "was designed by a Turkish architect".',
        ],
        examples: [
          { en: 'The results of the study will be published next month.', tr: 'Çalışmanın sonuçları gelecek ay yayımlanacak.' },
          { en: 'The old library is currently being renovated.', tr: 'Eski kütüphane şu anda yenileniyor.' },
        ],
      },
      {
        heading: 'Akademik kalıplar',
        points: [
          'It is believed / thought / estimated that + cümle.',
          'X is believed to V1 (şimdi) / X is believed to have V3 (geçmiş).',
          'have / get something done: işi başkasına yaptırmak (ettirgen).',
        ],
        examples: [
          { en: 'It is estimated that more than 7,000 languages are spoken today.', tr: 'Bugün 7.000’den fazla dil konuşulduğu tahmin ediliyor.' },
          { en: 'The pyramids are believed to have been built by paid workers.', tr: 'Piramitlerin ücretli işçiler tarafından inşa edildiğine inanılıyor.' },
        ],
      },
    ],
    traps: ['Geçişsiz fiiller (happen, occur, arise, appear, exist, emerge) edilgen yapılmaz: "was occurred" yanlıştır.', '"be + V-ing" (etken, süreç) ile "be + V3" (edilgen) karıştırılır: nesne var mı yok mu bak.'],
    exercises: [
      { q: 'Penicillin ---- by Alexander Fleming in 1928, almost by accident.', options: ['discovered', 'was discovered', 'has discovered', 'had discovered', 'is discovering'], answer: 1, why: 'Penisilin keşfedilen şeydir ve "by Fleming" var → edilgen; 1928 → geçmiş.' },
      { q: 'Several new species of frog ---- in the rainforest since the expedition began.', options: ['have been identified', 'identified', 'were identifying', 'have identified', 'are identified'], answer: 0, why: '"since" → present perfect; türler tanımlanan şeyler → edilgen.' },
      { q: 'The earthquake ---- at 3 a.m., when most people were asleep.', options: ['was occurred', 'occurred', 'has been occurred', 'was occurring by', 'is occurred'], answer: 1, why: '"occur" geçişsizdir, edilgen yapılmaz.' },
      { q: 'The Great Wall ---- to be visible from space, but this is actually a myth.', options: ['often claims', 'is often claimed', 'has often claimed', 'often claimed', 'was often claiming'], answer: 1, why: '"X is claimed to …" kalıbı: duvar iddia eden değil, hakkında iddia edilen.' },
      { q: 'The old library is currently ---- and will reopen next spring.', options: ['renovating', 'being renovated', 'renovated', 'been renovating', 'to renovate'], answer: 1, why: '"currently" → süreç; kütüphane yenilenen → is being V3.' },
    ],
    patterns: [/\b(is|are|was|were|be|been|being) \w+(ed|en|wn|ne|ght|lt|un)\b/, /\bby\b/],
  },
  {
    id: 'kosul',
    title: 'Koşul Cümleleri (If Clauses)',
    icon: '🔀',
    summary: 'If tipleri, unless, provided that, but for, wish ve if’siz (devrik) koşul.',
    ydsTip:
      'İki boşluklu sorularda iki tarafın uyumuna bak: had V3 ↔ would / could have V3; V2 ↔ would V1; geniş zaman ↔ will. Cümle Had / Were / Should ile başlıyorsa bu if’siz koşuldur.',
    sections: [
      {
        heading: 'Tipler',
        points: [
          'Tip 1 (gerçek, gelecek): If + geniş zaman, will V1.',
          'Tip 2 (şimdiki zamanda gerçek dışı): If + V2 (were), would V1.',
          'Tip 3 (geçmişte gerçek dışı): If + had V3, would / could have V3.',
          'Karma: If + had V3 (geçmiş), would V1 now (bugünkü sonuç).',
        ],
        examples: [
          { en: 'If global temperatures rise by two degrees, many coral reefs will disappear.', tr: 'Küresel sıcaklıklar iki derece artarsa birçok mercan resifi yok olacak.' },
          { en: 'If the city had invested in flood defences, the damage would have been far less severe.', tr: 'Şehir sel önlemlerine yatırım yapmış olsaydı hasar çok daha az olurdu.' },
        ],
      },
      {
        heading: 'If yerine geçenler',
        points: [
          'unless = if … not ("-medikçe").',
          'provided / providing (that), as long as, on condition that: "şartıyla".',
          'but for / without + isim: "… olmasaydı".',
          'otherwise: "aksi takdirde" (iki cümle arasında).',
          'in case: "… ihtimaline karşı" (koşul değil, önlem).',
        ],
        examples: [{ en: 'But for the support of volunteers, the project would have failed.', tr: 'Gönüllülerin desteği olmasaydı proje başarısız olurdu.' }],
      },
      {
        heading: 'Devrik koşul ve wish',
        points: [
          'Had + özne + V3 = If + had V3; Were + özne = If … were; Should + özne + V1 = If … should.',
          'wish / if only + V2 (şimdiki pişmanlık), + had V3 (geçmiş pişmanlık).',
        ],
        examples: [{ en: 'Had the warning been issued earlier, more people could have been evacuated.', tr: 'Uyarı daha erken yapılsaydı daha fazla insan tahliye edilebilirdi.' }],
      },
    ],
    traps: ['unless zaten olumsuz anlam taşır; "unless … not" çoğu zaman yanlıştır.', 'in case koşul değildir: "Take an umbrella in case it rains" = yağmur yağma ihtimaline karşı.'],
    exercises: [
      { q: 'If the dam ---- properly maintained, the village ---- flooded last spring.', options: ['had been / wouldn’t have been', 'was / won’t be', 'has been / wouldn’t be', 'were / will not be', 'would be / hadn’t been'], answer: 0, why: 'Geçmişte gerçekleşmemiş koşul (last spring) → Tip 3: had V3 / would have V3.' },
      { q: '---- the support of international donors, the hospital would have closed years ago.', options: ['Unless', 'But for', 'Provided that', 'As long as', 'In case'], answer: 1, why: 'Ardından isim öbeği geliyor ve anlam "olmasaydı" → but for.' },
      { q: 'You will not be admitted to the exam ---- you bring a valid identity card.', options: ['if', 'unless', 'provided that', 'as long as', 'whether'], answer: 1, why: '"Kimlik getirmedikçe alınmayacaksın" → unless (= if … not).' },
      { q: '---- the results been available earlier, the government could have acted sooner.', options: ['If', 'Were', 'Had', 'Should', 'Unless'], answer: 2, why: '"… been available" + "could have acted" → Tip 3 devrik: Had + özne + V3.' },
      { q: 'Many experts believe that if governments ---- more in education today, the economy ---- stronger in twenty years.', options: ['invest / will be', 'invested / would have been', 'had invested / will be', 'have invested / was', 'would invest / had been'], answer: 0, why: 'Gerçek bir gelecek olasılığı → Tip 1: geniş zaman / will.' },
    ],
    patterns: [/\b(unless|provided|providing|as long as|but for|otherwise|in case|on condition|if only|even if)\b/, /^(if|had|were|should|without)$/],
  },
  {
    id: 'sifat-cumlesi',
    title: 'Sıfat Cümleleri (Relative Clauses)',
    icon: '🔗',
    summary: 'who, which, whose, where, of which: bir ismi niteleyen yan cümleler ve kısaltmaları.',
    ydsTip:
      'Boşluktan önceki isme bak: insan → who / whom / whose; nesne → which; yer → where (ardından tam cümle) ya da which (ardından eksik cümle). Virgülden sonra "that" gelmez.',
    sections: [
      {
        heading: 'İlgi zamirleri',
        points: [
          'who: insan (özne); whom: insan (nesne, edattan sonra); whose: sahiplik ("-in … -ı").',
          'which: nesne ve hayvan; that: tanımlayıcı cümlede who / which yerine (virgülsüz).',
          'where: yer, when: zaman (ardından tam cümle gelir).',
          'Edat + which / whom: "the method on which the study is based".',
        ],
        examples: [
          { en: 'Marie Curie, who won two Nobel Prizes, was born in Warsaw.', tr: 'İki Nobel ödülü kazanan Marie Curie Varşova’da doğdu.' },
          { en: 'The region where the fossils were found is now a national park.', tr: 'Fosillerin bulunduğu bölge artık bir milli park.' },
        ],
      },
      {
        heading: 'Miktar + of whom / of which',
        points: ['most of whom, some of which, both of which, none of whom: virgülden sonra gelir, öncesindeki çoğul ismi niteler.'],
        examples: [{ en: 'The patients, many of whom were elderly, recovered fully.', tr: 'Çoğu yaşlı olan hastalar tamamen iyileşti.' }],
      },
      {
        heading: 'Kısaltma',
        points: [
          'Etken → V-ing: "people living in cities" (= who live).',
          'Edilgen → V3: "the documents found in the cave" (= which were found).',
          'the first / the only / the last + to V1: "the first woman to win the prize".',
        ],
      },
    ],
    traps: ['where ile which: "the city where I live" (tam cümle) / "the city which I visited" (nesne eksik).', 'whose’tan sonra isim gelir: "the scientist whose research …".'],
    exercises: [
      { q: 'The scientist ---- research changed our understanding of the brain received a lifetime award.', options: ['who', 'whose', 'whom', 'which', 'where'], answer: 1, why: 'Boşluktan sonra isim (research) var ve sahiplik anlatılıyor → whose.' },
      { q: 'Venice, ---- was built on more than a hundred small islands, is slowly sinking.', options: ['that', 'which', 'where', 'whose', 'what'], answer: 1, why: 'Virgülden sonra that kullanılmaz; ardından öznesi eksik cümle var → which.' },
      { q: 'The village ---- the ancient coins were discovered has attracted many archaeologists.', options: ['which', 'where', 'when', 'whom', 'that'], answer: 1, why: 'Yer bildiren isim + ardından tam cümle (the coins were discovered) → where.' },
      { q: 'The volunteers, most of ---- were university students, worked without pay.', options: ['who', 'whom', 'which', 'them', 'whose'], answer: 1, why: 'Edattan (of) sonra insan için whom kullanılır: most of whom.' },
      { q: 'The bridge ---- in 1890 is still used by thousands of cars every day.', options: ['building', 'built', 'was built', 'which built', 'to build'], answer: 1, why: 'Köprü inşa edilen → edilgen kısaltma V3 (= which was built).' },
    ],
    patterns: [/^(who|whom|whose|which|where|when|that)\b/, /\b(of whom|of which|in which|on which|by which|to whom)\b/],
  },
  {
    id: 'isim-cumlesi',
    title: 'İsim Cümleleri (Noun Clauses)',
    icon: '📦',
    summary: 'that, whether, what, how: cümlenin öznesi ya da nesnesi olan yan cümleler.',
    ydsTip:
      'Boşluk bir fiilin öznesi ya da nesnesi konumundaysa isim cümlesi ara. Ardından eksik (öznesi ya da nesnesi olmayan) cümle geliyorsa "what"; tam cümle ve evet/hayır anlamı varsa "whether"; tam cümle ve bilgi varsa "that".',
    sections: [
      {
        heading: 'Türler',
        points: [
          'that + tam cümle: "It is clear that …", "The fact that …".',
          'whether (or not) / if: evet-hayır belirsizliği. Cümle başında (özne olarak) yalnızca whether kullanılır.',
          'what = the thing that: ardından eksik cümle gelir.',
          'how, why, when, where, who + düz cümle düzeni (soru düzeni değil).',
        ],
        examples: [
          { en: 'What surprised the researchers most was the speed of the change.', tr: 'Araştırmacıları en çok şaşırtan şey değişimin hızıydı.' },
          { en: 'It is still unknown whether the drug has long-term side effects.', tr: 'İlacın uzun vadeli yan etkileri olup olmadığı hâlâ bilinmiyor.' },
          { en: 'Scientists cannot explain why some people are immune to the disease.', tr: 'Bilim insanları bazı insanların neden bu hastalığa bağışık olduğunu açıklayamıyor.' },
        ],
      },
    ],
    traps: ['Soru düzeni kullanılmaz: "why does it happen" değil "why it happens".', '"what" ile "that" karışır: what kendi içinde eksik cümle ister, that tam cümle.'],
    exercises: [
      { q: '---- the universe will continue to expand forever remains one of the great questions of cosmology.', options: ['That', 'What', 'Whether', 'Which', 'If'], answer: 2, why: 'Evet/hayır belirsizliği ve cümle başında özne → whether (if cümle başında özne olamaz).' },
      { q: '---- the team discovered in the tomb changed the history of the region.', options: ['That', 'What', 'Whether', 'Which', 'How'], answer: 1, why: '"discovered" fiilinin nesnesi eksik → what (= the thing that).' },
      { q: 'Researchers are trying to understand ---- some birds can navigate across thousands of kilometres.', options: ['what', 'how', 'which', 'whom', 'whose'], answer: 1, why: 'Ardından tam cümle ve "nasıl" anlamı → how.' },
      { q: 'It is widely accepted ---- regular exercise reduces the risk of heart disease.', options: ['what', 'that', 'whether', 'which', 'if'], answer: 1, why: '"It is accepted that + tam cümle" kalıbı.' },
      { q: 'Nobody knows exactly ---- the first humans arrived in the Americas.', options: ['when', 'what', 'which', 'that', 'whom'], answer: 0, why: 'Ardından tam cümle ve "ne zaman" anlamı → when.' },
    ],
    patterns: [/^(what|whether|how|why|that|whatever|whoever)$/, /\b(the fact that|whether or not)\b/],
  },
  {
    id: 'baglaclar',
    title: 'Zarf Cümleleri ve Bağlaçlar',
    icon: '🧷',
    summary: 'although / despite, because / because of, so that / in order to: anlam ilişkisi ve yapı.',
    ydsTip:
      'Önce iki cümle arasındaki anlam ilişkisini bul: zıtlık mı, sebep mi, amaç mı, sonuç mu, zaman mı? Sonra yapıya bak: ardından tam cümle geliyorsa bağlaç (although, because), isim öbeği geliyorsa edat (despite, because of).',
    sections: [
      {
        heading: 'Zıtlık',
        points: [
          'although, though, even though, while, whereas + cümle.',
          'despite, in spite of + isim / V-ing.',
          'while / whereas iki şeyi karşılaştırırken de kullanılır ("kuzey yağışlıyken güney kurak").',
        ],
        examples: [
          { en: 'Although the experiment failed, it provided valuable data.', tr: 'Deney başarısız olsa da değerli veriler sağladı.' },
          { en: 'Despite its small size, the country has a strong economy.', tr: 'Küçük olmasına rağmen ülkenin güçlü bir ekonomisi var.' },
        ],
      },
      {
        heading: 'Sebep ve amaç',
        points: [
          'because, since, as + cümle; because of, due to, owing to + isim.',
          'so that + cümle (genellikle can / could / will ile); in order to / so as to + V1.',
        ],
        examples: [{ en: 'Many species migrate south so that they can survive the winter.', tr: 'Birçok tür kışı atlatabilmek için güneye göç eder.' }],
      },
      {
        heading: 'Zaman ve sonuç',
        points: [
          'as soon as, once, until, by the time, whenever, while.',
          'so + sıfat / zarf + that; such + (a) sıfat + isim + that: "o kadar … ki".',
        ],
        examples: [{ en: 'The storm was so strong that thousands of trees were uprooted.', tr: 'Fırtına o kadar şiddetliydi ki binlerce ağaç kökünden söküldü.' }],
      },
    ],
    traps: ['"despite of" yoktur: despite ya da in spite of.', '"even if" (olsa bile, varsayım) ile "even though" (-e rağmen, gerçek) farklıdır.'],
    exercises: [
      { q: '---- the high cost of the treatment, many patients choose it because it is highly effective.', options: ['Although', 'Despite', 'Because', 'Even if', 'Whereas'], answer: 1, why: 'Zıtlık anlamı + ardından isim öbeği (the high cost) → despite.' },
      { q: 'Some animals hibernate ---- they can survive long periods without food.', options: ['so that', 'in order to', 'because of', 'such that', 'despite'], answer: 0, why: 'Amaç + ardından tam cümle (they can survive) → so that.' },
      { q: 'Northern regions receive heavy rainfall, ---- southern areas suffer from drought.', options: ['whereas', 'because', 'so that', 'unless', 'therefore'], answer: 0, why: 'İki bölge karşılaştırılıyor → whereas.' },
      { q: 'The road was closed ---- a landslide, so we had to take a longer route.', options: ['because', 'due to', 'although', 'so as to', 'in case'], answer: 1, why: 'Sebep + ardından isim öbeği → due to (because cümle ister).' },
      { q: 'The lecture was ---- complex that even the experts had difficulty following it.', options: ['such', 'so', 'too', 'enough', 'very'], answer: 1, why: 'so + sıfat + that ("o kadar … ki").' },
    ],
    patterns: [/\b(although|though|even though|whereas|while|despite|in spite of|because|since|as|so that|in order to|so as to|such|so|even if|once|until|as soon as|now that|lest)\b/],
  },
  {
    id: 'gecis-ifadeleri',
    title: 'Geçiş İfadeleri (Transitions)',
    icon: '↔️',
    summary: 'however, therefore, moreover, for instance: cloze ve paragraf sorularının anahtarı.',
    ydsTip:
      'Boşluktan önceki ve sonraki cümleyi Türkçe tek cümlede bağla: "ayrıca" mı, "ancak" mı, "bu nedenle" mi, "örneğin" mi, "aslında" mı? Seçeneklerde aynı anlamlı iki ifade varsa ikisi de büyük olasılıkla yanlıştır.',
    sections: [
      {
        heading: 'Anlamına göre gruplar',
        points: [
          'Ekleme: moreover, furthermore, in addition, besides, likewise, similarly.',
          'Zıtlık: however, nevertheless, nonetheless, on the other hand, in contrast, yet, still.',
          'Sonuç: therefore, thus, hence, consequently, as a result, accordingly.',
          'Örnek: for instance, for example, namely, in particular.',
          'Düzeltme / vurgu: in fact, indeed, on the contrary, in other words, in short.',
          'Seçenek: otherwise (aksi hâlde), instead (onun yerine).',
        ],
        examples: [
          { en: 'Solar panels have become much cheaper. As a result, they are now used even in remote villages.', tr: 'Güneş panelleri çok ucuzladı. Bunun sonucunda artık uzak köylerde bile kullanılıyor.' },
          { en: 'Many people think bats are blind. In fact, most bats can see quite well.', tr: 'Birçok kişi yarasaların kör olduğunu düşünür. Aslında çoğu yarasa oldukça iyi görür.' },
        ],
      },
    ],
    traps: [
      '"on the contrary" önceki ifadeyi reddeder; "in contrast" iki şeyi karşılaştırır.',
      'Bu ifadeler iki cümleyi virgülle bağlamaz; nokta ya da noktalı virgülden sonra gelir.',
    ],
    exercises: [
      { q: 'Solar panels have become much cheaper over the last decade. ----, they are now used even in remote villages.', options: ['However', 'As a result', 'On the contrary', 'Nevertheless', 'For instance'], answer: 1, why: 'Ucuzlama → yaygın kullanım: sebep-sonuç → as a result.' },
      { q: 'Many people believe that bats are blind. ----, most bats can see quite well.', options: ['In fact', 'Therefore', 'Similarly', 'Moreover', 'As a result'], answer: 0, why: 'Yaygın inancı düzelten gerçek bilgi → in fact.' },
      { q: 'The new policy reduced traffic in the city centre. ----, it improved air quality significantly.', options: ['However', 'Moreover', 'Otherwise', 'In contrast', 'Instead'], answer: 1, why: 'İkinci olumlu sonuç ekleniyor → moreover.' },
      { q: 'Some languages build words by adding many suffixes to a root. Turkish, ----, can express a whole sentence in a single long word.', options: ['for instance', 'however', 'therefore', 'otherwise', 'nevertheless'], answer: 0, why: 'Genel bilgiye örnek veriliyor → for instance.' },
      { q: 'The first study found a strong link between diet and memory. The second study, ----, found no such connection.', options: ['similarly', 'in contrast', 'as a result', 'in addition', 'for example'], answer: 1, why: 'İki çalışmanın sonuçları karşılaştırılıyor ve zıt → in contrast.' },
    ],
    patterns: [/^(however|moreover|furthermore|therefore|thus|hence|consequently|nevertheless|nonetheless|in contrast|on the contrary|on the other hand|for instance|for example|in fact|indeed|likewise|similarly|in addition|as a result|otherwise|instead|accordingly|besides|namely|in other words)\b/],
  },
  {
    id: 'edatlar',
    title: 'Edatlar ve Edat Öbekleri',
    icon: '📍',
    summary: 'due to, in terms of, regardless of, result in / from: isimden önce gelen kalıplar.',
    ydsTip:
      'Edattan sonra isim ya da V-ing gelir; boşluktan sonra tam cümle geliyorsa doğru cevap edat değil bağlaçtır. Fiil + edat kalıplarını (result in / from, consist of, depend on) birlikte ezberle.',
    sections: [
      {
        heading: 'Anlamına göre edat öbekleri',
        points: [
          'Sebep: due to, owing to, because of, on account of, as a result of, thanks to.',
          'Zıtlık: despite, in spite of, regardless of (… ne olursa olsun), notwithstanding.',
          'Ekleme / hariç: in addition to, as well as, apart from, besides, except for.',
          'Yerine: instead of, rather than, in place of.',
          'Açısından: in terms of, with regard to, as for, concerning, regarding.',
          'Yoluyla: by means of, through, via.',
        ],
        examples: [{ en: 'In terms of population, India has overtaken China.', tr: 'Nüfus bakımından Hindistan Çin’i geride bıraktı.' }],
      },
      {
        heading: 'Fiil / sıfat + edat kalıpları',
        points: [
          'result in (sonuç doğurmak) ↔ result from (… -den kaynaklanmak).',
          'consist of, depend on, contribute to, account for, lead to, focus on, rely on.',
          'be responsible for, be aware of, be capable of, be similar to, be different from.',
        ],
        examples: [
          { en: 'The disease results from a lack of vitamin D.', tr: 'Hastalık D vitamini eksikliğinden kaynaklanır.' },
          { en: 'A poor diet may result in serious health problems.', tr: 'Kötü beslenme ciddi sağlık sorunlarına yol açabilir.' },
        ],
      },
    ],
    traps: ['"apart from" hem "hariç" hem "-in yanı sıra" anlamına gelir; bağlama bak.', '"thanks to" olumlu, "due to / owing to" nötr sebep bildirir.'],
    exercises: [
      { q: 'The flight was delayed ---- bad weather conditions over the Alps.', options: ['because', 'owing to', 'although', 'so that', 'despite'], answer: 1, why: 'Sebep + ardından isim öbeği → owing to.' },
      { q: 'Smoking can result ---- serious lung diseases.', options: ['from', 'in', 'of', 'with', 'at'], answer: 1, why: 'Sigara sonuç doğurur → result in.' },
      { q: '---- cost, the new system is much more efficient than the old one.', options: ['In terms of', 'Instead of', 'Regardless', 'Owing', 'As if'], answer: 0, why: '"Maliyet açısından" → in terms of.' },
      { q: 'Water consists ---- hydrogen and oxygen.', options: ['in', 'from', 'of', 'with', 'on'], answer: 2, why: 'consist of: "-den oluşmak".' },
      { q: 'The festival will take place ---- the weather, as it is held indoors.', options: ['regardless of', 'because of', 'in addition', 'thanks', 'due'], answer: 0, why: 'Kapalı alanda olduğu için hava ne olursa olsun → regardless of.' },
    ],
    patterns: [/\b(due to|owing to|because of|thanks to|in terms of|regardless of|instead of|rather than|apart from|in addition to|as well as|with regard to|by means of|in favour of|on behalf of|in spite of|on account of)\b/, /^(in|on|at|of|for|from|with|by|to|into|over|under|through|within|among|between|across|about|against|without|behind|beyond|towards?|upon|onto|throughout|along|around|during)( \/ (in|on|at|of|for|from|with|by|to|into|over|under|through|within|among|between|across|about|against|without|behind|beyond|towards?|upon|onto|throughout|along|around|during))?$/],
  },
  {
    id: 'ing-to',
    title: 'Gerund ve Infinitive (-ing / to V)',
    icon: '🧬',
    summary: 'avoid -ing, tend to, look forward to -ing: fiilden sonra hangi yapı gelir?',
    ydsTip:
      'Boşluktan önceki fiili ya da edatı tanı. Edattan sonra her zaman -ing gelir (içinde "to" olan kalıplar dahil: look forward to, be used to, be committed to). YDS’de en sık: tend to, fail to, manage to, aim to, avoid -ing, involve -ing.',
    sections: [
      {
        heading: 'Fiile göre',
        points: [
          '-ing alanlar: avoid, enjoy, consider, deny, risk, suggest, involve, mind, postpone, keep, finish, practise.',
          'to V1 alanlar: afford, agree, aim, decide, fail, manage, plan, refuse, tend, seem, intend, attempt, hesitate.',
          'Anlamı değişenler: remember / forget + -ing (yapmış olmayı) ↔ + to (yapmayı); stop + -ing (bırakmak) ↔ + to (bir şey yapmak için durmak); try + -ing (deneme amaçlı) ↔ + to (çabalamak).',
        ],
        examples: [
          { en: 'The company decided to expand into Asian markets.', tr: 'Şirket Asya pazarlarına açılmaya karar verdi.' },
          { en: 'Many people avoid eating late at night.', tr: 'Birçok kişi gece geç saatte yemek yemekten kaçınır.' },
        ],
      },
      {
        heading: 'Diğer kullanımlar',
        points: [
          'Edattan sonra -ing: interested in learning, instead of driving, before leaving.',
          'Sıfat + to V1: it is difficult to …, too / enough + to V1.',
          'Geçmiş ve edilgen: to have V3, having V3, to be V3, being V3.',
        ],
        examples: [{ en: 'We look forward to hearing from you.', tr: 'Sizden haber almayı dört gözle bekliyoruz.' }],
      },
    ],
    traps: ['"to" bazen edattır: object to doing, be committed to doing, contribute to doing.', '"used to V1" (eskiden) ↔ "be used to V-ing" (alışkın olmak).'],
    exercises: [
      { q: 'Many young people tend ---- more time online than with their families.', options: ['spending', 'to spend', 'spend', 'spent', 'to spending'], answer: 1, why: 'tend + to V1.' },
      { q: 'The project involves ---- data from more than two thousand schools.', options: ['collecting', 'to collect', 'collect', 'collected', 'to collecting'], answer: 0, why: 'involve + V-ing.' },
      { q: 'Researchers are committed to ---- a cure for the disease.', options: ['find', 'finding', 'found', 'have found', 'be found'], answer: 1, why: 'be committed to: buradaki "to" edattır → V-ing.' },
      { q: 'I clearly remember ---- the documents on the desk, but now they are gone.', options: ['to leave', 'leaving', 'leave', 'to be leaving', 'left'], answer: 1, why: 'Geçmişte yaptığını hatırlamak → remember + V-ing.' },
      { q: 'The government failed ---- the economic crisis in time.', options: ['preventing', 'to prevent', 'prevent', 'to preventing', 'prevented'], answer: 1, why: 'fail + to V1.' },
    ],
    patterns: [/^to \w+$/, /^\w+ing$/, /^(to have|having|being|to be)\b/],
  },
  {
    id: 'karsilastirma',
    title: 'Karşılaştırma (Comparatives)',
    icon: '⚖️',
    summary: 'more … than, as … as, the more … the more, twice as … as.',
    ydsTip:
      'Boşluktan sonra "than" varsa karşılaştırma sıfatı, "as" varsa eşitlik yapısı ara. Cümle "The + comparative" ile başlıyorsa ikinci yarı da aynı yapıyla gelir.',
    sections: [
      {
        heading: 'Yapılar',
        points: [
          'Kısa sıfat -er / uzun sıfat more … than; less … than.',
          'as … as (eşit), not as / so … as (daha az), twice / three times as … as.',
          'the + -est / most: en …',
          'the more …, the more …: "ne kadar … o kadar …".',
          'Güçlendirme: much, far, considerably, significantly + comparative (very değil).',
          'similar to, different from, compared to / with, superior / inferior to.',
        ],
        examples: [
          { en: 'The more we learn about the brain, the more questions arise.', tr: 'Beyin hakkında ne kadar çok şey öğrenirsek o kadar çok soru ortaya çıkıyor.' },
          { en: 'Electric cars are far cheaper to run than petrol cars.', tr: 'Elektrikli arabaların kullanım maliyeti benzinlilerden çok daha düşük.' },
        ],
      },
    ],
    traps: ['"more better" ve "very bigger" yanlıştır: "much better".', 'superior / inferior "than" değil "to" alır.'],
    exercises: [
      { q: 'The ---- a city becomes, the more difficult it is to manage its traffic.', options: ['large', 'larger', 'largest', 'more large', 'as large'], answer: 1, why: '"the more …" ile eşleşen "the + comparative" → the larger.' },
      { q: 'Today’s computers are ---- more powerful than those of twenty years ago.', options: ['very', 'much', 'more', 'as', 'so'], answer: 1, why: 'Karşılaştırma sıfatını much güçlendirir; very kullanılmaz.' },
      { q: 'The new bridge is not ---- long as the old one, but it is much wider.', options: ['so', 'more', 'than', 'such', 'too'], answer: 0, why: 'not so / as … as: "… kadar … değil".' },
      { q: 'Mount Everest is ---- mountain in the world above sea level.', options: ['higher', 'the highest', 'as high', 'highest than', 'more high'], answer: 1, why: '"in the world" → üstünlük: the highest.' },
      { q: 'The population of the city is now three times ---- it was in 1950.', options: ['as large as', 'larger as', 'the largest', 'as larger than', 'more large than'], answer: 0, why: '"three times as … as" kalıbı.' },
    ],
    patterns: [/\b(more|less|than|most|least|fewer)\b/, /\bas \w+ as\b/, /^\w+(er|est)$/],
  },
  {
    id: 'miktar',
    title: 'Miktar İfadeleri ve Zamirler',
    icon: '🔢',
    summary: 'few / a few, little / a little, each, either, the number of, the other.',
    ydsTip:
      'İsmin sayılabilir olup olmadığını ve fiilin tekil / çoğul olduğunu kontrol et. few / little olumsuz ("çok az, yetersiz"), a few / a little olumlu ("birkaç, biraz") anlam taşır; cümlenin tonuna bak.',
    sections: [
      {
        heading: 'Kurallar',
        points: [
          'Sayılabilen çoğul: many, few, a few, several, a number of.',
          'Sayılamayan: much, little, a little, a great deal of, an amount of.',
          'each / every + tekil isim + tekil fiil; both (iki, çoğul fiil); either (ikisinden biri); neither (ikisi de değil).',
          'the number of + çoğul isim + TEKİL fiil; a number of + çoğul isim + ÇOĞUL fiil.',
          'İki şeyden: one … the other; ikiden fazla: one … another / others / the others; the former (ilki) / the latter (ikincisi).',
        ],
        examples: [
          { en: 'Few studies have examined this question, so our knowledge is limited.', tr: 'Bu soruyu inceleyen çok az çalışma var, bu yüzden bilgimiz sınırlı.' },
          { en: 'The number of tourists has doubled since 2015.', tr: 'Turist sayısı 2015’ten bu yana iki katına çıktı.' },
        ],
      },
    ],
    traps: ['"research, information, evidence, equipment, knowledge" sayılamaz: many değil much / little.', 'neither / either tek başına özne olduğunda fiil tekildir.'],
    exercises: [
      { q: '---- research has been done on the long-term effects of the drug, so doctors remain cautious.', options: ['Few', 'Little', 'A few', 'Many', 'Several'], answer: 1, why: '"research" sayılamaz ve anlam olumsuz (doktorlar temkinli) → little.' },
      { q: 'The number of students who study abroad ---- increased sharply.', options: ['have', 'has', 'are', 'were', 'being'], answer: 1, why: '"The number of" tekil fiil alır → has.' },
      { q: 'There are two possible explanations, but ---- of them is fully convincing.', options: ['neither', 'either', 'both', 'any', 'all'], answer: 0, why: 'İki şey + olumsuz anlam ("ama") + tekil fiil (is) → neither.' },
      { q: '---- participant in the study was given a questionnaire.', options: ['All', 'Each', 'Both', 'Most', 'Many'], answer: 1, why: 'Tekil isim (participant) + tekil fiil → each.' },
      { q: 'The museum has two famous paintings: one by Van Gogh and ---- by Monet.', options: ['another', 'other', 'the other', 'others', 'the others'], answer: 2, why: 'İki şeyden ikincisi → the other.' },
    ],
    patterns: [/^(few|little|a few|a little|much|many|each|every|both|either|neither|none|all|most|several|another|other|others|the other|the others|the former|the latter|a number of|the number of|any|some)\b/],
  },
  {
    id: 'cift-baglac',
    title: 'Çift Bağlaçlar ve Paralel Yapı',
    icon: '🪢',
    summary: 'both … and, either … or, neither … nor, not only … but also, whether … or.',
    ydsTip:
      'Seçeneklerde çift bağlacın ikinci parçasını ara: both → and, either → or, neither → nor, not only → but also, whether → or. İki boşluklu sorularda bu eşleşme çoğu zaman tek başına doğru cevabı verir.',
    sections: [
      {
        heading: 'Eşleşmeler',
        points: [
          'both A and B: ikisi de (çoğul fiil).',
          'either A or B: ya … ya; neither A nor B: ne … ne (fiil yakındaki özneye uyar).',
          'not only A but (also) B: sadece … değil, aynı zamanda …',
          'whether A or B: … olsun … olsun / … mı yoksa … mı.',
          'Paralel yapı: A ile B aynı türde olur (iki isim, iki fiil, iki sıfat).',
        ],
        examples: [
          { en: 'Neither the manager nor the employees were informed about the change.', tr: 'Değişiklik hakkında ne müdüre ne de çalışanlara bilgi verildi.' },
          { en: 'The project aims not only to protect wildlife but also to support local communities.', tr: 'Proje yalnızca yaban hayatını korumayı değil, yerel toplulukları desteklemeyi de amaçlıyor.' },
        ],
      },
    ],
    traps: ['"Not only" cümle başına gelirse devrik yapı gerekir: "Not only does it …".', '"neither … or" ve "either … nor" yanlış eşleşmelerdir.'],
    exercises: [
      { q: 'The new vaccine is ---- safe ---- effective, according to the trial results.', options: ['both / and', 'either / nor', 'neither / or', 'not only / and', 'whether / nor'], answer: 0, why: 'Doğru eşleşme both … and; anlam da "hem güvenli hem etkili".' },
      { q: '---- the students ---- the teacher knew the answer, so they looked it up online.', options: ['Either / or', 'Neither / nor', 'Both / and', 'Not only / but also', 'Whether / or'], answer: 1, why: 'Cevabı internetten aradılar → kimse bilmiyordu: neither … nor.' },
      { q: 'The museum is popular ---- with tourists ---- with local residents.', options: ['not only / but also', 'neither / or', 'either / nor', 'both / or', 'whether / and'], answer: 0, why: 'Doğru eşleşme not only … but also.' },
      { q: 'You can submit the form ---- online ---- by post.', options: ['both / nor', 'either / or', 'neither / and', 'not only / or', 'whether / nor'], answer: 1, why: 'İki seçenekten biri → either … or.' },
      { q: '---- the plan succeeds ---- fails depends largely on public support.', options: ['Whether / or', 'Either / nor', 'Both / and', 'Neither / or', 'Not only / but'], answer: 0, why: 'Cümlenin öznesi olan "başarılı mı başarısız mı" → whether … or.' },
    ],
    patterns: [/\b(both|either|neither|not only|whether|not)\b.*\/.*\b(and|or|nor|but also|but)\b/],
  },
  {
    id: 'devrik',
    title: 'Devrik Yapılar (Inversion)',
    icon: '🙃',
    summary: 'Never, Rarely, No sooner, Only after, Not until ile başlayan cümlelerde soru düzeni.',
    ydsTip:
      'Cümle Never, Rarely, Seldom, Hardly, No sooner, Little, Only, Not until, Not only gibi olumsuz / sınırlayıcı bir ifadeyle başlıyorsa devamında soru düzeni (yardımcı fiil + özne) olan seçeneği seç.',
    sections: [
      {
        heading: 'Kalıplar',
        points: [
          'Never / Rarely / Seldom + yardımcı fiil + özne: "Rarely have we seen …".',
          'Hardly / Scarcely … when; No sooner … than: "No sooner had the meeting started than …".',
          'Only after / Only when / Not until + yan cümle, ardından ana cümle devrik: "Only after the data was checked did they publish it".',
          'Little did + özne + V1: "Little did they know …".',
          'Koşul: Had / Were / Should + özne (bkz. Koşul Cümleleri).',
        ],
        examples: [
          { en: 'Never before had the city experienced such a severe drought.', tr: 'Şehir daha önce hiç bu kadar şiddetli bir kuraklık yaşamamıştı.' },
          { en: 'Only after the experiment was repeated did the researchers trust the results.', tr: 'Araştırmacılar sonuçlara ancak deney tekrarlandıktan sonra güvendi.' },
        ],
      },
    ],
    traps: ['Only after / Not until ile kurulan cümlede devriklik ilk yan cümlede değil ana cümlede olur.', 'Geniş ve geçmiş zamanda yardımcı fiil yoksa do / does / did eklenir.'],
    exercises: [
      { q: 'Rarely ---- such a large number of birds in one place.', options: ['we have seen', 'have we seen', 'we saw', 'seen we have', 'did we saw'], answer: 1, why: '"Rarely" başta → yardımcı fiil + özne: have we seen.' },
      { q: 'No sooner ---- the plane taken off than the storm began.', options: ['had', 'has', 'did', 'was', 'have'], answer: 0, why: '"No sooner … than" + V3 (taken) → had.' },
      { q: 'Only when the results were published ---- the importance of the discovery.', options: ['the public realised', 'did the public realise', 'the public did realise', 'realised the public', 'had realised the public'], answer: 1, why: '"Only when + yan cümle" sonrası ana cümle devrik: did + özne + V1.' },
      { q: 'Not only ---- the new law protect workers, but it also encourages investment.', options: ['it does', 'does', 'is', 'did it', 'it'], answer: 1, why: '"Not only" başta → does + özne (the new law) + V1.' },
      { q: 'Little ---- that their small experiment would change the world.', options: ['they knew', 'did they know', 'they did know', 'knew they', 'had known they'], answer: 1, why: '"Little" başta → did + özne + V1.' },
    ],
    patterns: [/^(had|has|have|did|does|do|was|were|is|are|should|could|would|can) (we|they|he|she|it|the|i|you|these|those|this|that|scientists|people)\b/],
  },
]

/** Konu kimliğinden konu. */
export function getGrammarTopic(id: string): GrammarTopic | undefined {
  return GRAMMAR_TOPICS.find((t) => t.id === id)
}

/**
 * Bir çıkmış sorunun şıklarına bakarak ilgili dilbilgisi konularını tahmin eder (en çok 2).
 * Bir konunun kalıbına en az iki şık uymalıdır; aksi hâlde boş döner.
 */
export function guessGrammarTopics(options: string[]): GrammarTopic[] {
  const opts = options.map((o) => o.trim().toLowerCase().replace(/[.,;]$/, ''))
  return GRAMMAR_TOPICS.map((t) => ({ t, score: opts.filter((o) => t.patterns.some((re) => re.test(o))).length }))
    .filter((x) => x.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map((x) => x.t)
}

