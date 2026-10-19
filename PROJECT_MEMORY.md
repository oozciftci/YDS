# YDS Projesi Hafıza & Durum Raporu (PROJECT_MEMORY)

Bu dosya, YDS (Yabancı Dil Bilgisi Seviye Tespit Sınavı) Kelime Çalışma Uygulamasının tüm mimarisini, bugüne kadar alınan kararları, mevcut durumunu ve yapılacak işleri belgeleyen **kalıcı proje hafızasıdır**.

> **Son Güncelleme:** 13 Ekim 2026  
> **Konuşma / Oturum Geçmişi:** `session-history/` klasöründe arşivlenmiştir.  
> **Yol haritası ve yapılanlar/sıradakiler listesi:** `YOL_HARITASI.md` (her adımdan sonra güncellenir).

---

## 1. Proje Özeti ve Temel Mimari

- **Uygulama Türü:** Progressive Web App (PWA) — Masaüstü ve mobilde çevrimdışı (offline-first) çalışır.
- **Odak Noktası:** YDS odaklı kelime pratikleri, Spaced Repetition (FSRS / SM-2 algoritması), eş anlamlı kelime eşleştirme, çoktan seçmeli sınav simülasyonu ve Web Speech TTS (telaffuz).
- **Frontend:** React 19 + TypeScript + Vite 8
- **Tasarım & Stil:** Vanilla CSS / CSS Modules + Inter Variable font
- **Yerel Veritabanı:** Dexie.js v4 (IndexedDB) — İnternetsiz tam işlevsellik
- **State Yönetimi:** Zustand v5
- **Senkronizasyon:** Supabase JS Client (İnternet olduğunda iki yönlü senkronizasyon altyapısı)
- **Hafıza & Algoritma:** `ts-fsrs` (Free Spaced Repetition Scheduler — Anki standardı)
- **PWA / SW:** `vite-plugin-pwa` + Workbox (Otomatik sessiz arka plan güncellemeleri)

---

## 2. Kritik Teknik Kurallar (Tavizsiz İlkeler)

1. **Offline-First:** İnternet bağlantısı olmasa dahi kelime çalışılabilmeli, test çözülebilmeli ve skorlar kaydedilebilmelidir.
2. **Kapsamlı Loglama:** Etkileşimler (bildi/bilemedi, oturum süreleri, hatalar) yerelde biriktirilir (`logger.ts`), internet geldiğinde backend'e aktarılır.
3. **Dinamik Backend Ayarları:** API veya sunucu adresleri kod içine gömülmez (`hardcoded` yasaktır). `SettingsPage` üzerinden kullanıcı URL tanımlar ve `localStorage`'da saklanır.
4. **Çoklu Kullanıcı Desteği:** Farklı kullanıcı profilleri oluşturulabilir, kelimeler ve ilerlemeler kullanıcı bazlı saklanır ve profiller arası kelime aktarımı yapılabilir.

---

## 3. Sayfa ve Bileşen Haritası

| Sayfa / Bileşen | Dosya Yolu | Görevi |
| :--- | :--- | :--- |
| **Ana Sayfa (Dashboard)** | `src/pages/Home.tsx` | Günlük hedef takibi, tekrar bekleyen kelime sayısı, hızlı pratik başlatıcılar. |
| **Akıllı Tekrar (Study)** | `src/pages/Study.tsx` | FSRS algoritmasıyla 4 kademeli (Again, Hard, Good, Easy) kelime kartı çalışması. |
| **Sınav / Test (ExamQuiz)**| `src/pages/ExamQuiz.tsx` | 4 seçenekli YDS sınav simülasyonu, anlık skor ve kelime açıklamaları. |
| **Eş Anlamlı Eşleştirme** | `src/pages/SynonymMatch.tsx` | YDS soru köklerinde sık çıkan eş anlamlı kelimeleri interaktif kartlarla eşleştirme. |
| **Kelime Kütüphanesi** | `src/pages/Words.tsx` | Kelime arama, filtreleme, telaffuz dinleme, yeni kelime ekleme/düzenleme/silme. |
| **İstatistikler** | `src/pages/Stats.tsx` | Öğrenme kademeleri (New, Learning, Review, Mastered) ve unutma eğrisi grafikleri. |
| **Ayarlar** | `src/pages/Settings.tsx` | Dinamik backend URL testi, PWA/SW durumu, depolama kullanımı, profil yönetimi, JSON yedekleme/yükleme. |
| **YDS Soru Merkezi (yalnızca yerel)** | `src/pages/ExamStudy.tsx` + `src/pages/exam/` | Sınav çöz, konuya göre çalış, Yanlış Defteri, 180 dk deneme; cevaplar `examAnswers`, denemeler `mockResults` tablosunda. Soru tipleri: `src/services/ydsSections.ts`. |
| **Etkileşimli Cümle** | `src/components/InteractiveSentence.tsx` | Örnek cümlelerdeki kelimelere tıklayarak anında anlamını görme. |
| **Kelime Paketleri** | `src/data/wordPacks.ts` | Hazır YDS kelime paketleri (Akademik, Bağlaçlar, Fiiller vb. tek tıkla kütüphaneye aktarım). |

