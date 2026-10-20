// Dilbilgisi Rehberi için ek alıştırmalar (konu başına 5 → 10). Tüm sorular özgündür; çıkmış sorulardan alıntı yoktur.
import type { GrammarExercise } from './grammar'

const RAW: Record<string, GrammarExercise[]> = {
  zamanlar: [
    { q: 'The museum ---- for renovation since January, so visitors cannot see the main collection.', options: ['closes', 'has been closed', 'was closing', 'had closed', 'will close'], answer: 1, why: '"since January" geçmişte başlayıp şimdiye uzanan bir durumu gösterir: present perfect (passive) = has been closed.' },
    { q: 'When the manager entered the room, the employees ---- the problem for almost two hours.', options: ['discussed', 'have discussed', 'had been discussing', 'were discussed', 'would discuss'], answer: 2, why: 'Geçmişteki bir andan (entered) önce başlayıp süren eylem: past perfect continuous = had been discussing.' },
    { q: 'By the time you read this letter, I ---- on a plane to Canada.', options: ['am', 'will be', 'was', 'have been', 'had been'], answer: 1, why: 'Gelecekte, mektup okunurken süren bir durum: will be (uçakta olacağım).' },
    { q: 'The company ---- its profits in 2019, but it has lost money every year since then.', options: ['doubles', 'has doubled', 'doubled', 'is doubling', 'had doubled'], answer: 2, why: '"in 2019" belirli bir geçmiş zaman: past simple (doubled). Present perfect belirli zamanla kullanılmaz.' },
    { q: 'Once the committee ---- its decision, the results will be sent to all applicants.', options: ['will make', 'is making', 'would make', 'had made', 'has made'], answer: 4, why: '"Once" ile kurulan zaman cümlesinde gelecek anlam için will kullanılmaz; ana cümle will ile gelecekte, yan cümle tamamlanmışlık için present perfect (has made) olur.' },
  ],
  kipler: [
    { q: 'The streets are wet this morning, so it ---- during the night.', options: ['must have rained', 'should rain', 'can’t rain', 'needn’t have rained', 'would rain'], answer: 0, why: 'Güçlü kanıt (sokaklar ıslak) → geçmişe dair kesin çıkarım: must have V3.' },
    { q: 'You ---- apologised; nobody was offended by what you said.', options: ['must have', 'needn’t have', 'can’t have', 'might', 'ought'], answer: 1, why: '"needn’t have V3" = yapıldı ama gerekmiyordu.' },
    { q: 'He ---- the exam; he hardly studied and looked very worried afterwards.', options: ['must have passed', 'can’t have passed', 'should have passed', 'needn’t have passed', 'would pass'], answer: 1, why: 'Kanıt tersini gösteriyor (az çalıştı, endişeli): can’t have V3 = geçmiş için "olamaz".' },
    { q: 'The doctor insisted that the patient ---- complete rest for at least a week.', options: ['takes', 'took', 'take', 'would take', 'has taken'], answer: 2, why: 'insist that + özne + V1 (subjunctive).' },
    { q: 'She ---- have left the building yet; her coat is still hanging on the chair.', options: ['should', 'can’t', 'ought', 'mustn’t', 'needn’t'], answer: 1, why: 'Kanıt (ceket hâlâ orada) çıkarımı olumsuz yapar: can’t have left.' },
  ],
  edilgen: [
    { q: 'The new regulations ---- by the parliament next month.', options: ['will be approved', 'will approve', 'approved', 'are approving', 'have approved'], answer: 0, why: 'Özne düzenlemeler, eylemi yapan "parliament" (by ile): will be + V3.' },
    { q: 'Hundreds of workers ---- since the factory closed last spring.', options: ['laid off', 'have been laid off', 'were laying off', 'had laid off', 'are laid off'], answer: 1, why: '"since" ile present perfect passive: have been laid off.' },
    { q: 'It is believed that the ancient manuscript ---- by monks in the tenth century.', options: ['wrote', 'was written', 'has written', 'is writing', 'had written'], answer: 1, why: 'Elyazması yazılmış (edilgen) ve belirli geçmiş zaman: was written.' },
    { q: 'The patient is said ---- from a rare disease for years before it was diagnosed.', options: ['to suffer', 'to have suffered', 'suffering', 'to be suffered', 'having suffer'], answer: 1, why: '"is said to have V3": söylenen şey, söylemeden önceki bir olayı anlatır.' },
    { q: 'The suspect denied ---- anything about the robbery until his lawyer arrived.', options: ['to be told', 'to tell', 'being told', 'told', 'tell'], answer: 2, why: 'deny + V-ing; özne bilgilendirilen taraf → edilgen being told.' },
  ],
  kosul: [
    { q: 'If the company ---- more carefully, it would not be in such financial trouble now.', options: ['planned', 'had planned', 'plans', 'would plan', 'has planned'], answer: 1, why: 'Karma koşul: geçmişteki koşul (had V3) → şimdiki sonuç (would be).' },
    { q: '---- you need any further information, please do not hesitate to contact us.', options: ['Should', 'Would', 'Were', 'Had', 'Could'], answer: 0, why: '"If you need" yerine devrik: Should you need.' },
    { q: 'We will go for a picnic tomorrow ---- it rains.', options: ['if', 'unless', 'when', 'although', 'because'], answer: 1, why: '"unless" = if ... not: yağmur yağmazsa pikniğe gideriz.' },
    { q: 'If I ---- you, I would think twice before signing that contract.', options: ['am', 'was being', 'were', 'will be', 'had been being'], answer: 2, why: '2. tip koşul: If I were you...' },
    { q: 'Supposing the flight is cancelled, what ---- do?', options: ['we will', 'would we', 'did we', 'have we', 'we had'], answer: 1, why: '"Supposing" varsayım kurar; sonuç soruda would + özne + V1.' },
  ],
  'sifat-cumlesi': [
    { q: 'The researcher ---- study was published last year has received a major award.', options: ['who', 'whom', 'whose', 'which', 'that'], answer: 2, why: 'Aitlik: araştırmacının çalışması → whose + isim.' },
    { q: 'The town in ---- she grew up has changed a lot over the years.', options: ['that', 'which', 'where', 'whom', 'what'], answer: 1, why: 'Edat + ilgi zamiri: in which (that edat sonrasında kullanılmaz).' },
    { q: 'All the students ---- passed the test will receive a certificate.', options: ['whom', 'who', 'which', 'what', 'whose'], answer: 1, why: 'Özne konumunda kişi: who.' },
    { q: 'The proposal, ---- was presented yesterday, has been strongly criticised.', options: ['that', 'what', 'which', 'who', 'whom'], answer: 2, why: 'Virgüllü (tanımlayıcı olmayan) cümlede that kullanılmaz: which.' },
    { q: 'The documents ---- on the table belong to the manager.', options: ['laying', 'lying', 'laid', 'lied', 'lain'], answer: 1, why: 'Sıfat-fiil kısaltması: which are lying → lying (lie: yatmak).' },
  ],
  'isim-cumlesi': [
    { q: 'Nobody knows ---- the ancient civilisation disappeared so suddenly.', options: ['that', 'why', 'what', 'whose', 'whom'], answer: 1, why: 'Neden bilinmiyor: why + tam cümle.' },
    { q: 'The question is ---- we can afford to build a new hospital.', options: ['whether', 'which', 'what', 'who', 'that'], answer: 0, why: 'Evet/hayır içeren belirsizlik: whether.' },
    { q: 'She asked me ---- I had finished the report.', options: ['that', 'if', 'what', 'who', 'where for'], answer: 1, why: 'Dolaylı evet/hayır sorusu: if/whether.' },
    { q: 'It is surprising ---- the experiment failed twice.', options: ['what', 'that', 'whom', 'which', 'where'], answer: 1, why: 'Sıfattan sonra "that" cümlesi: surprising that.' },
    { q: 'Do you know ---- the nearest pharmacy is?', options: ['where', 'where is', 'that', 'which one is', 'what'], answer: 0, why: 'Dolaylı soruda düz sıra: where the nearest pharmacy is.' },
  ],
  baglaclar: [
    { q: '---- the ticket was expensive, the concert was sold out within hours.', options: ['Because', 'Although', 'Since', 'So that', 'Unless'], answer: 1, why: 'Zıtlık: pahalı olmasına rağmen tükendi → Although.' },
    { q: 'She saved money every month ---- she could buy a house.', options: ['so that', 'although', 'unless', 'whereas', 'in case of'], answer: 0, why: 'Amaç: so that + özne + could.' },
    { q: 'Take an umbrella ---- it rains later.', options: ['in case', 'unless', 'as long as', 'even though', 'so as'], answer: 0, why: 'Önlem: in case (yağarsa diye).' },
    { q: 'The new system is faster, ---- the old one was more reliable.', options: ['so', 'whereas', 'because', 'unless', 'provided'], answer: 1, why: 'Karşıtlık: whereas = oysa.' },
    { q: 'He kept working ---- he was exhausted.', options: ['even though', 'because of', 'in order to', 'as if', 'unless'], answer: 0, why: 'Zıtlık: yorgun olmasına rağmen → even though.' },
  ],
  'gecis-ifadeleri': [
    { q: 'The plan was carefully prepared; ----, it failed because of a minor mistake.', options: ['moreover', 'nevertheless', 'for example', 'therefore', 'similarly'], answer: 1, why: 'Zıtlık: nevertheless = yine de.' },
    { q: 'Prices have risen sharply. ----, many families have cut their spending.', options: ['In contrast', 'As a result', 'Otherwise', 'On the other hand', 'Likewise'], answer: 1, why: 'Sonuç: as a result.' },
    { q: 'Exercise improves physical health. ----, it reduces stress.', options: ['However', 'In addition', 'Instead', 'Otherwise', 'Even so'], answer: 1, why: 'Ek bilgi: in addition.' },
    { q: 'You must submit the form today; ----, your application will be rejected.', options: ['moreover', 'otherwise', 'therefore', 'meanwhile', 'besides'], answer: 1, why: 'Aksi halde: otherwise.' },
    { q: 'Some people prefer cities; ----, others enjoy village life.', options: ['consequently', 'on the other hand', 'as a result', 'for instance', 'thus'], answer: 1, why: 'Karşıtlık: on the other hand.' },
  ],
  edatlar: [
    { q: 'The new policy will be effective ---- 1 March.', options: ['in', 'at', 'from', 'by', 'since'], answer: 2, why: 'Başlangıç tarihi: effective from.' },
    { q: 'The company is responsible ---- the safety of its employees.', options: ['to', 'for', 'of', 'with', 'about'], answer: 1, why: 'responsible for.' },
    { q: 'She is not accustomed ---- working at night.', options: ['to', 'for', 'with', 'at', 'in'], answer: 0, why: 'accustomed to + V-ing.' },
    { q: 'They congratulated him ---- winning the prize.', options: ['for', 'on', 'with', 'about', 'to'], answer: 1, why: 'congratulate sb on (başarı).' },
    { q: 'The meeting was cancelled ---- to the bad weather.', options: ['owing', 'because', 'since', 'in spite', 'although'], answer: 0, why: 'owing to = ...yüzünden; because/since bağlaçtır, isim öbeği almaz.' },
  ],
  'ing-to': [
    { q: 'The manager suggested ---- the meeting until the following week.', options: ['to postpone', 'postponing', 'postpone', 'to postponing', 'postponed'], answer: 1, why: 'suggest + V-ing.' },
    { q: 'He decided ---- the offer after thinking about it for several days.', options: ['accepting', 'to accept', 'accept', 'having accept', 'to accepting'], answer: 1, why: 'decide + to-infinitive.' },
    { q: 'I remember ---- the door before leaving, so it must be locked.', options: ['to lock', 'locking', 'lock', 'to have locking', 'locked'], answer: 1, why: 'remember + V-ing = yapmış olduğunu hatırlamak.' },
    { q: 'The students were not allowed ---- mobile phones during the exam.', options: ['using', 'to use', 'use', 'used', 'for using'], answer: 1, why: 'be allowed + to-infinitive.' },
    { q: 'It is no use ---- over spilt milk.', options: ['to cry', 'crying', 'cry', 'cried', 'to be crying'], answer: 1, why: 'It is no use + V-ing.' },
  ],
  karsilastirma: [
    { q: 'This year’s exam was ---- than last year’s.', options: ['much more difficult', 'much difficult', 'most difficult', 'the more difficult', 'as difficult'], answer: 0, why: 'than ile karşılaştırma: much more difficult.' },
    { q: 'The harder you try, ---- you will become.', options: ['more successful', 'the more successful', 'most successful', 'the most successful', 'successful'], answer: 1, why: 'The + comparative, the + comparative.' },
    { q: 'This is ---- book I have ever read about the subject.', options: ['the more interesting', 'more interesting', 'the most interesting', 'most interesting', 'as interesting'], answer: 2, why: '"ever" ile üstünlük: the most interesting.' },
    { q: 'He is not as ---- as his brother.', options: ['taller', 'tall', 'tallest', 'more tall', 'the tall'], answer: 1, why: 'as + sıfat + as: eşitlik/olumsuz eşitlik (tall).' },
    { q: 'The new model is twice ---- as the old one.', options: ['as fast', 'faster', 'fastest', 'more fast', 'the fast'], answer: 0, why: 'twice as + sıfat + as.' },
  ],
  miktar: [
    { q: 'There is ---- evidence to support his claim.', options: ['few', 'a few', 'little', 'many', 'a number of'], answer: 2, why: 'evidence sayılamaz; olumsuz anlam: little.' },
    { q: '---- of the students were present at the lecture.', options: ['Much', 'A great deal', 'Most', 'Little', 'Every'], answer: 2, why: 'Most of + çoğul isim.' },
    { q: 'Each of the participants ---- a certificate at the end.', options: ['receive', 'receives', 'are receiving', 'have received', 'were receiving'], answer: 1, why: 'Each of + çoğul isim, fiil tekil.' },
    { q: 'He has ---- friends, so he rarely feels lonely.', options: ['a little', 'much', 'a lot of', 'a great deal of', 'little'], answer: 2, why: 'friends sayılabilir çoğul: a lot of.' },
    { q: 'Neither of the two solutions ---- satisfactory.', options: ['are', 'were', 'is', 'have been', 'be'], answer: 2, why: 'Neither of ... + tekil fiil.' },
  ],
  'cift-baglac': [
    { q: 'The new employee is ---- experienced but also highly motivated.', options: ['both', 'either', 'not only', 'neither', 'whether'], answer: 2, why: 'not only ... but also.' },
    { q: 'You can pay ---- by cash or by credit card.', options: ['both', 'neither', 'either', 'not only', 'whether'], answer: 2, why: 'either ... or.' },
    { q: '---- the manager nor his assistant was informed about the change.', options: ['Either', 'Both', 'Neither', 'Not only', 'Whether'], answer: 2, why: 'neither ... nor.' },
    { q: 'She is both intelligent ---- hardworking.', options: ['or', 'nor', 'and', 'but', 'as well'], answer: 2, why: 'both ... and.' },
    { q: 'The proposal was rejected, ---- because it was expensive but also because it was impractical.', options: ['not only', 'both', 'either', 'whether', 'neither'], answer: 0, why: 'not only ... but also (paralel yapı).' },
  ],
  devrik: [
    { q: 'Never ---- such a beautiful sunset.', options: ['I have seen', 'have I seen', 'I saw', 'did I seen', 'seen I'], answer: 1, why: 'Never başta: have + özne + V3.' },
    { q: 'Only by working together ---- solve this problem.', options: ['we can', 'can we', 'we could', 'we will', 'are we'], answer: 1, why: 'Only by ... başta: can + özne.' },
    { q: 'So expensive ---- that few people could afford it.', options: ['the car was', 'was the car', 'did the car', 'the car did', 'is the car'], answer: 1, why: 'So + sıfat başta: was + özne.' },
    { q: 'Under no circumstances ---- the door be left open.', options: ['should', 'does', 'is', 'will not', 'has'], answer: 0, why: 'Under no circumstances başta devrik: should + özne.' },
    { q: 'Little ---- that the project would fail.', options: ['they knew', 'did they know', 'they did know', 'knew they not', 'have they known'], answer: 1, why: 'Little (hiç bilmemek) başta: did + özne + V1.' },
  ],
}

// Doğru şıkkın harf dağılımını dengele: doğru şık ile hedef konumdaki şık yer değiştirir (sabit, tekrarlanabilir düzen).
const TARGETS = [2, 0, 3, 1, 4, 1, 3, 4, 0, 2]
let k = 0
for (const list of Object.values(RAW)) {
  for (const ex of list) {
    const to = TARGETS[k++ % TARGETS.length]
    const tmp = ex.options[to]
    ex.options[to] = ex.options[ex.answer]
    ex.options[ex.answer] = tmp
    ex.answer = to
  }
}

export const GRAMMAR_EXTRA = RAW
