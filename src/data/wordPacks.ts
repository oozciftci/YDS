import type { CreateWordInput } from '../services/words'

export interface WordPack {
  id: string
  title: string
  level: 'Başlangıç (A1-A2)' | 'Orta (B1-B2)' | 'İleri / Sınav (C1-C2)'
  badge: string
  description: string
  targetExam: string
  words: CreateWordInput[]
}

/**
 * 1. YDS & YÖKDİL Akademik Çekirdek Kelimeler (C1-C2 İleri Düzey)
 * ÖSYM sınavlarında paragraf, kelime ve çeviri sorularında en belirleyici kelimeler.
 */
const YDS_ACADEMIC_PACK: WordPack = {
  id: 'yds_academic_core',
  title: 'YDS & YÖKDİL Akademik Çekirdek',
  level: 'İleri / Sınav (C1-C2)',
  badge: 'C1-C2',
  description: 'ÖSYM sınavlarında en sık sorulan akademik fiiller, sıfatlar ve isimler. Eş anlamlıları ve çift dilli örnek cümleleriyle.',
  targetExam: 'YDS, YÖKDİL, YDT, TOEFL',
  words: [
    {
      term: 'deteriorate',
      definition: 'kötüleşmek, bozulmak, fenalaşmak',
      partOfSpeech: 'verb',
      synonyms: ['worsen', 'decline', 'degenerate', 'decay'],
      tags: ['YDS-Akademik', 'C1-İleri', 'Fiil', 'Sağlık'],
      difficulty: 4,
      sentences: [
        {
          en: 'The patient’s medical condition began to deteriorate rapidly overnight.',
          tr: 'Hastanın tıbbi durumu gece boyunca hızla kötüleşmeye başladı.',
        },
      ],
    },
    {
      term: 'abolish',
      definition: 'yürürlükten kaldırmak, feshetmek, kanunen son vermek',
      partOfSpeech: 'verb',
      synonyms: ['terminate', 'eliminate', 'repeal', 'nullify'],
      tags: ['YDS-Akademik', 'C1-İleri', 'Fiil', 'Hukuk'],
      difficulty: 4,
      sentences: [
        {
          en: 'Several countries have voted to abolish capital punishment permanently.',
          tr: 'Birçok ülke idam cezasını kalıcı olarak yürürlükten kaldırma yönünde oy kullandı.',
        },
      ],
    },
    {
      term: 'scrutinize',
      definition: 'dikkatle ve derinlemesine incelemek, mercek altına almak',
      partOfSpeech: 'verb',
      synonyms: ['examine', 'inspect', 'investigate', 'audit'],
      tags: ['YDS-Akademik', 'C1-İleri', 'Fiil', 'Bilim'],
      difficulty: 4,
      sentences: [
        {
          en: 'Financial regulators scrutinize every transaction made by investment banks.',
          tr: 'Finansal düzenleyiciler, yatırım bankaları tarafından yapılan her işlemi dikkatle inceler.',
        },
      ],
    },
    {
      term: 'unprecedented',
      definition: 'eşi benzeri görülmemiş, emsalsiz, tarihte ilk kez yaşanan',
      partOfSpeech: 'adjective',
      synonyms: ['unparalleled', 'exceptional', 'groundbreaking', 'novel'],
      tags: ['YDS-Akademik', 'C1-İleri', 'Sıfat', 'Ekonomi'],
      difficulty: 4,
      sentences: [
        {
          en: 'The global market experienced an unprecedented economic expansion this decade.',
          tr: 'Küresel piyasa, bu on yılda eşi benzeri görülmemiş bir ekonomik büyüme yaşadı.',
        },
      ],
    },
    {
      term: 'mitigate',
      definition: 'hafifletmek, yatıştırmak, olumsuz etkisini azaltmak',
      partOfSpeech: 'verb',
      synonyms: ['alleviate', 'ease', 'lessen', 'moderate'],
      tags: ['YDS-Akademik', 'C1-İleri', 'Fiil', 'Çevre'],
      difficulty: 4,
      sentences: [
        {
          en: 'Emergency measures were taken to mitigate the environmental impact of the oil spill.',
          tr: 'Petrol sızıntısının çevresel etkisini hafifletmek için acil önlemler alındı.',
        },
      ],
    },
    {
      term: 'undermine',
      definition: 'zayıflatmak, baltalamak, temelini sarsmak',
      partOfSpeech: 'verb',
      synonyms: ['weaken', 'sabotage', 'impair', 'compromise'],
      tags: ['YDS-Akademik', 'C1-İleri', 'Fiil', 'Politika'],
      difficulty: 4,
      sentences: [
        {
          en: 'High inflation rates can undermine public confidence in national currency.',
          tr: 'Yüksek enflasyon oranları, ulusal para birimine olan kamu güvenini sarsabilir.',
        },
      ],
    },
    {
      term: 'resilient',
      definition: 'çabuk toparlanan, dirençli, esnek ve güçlü',
      partOfSpeech: 'adjective',
      synonyms: ['tough', 'durable', 'hardy', 'tenacious'],
      tags: ['YDS-Akademik', 'C1-İleri', 'Sıfat', 'Psikoloji'],
      difficulty: 4,
      sentences: [
        {
          en: 'Children are remarkably resilient and often adapt quickly to new surroundings.',
          tr: 'Çocuklar son derece dirençlidir ve genellikle yeni ortamlara hızla uyum sağlarlar.',
        },
      ],
    },
    {
      term: 'lucrative',
      definition: 'kazançlı, çok karlı, bol gelir getiren',
      partOfSpeech: 'adjective',
      synonyms: ['profitable', 'rewarding', 'gainful', 'remunerative'],
      tags: ['YDS-Akademik', 'C1-İleri', 'Sıfat', 'Ekonomi'],
      difficulty: 3,
      sentences: [
        {
          en: 'The tech company signed a lucrative contract with European aerospace leaders.',
          tr: 'Teknoloji şirketi, Avrupalı havacılık liderleriyle çok kazançlı bir sözleşme imzaladı.',
        },
      ],
    },
    {
      term: 'comprehensive',
      definition: 'kapsamlı, geniş çaplı, eksiksiz',
      partOfSpeech: 'adjective',
      synonyms: ['thorough', 'extensive', 'exhaustive', 'broad'],
      tags: ['YDS-Akademik', 'C1-İleri', 'Sıfat', 'Eğitim'],
      difficulty: 3,
      sentences: [
        {
          en: 'The university publishes a comprehensive guide for international postgraduates.',
          tr: 'Üniversite, uluslararası lisansüstü öğrenciler için kapsamlı bir rehber yayımlıyor.',
        },
      ],
    },
    {
      term: 'ambiguous',
      definition: 'belirsiz, muğlak, birden fazla anlama gelebilen',
      partOfSpeech: 'adjective',
      synonyms: ['vague', 'unclear', 'obscure', 'equivocal'],
      tags: ['YDS-Akademik', 'C1-İleri', 'Sıfat', 'Hukuk'],
      difficulty: 4,
      sentences: [
        {
          en: 'The legal clauses in the treaty were dangerously ambiguous to both parties.',
          tr: 'Anlaşmadaki yasal maddeler her iki taraf için de tehlikeli derecede muğlaktı.',
        },
      ],
    },
    {
      term: 'deplete',
      definition: 'tüketmek, bitirmek, kaynaklarını kurutmak',
      partOfSpeech: 'verb',
      synonyms: ['exhaust', 'drain', 'consume', 'impoverish'],
      tags: ['YDS-Akademik', 'C1-İleri', 'Fiil', 'Çevre'],
      difficulty: 4,
      sentences: [
        {
          en: 'Excessive groundwater extraction threatens to deplete freshwater reserves.',
          tr: 'Aşırı yeraltı suyu çekimi, tatlı su rezervlerini tüketme tehlikesi taşımaktadır.',
        },
      ],
    },
    {
      term: 'facilitate',
      definition: 'kolaylaştırmak, olanak sağlamak, önünü açmak',
      partOfSpeech: 'verb',
      synonyms: ['ease', 'enable', 'assist', 'promote'],
      tags: ['YDS-Akademik', 'C1-İleri', 'Fiil', 'Yönetim'],
      difficulty: 3,
      sentences: [
        {
          en: 'Modern high-speed rail networks facilitate economic cooperation across regions.',
          tr: 'Modern yüksek hızlı tren ağları, bölgeler arası ekonomik iş birliğini kolaylaştırır.',
        },
      ],
    },
    {
      term: 'jeopardize',
      definition: 'tehlikeye atmak, riske sokmak',
      partOfSpeech: 'verb',
      synonyms: ['endanger', 'imperil', 'threaten', 'compromise'],
      tags: ['YDS-Akademik', 'C1-İleri', 'Fiil', 'Güvenlik'],
      difficulty: 4,
      sentences: [
        {
          en: 'Careless disclosures of confidential research can jeopardize scientific patents.',
          tr: 'Gizli araştırmaların dikkatsizce ifşa edilmesi bilimsel patentleri tehlikeye atabilir.',
        },
      ],
    },
    {
      term: 'plausible',
      definition: 'makul, akla yatkın, inandırıcı',
      partOfSpeech: 'adjective',
      synonyms: ['reasonable', 'credible', 'believable', 'feasible'],
      tags: ['YDS-Akademik', 'C1-İleri', 'Sıfat', 'Mantık'],
      difficulty: 4,
      sentences: [
        {
          en: 'Physicists offered a plausible explanation for the unexpected anomaly.',
          tr: 'Fizikçiler beklenmedik anormallik için akla yatkın bir açıklama sundular.',
        },
      ],
    },
    {
      term: 'reinforce',
      definition: 'güçlendirmek, pekiştirmek, takviye etmek',
      partOfSpeech: 'verb',
      synonyms: ['strengthen', 'fortify', 'bolster', 'consolidate'],
      tags: ['YDS-Akademik', 'C1-İleri', 'Fiil', 'Eğitim'],
      difficulty: 3,
      sentences: [
        {
          en: 'Regular practice and revision reinforce newly acquired language skills.',
          tr: 'Düzenli pratik ve tekrar, yeni edinilen dil becerilerini pekiştirir.',
        },
      ],
    },
    {
      term: 'vulnerable',
      definition: 'savunmasız, hassas, kolay incinir, açık hedef',
      partOfSpeech: 'adjective',
      synonyms: ['susceptible', 'defenceless', 'exposed', 'fragile'],
      tags: ['YDS-Akademik', 'C1-İleri', 'Sıfat', 'Toplum'],
      difficulty: 4,
      sentences: [
        {
          en: 'Coastal settlements remain vulnerable to severe storms and rising sea levels.',
          tr: 'Kıyı yerleşimleri şiddetli fırtınalara ve yükselen deniz seviyelerine karşı savunmasız kalmaktadır.',
        },
      ],
    },
    {
      term: 'obsolete',
      definition: 'modası geçmiş, kullanımdan kalkmış, eskimiş',
      partOfSpeech: 'adjective',
      synonyms: ['outdated', 'archaic', 'antiquated', 'defunct'],
      tags: ['YDS-Akademik', 'C1-İleri', 'Sıfat', 'Teknoloji'],
      difficulty: 4,
      sentences: [
        {
          en: 'Rapid advances in artificial intelligence quickly render older algorithms obsolete.',
          tr: 'Yapay zekadaki hızlı ilerlemeler, eski algoritmaları hızla kullanımdan kaldırmaktadır.',
        },
      ],
    },
    {
      term: 'prevalent',
      definition: 'yaygın, hakim, sıklıkla görülen',
      partOfSpeech: 'adjective',
      synonyms: ['widespread', 'common', 'rampant', 'predominant'],
      tags: ['YDS-Akademik', 'C1-İleri', 'Sıfat', 'Sosyoloji'],
      difficulty: 4,
      sentences: [
        {
          en: 'Respiratory illnesses are especially prevalent during cold winter months.',
          tr: 'Solunum yolu hastalıkları özellikle soğuk kış aylarında yaygındır.',
        },
      ],
    },
    {
      term: 'volatile',
      definition: 'istikrarsız, dalgalı, hızla değişen, uçucu',
      partOfSpeech: 'adjective',
      synonyms: ['unstable', 'erratic', 'capricious', 'fluctuating'],
      tags: ['YDS-Akademik', 'C1-İleri', 'Sıfat', 'Finans'],
      difficulty: 4,
      sentences: [
        {
          en: 'Energy prices remain volatile due to political tensions across global oil hubs.',
          tr: 'Küresel petrol merkezlerindeki siyasi gerilimler nedeniyle enerji fiyatları istikrarsız kalmaya devam ediyor.',
        },
      ],
    },
    {
      term: 'endorse',
      definition: 'onaylamak, resmi olarak desteklemek, arka çıkmak',
      partOfSpeech: 'verb',
      synonyms: ['support', 'approve', 'back', 'sanction'],
      tags: ['YDS-Akademik', 'C1-İleri', 'Fiil', 'Politika'],
      difficulty: 3,
      sentences: [
        {
          en: 'Medical associations strongly endorse vaccination campaigns against epidemic viruses.',
          tr: 'Tıp dernekleri salgın virüslere karşı aşılama kampanyalarını güçlü bir şekilde desteklemektedir.',
        },
      ],
    },
    {
      term: 'fluctuate',
      definition: 'dalgalanmak, iniş çıkış göstermek, istikrarsız seyretmek',
      partOfSpeech: 'verb',
      synonyms: ['oscillate', 'vary', 'shift', 'alternate'],
      tags: ['YDS-Akademik', 'C1-İleri', 'Fiil', 'Ekonomi'],
      difficulty: 3,
      sentences: [
        {
          en: 'Exchange rates fluctuate constantly depending on macroeconomic indicators.',
          tr: 'Döviz kurları makroekonomik göstergelere bağlı olarak sürekli dalgalanır.',
        },
      ],
    },
    {
      term: 'distort',
      definition: 'çarpıtmak, tahrif etmek, gerçeği saptırmak',
      partOfSpeech: 'verb',
      synonyms: ['misrepresent', 'twist', 'falsify', 'pervert'],
      tags: ['YDS-Akademik', 'C1-İleri', 'Fiil', 'Medya'],
      difficulty: 4,
      sentences: [
        {
          en: 'Sensational headlines often distort scientific research to attract clicks.',
          tr: 'Sansasyonel manşetler, tıklama almak uğruna bilimsel araştırmaları sıklıkla çarpıtır.',
        },
      ],
    },
    {
      term: 'enhance',
      definition: 'artırmak, yükseltmek, niteliğini geliştirmek',
      partOfSpeech: 'verb',
      synonyms: ['improve', 'boost', 'augment', 'enrich'],
      tags: ['YDS-Akademik', 'C1-İleri', 'Fiil', 'Gelişim'],
      difficulty: 3,
      sentences: [
        {
          en: 'Consistent reading habits enhance analytical reasoning and working memory.',
          tr: 'Düzenli okuma alışkanlığı, analitik muhakemeyi ve çalışma belleğini geliştirir.',
        },
      ],
    },
    {
      term: 'induce',
      definition: 'tetiklemek, yol açmak, teşvik etmek',
      partOfSpeech: 'verb',
      synonyms: ['cause', 'prompt', 'provoke', 'stimulate'],
      tags: ['YDS-Akademik', 'C1-İleri', 'Fiil', 'Tıp'],
      difficulty: 4,
      sentences: [
        {
          en: 'Severe emotional stress can induce physiological cardiovascular symptoms.',
          tr: 'Şiddetli duygusal stres, fizyolojik kardiyovasküler semptomları tetikleyebilir.',
        },
      ],
    },
    {
      term: 'intervene',
      definition: 'müdahale etmek, araya girmek, devreye girmek',
      partOfSpeech: 'verb',
      synonyms: ['interfere', 'step in', 'mediate', 'arbitrate'],
      tags: ['YDS-Akademik', 'C1-İleri', 'Fiil', 'Diplomasi'],
      difficulty: 3,
      sentences: [
        {
          en: 'International peacekeepers were deployed to intervene before hostilities erupted.',
          tr: 'Çatışmalar patlak vermeden önce müdahale etmek amacıyla uluslararası barış gücü konuşlandırıldı.',
        },
      ],
    },
    {
      term: 'perpetuate',
      definition: 'sürekli kılmak, ebedileştirmek, devam ettirmek',
      partOfSpeech: 'verb',
      synonyms: ['sustain', 'prolong', 'maintain', 'immortalize'],
      tags: ['YDS-Akademik', 'C1-İleri', 'Fiil', 'Kültür'],
      difficulty: 5,
      sentences: [
        {
          en: 'Biased curriculum materials can perpetuate outdated social stereotypes.',
          tr: 'Önyargılı müfredat materyalleri, modası geçmiş toplumsal klişeleri sürdürebilir.',
        },
      ],
    },
    {
      term: 'suppress',
      definition: 'bastırmak, gizlemek, kontrol altına alıp engellemek',
      partOfSpeech: 'verb',
      synonyms: ['stifle', 'repress', 'subdue', 'quell'],
      tags: ['YDS-Akademik', 'C1-İleri', 'Fiil', 'Biyoloji'],
      difficulty: 4,
      sentences: [
        {
          en: 'Immunosuppressive drugs suppress hostile immune reactions following organ transplants.',
          tr: 'Bağışıklık baskılayıcı ilaçlar, organ nakillerinin ardından oluşan düşmanca bağışıklık tepkilerini bastırır.',
        },
      ],
    },
    {
      term: 'reluctant',
      definition: 'isteksiz, gönülsüz, tereddüt eden',
      partOfSpeech: 'adjective',
      synonyms: ['unwilling', 'hesitant', 'disinclined', 'loath'],
      tags: ['YDS-Akademik', 'C1-İleri', 'Sıfat', 'Psikoloji'],
      difficulty: 3,
      sentences: [
        {
          en: 'Investors were reluctant to finance unproven deep-tech startup projects.',
          tr: 'Yatırımcılar, henüz kanıtlanmamış derin teknoloji girişim projelerini finanse etme konusunda isteksizdi.',
        },
      ],
    },
    {
      term: 'advocate',
      definition: 'savunmak, desteklemek, arkasında durmak',
      partOfSpeech: 'verb',
      synonyms: ['support', 'champion', 'promote', 'endorse'],
      tags: ['YDS-Akademik', 'C1-İleri', 'Fiil', 'Hukuk'],
      difficulty: 3,
      sentences: [
        {
          en: 'Human rights organizations advocate stronger safeguards for migrant workers.',
          tr: 'İnsan hakları örgütleri, göçmen işçiler için daha güçlü koruma mekanizmalarını savunmaktadır.',
        },
      ],
    },
    {
      term: 'coherent',
      definition: 'tutarlı, mantıklı, ahenkli ve anlaşılır',
      partOfSpeech: 'adjective',
      synonyms: ['logical', 'consistent', 'articulate', 'lucid'],
      tags: ['YDS-Akademik', 'C1-İleri', 'Sıfat', 'Felsefe'],
      difficulty: 4,
      sentences: [
        {
          en: 'The researcher failed to provide a coherent rationale for her experimental methodology.',
          tr: 'Araştırmacı, deney metodolojisi için tutarlı bir gerekçe sunamadı.',
        },
      ],
    },
  ],
}

