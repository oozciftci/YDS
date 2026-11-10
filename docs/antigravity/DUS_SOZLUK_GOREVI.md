# Görev: DUS sorularındaki terimler için sade Türkçe sözlük hazırla

Bu dosya, projeyi hiç bilmeyen bir yapay zekâ ajanı (Antigravity) için yazıldı. Baştan sona oku, sonra başla.
Yalnızca burada tarif edilen işi yap.

---

## 1. Proje ve bu görevin amacı

`C:\Projeler\YDS_Proje` kişisel bir sınav çalışma uygulamasıdır (React + Vite web uygulaması, telefonda kullanılır).
İçindeki **DUS** (Diş Hekimliğinde Uzmanlık Sınavı) bölümü, 2012–2021 yılları arasındaki 12 sınavın
**1428 çıkmış sorusunu** metin olarak gösterir.

Diş hekimliği sorularında Latince/Yunanca terimler, kısaltmalar, kişi adıyla anılan yöntemler ve uzmanlık
jargonu çoktur. Kullanıcı soruyu okurken bir terime dokununca küçük bir **balon** açılacak ve o terimin ne
olduğunu **basit Türkçeyle, sorunun bağlamına uygun** biçimde anlatacak. Ayrıca her soru için "bu soru aslında
ne soruyor" diye tek cümlelik sade bir açıklama gösterilecek.

**Senin işin yalnızca bu balonların verisini üretmek.** Uygulamanın kodunu yazmayacaksın; ekranda gösterme
işini başka biri yapacak.

---

## 2. Kesin kurallar

1. **Yalnızca şu klasöre dosya yaz:** `local-data/dus/sozluk/parcalar/<sınav>/` (klasör yoksa oluştur).
   Başka hiçbir dosyayı oluşturma, değiştirme, silme ya da taşıma. Bu belge, örnek dosya, betikler, uygulama kodu
   ve `local-data` içindeki diğer her şey **salt okunurdur**.
2. `git` komutu çalıştırma (commit, add, checkout vb. hiçbiri). Paket kurma (`npm install`, `pip install`).
   Uygulamayı ya da sunucuyu başlatma.
3. **Cevabı öğrenme ve ele verme.** Şu dosyaları **açma**:
   - `local-data/dus/cozumler/*.json` (doğru cevabı ve çözümü içerir),
   - `local-data/dus/sinavlar/*/sinav.json` (cevap anahtarını içerir).
   Soruların metnini yalnızca aşağıdaki `--sonraki` komutuyla al.
4. Bilmediğin ya da emin olmadığın bir şeyi uydurma. Bir terimden emin değilsen o terimi hiç yazma.
5. İnternete ihtiyacın yok; kendi tıp/diş hekimliği bilgini kullan.

---

## 3. Dosyalar ve ne işe yaradıkları

Bütün yollar proje köküne (`C:\Projeler\YDS_Proje`) göredir. Komutları proje kökünde çalıştır.

| Yol | Ne | Sen ne yapacaksın |
|---|---|---|
| `docs/antigravity/DUS_SOZLUK_GOREVI.md` | Bu belge | Oku |
| `docs/antigravity/dus_sozluk_ornek.json` | **Örnek çıktı** (3 soru). Biçimin, uzunluğun ve üslubun ölçüsü budur. | Oku, aynı tarzda yaz |
| `scripts/dus/sozluk_denetle.py` | Yardımcı ve denetleyici betik (yalnızca Python standart kütüphanesi) | Çalıştır, değiştirme |
| `local-data/dus/ocr/<sınav>.json` | Soruların metni (OCR ile çıkarılmış, denetlenmiş) | Doğrudan açmana gerek yok; `--sonraki` gösterir |
| `local-data/dus/sozluk/parcalar/<sınav>/NNN.json` | **Senin çıktın**: her parti ayrı dosya | Yaz |
| `local-data/dus/sozluk/<sınav>.json` | Parçaların birleşimi; betik kendisi üretir | Dokunma |

Sınav kimlikleri (12 adet, bu sırayla çalış):
`2012-ilkbahar, 2012-sonbahar, 2013-ilkbahar, 2014-ilkbahar, 2014-sonbahar, 2015-sonbahar, 2016, 2017, 2018, 2019, 2020, 2021`

