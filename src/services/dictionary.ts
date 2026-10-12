import { db } from '../db'
import type { CardState, SampleSentence, WordItem } from '../types/database'

/**
 * Temel ve sık kullanılan İngilizce kelimelerin çevrimdışı sözlüğü (~400+ kelime).
 * Cihaz tamamen internetsizken bile cümledeki bağlaç, zamir, edat ve yaygın kelimelerin
 * anında Türkçe karşılığını sağlar.
 */
export const OFFLINE_COMMON_DICT: Record<string, string> = {
  // Tanımlıklar ve İşaret Zamirleri
  the: 'belirtme eki (-i, o)',
  a: 'bir',
  an: 'bir',
  this: 'bu',
  that: 'şu, o / ki',
  these: 'bunlar',
  those: 'şunlar, onlar',

  // Zamirler
  i: 'ben',
  you: 'sen / siz',
  he: 'o (erkek)',
  she: 'o (kadın)',
  it: 'o (cansız/hayvan)',
  we: 'biz',
  they: 'onlar',
  me: 'beni / bana',
  him: 'onu / ona',
  her: 'onun / onu',
  us: 'bizi / bize',
  them: 'onları / onlara',
  my: 'benim',
  your: 'senin / sizin',
  his: 'onun',
  its: 'onun',
  our: 'bizim',
  their: 'onların',

  // Yardımcı Fiiller (To Be, Do, Have, Modals)
  is: 'dır / dir (olmak)',
  are: 'dırlar (olmak)',
  am: 'im (olmak)',
  was: 'idi / oldu',
  were: 'idiler / oldular',
  be: 'olmak',
  been: 'olmuş / bulunmuş',
  being: 'oluş / varlık',
  have: 'sahip olmak / -miş olmak',
  has: 'sahip olmak / -miş olmak',
  had: 'sahipti / -mişti',
  do: 'yapmak / etmek',
  does: 'yapar / eder',
  did: 'yaptı / etti',
  done: 'yapılmış / bitmiş',
  can: '-ebilmek (yetenek/olasılık)',
  could: '-ebilirdi / -ebildi',
  will: '-ecek / -acak (gelecek zaman)',
  would: '-erdi / -ecekti / rica',
  shall: '-ecek / yapmalı',
  should: '-meli / -malı (tavsiye)',
  ought: '-meli / -malı',
  must: '-meli / -malı (zorunluluk)',
  may: '-ebilir (olasılık/izin)',
  might: '-ebilirdi (düşük olasılık)',

  // Edatlar (Prepositions)
  in: 'içinde / -de, -da',
  on: 'üzerinde / -de, -da',
  at: '-de, -da / yanında',
  by: 'tarafından / ile / yanında',
  for: 'için / boyunca',
  with: 'ile / birlikte',
  without: '-sız, -siz / olmaksızın',
  about: 'hakkında / yaklaşık',
  against: 'karşı / aleyhine',
  between: 'arasında (iki şey)',
  among: 'arasında (ikiden fazla)',
  into: 'içine / doğru',
  through: 'aracılığıyla / içinden / boyunca',
  during: 'sırasında / esnasında',
  before: 'önce / önünde',
  after: 'sonra / ardından',
  above: 'üzerinde / yukarıda',
  below: 'altında / aşağıda',
  under: 'altında / yönetiminde',
  over: 'üzerinde / aşkın / bitmiş',
  to: '-e, -a (yönelme) / için',
  from: '-den, -dan (ayrılma)',
  up: 'yukarı / artış',
  down: 'aşağı / düşüş',
  of: '-ın, -in (aitlik) / -den yapılmış',
  off: 'kapalı / uzağında',

  // Bağlaçlar (Conjunctions - YDS için hayati)
  and: 've',
  or: 'veya / ya da / yoksa',
  but: 'ama / fakat / lakin',
  nor: 'ne de',
  so: 'bu yüzden / öyle ki / çok',
  yet: 'yine de / henüz',
  because: 'çünkü / -dığı için',
  since: '-den beri / çünkü / mademki',
  as: 'olarak / gibi / -dıkça / çünkü',
  although: '-e rağmen / karşın',
  though: '-e rağmen / gerçi',
  even: 'bile / hatta',
  while: 'iken / oysa / karşın',
  whereas: 'oysaki / halbuki',
  if: 'eğer / şayet / -se, -sa',
  unless: '-medikçe / -mezse',
  whether: 'olup olmadığı / ister... ister...',
  however: 'ancak / yine de / her nasılsa',
  therefore: 'bu nedenle / dolayısıyla',
  furthermore: 'dahası / ayrıca',
  moreover: 'dahası / üstelik',
  nevertheless: 'yine de / buna rağmen',
  meanwhile: 'bu sırada / bu esnada',
  otherwise: 'aksi takdirde / yoksa',
  despite: '-e rağmen / karşın',

  // Soru ve İlgi Zamirleri
  what: 'ne / şey',
  which: 'hangi / ki o',
  who: 'kim / ki o (kişi)',
  whom: 'kime / kimi',
  whose: 'kimin / ki onun',
  where: 'nerede / nereye',
  when: 'ne zaman / -dığı zaman',
  why: 'neden / niçin',
  how: 'nasıl / ne kadar',

  // Miktar ve Belirteçler
  all: 'tüm / bütün / hepsi',
  any: 'herhangi bir / hiç',
  some: 'bazı / birkaç / biraz',
  no: 'hayır / hiçbir',
  not: 'değil / -me, -ma',
  none: 'hiçbiri',
  much: 'çok (sayılamayan)',
  many: 'çok (sayılabilen)',
  more: 'daha fazla / daha',
  most: 'en çok / çoğu',
  few: 'az (neredeyse hiç)',
  little: 'az / küçük',
  other: 'diğer / başka',
  another: 'başka bir / diğeri',
  such: 'böyle / böylesi',
  only: 'sadece / yalnızca',
  very: 'çok / tam da',
  too: 'de / da / aşırı',
  enough: 'yeterli / yeterince',
  each: 'her bir',
  every: 'her / bütün',
  both: 'her ikisi de',
  either: 'ya biri ya diğeri / de',
  neither: 'hiçbiri (iki şeyden)',

  // Zaman ve Yer Zarfları
  now: 'şimdi / şu anda',
  then: 'o zaman / ardından',
  here: 'burada / buraya',
  there: 'orada / oraya',
  always: 'her zaman / daima',
  never: 'asla / hiçbir zaman',
  often: 'sık sık / genellikle',
  seldom: 'nadiren',
  rarely: 'nadiren',
  sometimes: 'bazen / ara sıra',
  usually: 'genellikle / çoğunlukla',
  already: 'zaten / çoktan',
  still: 'hâlâ / yine de',
  again: 'tekrar / yeniden',
  soon: 'yakında / tez zamanda',
  today: 'bugün',
  yesterday: 'dün',
  tomorrow: 'yarın',

  // Çok Yaygın Fiiller
  say: 'söylemek / demek',
  said: 'dedi / söyledi',
  get: 'almak / elde etmek / olmak',
  got: 'aldı / oldu',
  make: 'yapmak / üretmek / kılmak',
  made: 'yaptı / yapılmış',
  go: 'gitmek',
  went: 'gitti',
  gone: 'gitmiş',
  know: 'bilmek / tanımak',
  knew: 'biliyordu',
  known: 'bilinen / tanınan',
  take: 'almak / götürmek / tutmak',
  took: 'aldı',
  taken: 'alınmış',
  see: 'görmek / anlamak',
  saw: 'gördü',
  seen: 'görülmüş',
  come: 'gelmek',
  came: 'geldi',
  think: 'düşünmek / sanmak',
  thought: 'düşündü / fikir',
  look: 'bakmak / görünmek',
  want: 'istemek',
  give: 'vermek',
  gave: 'verdi',
  given: 'verilmiş / göz önüne alındığında',
  use: 'kullanmak / faydalanmak',
  used: 'kullandı / kullanılmış / alışkın',
  find: 'bulmak / keşfetmek',
  found: 'buldu / kurmak',
  tell: 'anlatmak / söylemek',
  told: 'anlattı / söyledi',
  ask: 'sormak / istemek',
  work: 'çalışmak / iş',
  seem: 'görünmek / gibi gelmek',
  feel: 'hissetmek / sezmek',
  try: 'denemek / çabalamak',
  leave: 'ayrılmak / bırakmak',
  left: 'ayrıldı / sol',
  call: 'çağırmak / aramak / adlandırmak',
  show: 'göstermek / sergilemek',
  need: 'ihtiyaç duymak / gerekmek',
  mean: 'anlamına gelmek / kastedilen',
  meant: 'anlamına geldi',
  keep: 'tutmak / sürdürmek',
  kept: 'tuttu / sürdürdü',
  let: 'izin vermek / bırakmak',
  begin: 'başlamak',
  began: 'başladı',
  begun: 'başlamış',
  help: 'yardım etmek / yardım',
  talk: 'konuşmak / sohbet',
  turn: 'dönmek / çevirmek / sıra',
  start: 'başlamak / başlatmak',
  mightily: 'kuvvetle / şiddetle',
  rapidly: 'hızla / süratle',
  gradually: 'kademeli olarak / yavaş yavaş',
  dramatically: 'çarpıcı biçimde / önemli ölçüde',
  significantly: 'önemli ölçüde / belirgin şekilde',
  severely: 'şiddetle / ağır şekilde',
}