---

## 4. Tamamlanan Aşamalar & Kronoloji

- **Adım 1 (12 Ekim 2026):** Vite + React + TS iskeleti kuruldu, PWA yapılandırması (manifest, service worker) hazırlandı, dinamik backend destekli `Settings` sayfası geliştirildi.
- **Adım 2 (12 Ekim 2026):** Dexie.js ile yerel veritabanı şemaları kuruldu (`words`, `study_logs`, `logs`, `users`). FSRS aralıklı tekrar algoritması entegre edildi.
- **Adım 3 (12 Ekim 2026):** `Home`, `Study`, `Words`, `Stats` sayfaları tamamlandı. Hazır kelime paketleri oluşturuldu.
- **Adım 4 (12 Ekim 2026):** `ExamQuiz` ve `SynonymMatch` interaktif oyun modları eklendi. Çoklu kullanıcı yönetimi ve kelime transfer modalları geliştirildi.
- **Adım 5 (13 Ekim 2026):** Oturum geçmişi yönetim altyapısı kuruldu (`npm run history`), konuşma logları arşivlendi.
- **Adım 6 (13 Ekim 2026):** Görsel iyileştirme ve tasarım standardizasyonu (4 Aşama) başarıyla tamamlandı.
- **Adım 7 (13 Ekim 2026):** Seviye ve Grup Odaklı Çalışma Mimarisi (Kullanıcı Geri Bildirimiyle Yeniden Yapılandırma):
  - **Kesintisiz Navigasyon:** Çalışma ekranına veya FSRS tekrarlarına girildiğinde kullanıcıyı hapseden yapı kaldırıldı; üst barda her ekranda çalışan `← Ana Sayfaya Dön` bağlantısı ve kırıntı (breadcrumb) sistemi eklendi.
  - **3.350+ Kelimenin Seviye & Grup Odaklı Yapılandırılması:** Karambole rastgele 15 soru hissi tamamen ortadan kaldırıldı; kelimeler `Seviye 3: C1-C2 İleri Düzey (YDS Akademik)`, `Seviye 2: B1-B2 Orta Düzey`, `Seviye 1: A1-A2 Başlangıç`, `YDS Phrasal Verbs` ve `Bağlaçlar & Edatlar` hazır seviye destelerine ayrıldı.
  - **Özel Grup & Deste Oluşturma ("Kelimeyi Grupla"):** Kullanıcının kendi adlandırdığı özel gruplar açabilmesi, kelimeleri tek tıkla (`🏷️ Gruba Ekle`) bu destelere dahil edebilmesi ve dilediği zaman yalnızca o desteyi çalışabilmesi sağlandı (`AssignGroupModal.tsx`).
  - **Flaş Kartların Öncelikli / Önerilen Mod Yapılması:** Soru türü seçimi varsayılan olarak doğrudan `🗂️ Flaş Kartlar (Önerilen)` moduna getirildi.
  - **Grup Bazlı Günlük İlerleme & İstatistik Takibi:** Yapılan tüm oturumlar `sessionLogs` tablosunda doğru/yanlış, soru sayısı ve başarı yüzdesiyle kaydedildi; Ana Sayfa ve İstatistikler ekranında "Bugün Çalışılan Gruplar ve Performans" panelleriyle gösterildi.