Soru anahtarları `tbt/<no>` (Temel Bilimler Testi: anatomi, histoloji, fizyoloji, biyokimya, mikrobiyoloji,
patoloji, farmakoloji, biyoloji) ve `kbt/<no>` (Klinik Bilimler Testi: restoratif, protetik, cerrahi, radyoloji,
periodontoloji, ortodonti, endodonti, pedodonti) biçimindedir. `--sonraki` her sorunun dersini de yazar.

---

## 4. Betik komutları

```
python scripts/dus/sozluk_denetle.py --durum                        # sınav başına ilerleme (ör. 2012-ilkbahar 30/120)
python scripts/dus/sozluk_denetle.py --sonraki 2012-ilkbahar         # sözlüğü yazılmamış sıradaki 10 sorunun metni
python scripts/dus/sozluk_denetle.py --sonraki 2012-ilkbahar --adet 5
python scripts/dus/sozluk_denetle.py --parca 2012-ilkbahar           # yazman gereken sıradaki parça dosyasının yolu
python scripts/dus/sozluk_denetle.py 2012-ilkbahar                   # o sınavın bütün parçalarını denetler
python scripts/dus/sozluk_denetle.py --hepsi                         # bütün sınavları denetler
```

Denetim `HATA` satırı vermezse parçaları `local-data/dus/sozluk/<sınav>.json` dosyasında kendisi birleştirir.
`uyarı` satırları bilgi içindir; bak, gerekiyorsa düzelt.

---

## 5. Çalışma akışı

Her sınav için, sınav bitene kadar tekrarla:

1. `--sonraki <sınav> --adet 10` ile sıradaki 10 soruyu al.
2. `--parca <sınav>` ile yeni parça dosyasının yolunu al (ör. `.../parcalar/2012-ilkbahar/004.json`).
3. Bu 10 sorunun sözlüğünü **o yeni dosyaya** yaz (biçim aşağıda). Eski parça dosyalarını yeniden yazma.
4. `python scripts/dus/sozluk_denetle.py <sınav>` çalıştır. `HATA` varsa **o parça dosyasını** düzelt ve denetimi
   yeniden çalıştır; hata kalmayınca 1. adıma dön.

`--sonraki` "0 soru kaldı" deyince sonraki sınava geç. Yarıda kesilirsen `--durum` ile kaldığın yeri bul; betik
yazılmış soruları atlar. Bir parçada hata varsa yeni parçaya geçmeden önce düzelt.

---

## 6. Çıktı biçimi

Her parça dosyası UTF-8 kodlu, geçerli bir JSON'dur (sonda virgül yok, Türkçe karakterler olduğu gibi):

```json
{
  "sinav": "2012-ilkbahar",
  "surum": 1,
  "sorular": {
    "kbt/1": {
      "neSoruyor": "Dişin üç yüzünü kapsayan bir dolgudan sonra görülen hassasiyetin en sık sebebi soruluyor.",
      "terimler": [
        {
          "metin": "MOD restorasyon",
          "terim": "MOD restorasyon",
          "kisa": "Üç yüzlü dolgu",
          "aciklama": "Dişin Mezial (öndeki dişe bakan yan yüz), Oklüzal (çiğneme yüzü) ve Distal (arkadaki dişe bakan yan yüz) yüzlerini birlikte kapsayan dolgu.",
          "koken": "Kısaltma: Mezial-Oklüzal-Distal"
        }
      ]
    }
  }
}
```

