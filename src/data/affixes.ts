// YDS'de sık görülen ekler: anlamı, kelimeye kattığı tür ve örnekler. Özgün derleme (yayına girebilir).

export interface Affix {
  affix: string
  kind: 'prefix' | 'suffix'
  /** Türkçe anlamı / işlevi */
  meaning: string
  /** Oluşan kelimenin türü (son ekler için) */
  pos?: string
  examples: string[]
}

export const AFFIXES: Affix[] = [
  // ---- Ön ekler ----
  { affix: 'un-', kind: 'prefix', meaning: 'olumsuz, değil', examples: ['unable', 'unlikely', 'unprecedented', 'unaware'] },
  { affix: 'in- / im- / il- / ir-', kind: 'prefix', meaning: 'olumsuz, değil', examples: ['inadequate', 'impossible', 'illegal', 'irrelevant'] },
  { affix: 'dis-', kind: 'prefix', meaning: 'olumsuz; ayırma, tersine çevirme', examples: ['disagree', 'disappear', 'discourage', 'disadvantage'] },
  { affix: 'mis-', kind: 'prefix', meaning: 'yanlış, hatalı', examples: ['misunderstand', 'mislead', 'misinterpret', 'misuse'] },
  { affix: 're-', kind: 'prefix', meaning: 'yeniden, tekrar', examples: ['rebuild', 'reconsider', 'restore', 'renew'] },
  { affix: 'pre-', kind: 'prefix', meaning: 'önce, ön', examples: ['predict', 'prevent', 'precede', 'prehistoric'] },
  { affix: 'post-', kind: 'prefix', meaning: 'sonra', examples: ['postpone', 'postwar', 'postgraduate'] },
  { affix: 'over-', kind: 'prefix', meaning: 'aşırı, fazla', examples: ['overestimate', 'overcome', 'overlook', 'overwhelming'] },
  { affix: 'under-', kind: 'prefix', meaning: 'yetersiz, alt', examples: ['underestimate', 'undermine', 'undergo', 'underlying'] },
  { affix: 'inter-', kind: 'prefix', meaning: 'arası, karşılıklı', examples: ['interact', 'interfere', 'international', 'interpret'] },
  { affix: 'trans-', kind: 'prefix', meaning: 'öte, karşıya, değişim', examples: ['transform', 'transmit', 'transport', 'transition'] },
  { affix: 'sub-', kind: 'prefix', meaning: 'alt, altında', examples: ['subsequent', 'substitute', 'subtle', 'subconscious'] },
  { affix: 'super- / sur-', kind: 'prefix', meaning: 'üst, üstün', examples: ['superior', 'supervise', 'surpass', 'surplus'] },
  { affix: 'anti-', kind: 'prefix', meaning: 'karşıt, -e karşı', examples: ['antibiotic', 'antisocial', 'antibody'] },
  { affix: 'co- / con- / com-', kind: 'prefix', meaning: 'birlikte', examples: ['cooperate', 'coexist', 'combine', 'contribute'] },
  { affix: 'ex-', kind: 'prefix', meaning: 'dış, dışarı; eski', examples: ['exclude', 'expand', 'expose', 'ex-president'] },
  { affix: 'de-', kind: 'prefix', meaning: 'azaltma, kaldırma, aşağı', examples: ['decline', 'decrease', 'deteriorate', 'deprive'] },
  { affix: 'en- / em-', kind: 'prefix', meaning: '-laştırmak, içine koymak', examples: ['enable', 'enhance', 'enlarge', 'empower'] },
  { affix: 'out-', kind: 'prefix', meaning: '-den daha fazla, geçmek', examples: ['outnumber', 'outweigh', 'outcome', 'outbreak'] },
  { affix: 'non-', kind: 'prefix', meaning: '-sız, olmayan', examples: ['nonetheless', 'nonprofit', 'nonverbal'] },
  { affix: 'multi- / poly-', kind: 'prefix', meaning: 'çok', examples: ['multiple', 'multinational', 'polygon'] },
  { affix: 'mono- / uni-', kind: 'prefix', meaning: 'tek', examples: ['monopoly', 'uniform', 'unique', 'unify'] },
  // ---- Son ekler ----
  { affix: '-tion / -sion / -ation', kind: 'suffix', meaning: 'eylemden isim (-me, -ma, -ış)', pos: 'isim', examples: ['contribution', 'decision', 'information', 'expansion'] },
  { affix: '-ment', kind: 'suffix', meaning: 'eylemden isim (-me, -ma, -lik)', pos: 'isim', examples: ['development', 'achievement', 'agreement', 'requirement'] },
  { affix: '-ness', kind: 'suffix', meaning: 'sıfattan isim (-lık, -lik)', pos: 'isim', examples: ['awareness', 'effectiveness', 'weakness', 'happiness'] },
  { affix: '-ity / -ty', kind: 'suffix', meaning: 'sıfattan isim (-lık, -lik)', pos: 'isim', examples: ['ability', 'diversity', 'stability', 'scarcity'] },
  { affix: '-ance / -ence', kind: 'suffix', meaning: 'durum, nitelik (isim)', pos: 'isim', examples: ['importance', 'existence', 'reluctance', 'dependence'] },
  { affix: '-er / -or / -ist / -ant', kind: 'suffix', meaning: 'yapan kişi / şey', pos: 'isim', examples: ['researcher', 'investor', 'scientist', 'participant'] },
  { affix: '-ism', kind: 'suffix', meaning: 'akım, öğreti, davranış', pos: 'isim', examples: ['criticism', 'tourism', 'capitalism'] },
  { affix: '-ship / -hood', kind: 'suffix', meaning: 'durum, ilişki, dönem', pos: 'isim', examples: ['relationship', 'leadership', 'childhood'] },
  { affix: '-ize / -ise', kind: 'suffix', meaning: '-laştırmak (fiil)', pos: 'fiil', examples: ['realize', 'emphasize', 'modernize', 'minimize'] },
  { affix: '-ify', kind: 'suffix', meaning: '-laştırmak, yapmak (fiil)', pos: 'fiil', examples: ['identify', 'simplify', 'justify', 'intensify'] },
  { affix: '-en', kind: 'suffix', meaning: '-laştırmak (fiil)', pos: 'fiil', examples: ['strengthen', 'weaken', 'broaden', 'threaten'] },
  { affix: '-ate', kind: 'suffix', meaning: 'fiil yapar (-lemek)', pos: 'fiil', examples: ['generate', 'motivate', 'eliminate', 'accumulate'] },
  { affix: '-able / -ible', kind: 'suffix', meaning: '-ebilir, -ilebilir', pos: 'sıfat', examples: ['available', 'reliable', 'flexible', 'inevitable'] },
  { affix: '-ful', kind: 'suffix', meaning: '-lı, dolu', pos: 'sıfat', examples: ['useful', 'successful', 'harmful', 'powerful'] },
  { affix: '-less', kind: 'suffix', meaning: '-sız', pos: 'sıfat', examples: ['useless', 'harmless', 'regardless', 'countless'] },
  { affix: '-ive', kind: 'suffix', meaning: 'nitelik bildiren sıfat', pos: 'sıfat', examples: ['effective', 'extensive', 'innovative', 'sensitive'] },
  { affix: '-al / -ial', kind: 'suffix', meaning: '-sal, -e ait', pos: 'sıfat', examples: ['environmental', 'crucial', 'essential', 'potential'] },
  { affix: '-ous', kind: 'suffix', meaning: '-lı, niteliğinde', pos: 'sıfat', examples: ['dangerous', 'enormous', 'various', 'numerous'] },
  { affix: '-ic / -ical', kind: 'suffix', meaning: '-sal, -e ait', pos: 'sıfat', examples: ['economic', 'scientific', 'historical', 'dramatic'] },
  { affix: '-ly', kind: 'suffix', meaning: 'sıfattan zarf (-ca, -ce)', pos: 'zarf', examples: ['significantly', 'gradually', 'merely', 'subsequently'] },
]

