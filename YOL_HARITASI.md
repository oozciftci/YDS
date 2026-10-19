# YDS Çalışma Platformu — Yol Haritası

Bu dosya, uygulamayı kelime odaklı bir araçtan tam kapsamlı bir YDS / dil çalışma platformuna dönüştürme planıdır.
**Her adım bittiğinde güncellenir.** Durum işaretleri: ✅ bitti · 🔄 üzerinde çalışılıyor · ⏳ sırada · 💤 ertelendi.

> Son güncelleme: 19 Ekim 2026

---

## Şu an

- ⏸️ Faz 1 tamamlandı — kullanıcı denemesi ve geri bildirim bekleniyor.

## Sıradakiler (yakın)

1. ⏳ Faz 2.1 – FSRS'in doğru kullanımı (öğrenme adımları, 4 puandaki elle uzatmanın kaldırılması)
2. ⏳ Faz 2.5 – Soru çözerken bilinmeyen kelimeleri tek dokunuşla "Sınavdan Topladıklarım" destesine alma
3. ⏳ Faz 2.2 – Zayıf kelimeler destesi
4. ⏳ Faz 3.1 – Sınav tarihine göre günlük plan kartı (kelime + soru; en zayıf soru tipi önerisi)

## Yapılanlar

| Tarih | İş | Not |
| :--- | :--- | :--- |
| 19.10.2026 | Yol haritası oluşturuldu | Mevcut özellikler envanteri çıkarıldı |
| 19.10.2026 | **Faz 1 – Soru Merkezi** (1.1–1.6) | Soru tipleri, cevaplar veritabanında, giriş ekranı, konuya göre çalışma, Yanlış Defteri, 180 dk deneme + sonuç raporu, tip bazlı başarı çubukları |

---

## Tasarım ilkeleri (her adımda uyulur)

1. **Sade arayüz:** Yeni özellik yeni bir menü kalabalığı demek değildir. Her ekranda tek bir ana eylem öne çıkar; ikincil seçenekler geri planda kalır.
2. **Kendini anlatan ekranlar:** Her bölümün başında bir cümlelik "bu ne işe yarar" açıklaması vardır. Boş durumlarda (henüz veri yokken) ne yapılacağı söylenir.
3. **Çevrimdışı önce:** Her özellik internetsiz çalışır.
4. **Telif güvenliği:** Çıkmış YDS soruları ve çevirileri yalnızca yerelde (`npm run dev`) kullanılır; yayın derlemesine ve GitHub'a girmez. Soru kayıtları (hangi soruya ne cevap verildi) veritabanında yalnızca sınav kimliği + soru numarası olarak tutulur, soru metni kopyalanmaz.
5. **Mobil uyum:** Her ekran telefonda tek elle kullanılabilir.

---

## Mevcut durum envanteri (19.10.2026)

Zaten var olanlar — yeniden yapılmayacak, gerekirse iyileştirilecek:

- FSRS aralıklı tekrar (`ts-fsrs`), 1-5 puanlı kart değerlendirme
- Çalışma modları: flaş kart, çoktan seçmeli, eş anlamlı, cümle içi boşluk, karışık
- Seviye/grup desteleri (A1-A2, B1-B2, C1-C2, Phrasal, Bağlaçlar) + özel gruplar
- Eş anlamlı eşleştirme oyunu, mini kelime denemesi
- Ana sayfada sınav geri sayımı, günlük hedef, seri (streak)
- İstatistik sayfası (seviye dağılımı, tekrar takvimi, en çok yanılınan kelimeler)
- Web Speech TTS telaffuz, etkileşimli cümle (kelimeye dokun → anlam)
- Çoklu profil, JSON yedekleme, Supabase senkron altyapısı, PWA
- **Yerel:** 27 çıkmış YDS sınavı (her biri 80 soru), cümle cümle Türkçe çeviri, orijinal PDF sayfası görüntüleme

---

## Faz 1 — Soru Merkezi (YDS soru çalışmasını tam bir modüle dönüştürme)

Amaç: Elimizdeki 27 sınavı (2.160 soru) en verimli şekilde kullanmak. *Yerel modül.*

| # | İş | Durum | Açıklama |
| :--- | :--- | :---: | :--- |
| 1.1 | Soru tipi sınıflandırması + cevapların veritabanına taşınması | ✅ | ÖSYM düzeni: 1-6 Kelime, 7-16 Dilbilgisi, 17-26 Cloze, 27-36 Cümle Tamamlama, 37-42 Çeviri, 43-62 Okuma, 63-67 Diyalog, 68-71 Yakın Anlam, 72-75 Paragraf Tamamlama, 76-80 Anlam Bütünlüğü. Cevaplar `localStorage` yerine Dexie'de (eski kayıtlar otomatik taşınır). |
| 1.2 | Soru Merkezi giriş ekranı | ✅ | 2 hızlı kart (Devam et, Yanlış Defteri) + konu listesi + sınav listesi (Çöz / Deneme). |
| 1.3 | Konuya göre çalışma | ✅ | Bir tip seçilince tüm sınavlardan (en yeniden başlayarak) çözülmemiş sorular sırayla gelir; hepsi bitince "yeniden çöz". |
| 1.4 | Yanlış Defteri | ✅ | Yanlış yapılan sorular toplanır; defterde doğru çözülünce çıkar, "Defterden çıkar" ile elle de çıkarılabilir. |
| 1.5 | Süreli deneme sınavı | ✅ | 80 soru / 180 dk, çeviri-sözlük kapalı, sayfadan çıkınca kaldığı yerden sürer; sonuçta puan (doğru × 1,25), tip dökümü, çözüm inceleme. |
| 1.6 | Tip bazlı başarı raporu | ✅ | Soru Merkezi'nde her tip için başarı çubuğu ve "en çok zorlandığın tip"; deneme sonunda tip dökümü. Ana sayfaya öneri 3.1 ile gelecek. |

