# Görev: DUS sorularına alt konu etiketi ve spot bilgi kartları yaz

Bu dosya, projeyi hiç bilmeyen bir yapay zekâ ajanı (Antigravity) için yazıldı. Baştan sona oku, sonra başla.
Yalnızca burada tarif edilen işi yap.

---

## 1. Proje ve bu görevin amacı

`C:\Projeler\YDS_Proje` kişisel bir sınav çalışma uygulamasıdır (React + Vite web uygulaması, telefonda kullanılır).
İçindeki **DUS** (Diş Hekimliğinde Uzmanlık Sınavı) bölümü, 2012–2021 arasındaki sınavların **çıkmış sorularını**
(yaklaşık 1430 soru) metin olarak gösterir. Her soru 16 dersten birine aittir (anatomi, fizyoloji … pedodonti).

Bu görevde her soru için iki şey üreteceksin:

1. **Alt konu etiketi:** Sorunun, dersin içinde hangi konuya ait olduğu (ör. Anatomi → "Kranial sinirler ve
   gangliyonlar"). Kullanıcı "periodontolojide en çok hangi konudan soru çıkmış, ben hangi konuda zayıfım" diye
   bakabilecek. Konular **hazır bir listeden** seçilir; sen yeni konu uydurmazsın.
2. **Spot bilgi kartları:** Sorunun dayandığı, sınavda yeniden sorulabilecek kalıcı bilgiyi 1–3 küçük karta
   damıt. Kartın ön yüzü kısa bir soru, arka yüzü tek cümlelik kesin bilgi. Kullanıcı bunları tekrar kartı gibi
   çalışacak.

**Senin işin yalnızca bu veriyi üretmek.** Uygulamanın kodunu yazmayacaksın; ekranda gösterme işini başka biri yapacak.

---

## 2. Kesin kurallar

1. **Yalnızca şu klasöre dosya yaz:** `local-data/dus/konu/parcalar/<sınav>/` (klasör yoksa oluştur).
   Başka hiçbir dosyayı oluşturma, değiştirme, silme ya da taşıma. Bu belge, örnek dosya, betikler
   (`scripts/` altındaki her şey, `konular.json` dâhil), uygulama kodu ve `local-data` içindeki diğer her şey
   **salt okunurdur**. (Betiğin kendisi `local-data/dus/konu/<sınav>.json` ve `local-data/dus/konu/sonraki.txt`
   dosyalarını yazar; onlara elle dokunma.)
2. **Kod değiştirme.** Betik bir şeyi hata sayıyorsa betiği değil, **parça dosyanı** düzelt.
3. `git` komutu çalıştırma (commit, add, checkout vb. hiçbiri). Paket kurma (`npm install`, `pip install`).
   Uygulamayı ya da sunucuyu başlatma.
4. Soruların metnini, cevabını ve hazır çözümünü **yalnızca** aşağıdaki `--sonraki` komutuyla al. `local-data`
   altındaki JSON dosyalarını doğrudan açma (çok büyükler, gereksiz yere yer kaplarlar).
5. **Bilmediğin ya da emin olmadığın bir bilgiyi yazma.** Hazır çözümler yapay zekâ ile yazılmıştır ve
   denetlenmemiştir; içlerinde hata olabilir. Bir bilgiyi ancak kendi tıp/diş hekimliği bilginle de doğruluyorsan
   karta koy. Emin olmadığın bilgiyi atla: 1 sağlam kart, 3 şüpheli karttan iyidir.
6. İnternete ihtiyacın yok.

---

## 3. Dosyalar

Bütün yollar proje köküne (`C:\Projeler\YDS_Proje`) göredir. Komutları proje kökünde çalıştır.

| Yol | Ne | Sen ne yapacaksın |
|---|---|---|
| `docs/antigravity/DUS_KONU_SPOT_GOREVI.md` | Bu belge | Oku |
| `docs/antigravity/dus_konu_spot_ornek.json` | **Örnek çıktı** (3 soru). Biçimin, uzunluğun ve üslubun ölçüsü budur. | Oku, aynı tarzda yaz |
| `scripts/dus/konular.json` | Ders başına alt konu listesi | Okuman gerekmez; `--sonraki` ilgili listeyi gösterir |
| `scripts/dus/konu_denetle.py` | Yardımcı ve denetleyici betik (yalnızca Python standart kütüphanesi) | Çalıştır, değiştirme |
| `local-data/dus/konu/parcalar/<sınav>/NNN.json` | **Senin çıktın**: her parti (~20 soru) ayrı dosya | Yaz |
| `local-data/dus/konu/<sınav>.json` | Parçaların birleşimi; betik kendisi üretir | Dokunma |

Sınav kimlikleri (bu sırayla çalış; `--sonraki` sınav adı verilmezse sıradakini kendisi seçer):
`2012-ilkbahar, 2012-sonbahar, 2013-ilkbahar, 2014-ilkbahar, 2014-sonbahar, 2015-sonbahar, 2016, 2017, 2018, 2019, 2020, 2021`
(`--durum` "hazır çözüm yok; şimdilik atla" dediği sınavı atla; o sınav henüz hazırlanıyor.)

Soru anahtarları `tbt/<no>` (Temel Bilimler Testi) ve `kbt/<no>` (Klinik Bilimler Testi) biçimindedir.
`--sonraki` her sorunun dersini ve o dersin konu listesini yazar.

---

## 4. Betik komutları

Python'u her zaman `-I` ile çalıştır:

```
python -I scripts/dus/konu_denetle.py --durum                  # sınav başına ilerleme, sıradaki sınav
python -I scripts/dus/konu_denetle.py --sonraki                # sıradaki 20 sorunun girdisi + yazılacak dosyanın yolu
python -I scripts/dus/konu_denetle.py --sonraki 2016           # belirli bir sınavın sıradaki 20 sorusu
python -I scripts/dus/konu_denetle.py --sonraki --dosyaya      # aynı girdiyi local-data/dus/konu/sonraki.txt'ye yazar
python -I scripts/dus/konu_denetle.py --parca <dosya>          # parçayı (ve o sınavın bütün parçalarını) denetler
python -I scripts/dus/konu_denetle.py 2016                     # o sınavın bütün parçalarını denetler
python -I scripts/dus/konu_denetle.py --hepsi                  # bütün sınavları denetler
python -I scripts/dus/konu_denetle.py --ozet                   # ders → konu soru sayıları
```

Terminal çıktın uzun metni kesiyorsa `--sonraki --dosyaya` kullan ve `local-data/dus/konu/sonraki.txt` dosyasını oku.

`--sonraki` çıktısında her soru için şunlar vardır: soru metni, şıklar, **cevap anahtarı**, **hazır çözüm**
(kısaltılmış, denetlenmemiş). En sonda, partideki derslerin **konu listesi** (kimlik — ad: kapsam) gelir.
Başta da yazman gereken **yeni parça dosyasının yolu** ve denetim komutu yazar.

Denetim `HATA` satırı vermezse parçaları `local-data/dus/konu/<sınav>.json` dosyasında kendisi birleştirir
("Birleştirildi →"). `uyarı` satırları bilgi içindir; bak, gerekiyorsa düzelt.

---

## 5. Çalışma akışı (döngü)

Her sınav için, sınav bitene kadar tekrarla:

1. `python -I scripts/dus/konu_denetle.py --sonraki` → sıradaki 20 soruyu ve yazacağın dosyanın yolunu al
   (ör. `local-data/dus/konu/parcalar/2012-ilkbahar/003.json`).
2. Bu 20 sorunun kaydını **o yeni dosyaya** yaz (biçim §6). Eski parça dosyalarını yeniden yazma.
3. `python -I scripts/dus/konu_denetle.py --parca <o dosya>` çalıştır.
4. `HATA` varsa **o parça dosyasını** düzelt ve 3. adımı yinele. `0 hata` olunca 1. adıma dön.

`--sonraki`, sınavda hatalı bir parça varken yeni soru vermez; önce hatayı düzeltmeni ister.
Bir sınav bitince `--sonraki` kendiliğinden sıradaki sınava geçer. Yarıda kesilirsen `--durum` ile kaldığın
yeri bul; betik yazılmış soruları atlar. Hiçbir soruyu atlama: şekilli ya da zor soruda da bir kayıt yaz (§7).

İş bölümü: **sınav sınav** çalış. Bir sınavı bitirmeden başkasına geçme. Her sınav ~6 parçadır.

---

## 6. Çıktı biçimi

Her parça dosyası UTF-8 kodlu, geçerli bir JSON'dur (sonda virgül yok, Türkçe karakterler olduğu gibi):

```json
{
  "sinav": "2012-ilkbahar",
  "surum": 1,
  "sorular": {
    "tbt/1": {
      "konu": "anatomi/kranial-sinirler",
      "altBaslik": "Gözyaşı bezinin parasempatik innervasyonu",
      "zorluk": 1,
      "spotlar": [
        {
          "on": "Gözyaşı bezinin salgısını hangi kranial sinirin parasempatik lifleri yönetir?",
          "arka": "Nervus facialis (VII); preganglioner lifler n. petrosus major ile ganglion pterygopalatinum'a ulaşır."
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
| `sorular` | ✔ | Anahtar: `tbt/12`, `kbt/7`… `--sonraki`nin verdiği 20 sorunun hepsi için bir kayıt |
| `konu` | ✔ | `--sonraki`nin en sonda verdiği **o dersin** listesindeki kimliklerden biri, harfi harfine (§7) |
| `altBaslik` | ✔ | 3–60 karakter. Konudan daha ince başlık, serbest metin (§7) |
| `zorluk` | ✔ | `1`, `2` ya da `3` (tam sayı; tırnaksız) (§7) |
| `spotlar` | ✔ | 1–3 kart. Yalnızca `[İPTAL EDİLMİŞ SORU]` işaretli soruda 0 olabilir |
| `on` | ✔ | 10–120 karakter, soru biçiminde, `?` ile biter (§8) |
| `arka` | ✔ | 15–220 karakter, **tek cümle**, kesin bilgi (§8) |

Başka alan ekleme; betik bilinmeyen alanı hata sayar.

---

## 7. Konu, alt başlık, zorluk

**`konu`:** Sorunun **asıl ölçtüğü bilgiye** göre seç, sorudaki kelimelere göre değil.
- Listedeki `kapsam` açıklamalarını oku; soru hangisinin içine düşüyorsa onu seç.
- İki konuya da benziyorsa sorunun **cevabını bilmek için hangi konuyu çalışmak gerektiğine** bak. Örnek:
  "Pemfigus vulgariste otoantikor hangi yapıya karşıdır?" → ağız lezyonu bilgisi (`patoloji/oral-mukoza`);
  "Pemfigusta epitel hangi tip aşırı duyarlılıkla hasar görür?" → mekanizma (`patoloji/immunopatoloji`).
- `<ders>/diger` yalnızca gerçekten hiçbir konuya sığmayan soru içindir. Bir derste `diger` oranı %15'i aşarsa
  `--ozet` uyarır; bu, `diger`i fazla kullandığını gösterir.
- Kimliği **listeden kopyala**; harf değiştirme, yeni kimlik uydurma. Başka dersin kimliği hata sayılır.

**`altBaslik`:** Konunun içindeki daha dar başlık; bir ders kitabındaki alt bölüm adı gibi. Kısa bir ad
öbeği, cümle değil. Örnekler: "Gözyaşı bezinin parasempatik innervasyonu", "Amalgam kondansasyonu",
"Kırmızı kompleks bakterileri", "Bolton analizi", "Süt dişinde pulpotomi ajanları".
Sorunun kalıbını ("…hangisi değildir") ya da cevabı yazma.

**`zorluk`:** Sınava hazırlanan bir diş hekimi için:
- `1` — temel, sık sorulan, ders kitabının ana bilgisi (ör. gözyaşı bezinin siniri).
- `2` — orta; ayrıntı bilgisi ya da iki bilgiyi birleştirmeyi gerektirir.
- `3` — ince ayrıntı, nadir bilgi, sayısal değer, uzun vaka ya da "hangileri doğrudur" türü birleşik soru.

**Şekilli sorular** (`[ŞEKİLLİ SORU]`): Şekli göremezsin. Konu ve alt başlığı soru metni, cevap ve çözümden
çıkar; spotu şekle bağlı olmayan genel bilgiden yaz (şekildeki numara/harf hakkında spot yazma).
**İptal edilmiş sorular** (`[İPTAL EDİLMİŞ SORU]`): Konu/alt başlık/zorluk yine yazılır; spot ancak tartışmasız
bir bilgi varsa yazılır, yoksa `"spotlar": []`.

---

## 8. Spot kartlarını nasıl yazacaksın

Okuyucu: DUS'a hazırlanan diş hekimi. Kartı aylar sonra, soruyu görmeden çalışacak. Bu yüzden:

1. **Kendi başına anlaşılır olmalı.** Kart soruya atıf yapmaz. "bu soruda", "soruda", "sorunun", "yukarıdaki",
   "aşağıdakilerden", "şıkkı", "seçenek", "doğru cevap", "şekildeki", "vakada" gibi ifadeler **yasak**
   (betik hata sayar). "A)" gibi şık harfi de yazma.
2. **Kalıcı, sınavda yeniden sorulabilecek bilgi.** Sorunun cevabındaki çekirdek bilgi birinci kart olsun.
   İkinci ve üçüncü kart, çözümde geçen ve aynı konuda sık sorulan **yakın** bilgilerden seçilir (ör. çeldirici
   şıklardan birinin ayırt edici özelliği). Önemsiz ayrıntıyı karta çevirme.
3. **Özgün cümle.** Soru kökünü ya da şıkları kopyalama; soruyu kendi sözlerinle, daha kısa sor. Soru kökünden
   8 ya da daha fazla kelimelik birebir dizi betikte hata sayılır.
4. **`on` bir soru:** Kısa, tek bir şeyi sorar, `?` ile biter. "Ne/hangi/neden/kaç" ile kurulur.
   Olumsuz kalıp ("hangisi değildir") kullanma; karta olumlu bilgi yaz.
5. **`arka` tek cümle, kesin bilgi:** Önce cevap, sonra gerekiyorsa kısa bir gerekçe ya da ayırt edici özellik
   (noktalı virgülle). "olabilir, genellikle, bazen" gibi bulanık ifadeleri bilginin kendisi öyleyse kullan.
6. **Doğruluk.** Cevap anahtarı ile hazır çözüm çelişirse **cevap anahtarı** geçerlidir. Çözümde senin
   bildiğinle çelişen bir bilgi görürsen o bilgiyi karta koyma. Sayısal değerleri (doz, mm, yüzde, yaş) ancak
   kesin biliyorsan yaz.
7. **Yineleme yok.** Aynı soruda iki kart aynı bilgiyi vermesin. Aynı sınavda başka bir soruda yazdığın kartın
   aynısını yazma (betik uyarır); aynı bilgi tekrar sorulmuşsa farklı bir yönünü kartla.
8. **Türkçe**, ders kitabı terimleriyle (Latince terimler olduğu gibi kalabilir: n. facialis, ganglion oticum).

### İyi ve kötü örnekler

Soru (2012-ilkbahar tbt/1): Gözyaşı bezinin işleviyle ilgili kranial sinir soruluyor; cevap n. facialis.

| | `on` | `arka` | Neden |
|---|---|---|---|
| ✔ | Gözyaşı bezinin salgısını hangi kranial sinirin parasempatik lifleri yönetir? | Nervus facialis (VII); preganglioner lifler n. petrosus major ile ganglion pterygopalatinum'a ulaşır. | Kendi başına anlaşılır, cevap + yol |
| ✘ | Bu sorudaki bez hangi sinirle ilgilidir? | E şıkkı, n. facialis. | Soruya ve şıkka atıf |
| ✘ | *(soru kökünün kelimesi kelimesine aynısı, "Aşağıdaki … hangisi …?")* | N. facialis. | Soru kökünün kopyası; "aşağıdaki"; `arka` cümle değil |
| ✘ | N. facialis | Gözyaşı bezini uyarır. Ayrıca tat duyusu taşır. Mimik kaslarını da çalıştırır. | `on` soru değil; `arka` üç cümle |
| ✘ | Hangi sinir n. opticus değildir? | Gözyaşı bezinin siniri n. opticus değildir. | Olumsuz kalıp, bilgi vermiyor |

Soru (2012-ilkbahar kbt/1): MOD restorasyon sonrası hassasiyetin başlıca nedeni; cevap yetersiz kondansasyon.

| | `on` | `arka` |
|---|---|---|
| ✔ | Amalgam restorasyon sonrası hassasiyetin başlıca nedeni nedir? | Yetersiz kondansasyon; kalan boşluklar ve kenar uyumsuzluğu mikrosızıntıya ve hassasiyete yol açar. |
| ✔ (yakın bilgi) | Sınıf II amalgam kavitesinde aksiyopulpal köşe neden yuvarlatılır? | Bu köşede amalgamda biriken gerilmeyi azaltmak ve istmus bölgesinde materyal kalınlığını artırarak kırılmayı önlemek için. |
| ✘ | Hassasiyetin nedeni nedir? | Kondansasyon. | Bağlamsız (hangi restorasyon?), bilgi eksik |

Daha fazlası için `docs/antigravity/dus_konu_spot_ornek.json` dosyasına bak.

---

## 9. Her partiden önce kontrol listesi

- [ ] `--sonraki`nin verdiği 20 sorunun hepsine kayıt yazdım mı?
- [ ] Her `konu` o sorunun dersinin listesinden mi, harfi harfine mi?
- [ ] `diger`i yalnızca gerçekten sığmayan sorularda mı kullandım?
- [ ] Her kart soruyu görmeden anlaşılıyor mu? Yasak ifade, şık harfi, soru kökü kopyası yok mu?
- [ ] Her `on` `?` ile bitiyor, her `arka` tek cümle mi?
- [ ] Karttaki her bilgiden eminim (çözüme körü körüne güvenmedim) değil mi?
- [ ] JSON geçerli mi, `--parca` denetimi `0 hata` diyor mu?

Kaliteyi korumak için hız yapma: 20 soruluk partiler hâlinde çalış ve her partiden sonra denetle.

---

## 10. Bitince

Bütün sınavlar bitince şunları çalıştır:

```
python -I scripts/dus/konu_denetle.py --hepsi
python -I scripts/dus/konu_denetle.py --durum
python -I scripts/dus/konu_denetle.py --ozet
```

Ardından kısa bir rapor yaz:
- `--durum` çıktısındaki TOPLAM satırı,
- `--ozet` çıktısındaki UYARI satırları (varsa) ve `diger` oranı yüksek dersler için hangi tür soruların
  `diger`e düştüğü (bir iki örnek; konu listesine eklenmesi gereken bir başlık varsa öner),
- emin olamadığın için spot yazmadığın ya da tek spotla bıraktığın soruların listesi (sınav + anahtar + bir
  cümle neden),
- hazır çözümde hata olduğunu düşündüğün sorular (sınav + anahtar + bir cümle),
- kalan uyarıların özeti.