/**
 * 2. YDS Sınav Belirleyici Phrasal Verbs & Prepositional Kalıplar (B2 - C1)
 */
const YDS_PHRASAL_PACK: WordPack = {
  id: 'yds_phrasal_verbs',
  title: 'YDS & YÖKDİL En Çok Çıkan Phrasal Verbs',
  level: 'Orta (B1-B2)',
  badge: 'B2-C1',
  description: 'YDS sınav sorularında doğrudan puan kazandıran, en çok test edilen edatlı fiiller (phrasal verbs).',
  targetExam: 'YDS, YÖKDİL, YDT',
  words: [
    {
      term: 'bring about',
      definition: 'neden olmak, yol açmak, beraberinde getirmek',
      partOfSpeech: 'phrasal_verb',
      synonyms: ['cause', 'lead to', 'generate', 'trigger'],
      tags: ['YDS-Phrasal', 'Phrasal-Verb', 'B2-Orta'],
      difficulty: 3,
      sentences: [
        {
          en: 'Technological innovations brought about profound transformations in commerce.',
          tr: 'Teknolojik yenilikler ticarette köklü dönüşümlere yol açtı.',
        },
      ],
    },
    {
      term: 'carry out',
      definition: 'yürütmek, gerçekleştirmek, uygulamaya koymak',
      partOfSpeech: 'phrasal_verb',
      synonyms: ['execute', 'perform', 'conduct', 'implement'],
      tags: ['YDS-Phrasal', 'Phrasal-Verb', 'B2-Orta'],
      difficulty: 3,
      sentences: [
        {
          en: 'Independent scientists carry out randomized controlled trials to verify drug safety.',
          tr: 'Bağımsız bilim insanları ilaç güvenliğini doğrulamak için randomize kontrollü deneyler yürütür.',
        },
      ],
    },
    {
      term: 'cope with',
      definition: 'başa çıkmak, üstesinden gelmek, göğüs germek',
      partOfSpeech: 'phrasal_verb',
      synonyms: ['deal with', 'handle', 'manage', 'tackle'],
      tags: ['YDS-Phrasal', 'Phrasal-Verb', 'B2-Orta'],
      difficulty: 3,
      sentences: [
        {
          en: 'Developing nations struggle to cope with the severe repercussions of climate droughts.',
          tr: 'Gelişmekte olan ülkeler iklim kuraklıklarının ağır sonuçlarıyla başa çıkmakta zorlanmaktadır.',
        },
      ],
    },
    {
      term: 'rely on',
      definition: 'güvenmek, bel bağlamak, muhtaç olmak',
      partOfSpeech: 'phrasal_verb',
      synonyms: ['depend on', 'count on', 'trust', 'hinge on'],
      tags: ['YDS-Phrasal', 'Phrasal-Verb', 'B2-Orta'],
      difficulty: 2,
      sentences: [
        {
          en: 'Modern autonomous vehicles rely heavily on real-time sensor processing.',
          tr: 'Modern otonom araçlar büyük ölçüde gerçek zamanlı sensör işlemeye bel bağlar.',
        },
      ],
    },
    {
      term: 'account for',
      definition: 'açıklamak; oluşturmak, tekabül etmek (-den sorumlu olmak)',
      partOfSpeech: 'phrasal_verb',
      synonyms: ['explain', 'constitute', 'make up', 'represent'],
      tags: ['YDS-Phrasal', 'Phrasal-Verb', 'B2-C1'],
      difficulty: 4,
      sentences: [
        {
          en: 'Renewable energy sources now account for over forty percent of total electricity generation.',
          tr: 'Yenilenebilir enerji kaynakları artık toplam elektrik üretiminin yüzde kırkından fazlasını oluşturuyor.',
        },
      ],
    },
    {
      term: 'call off',
      definition: 'iptal etmek, vazgeçmek',
      partOfSpeech: 'phrasal_verb',
      synonyms: ['cancel', 'abandon', 'abort', 'drop'],
      tags: ['YDS-Phrasal', 'Phrasal-Verb', 'B2-Orta'],
      difficulty: 3,
      sentences: [
        {
          en: 'The airline decided to call off all scheduled departures due to heavy blizzards.',
          tr: 'Havayolu şirketi şiddetli kar fırtınası nedeniyle planlanan tüm seferleri iptal etmeye karar verdi.',
        },
      ],
    },
    {
      term: 'put off',
      definition: 'ertelemek, ileri bir tarihe bırakmak',
      partOfSpeech: 'phrasal_verb',
      synonyms: ['postpone', 'delay', 'defer', 'suspend'],
      tags: ['YDS-Phrasal', 'Phrasal-Verb', 'B2-Orta'],
      difficulty: 3,
      sentences: [
        {
          en: 'Diplomats chose to put off the peace summit until key ambassadors could assemble.',
          tr: 'Diplomatlar, kilit büyükelçiler toplanana kadar barış zirvesini ertelemeyi tercih etti.',
        },
      ],
    },
    {
      term: 'figure out',
      definition: 'anlamak, çözmek, hesaplamak, kavramak',
      partOfSpeech: 'phrasal_verb',
      synonyms: ['understand', 'solve', 'fathom', 'work out'],
      tags: ['YDS-Phrasal', 'Phrasal-Verb', 'B2-Orta'],
      difficulty: 2,
      sentences: [
        {
          en: 'Software engineers worked tirelessly to figure out the root cause of the memory leak.',
          tr: 'Yazılım mühendisleri bellek sızıntısının kök nedenini çözmek için yorulmadan çalıştı.',
        },
      ],
    },
    {
      term: 'keep up with',
      definition: 'ayak uydurmak, hızına yetişmek, geride kalmamak',
      partOfSpeech: 'phrasal_verb',
      synonyms: ['keep pace with', 'match', 'follow', 'stay abreast of'],
      tags: ['YDS-Phrasal', 'Phrasal-Verb', 'B2-Orta'],
      difficulty: 3,
      sentences: [
        {
          en: 'Regulatory laws often lag behind and fail to keep up with rapid technological changes.',
          tr: 'Düzenleyici yasalar çoğu zaman geride kalır ve hızlı teknolojik değişimlere ayak uyduramaz.',
        },
      ],
    },
    {
      term: 'make up for',
      definition: 'telafi etmek, açığı kapatmak, bedelini ödemek',
      partOfSpeech: 'phrasal_verb',
      synonyms: ['compensate for', 'atone for', 'offset', 'balance'],
      tags: ['YDS-Phrasal', 'Phrasal-Verb', 'B2-C1'],
      difficulty: 4,
      sentences: [
        {
          en: 'Extra overtime bonuses were distributed to make up for unexpected shipment delays.',
          tr: 'Beklenmeyen sevkiyat gecikmelerini telafi etmek amacıyla fazladan mesai primleri dağıtıldı.',
        },
      ],
    },
    {
      term: 'cut down on',
      definition: 'azaltmak, kısmak, tüketimini düşürmek',
      partOfSpeech: 'phrasal_verb',
      synonyms: ['reduce', 'curtail', 'slash', 'limit'],
      tags: ['YDS-Phrasal', 'Phrasal-Verb', 'B2-Orta'],
      difficulty: 2,
      sentences: [
        {
          en: 'Doctors advise heart patients to cut down on saturated fats and refined sugars.',
          tr: 'Doktorlar kalp hastalarına doymuş yağları ve rafine şekerleri azaltmalarını tavsiye eder.',
        },
      ],
    },
    {
      term: 'come up with',
      definition: 'ileri sürmek, bulmak, ortaya atmak (fikir/çözüm)',
      partOfSpeech: 'phrasal_verb',
      synonyms: ['produce', 'propose', 'devise', 'conceive'],
      tags: ['YDS-Phrasal', 'Phrasal-Verb', 'B2-Orta'],
      difficulty: 3,
      sentences: [
        {
          en: 'The committee came up with a revolutionary solution to urban traffic gridlock.',
          tr: 'Komite, kentsel trafik kilitlenmesine karşı devrim niteliğinde bir çözüm ortaya koydu.',
        },
      ],
    },
    {
      term: 'rule out',
      definition: 'elemek, göz ardı etmek, olasılık dışı bırakmak',
      partOfSpeech: 'phrasal_verb',
      synonyms: ['exclude', 'eliminate', 'reject', 'dismiss'],
      tags: ['YDS-Phrasal', 'Phrasal-Verb', 'B2-C1'],
      difficulty: 4,
      sentences: [
        {
          en: 'Medical tests successfully ruled out any malignant hereditary tumors.',
          tr: 'Tıbbi testler, herhangi bir kötü huylu kalıtsal tümör olasılığını başarıyla eledi.',
        },
      ],
    },
    {
      term: 'wipe out',
      definition: 'yok etmek, tamamen silmek, kökünü kazımak',
      partOfSpeech: 'phrasal_verb',
      synonyms: ['eradicate', 'destroy', 'annihilate', 'extinguish'],
      tags: ['YDS-Phrasal', 'Phrasal-Verb', 'B2-C1'],
      difficulty: 4,
      sentences: [
        {
          en: 'The epidemic wiped out nearly one-third of the native livestock population.',
          tr: 'Salgın hastalık, yerli çiftlik hayvanı popülasyonunun neredeyse üçte birini yok etti.',
        },
      ],
    },
    {
      term: 'turn down',
      definition: 'reddetmek, geri çevirmek; sesini kısmak',
      partOfSpeech: 'phrasal_verb',
      synonyms: ['reject', 'refuse', 'decline', 'spurn'],
      tags: ['YDS-Phrasal', 'Phrasal-Verb', 'B2-Orta'],
      difficulty: 3,
      sentences: [
        {
          en: 'She decided to turn down the lucrative job offer because it required relocating abroad.',
          tr: 'Yurt dışına taşınmayı gerektirdiği için bu kazançlı iş teklifini geri çevirmeye karar verdi.',
        },
      ],
    },
  ],
}