## Faz 2 — Kelime motoru iyileştirmeleri

| # | İş | Durum | Açıklama |
| :--- | :--- | :---: | :--- |
| 2.1 | FSRS'in doğru kullanımı | ⏳ | Öğrenme adımları (`learning_steps`) kaydedilmiyor; 4 puandaki elle uzatma kaldırılıp FSRS'e bırakılacak. |
| 2.2 | Zayıf kelimeler destesi | ⏳ | Sık yanılınan kelimelerden otomatik deste, tek dokunuşla çalışma. |
| 2.3 | Dinleme kartı | ⏳ | Kelime seslendirilir, kullanıcı anlamını seçer/yazar. |
| 2.4 | Soru bağlamında kelime | ⏳ | *Yerel:* kelimenin çıkmış sorularda geçtiği cümleler kartın arkasında. |
| 2.5 | Sorudan kelime toplama | ⏳ | Soru çözerken bilinmeyen kelimeler tek dokunuşla "Sınavdan Topladıklarım" destesine. |

## Faz 3 — Plan ve motivasyon

| # | İş | Durum | Açıklama |
| :--- | :--- | :---: | :--- |
| 3.1 | Sınav tarihine göre günlük plan | ⏳ | "Bugün: 25 tekrar + 10 yeni kelime + 15 soru" — tek kart, ilerledikçe dolar. |
| 3.2 | Çalışma takvimi (ısı haritası) | ⏳ | İstatistikte son 12 haftalık çalışma yoğunluğu. |
| 3.3 | Rozetler / kilometre taşları | ⏳ | Az sayıda, anlamlı: ilk deneme, 7/30 gün seri, 500 kelime vb. |
| 3.4 | Hatırlatma bildirimi | ⏳ | PWA bildirimi, kullanıcı saat seçer. |
| 3.5 | Deneme sonuçları grafiği | ⏳ | Zaman içinde puan gelişimi. |

## Faz 4 — Dilbilgisi rehberi

| # | İş | Durum | Açıklama |
| :--- | :--- | :---: | :--- |
| 4.1 | YDS gramer konu anlatımları | ⏳ | Özgün içerik: zamanlar, edilgen, koşul, bağlaçlar, edatlar, sıfat cümlesi, isim cümlesi, kipler vb. Kısa ve örnekli. |
| 4.2 | Konu başına mikro alıştırma | ⏳ | Özgün 5-10 soruluk alıştırmalar. |
| 4.3 | Sorudan konuya bağlantı | ⏳ | Yanlış yapılan dilbilgisi sorusunda "İlgili konu: …" bağlantısı. |

## Faz 5 — Okuma ve dinleme

| # | İş | Durum | Açıklama |
| :--- | :--- | :---: | :--- |
| 5.1 | Okuma modu | ⏳ | Paragraf odaklı okuma, bilinmeyen kelime işaretleme, okuma süresi. |
| 5.2 | Cümle seslendirme | ⏳ | Paragraf ve cümleleri TTS ile dinleme, hız ayarı. |

## Faz 6 — Yapay zekâ ve platform

| # | İş | Durum | Açıklama |
| :--- | :--- | :---: | :--- |
| 6.1 | "Neden yanlış?" açıklaması | 💤 | API anahtarı / maliyet kararı gerektirir. |
| 6.2 | Yazma pratiği geri bildirimi | 💤 | Aynı karar. |
| 6.3 | Cihazlar arası ilerleme senkronu | 💤 | Supabase altyapısı mevcut; yalnızca ilerleme verisi, soru metni asla. |
| 6.4 | Anki / CSV içe-dışa aktarma | ⏳ | |

---

## Değişiklik günlüğü

- **19.10.2026** — Faz 1 tamamlandı: `/yds-sorular` artık Soru Merkezi (alt sayfalar: `sinav/:id`, `konu/:tip`, `yanlislar`, `deneme/:id`). Cevaplar Dexie `examAnswers`, deneme sonuçları `mockResults` tablosunda (DB v5); eski tarayıcı kayıtları otomatik taşındı; JSON yedek v3 bu tabloları içerir. Yayın derlemesinde modül yok (dist kontrol edildi).
- **19.10.2026** — Yol haritası oluşturuldu. Faz 1.1'e başlandı.