/** Kelimenin kökünü kabaca bulur (aile gruplamak için): bilinen son ekleri sırayla atar. */
const SUFFIXES = [
  'izations', 'ization', 'ational', 'fulness', 'iveness', 'ousness', 'ability', 'ibility',
  'ations', 'ation', 'ments', 'ment', 'ness', 'ities', 'ity', 'ances', 'ance', 'ences', 'ence', 'ions', 'ion',
  'ively', 'ive', 'ally', 'ical', 'ial', 'al', 'ously', 'ous', 'ful', 'less', 'able', 'ible', 'ably', 'ibly',
  'izing', 'ized', 'izes', 'ize', 'ising', 'ised', 'ise', 'ifying', 'ified', 'ifies', 'ify',
  'ers', 'er', 'ors', 'or', 'ists', 'ist', 'ants', 'ant', 'ents', 'ent',
  'ing', 'ed', 'ly', 'es', 's',
]

export function stemOf(term: string): string {
  let w = term.toLowerCase().trim()
  if (w.includes(' ')) return w // deyim/phrasal: tek başına
  for (const suf of SUFFIXES) {
    if (w.endsWith(suf) && w.length - suf.length >= 4) {
      w = w.slice(0, -suf.length)
      break
    }
  }
  // develop-e / creat-e gibi son 'e' farkını eşitle
  return w.replace(/e$/, '')
}

/** Havuzdaki aynı kökten kelimeler (kendisi hariç). */
export function familyOf(term: string, allTerms: string[]): string[] {
  const s = stemOf(term)
  if (s.length < 4) return []
  return [...new Set(allTerms.filter((t) => t.toLowerCase() !== term.toLowerCase() && stemOf(t) === s))].slice(0, 8)
}