/**
 * 3. YDS Sınav Belirleyici Bağlaçlar & Geçiş Sözcükleri (Conjunctions & Transitions)
 */
const YDS_CONJUNCTION_PACK: WordPack = {
  id: 'yds_conjunctions',
  title: 'YDS & YÖKDİL Sınav Bağlaçları ve Geçiş Kalıpları',
  level: 'Orta (B1-B2)',
  badge: 'B2-C1',
  description: 'Cümle tamamlama ve paragraf sorularının omurgasını oluşturan zıtlık, sebep-sonuç ve ekleme bağlaçları.',
  targetExam: 'YDS, YÖKDİL, YDT',
  words: [
    {
      term: 'furthermore',
      definition: 'dahası, ayrıca, bundan başka, üstelik',
      partOfSpeech: 'conjunction',
      synonyms: ['moreover', 'in addition', 'besides', 'additionally'],
      tags: ['YDS-Bağlaç', 'Bağlaç', 'B2-Orta'],
      difficulty: 3,
      sentences: [
        {
          en: 'The proposed project is remarkably expensive; furthermore, it offers minimal societal utility.',
          tr: 'Önerilen proje son derece pahalıdır; dahası, toplumsal faydası çok azdır.',
        },
      ],
    },
    {
      term: 'nevertheless',
      definition: 'yine de, buna rağmen, bununla birlikte',
      partOfSpeech: 'conjunction',
      synonyms: ['nonetheless', 'however', 'still', 'yet'],
      tags: ['YDS-Bağlaç', 'Bağlaç', 'B2-C1'],
      difficulty: 3,
      sentences: [
        {
          en: 'The experiment was fraught with technical difficulties; nevertheless, significant insights emerged.',
          tr: 'Deney teknik zorluklarla doluydu; yine de çok önemli bulgular ortaya çıktı.',
        },
      ],
    },
    {
      term: 'despite',
      definition: '-e rağmen, -e karşın',
      partOfSpeech: 'preposition',
      synonyms: ['in spite of', 'regardless of', 'notwithstanding'],
      tags: ['YDS-Bağlaç', 'Bağlaç', 'B2-Orta'],
      difficulty: 2,
      sentences: [
        {
          en: 'Despite severe geopolitical instability, the national economy expanded steadily.',
          tr: 'Ağır jeopolitik istikrarsızlığa rağmen, ülke ekonomisi istikrarlı bir şekilde büyüdü.',
        },
      ],
    },
    {
      term: 'whereas',
      definition: 'oysaki, halbuki, -e karşın, oysa',
      partOfSpeech: 'conjunction',
      synonyms: ['while', 'on the other hand', 'in contrast to the fact that'],
      tags: ['YDS-Bağlaç', 'Bağlaç', 'B2-C1'],
      difficulty: 4,
      sentences: [
        {
          en: 'Some species thrive in urban ecosystems, whereas others disappear completely.',
          tr: 'Bazı türler kentsel ekosistemlerde serpilip gelişirken, diğerleri tamamen yok olur.',
        },
      ],
    },
    {
      term: 'consequently',
      definition: 'sonuç olarak, dolayısıyla, neticede',
      partOfSpeech: 'conjunction',
      synonyms: ['therefore', 'as a result', 'hence', 'thus'],
      tags: ['YDS-Bağlaç', 'Bağlaç', 'B2-Orta'],
      difficulty: 3,
      sentences: [
        {
          en: 'Severe droughts ruined agricultural yields; consequently, food prices surged.',
          tr: 'Şiddetli kuraklık tarımsal rekolteyi mahvetti; sonuç olarak gıda fiyatları fırladı.',
        },
      ],
    },
    {
      term: 'owing to',
      definition: '-den dolayı, yüzünden, sebebiyle',
      partOfSpeech: 'preposition',
      synonyms: ['due to', 'because of', 'on account of', 'thanks to'],
      tags: ['YDS-Bağlaç', 'Bağlaç', 'B2-Orta'],
      difficulty: 3,
      sentences: [
        {
          en: 'Flights were grounded for twelve hours owing to dense volcanic ash clouds.',
          tr: 'Yoğun volkanik kül bulutları yüzünden uçuşlar on iki saat boyunca durduruldu.',
        },
      ],
    },
    {
      term: 'provided that',
      definition: 'şartıyla, koşuluyla, -mesi kaydıyla',
      partOfSpeech: 'conjunction',
      synonyms: ['as long as', 'on condition that', 'providing'],
      tags: ['YDS-Bağlaç', 'Bağlaç', 'B2-C1'],
      difficulty: 3,
      sentences: [
        {
          en: 'Loans will be granted provided that applicants demonstrate solid collateral.',
          tr: 'Krediler, başvuru sahiplerinin sağlam teminat göstermesi şartıyla verilecektir.',
        },
      ],
    },
    {
      term: 'in contrast',
      definition: 'buna karşılık, tezat olarak, aksine',
      partOfSpeech: 'conjunction',
      synonyms: ['on the contrary', 'conversely', 'by comparison'],
      tags: ['YDS-Bağlaç', 'Bağlaç', 'B2-Orta'],
      difficulty: 3,
      sentences: [
        {
          en: 'Traditional coal plants emit enormous pollutants; in contrast, solar arrays produce green power.',
          tr: 'Geleneksel kömür santralleri devasa kirleticiler yayar; buna karşılık güneş panelleri yeşil enerji üretir.',
        },
      ],
    },
    {
      term: 'in terms of',
      definition: 'açısından, bakımından, noktasında',
      partOfSpeech: 'preposition',
      synonyms: ['with regard to', 'as regards', 'concerning'],
      tags: ['YDS-Bağlaç', 'Bağlaç', 'B2-Orta'],
      difficulty: 3,
      sentences: [
        {
          en: 'In terms of cost efficiency, automated testing saves hundreds of development hours.',
          tr: 'Maliyet verimliliği açısından, otomatik testler yüzlerce geliştirme saati tasarruf sağlar.',
        },
      ],
    },
    {
      term: 'unless',
      definition: '-medikçe, -mezse, aksi takdirde',
      partOfSpeech: 'conjunction',
      synonyms: ['if not', 'except if', 'save that'],
      tags: ['YDS-Bağlaç', 'Bağlaç', 'B1-Orta'],
      difficulty: 2,
      sentences: [
        {
          en: 'Unless emissions are curtailed rapidly, global warming will exceed critical limits.',
          tr: 'Emisyonlar hızla kısılmadıkça, küresel ısınma kritik sınırları aşacaktır.',
        },
      ],
    },
  ],
}