- **Adım 8 (13 Ekim 2026 - İkinci Oturum):** Kart İyileştirmeleri, Simetrik Flaşkart & Sıralı Grup Ekleme:
  - **"Yarıda Bırakıldı" Başlık Temizliği:** Kafa karıştıran `(41 - 60)` aralıkları kaldırıldı; kategori adı, seviye numarası ve çalışma modu entegre edildi (`C1-C2 İleri Düzey • Level 3 • Flaşkart Modu`).
  - **Simetrik Flaşkart & Sıfır Dikey Kayma:** Ön ve arka yüzler `faceContainer`, `topPromptBlock`, sabit 115px `mainPromptCenter` ve sabit 54px `centerFlipWrap` ile eşitlendi; kart çevrilirken buton ve kelime tam olarak aynı pikselde kalacak şekilde hizalandı.
  - **Ön Yüzde Gruba Ekle & Sıra Numarası Belirleme:** Ön yüze `➕ Gruba Ekle` butonu ve modalı eklendi. Kelime eklenirken sıra numarası seçilebiliyor (örn: 4 yazılırsa 4. sıraya yerleşip sonrakiler kaydırılıyor, boş bırakılırsa sona ekleniyor).
  - **Son Kullanılan 2 Grup Hızlı Butonları (`⚡`):** Ön yüzde en son işlem yapılan 2 grubun adını dinamik gösteren ve tek tıkla ekleme sağlayan hızlı butonlar eklendi.
  - **Tam Yedekleme Kapsamı (`backup.ts`):** JSON export/import motoru `wordGroups`, `sessionLogs` ve `levelProgress` tablolarını da içerecek şekilde v2'ye yükseltildi.
  - **Ev Kurulum Kılavuzu & Dokümantasyon:** `KURULUM_VE_GELISTIRME_REHBERI.md` ve kapsamlı `README.md` hazırlandı.

---

## 5. Sıradaki Hedefler ve İyileştirmeler

### Tamamlananlar:
- [x] Tasarım Sistemi ve Renk Tokenları Standardizasyonu (`index.css`)
- [x] Ana Sayfa (Dashboard) Sadeleştirmesi ve Odak Akışı (`Home.tsx`)
- [x] Çalışma Ekranı (Study / Flashcard) Tasarım Sadeleştirmesi (`Study.module.css`)
- [x] Kelimeler (Words) Kütüphanesi & Tablo Standardizasyonu (`Words.module.css`)
- [x] Oturum geçmişi yönetim altyapısı (`npm run history` & `session-history/`)
- [x] Seviye & Grup Mimarisi, Flaşkart Önceliği, Kesintisiz Navigasyon ve Oturum Kayıtları (`groups.ts`, `AssignGroupModal.tsx`)
- [x] Kart başlık formatı, simetrik çevirme hizalaması, sıralı gruba ekleme ve son 2 grup hızlı butonları
- [x] Tam veritabanı JSON yedekleme/geri yükleme altyapısı (v2)
- [x] Ev bilgisayarı kurulum rehberi (`KURULUM_VE_GELISTIRME_REHBERI.md`) ve `README.md`