/**
 * Yerel arama önbelleği (LocalStorage)
 */
const CACHE_STORAGE_KEY = 'yds_dict_word_cache'

function getLocalCache(): Record<string, string> {
  try {
    const raw = localStorage.getItem(CACHE_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Record<string, string>) : {}
  } catch {
    return {}
  }
}

function setLocalCache(word: string, meaning: string): void {
  try {
    const cache = getLocalCache()
    cache[word.toLowerCase()] = meaning
    localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(cache))
  } catch {
    // quota exceeded vs. sessizce geç
  }
}

/**
 * Kelimeyi temizler (noktalama, tırnak, boşlukları ayıklar).
 */
export function cleanToken(token: string): string {
  return token
    .trim()
    .replace(/^[^a-zA-Z0-9çğıöşüÇĞİÖŞÜ]+/, '')
    .replace(/[^a-zA-Z0-9çğıöşüÇĞİÖŞÜ]+$/, '')
}

/**
 * Kelimenin olası kök adaylarını (lemma/stem) üretir.
 * Örn: "deteriorated" -> ["deteriorated", "deteriorate", "deteriorat"]
 * Örn: "countries" -> ["countries", "country"]
 * Örn: "patient's" -> ["patient's", "patient"]
 */
export function getStemCandidates(rawWord: string): string[] {
  const clean = cleanToken(rawWord).toLowerCase()
  if (!clean) return []

  const candidates = new Set<string>([clean])

  // Kesme işareti ('s / ’s)
  if (clean.includes("'") || clean.includes('’')) {
    const stripped = clean.replace(/['’]s?$/, '')
    if (stripped) candidates.add(stripped)
  }

  // -ies -> -y (örn: countries -> country)
  if (clean.length > 4 && clean.endsWith('ies')) {
    candidates.add(clean.slice(0, -3) + 'y')
  }

  // -es -> "" (örn: watches -> watch, boxes -> box)
  if (clean.length > 3 && clean.endsWith('es')) {
    candidates.add(clean.slice(0, -2))
    candidates.add(clean.slice(0, -1)) // bazen sadece s
  }

  // -s -> "" (çoğul eki: patients -> patient)
  if (clean.length > 3 && clean.endsWith('s') && !clean.endsWith('ss')) {
    candidates.add(clean.slice(0, -1))
  }

  // -ed -> -e veya "" (geçmiş zaman: deteriorated -> deteriorate, started -> start)
  if (clean.length > 4 && clean.endsWith('ed')) {
    candidates.add(clean.slice(0, -1)) // deteriorate
    candidates.add(clean.slice(0, -2)) // start
    // çift harf (stopped -> stop)
    if (clean.length > 5 && clean[clean.length - 3] === clean[clean.length - 4]) {
      candidates.add(clean.slice(0, -3))
    }
  }

  // -ing -> "" veya -e (progressive: declining -> decline, singing -> sing)
  if (clean.length > 5 && clean.endsWith('ing')) {
    candidates.add(clean.slice(0, -3)) // sing
    candidates.add(clean.slice(0, -3) + 'e') // decline
    // çift harf (running -> run)
    if (clean.length > 6 && clean[clean.length - 4] === clean[clean.length - 5]) {
      candidates.add(clean.slice(0, -4))
    }
  }

  // -ly -> "" (zarf: rapidly -> rapid)
  if (clean.length > 4 && clean.endsWith('ly')) {
    candidates.add(clean.slice(0, -2))
  }

  return Array.from(candidates)
}

/**
 * Arama Sonucu Bilgisi
 */
export interface WordLookupResult {
  term: string
  meaning: string
  source: 'sentence_gloss' | 'deck' | 'offline_dict' | 'cached' | 'online_api' | 'not_found'
  existingWord?: WordItem
  cardState?: CardState
  isNewWord: boolean
}

/**
 * Cümle içindeki bir kelimenin Türkçe anlamını hiyerarşik olarak arar:
 * 1. Cümlenin kendi wordGlosses nesnesi (varsa anında)
 * 2. Kullanıcının YDS havuzu (db.words ve db.cardStates)
 * 3. Yerel önbellek (LocalStorage)
 * 4. Çevrimdışı temel sözlük (OFFLINE_COMMON_DICT)
 * 5. Çevrimiçi Google Translate API sorgusu (ve anında önbelleğe alma)
 */
export async function lookupWordInSentence(
  rawToken: string,
  sentence?: SampleSentence,
  userId?: string,
): Promise<WordLookupResult> {
  const clean = cleanToken(rawToken)
  if (!clean) {
    return {
      term: rawToken,
      meaning: '',
      source: 'not_found',
      isNewWord: true,
    }
  }

  const candidates = getStemCandidates(clean)
  const lowerClean = clean.toLowerCase()

  // 1. Cümleye önceden eklenmiş wordGlosses haritası
  if (sentence?.wordGlosses) {
    for (const cand of [lowerClean, ...candidates, rawToken]) {
      if (sentence.wordGlosses[cand]) {
        return {
          term: clean,
          meaning: sentence.wordGlosses[cand],
          source: 'sentence_gloss',
          isNewWord: true,
        }
      }
    }
  }

  // 2. Kullanıcının kendi YDS kelime tablosu (Dexie)
  try {
    for (const cand of candidates) {
      const match = await db.words
        .filter((w) => !w.isDeleted && (!userId || w.userId === userId) && w.term.toLowerCase() === cand)
        .first()

      if (match) {
        let cardState: CardState | undefined
        if (userId) {
          cardState = await db.cardStates.where('id').equals(`${match.id}_${userId}`).first()
        }
        return {
          term: match.term,
          meaning: match.definition,
          source: 'deck',
          existingWord: match,
          cardState,
          isNewWord: false,
        }
      }
    }
  } catch {
    // Dexie arama hatası olursa devam et
  }

  // 3. Yerel Önbellek
  const localCache = getLocalCache()
  for (const cand of candidates) {
    if (localCache[cand]) {
      return {
        term: clean,
        meaning: localCache[cand],
        source: 'cached',
        isNewWord: true,
      }
    }
  }

  // 4. Çevrimdışı Temel Sözlük
  for (const cand of candidates) {
    if (OFFLINE_COMMON_DICT[cand]) {
      return {
        term: clean,
        meaning: OFFLINE_COMMON_DICT[cand],
        source: 'offline_dict',
        isNewWord: true,
      }
    }
  }

  // 5. Çevrimiçi Tercüme API Sorgusu (İnternet varsa)
  if (navigator.onLine) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 2500)

      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=tr&dt=t&q=${encodeURIComponent(
        clean,
      )}`
      const res = await fetch(url, { signal: controller.signal })
      clearTimeout(timeoutId)

      if (res.ok) {
        const data = (await res.json()) as unknown
        if (Array.isArray(data) && Array.isArray(data[0]) && Array.isArray(data[0][0])) {
          const translated = String(data[0][0][0] || '').trim()
          if (translated && translated.toLowerCase() !== clean.toLowerCase()) {
            setLocalCache(clean, translated)
            return {
              term: clean,
              meaning: translated,
              source: 'online_api',
              isNewWord: true,
            }
          }
        }
      }
    } catch {
      // Çevrimiçi sorgu başarısız olursa sorun değil
    }
  }

  return {
    term: clean,
    meaning: '',
    source: 'not_found',
    isNewWord: true,
  }
}

/**
 * Bir İngilizce cümledeki tüm kelimelerin Türkçe karşılıklarını otomatik çıkartır.
 * Hem kelime ekleme modalında hem de toplu işlemlerde kullanılabilir.
 */
export async function extractSentenceWordGlosses(
  sentenceEn: string,
  _sentenceTr?: string,
  userId?: string,
): Promise<Record<string, string>> {
  if (!sentenceEn.trim()) return {}

  // Cümleyi kelimelere böl (sadece alfabetik kelimeleri al)
  const tokens = sentenceEn.match(/[a-zA-Z0-9çğıöşüÇĞİÖŞÜ'-]+/g) || []
  const uniqueWords = Array.from(new Set(tokens.map(cleanToken).filter((w) => w.length > 1)))

  const glosses: Record<string, string> = {}

  for (const word of uniqueWords) {
    const res = await lookupWordInSentence(word, undefined, userId)
    if (res.meaning) {
      glosses[word.toLowerCase()] = res.meaning
    }
  }

  return glosses
}