/**
 * 4. Günlük Konuşma & Temel İngilizce (A1 - A2 Başlangıç Düzeyi)
 */
const BASIC_CONVERSATION_PACK: WordPack = {
  id: 'basic_conversation_a1_a2',
  title: 'Temel İngilizce ve Günlük Konuşma',
  level: 'Başlangıç (A1-A2)',
  badge: 'A1-A2',
  description: 'Günlük hayatta, seyahatte ve basit diyaloglarda en sık kullanılan temel eylemler ve iletişim kelimeleri.',
  targetExam: 'Genel İngilizce, Konuşma, CEFR A1-A2',
  words: [
    {
      term: 'introduce',
      definition: 'tanıtmak, tanıştırmak',
      partOfSpeech: 'verb',
      synonyms: ['present', 'acquaint'],
      tags: ['A1-A2', 'Başlangıç', 'Günlük-Konuşma', 'Fiil'],
      difficulty: 1,
      sentences: [
        {
          en: 'Let me introduce my colleague to the team.',
          tr: 'Ekibe meslektaşımı tanıştırmama izin verin.',
        },
      ],
    },
    {
      term: 'recommend',
      definition: 'tavsiye etmek, önermek',
      partOfSpeech: 'verb',
      synonyms: ['suggest', 'advise'],
      tags: ['A1-A2', 'Başlangıç', 'Günlük-Konuşma', 'Fiil'],
      difficulty: 2,
      sentences: [
        {
          en: 'Can you recommend a good Italian restaurant nearby?',
          tr: 'Yakınlarda güzel bir İtalyan restoranı tavsiye edebilir misiniz?',
        },
      ],
    },
    {
      term: 'borrow',
      definition: 'ödünç almak',
      partOfSpeech: 'verb',
      synonyms: ['take on loan', 'use temporarily'],
      tags: ['A1-A2', 'Başlangıç', 'Günlük-Konuşma', 'Fiil'],
      difficulty: 1,
      sentences: [
        {
          en: 'May I borrow your umbrella for an hour?',
          tr: 'Şemsiyenizi bir saatliğine ödünç alabilir miyim?',
        },
      ],
    },
    {
      term: 'lend',
      definition: 'ödünç vermek',
      partOfSpeech: 'verb',
      synonyms: ['loan', 'give temporarily'],
      tags: ['A1-A2', 'Başlangıç', 'Günlük-Konuşma', 'Fiil'],
      difficulty: 1,
      sentences: [
        {
          en: 'I can lend you my notebook if you missed class.',
          tr: 'Dersi kaçırdıysan defterimi sana ödünç verebilirim.',
        },
      ],
    },
    {
      term: 'explain',
      definition: 'açıklamak, izah etmek',
      partOfSpeech: 'verb',
      synonyms: ['clarify', 'describe'],
      tags: ['A1-A2', 'Başlangıç', 'Günlük-Konuşma', 'Fiil'],
      difficulty: 2,
      sentences: [
        {
          en: 'Could you please explain how this ticket machine works?',
          tr: 'Bu bilet makinesinin nasıl çalıştığını lütfen açıklar mısınız?',
        },
      ],
    },
    {
      term: 'afford',
      definition: 'maddi gücü yetmek, parası karşılayabilmek',
      partOfSpeech: 'verb',
      synonyms: ['pay for', 'manage'],
      tags: ['A1-A2', 'Başlangıç', 'Günlük-Konuşma', 'Fiil'],
      difficulty: 2,
      sentences: [
        {
          en: 'We cannot afford to dine at expensive restaurants every weekend.',
          tr: 'Her hafta sonu pahalı restoranlarda yemek yemeye gücümüz yetmez.',
        },
      ],
    },
    {
      term: 'complain',
      definition: 'şikayet etmek, yakınmak',
      partOfSpeech: 'verb',
      synonyms: ['protest', 'grumble'],
      tags: ['A1-A2', 'Başlangıç', 'Günlük-Konuşma', 'Fiil'],
      difficulty: 2,
      sentences: [
        {
          en: 'Customers complain when delivery drivers arrive late.',
          tr: 'Kuryeler geç kaldığında müşteriler şikayet eder.',
        },
      ],
    },
    {
      term: 'apologize',
      definition: 'özür dilemek',
      partOfSpeech: 'verb',
      synonyms: ['say sorry', 'express regret'],
      tags: ['A1-A2', 'Başlangıç', 'Günlük-Konuşma', 'Fiil'],
      difficulty: 1,
      sentences: [
        {
          en: 'I sincerely apologize for the misunderstanding during the call.',
          tr: 'Arama sırasındaki yanlış anlaşılma için içtenlikle özür dilerim.',
        },
      ],
    },
    {
      term: 'remember',
      definition: 'hatırlamak, aklında tutmak',
      partOfSpeech: 'verb',
      synonyms: ['recall', 'recollect'],
      tags: ['A1-A2', 'Başlangıç', 'Günlük-Konuşma', 'Fiil'],
      difficulty: 1,
      sentences: [
        {
          en: 'Please remember to lock the front door before leaving.',
          tr: 'Çıkmadan önce lütfen ön kapıyı kilitlemeyi unutmayın/hatırlayın.',
        },
      ],
    },
    {
      term: 'prefer',
      definition: 'tercih etmek, yeğlemek',
      partOfSpeech: 'verb',
      synonyms: ['favor', 'choose'],
      tags: ['A1-A2', 'Başlangıç', 'Günlük-Konuşma', 'Fiil'],
      difficulty: 1,
      sentences: [
        {
          en: 'I usually prefer drinking green tea instead of black coffee.',
          tr: 'Genellikle sade kahve yerine yeşil çay içmeyi tercih ederim.',
        },
      ],
    },
    {
      term: 'happen',
      definition: 'olmak, meydana gelmek',
      partOfSpeech: 'verb',
      synonyms: ['occur', 'take place'],
      tags: ['A1-A2', 'Başlangıç', 'Günlük-Konuşma', 'Fiil'],
      difficulty: 1,
      sentences: [
        {
          en: 'Accidents happen when drivers look at mobile screens.',
          tr: 'Sürücüler telefon ekranlarına baktığında kazalar meydana gelir.',
        },
      ],
    },
    {
      term: 'realize',
      definition: 'farkına varmak, idrak etmek',
      partOfSpeech: 'verb',
      synonyms: ['notice', 'understand'],
      tags: ['A1-A2', 'Başlangıç', 'Günlük-Konuşma', 'Fiil'],
      difficulty: 2,
      sentences: [
        {
          en: 'He did not realize that his wallet was missing until he reached the checkout.',
          tr: 'Kasaya varana kadar cüzdanının kayıp olduğunu fark etmedi.',
        },
      ],
    },
    {
      term: 'remind',
      definition: 'hatırlatmak',
      partOfSpeech: 'verb',
      synonyms: ['prompt', 'call to mind'],
      tags: ['A1-A2', 'Başlangıç', 'Günlük-Konuşma', 'Fiil'],
      difficulty: 2,
      sentences: [
        {
          en: 'Can you remind me about tomorrow’s appointment at lunch?',
          tr: 'Öğle yemeğinde bana yarınki randevuyu hatırlatabilir misin?',
        },
      ],
    },
    {
      term: 'expect',
      definition: 'beklemek, ummak',
      partOfSpeech: 'verb',
      synonyms: ['anticipate', 'await'],
      tags: ['A1-A2', 'Başlangıç', 'Günlük-Konuşma', 'Fiil'],
      difficulty: 2,
      sentences: [
        {
          en: 'We expect rainy weather throughout the upcoming weekend.',
          tr: 'Önümüzdeki hafta sonu boyunca yağmurlu hava bekliyoruz.',
        },
      ],
    },
    {
      term: 'invite',
      definition: 'davet etmek, çağırmak',
      partOfSpeech: 'verb',
      synonyms: ['ask', 'welcome'],
      tags: ['A1-A2', 'Başlangıç', 'Günlük-Konuşma', 'Fiil'],
      difficulty: 1,
      sentences: [
        {
          en: 'They plan to invite all close neighbors to the housewarming party.',
          tr: 'Ev görme partisine tüm yakın komşuları davet etmeyi planlıyorlar.',
        },
      ],
    },
  ],
}