### Seviye Düzeltmesi ve YDS Sıklığı (16 Ekim 2026)
- **Sorun:** Havuzdaki CEFR seviyeleri Oxford 5000'den alınırken bir kelimenin birden çok anlamından *sonuncusu* kullanılıyordu (örn. `arm` A1 yerine C1). Listede olmayan 417 kelime sessizce B1 yapılmıştı. Ayrıca `groups.ts` içindeki C1-C2 grubu `difficulty` 4'ü de (yani B2'yi) içeriyordu.
- **Çözüm:** `scripts/fixLevels.mjs` en düşük anlam seviyesini kullanır, listede olmayan kelimeleri kök/türeme/phrasal kuralıyla çıkarır ve `Seviye-Tahmini` etiketi koyar. `getWordLevelGroup()` her kelimeyi tek gruba koyar. `src/services/levelMigration.ts` daha önce içe aktarılmış kelimeleri bir kez günceller (`yds-levels-v2` bayrağı).
- **YDS sıklığı:** `2013-2023-tum-ydsler.pdf` (pdftotext ile) metninden sayıldı; etiketler `YDS-Çok-Sık` (>=55), `YDS-Sık` (>=20), `YDS-Ara` (>=8). Korpus küçüktür (~150 bin sözcük). Son YDS PDF'leri taranmış görüntü olduğundan OCR gerekir (kurulu değil). Resmi/doğrulanmış YDS sıklık listesi bulunamadı.
- **Yeniden üretmek için:** `pdftotext -layout cikmis_sorular/2013-2023-tum-ydsler.pdf yds.txt` sonra `node scripts/fixLevels.mjs yds.txt`.

### YDS Sınav Kelimeleri Paketi (16 Ekim 2026)
- Çıkmış YDS metinlerinde sık geçen ama Oxford 3000 havuzunda olmayan 397 kelime (`scripts/data/yds_sinav_kelimeleri.txt`, Türkçe anlam + eş anlamlı + özgün örnek cümle). Sınav cümleleri telif nedeniyle kullanılmadı.
- `node scripts/buildYdsPack.mjs <metin.txt...>` -> `public/data/yds_sinav_paketi.json` (seviye Oxford 5000'den, yoksa C1 + `Seviye-Tahmini`; `YDS-Sınav-Paketi` etiketi; sıklık notu).
- Paketler penceresinde "📝 YDS Sınav Kelimeleri" kartı. Akademik çekirdek paket (30) de görünür yapıldı.

### YDS Soru Çalışma Sayfası — YALNIZCA YEREL (16 Ekim 2026)
- Çıkmış YDS soruları (telifli) yayına/GitHub'a girmez. Sayfa `/yds-sorular` yalnızca `npm run dev` ile açılır: `App.tsx` içinde `import.meta.env.DEV` ile bağlı, yayın derlemesinde yoktur (dist'te doğrulandı). Veri `local-data/yds/` (git'te yok, `.gitignore`) klasöründen `vite.config.ts` içindeki dev-only `/local-api/yds` ara katmanıyla (yalnızca 127.0.0.1) sunulur.
- Boru hattı: PDF -> `C:\Projeler\OCR` (olmOCR, `--models olmocr --no-consensus`) -> `node scripts/parseYdsExam.mjs <sınav-adı>` -> `local-data/yds/<sınav>.json` (paragraflar, soru/şık, cümle kimlikleri, cevap anahtarı). Çeviriler ayrı dosyada: `local-data/yds/<sınav>.tr.json` (cümle kimliği -> Türkçe), ayrıştırıcı yeniden çalışınca kaybolmaz.
- Arayüz: cümle başındaki 🌐 çeviriyi açar, kelimeye dokununca anlam balonu (havuza ekleme dahil), şık seçip cevap kontrolü, altta paragraf/soru/şık çevirileri. İlerleme tarayıcıda (`yds-exam-progress:*`).
- Durum (16 Ekim 2026): 5 sınavın tamamı çevrildi (2024 Mart/Kasım, 2025 Mart/Kasım, 2026 Mart). 2025 Yaz atlandı: OCR çıktısı iki sütun karışıklığıyla bozuk (`local-data/yds/_eksik/`). Yeni sınav eklemek: OCR -> `parseYdsExam.mjs` -> `trTools.mjs list/merge`.
- Her soru/paragraf kaynak PDF sayfasını (`page`) taşır; sayfada "📄 Orijinal sayfa N" düğmesi PDF'i o sayfada açar (dev-only `/local-api/pdf/<dosya>`, yalnızca 127.0.0.1). `parseYdsExam.mjs` seçenekleri: `--pdf --prefix --offset --range`.
- 2013-2023 derlemesi (594 sayfa) OCR hattının 300 sayfa sınırı nedeniyle `tumydsler-p1/p2` olarak ikiye bölünüp okutuldu (p2 için `--offset 300`).
- 2013-2023 derlemesi (OCR'lı, 22 sınav) ayrıştırıldı: sayfalar `scratchpad/all/tum_sNNN.md` altında birleştirilip `parseYdsExam.mjs <id> <klasör> --prefix tum --range a-b --pdf 2013-2023-tum-ydsler.pdf --title ...` ile işlendi. Cevap anahtarı, her kitapçığın "SINAVDA UYULACAK KURALLAR" sayfasından sonraki sayfadadır (3 biçim: "1. A" satırları, iki sütun, `<th>1.C</th>`). Yapısal denetim: `node scripts/qcExams.mjs`. `yds-2022-a-anahtarsiz` (518-542) için cevap anahtarı derlemede YOK; `yds-2021-nisan` 65. cevap OCR'da okunamadı, `scripts/data/answer_overrides.json` ile D olarak düzeltildi.
- Sıklık etiketleri 2013-2023 derlemesi + 5 OCR'lı sınavla yeniden hesaplandı (eşikler 70/25/10); `levelMigration` bayrağı `yds-levels-v3`.

### Kelime Analizi ve "Yeni YDS Kelimeleri" Paketi (19 Ekim 2026)
- `node scripts/analyzeYdsCorpus.mjs`: 27 ayrıştırılmış sınavın (2013-2026, 13 farklı yıl) tüm İngilizce cümle/şıklarını kök bazında sayar (Oxford 5000 + havuz sözlüğüyle kural tabanlı kök bulma, İngiliz yazımı Amerikan'a eşlenir, özel isimler ve işlev sözcükleri atlanır). Her kök için: toplam geçiş, kaç sınavda/yılda, bölüm dağılımı (ÖSYM 80 soru düzeni), paragraf/kök/şık ayrımı, şıkta ve doğru şıkta kaç kez, kelime sorularında (1-6) şık/doğru cevap sayısı.
- YEREL çıktılar (`local-data/analiz/`, git'te yok, telifli): `yds_kelime_analizi.html` (çift tıkla açılan rapor: arama/filtre, kelime ayrıntısı, yıllık grafik, geçtiği tüm cümleler + Türkçe çevirileri, kelime sorusu şıkları sekmesi), `kelime_analizi.json`, `kelime_ornekleri.json`.
- YAYINA GİREN paket `public/data/yeni_yds_kelimeleri.json` (821 kelime): havuzda olmayan, en az 4 sınavda geçen ya da kelime sorusunda şık olan kökler. Türkçe anlamlar `scripts/data/yeni_yds_kelimeleri.txt` (elle yazıldı; "-" olanlar alınmaz). Sınav cümlesi içermez; notlarda yalnızca sayısal istatistik, etiketler `Yeni-YDS-Kelimeleri`, `YDS-Şıkta-Çıktı`, `YDS-Doğru-Cevap`, sıklık (`YDS-Çok-Sık` >=15 sınav, `YDS-Sık` >=8, `YDS-Ara` >=4).
- Paketler penceresinde "🆕 Yeni YDS Kelimeleri" kartı. Dev sunucusunda yüklenirse kelimelere en fazla 3 gerçek sınav cümlesi + çeviri eklenir (dev-only `/local-api/kelime-ornekleri`, yalnızca 127.0.0.1).
- Not: okuma sorusu kalıpları ("according to the passage", "underlined word") bazı kelimelerin sayısını şişirir; ayrıntıda paragraf/kök/şık ayrımı görülür.

### Sıradaki Önerilen Adımlar:
1. **GitHub Güncellemesi:** Yapılan tüm geliştirmelerin GitHub'a push edilmesi.
2. **Ev Bilgisayarı Kurulumu:** `KURULUM_VE_GELISTIRME_REHBERI.md` adımları takip edilerek ev bilgisayarında projenin çalıştırılması ve JSON yedeğinin aktarılması.

---

## 6. Antigravity IDE Oturum Kayıtları (Session Log Reference)

Diskte saklanan ve gerektiğinde `npm run history -- --export <num>` ile okunabilen oturumlar:

| No | Tarih | Oturum ID | Konu |
| :---: | :---: | :--- | :--- |
| **1** | 13.10.2026 13:18 | `e4fd061e...` | Oturum geçmişi sorununun çözümü, hafıza sistemi & script kurulumu (Şu anki oturum). |
| **2** | 13.10.2026 09:55 | `257932f3...` | YDS geliştirme süreci, tasarım kaosunun giderilmesi üzerine ilk analizler. |
| **3** | 12.10.2026 12:59 | `2a66d201...` | **YDS Projesinin ana mimarisinin, tüm sayfalarının ve modüllerinin inşa edildiği büyük oturum.** |