| Alan | Zorunlu | Kural |
|---|---|---|
| `sinav` | ✔ | Sınav kimliği; dosyanın bulunduğu klasörün adıyla aynı |
| `surum` | ✔ | Her zaman `1` |
| `sorular` | ✔ | Anahtar: `tbt/12`, `kbt/7`… Bu partideki her soru için bir kayıt |
| `neSoruyor` | ✔ | 15–300 karakter. Sorunun ne sorduğunu sade Türkçeyle **tek cümlede** söyler (§8) |
| `terimler` | ✔ | Boş olmayan liste; çoğu soruda 2–8 terim, en çok 20 |
| `metin` | ✔ | Terimin soru ya da şık metninde **birebir** geçtiği hâli (§7). Uygulama bu metni bulup altını çizer |
| `terim` | ✔ | Terimin sözlük biçimi: ek almamış, tekil, küçük harf (özel ad ve kısaltma hariç) |
| `kisa` | ✔ | 2–60 karakter. Balonun başlığı: terimin en kısa Türkçe karşılığı ("Gözyaşı bezi", "Sıkıştırmak") |
| `aciklama` | ✔ | 30–450 karakter, 1–3 cümle. Terimin ne olduğu, sade Türkçeyle (§8) |
| `koken` | – | En çok 120 karakter. Yalnızca kökeni anlamaya gerçekten yardım ediyorsa: "Latince: oculus (göz) + motor (hareket ettiren)". Kısaltmalarda açılımı |

Başka alan ekleme; betik bilinmeyen alanı hata sayar.

---

## 7. Hangi kelimeler terim sayılır, `metin` nasıl yazılır

**Al:**
- Latince/Yunanca anatomi ve tıp terimleri: *glandula lacrimalis, nervus facialis, musculus masseter, foramen ovale*
- Yabancı kökenli tıbbi kelimeler ve jargon: *postoperatif, idiyopatik, hiperplazi, apikal, oklüzal, kondanse,
  embrazür, matriks, kuafaj, rezorpsiyon, ankiloz*
- Kısaltmalar: *MOD, CD20, ART, MTA, EDTA, Hb, IgA, TNM*
- Kişi adıyla anılan yöntem, sınıflama, hastalık, alet: *Widman flebi, Kennedy sınıflaması, Black sınıflaması*
- Kimyasal formüller, ilaç ve madde adları: *HCO₃⁻, klorheksidin, kalsiyum hidroksit*
- Mikroorganizma adları: *Streptococcus mutans, Porphyromonas gingivalis*
- Şıklardaki terimler de dâhil (soruyu anlamak için şıkları da anlamak gerekir)

**Alma:**
- Herkesin bildiği gündelik kelimeler (*diş, hasta, ağrı, tedavi, kemik, kan*)
- Sorunun kalıp ifadeleri (*aşağıdakilerden hangisi*, *yukarıdaki ifadelerden*)
- Aynı soruda tekrar eden terimi ikinci kez

**`metin` kuralları** (betik denetler):
- Soru ya da şık metninin içinde **harfi harfine** geçmeli: büyük/küçük harf, tire, kesme işareti, alt simge dâhil.
  Metin "Nervus facialis" diyorsa "nervus facialis" yazma.
- Türkçe eki dışarıda bırak: metinde *glandula lacrimalis'in* geçiyorsa `metin` = `glandula lacrimalis`;
  *kranial sinirlerden* geçiyorsa `kranial sinirler`. Kelimenin ek almamış başı metinde aynen geçmeli.
- Çok kelimeli terimi bütün olarak al (*Oklüzal embrazür*, *Aksiyo-pulpal köşe*). Hem bütünü hem parçasını ayrıca
  yazma; ancak parça kendi başına başka bir yerde ayrı bir kavram olarak geçiyorsa ayrı yazabilirsin.
- Bir terim hem soruda hem şıkta geçiyorsa bir kez yaz; uygulama her geçtiği yerde gösterir.
- Şeklin (fotoğraf, grafik) içindeki yazılar metinde yoktur; onları yazma. `--sonraki` çıktısında
  `[ŞEKİLLİ SORU]` görürsen yalnızca metindeki terimleri al.

---

## 8. Açıklamaları nasıl yazacaksın

Okuyucu: diş hekimliği öğrencisi ya da mezunu, ama o terimi o an hatırlamıyor ya da hiç duymamış. Amaç soruyu
**anlamasını** sağlamak, cevabı söylemek değil.

1. **Sade Türkçe.** Kısa cümleler. Açıklamada başka bir zor terim kullanman gerekiyorsa onu da parantez içinde
   açıkla: "…pulpa (dişin içindeki sinir ve damarları barındıran canlı doku)…".
2. **Bağlama uygun.** Terimin birden çok anlamı varsa **bu soruda kastedilen** anlamı yaz. Örneğin "matriks",
   restoratif diş tedavisi sorusunda dolgu kalıbı (bant), histoloji sorusunda hücreler arası madde demektir.