/**
 * 5. Akıcı İletişim ve Orta Seviye İngilizce (B1 - B2 Gelişme Düzeyi)
 */
const INTERMEDIATE_PACK: WordPack = {
  id: 'intermediate_b1_b2',
  title: 'Akıcı İletişim & Orta Seviye (B1-B2)',
  level: 'Orta (B1-B2)',
  badge: 'B1-B2',
  description: 'Dizi, film, haber takibi ve iş dünyasında rahat iletişim kurmak için gereken temel omurga kelimeler.',
  targetExam: 'Genel İngilizce, B2 First, İş İngilizcesi',
  words: [
    {
      term: 'accomplish',
      definition: 'başarmak, üstesinden gelmek, sonuçlandırmak',
      partOfSpeech: 'verb',
      synonyms: ['achieve', 'fulfill', 'complete'],
      tags: ['B1-B2', 'Gelişme', 'Genel-İngilizce', 'Fiil'],
      difficulty: 3,
      sentences: [
        {
          en: 'With consistent daily effort, you can accomplish challenging language goals.',
          tr: 'Düzenli günlük çabayla zorlu dil hedeflerini başarabilirsiniz.',
        },
      ],
    },
    {
      term: 'confident',
      definition: 'kendine güvenen, kendinden emin',
      partOfSpeech: 'adjective',
      synonyms: ['assured', 'self-reliant', 'certain'],
      tags: ['B1-B2', 'Gelişme', 'Genel-İngilizce', 'Sıfat'],
      difficulty: 2,
      sentences: [
        {
          en: 'Speaking in public becomes easier when you feel confident about your topic.',
          tr: 'Konunuzdan emin olduğunuzda topluluk önünde konuşmak daha kolay hale gelir.',
        },
      ],
    },
    {
      term: 'efficient',
      definition: 'verimli, zamanı ve enerjiyi iyi kullanan',
      partOfSpeech: 'adjective',
      synonyms: ['productive', 'competent', 'effective'],
      tags: ['B1-B2', 'Gelişme', 'Genel-İngilizce', 'Sıfat'],
      difficulty: 3,
      sentences: [
        {
          en: 'Spaced repetition algorithms provide the most efficient method for vocabulary retention.',
          tr: 'Aralıklı tekrar algoritmaları, kelime akılda tutma için en verimli yöntemi sunar.',
        },
      ],
    },
    {
      term: 'maintain',
      definition: 'sürdürmek, korumak, bakımını yapmak',
      partOfSpeech: 'verb',
      synonyms: ['preserve', 'sustain', 'keep up'],
      tags: ['B1-B2', 'Gelişme', 'Genel-İngilizce', 'Fiil'],
      difficulty: 3,
      sentences: [
        {
          en: 'It requires steady discipline to maintain a continuous daily study streak.',
          tr: 'Sürekli bir günlük çalışma serisini korumak düzenli bir disiplin gerektirir.',
        },
      ],
    },
    {
      term: 'participate',
      definition: 'katılmak, iştirak etmek, yer almak',
      partOfSpeech: 'verb',
      synonyms: ['take part', 'join', 'partake'],
      tags: ['B1-B2', 'Gelişme', 'Genel-İngilizce', 'Fiil'],
      difficulty: 2,
      sentences: [
        {
          en: 'All club members are encouraged to participate in weekly debates.',
          tr: 'Tüm kulüp üyelerinin haftalık münazaralara katılması teşvik edilir.',
        },
      ],
    },
    {
      term: 'predict',
      definition: 'öngörmek, tahmin etmek',
      partOfSpeech: 'verb',
      synonyms: ['forecast', 'foresee', 'anticipate'],
      tags: ['B1-B2', 'Gelişme', 'Genel-İngilizce', 'Fiil'],
      difficulty: 2,
      sentences: [
        {
          en: 'Meteorologists predict heavy rainfall across coastal areas tomorrow.',
          tr: 'Meteorologlar yarın kıyı bölgelerinde şiddetli yağış tahmin ediyor.',
        },
      ],
    },
    {
      term: 'require',
      definition: 'gerektirmek, ihtiyaç duymak',
      partOfSpeech: 'verb',
      synonyms: ['demand', 'necessitate', 'need'],
      tags: ['B1-B2', 'Gelişme', 'Genel-İngilizce', 'Fiil'],
      difficulty: 2,
      sentences: [
        {
          en: 'Passing advanced exams requires hundreds of hours of focused revision.',
          tr: 'İleri düzey sınavları geçmek yüzlerce saatlik odaklanmış tekrar gerektirir.',
        },
      ],
    },
    {
      term: 'significant',
      definition: 'önemli, kayda değer, anlamlı',
      partOfSpeech: 'adjective',
      synonyms: ['meaningful', 'notable', 'considerable', 'substantial'],
      tags: ['B1-B2', 'Gelişme', 'Genel-İngilizce', 'Sıfat'],
      difficulty: 3,
      sentences: [
        {
          en: 'There has been a significant rise in international student applications.',
          tr: 'Uluslararası öğrenci başvurularında kayda değer bir artış görüldü.',
        },
      ],
    },
    {
      term: 'sufficient',
      definition: 'yeterli, kafi',
      partOfSpeech: 'adjective',
      synonyms: ['adequate', 'enough', 'ample'],
      tags: ['B1-B2', 'Gelişme', 'Genel-İngilizce', 'Sıfat'],
      difficulty: 3,
      sentences: [
        {
          en: 'Two weeks of preparation is barely sufficient for a comprehensive exam.',
          tr: 'Kapsamlı bir sınav için iki haftalık hazırlık neredeyse yetersizdir / ancak yeterlidir.',
        },
      ],
    },
    {
      term: 'temporary',
      definition: 'geçici, muvakkat',
      partOfSpeech: 'adjective',
      synonyms: ['interim', 'provisional', 'short-term'],
      tags: ['B1-B2', 'Gelişme', 'Genel-İngilizce', 'Sıfat'],
      difficulty: 2,
      sentences: [
        {
          en: 'Due to road repairs, authorities opened a temporary detour route.',
          tr: 'Yol onarımı nedeniyle yetkililer geçici bir servis yolu açtı.',
        },
      ],
    },
    {
      term: 'urgent',
      definition: 'acil, ivedi, ivedilikle yapılması gereken',
      partOfSpeech: 'adjective',
      synonyms: ['pressing', 'immediate', 'crucial'],
      tags: ['B1-B2', 'Gelişme', 'Genel-İngilizce', 'Sıfat'],
      difficulty: 2,
      sentences: [
        {
          en: 'Doctors sent an urgent request for additional blood supplies.',
          tr: 'Doktorlar ek kan malzemeleri için acil bir talep gönderdi.',
        },
      ],
    },
    {
      term: 'widespread',
      definition: 'yaygın, geniş çapta görülen',
      partOfSpeech: 'adjective',
      synonyms: ['prevalent', 'extensive', 'pervasive'],
      tags: ['B1-B2', 'Gelişme', 'Genel-İngilizce', 'Sıfat'],
      difficulty: 3,
      sentences: [
        {
          en: 'Smartphones gained widespread adoption across the world within a single decade.',
          tr: 'Akıllı telefonlar tek bir on yıl içinde tüm dünyada yaygın bir benimsenme kazandı.',
        },
      ],
    },
    {
      term: 'encourage',
      definition: 'teşvik etmek, cesaretlendirmek',
      partOfSpeech: 'verb',
      synonyms: ['inspire', 'motivate', 'heartens'],
      tags: ['B1-B2', 'Gelişme', 'Genel-İngilizce', 'Fiil'],
      difficulty: 2,
      sentences: [
        {
          en: 'Teachers constantly encourage pupils to read books outside the curriculum.',
          tr: 'Öğretmenler öğrencileri müfredat dışı kitaplar okumaya sürekli teşvik eder.',
        },
      ],
    },
    {
      term: 'challenge',
      definition: 'zorluk, meydan okuma; meydan okumak',
      partOfSpeech: 'noun',
      synonyms: ['difficulty', 'obstacle', 'test'],
      tags: ['B1-B2', 'Gelişme', 'Genel-İngilizce', 'İsim'],
      difficulty: 2,
      sentences: [
        {
          en: 'Learning a language with complex morphology poses a formidable challenge.',
          tr: 'Karmaşık morfolojiye sahip bir dili öğrenmek çetin bir zorluk oluşturur.',
        },
      ],
    },
    {
      term: 'valuable',
      definition: 'değerli, kıymetli, yararlı',
      partOfSpeech: 'adjective',
      synonyms: ['precious', 'worthwhile', 'invaluable'],
      tags: ['B1-B2', 'Gelişme', 'Genel-İngilizce', 'Sıfat'],
      difficulty: 2,
      sentences: [
        {
          en: 'Constructive feedback from mentors provides valuable career guidance.',
          tr: 'Akıl hocalarından gelen yapıcı geri bildirimler değerli bir kariyer rehberliği sunar.',
        },
      ],
    },
  ],
}

export const ALL_WORD_PACKS: WordPack[] = [
  YDS_ACADEMIC_PACK,
  YDS_PHRASAL_PACK,
  YDS_CONJUNCTION_PACK,
  INTERMEDIATE_PACK,
  BASIC_CONVERSATION_PACK,
]