3. **Önce ne olduğu, sonra gerekirse nerede ya da ne işe yaradığı.** "X, … olan bir …dır. … işini görür."
   Ders kitabı tanımı kopyalamak yerine kendi cümlelerinle, bir öğrenciye anlatır gibi yaz.
4. **Cevabı ele verme.** En önemli kural bu. Şıklardaki terimleri **genel olarak** tanımla; sorunun tam olarak
   sorduğu özelliği o terimin açıklamasına yazma. Örnek:
   - Soru: "Hangi kranial sinir glandula lacrimalis'in fonksiyonu ile ilgilidir?" Şıklar: beş kafa siniri.
   - YANLIŞ: *Nervus facialis: "…gözyaşı bezini de uyarır."* Bu cümle cevabı söyler.
   - DOĞRU: *Nervus facialis: "Yüz ifadesini oluşturan mimik kaslarını çalıştıran sinir; tat ve bazı salgı bezleri
     için de lifler taşır."* Terimi tanıtır, soruyu çözmez.
   - "doğru cevap", "doğru şık", "A şıkkı", "bu yüzden cevap" gibi ifadeleri hiç kullanma; betik bunları hata sayar.
   - Bir şıkkın doğru ya da yanlış olduğunu ima eden karşılaştırmalar da yazma ("…ama bu durumda kullanılmaz").
5. **Doğruluk.** Emin olmadığın bilgiyi yazma; kısa ve doğru, uzun ve şüpheliden iyidir. Sayısal değerleri
   (doz, mm, yaş) ancak terimin tanımının bir parçasıysa ve kesin biliyorsan yaz.
6. **Uzunluk.** `aciklama` çoğunlukla 1–2 cümle (80–250 karakter). Karmaşık kavramlarda 3 cümleye kadar çıkabilir.
   `kisa` birkaç kelimelik bir karşılıktır, cümle değildir.
7. Kısaltmalarda `aciklama` açılımla başlasın ve ne olduğunu söylesin: "MTA (Mineral Trioksit Agregat): …".

**`neSoruyor` için:** Sorunun kökünü sade Türkçeyle yeniden söyle; zor terimleri günlük karşılıklarıyla değiştir.
Şıklara, ipucuna ya da cevaba değinme. Örnek:
- Soru: "MOD restorasyon gerçekleştirilen bir hastada görülen postoperatif hassasiyetin başlıca nedeni
  aşağıdakilerden hangisidir?"
- `neSoruyor`: "Dişin üç yüzünü kapsayan bir dolgu yapıldıktan sonra ortaya çıkan diş hassasiyetinin en sık sebebi
  soruluyor."

Uzun vaka sorularında (hastanın şikâyeti, muayene bulguları, sonra soru) `neSoruyor` vakayı tek cümlede özetleyip
asıl soruyu söyler: "Dişinde şişlik ve ağrı olan çocuk hastada en uygun tedavinin ne olduğu soruluyor."

---

## 9. Her partiden önce kontrol listesi

- [ ] Her `metin` soruda ya da şıklarda harfi harfine geçiyor mu?
- [ ] Gündelik kelimeleri değil, gerçekten açıklama isteyen terimleri mi seçtim?
- [ ] Şıklardaki terimlerin açıklaması cevabı ele veriyor mu? (Veriyorsa o cümleyi çıkar.)
- [ ] Açıklama bu sorunun dersine ve bağlamına uygun mu?
- [ ] Açıklamada kullandığım zor kelimeleri de açıkladım mı?
- [ ] JSON geçerli mi, denetleyici `0 hata` diyor mu?

Kaliteyi korumak için hız yapma: 10 soruluk partiler hâlinde çalış ve her partiden sonra denetle.

---

## 10. Bitince

Bütün sınavlar bitince şunları çalıştır:

```
python scripts/dus/sozluk_denetle.py --hepsi
python scripts/dus/sozluk_denetle.py --durum
```

Ardından kısa bir rapor yaz:
- `--durum` çıktısındaki TOPLAM satırı,
- emin olamadığın için terim yazmadığın ya da kısa kestiğin soruların listesi (sınav + anahtar + bir cümle neden),
- kalan uyarıların özeti.
