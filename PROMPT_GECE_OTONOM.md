# Gece / Otonom Çalışma Yönergesi (yeni session için başlangıç promptu)

> Bu dosyanın tamamını yeni session’ın ilk mesajı olarak ver. Aynı metin `docs/` altında değil, proje kökünde durur; session yeniden başladığında da önce bunu oku.

---

## Sen kimsin, ne yapıyorsun

“YDS Kelime” projesinde (C:\Projeler\YDS_Proje; React 19 + TypeScript + Vite + Dexie; Türkçe arayüz; çevrimdışı çalışan PWA; uygulama içi yapay zekâ Gemini) kullanıcının yardımcı geliştiricisisin. Kullanıcı yatıp uyuyacak; **bu session sabah 06:05’e kadar (yaklaşık 8 saat) kendi kendine çalışacak.** 5 saatlik kullanım hakkı bittiğinde bekle, yenilenince **kaldığın yerden otomatik devam et**. Kullanıcıya soru sorma (soracaklarını aşağıdaki dosyaya yaz).

Saati her büyük adımın başında `date` ile kontrol et. **06:05’e ~30 dk kala** yeni büyük iş başlatma; yarım işi güvenli bir noktaya getir, commit’le, “sabah raporunu” yaz.

## Önce oku (sırayla)

1. `YOL_HARITASI.md` — özellikle **“Sıradakiler”** ve **Faz 7–10**.
2. `docs/PIYASA_ARASTIRMASI.md` — neden bu özellikler, rakipler ne vaat ediyor.
3. `PROJECT_MEMORY.md`, `PROMPT_YZ_KOC_VE_TAKTIK.md` — mimari ve eski kararlar.
4. Hafıza dizini (`MEMORY.md` ve bağlı dosyalar) — kullanıcı tercihleri.
5. `GECE_ILERLEME.md` — **varsa** son durum burada; oradan devam et. Yoksa oluştur.

## Kesin kurallar

- **Kullanıcıya görünen her metin Türkçe.** (Arayüz, açıklamalar, commit dışındaki mesajlar.)
- **Arayüz sade ve açıklamasız anlaşılır olsun;** ana sayfaya yeni karmaşa ekleme. Yeni özellik = mevcut ekranda küçük kart/sekme.
- **Telif:** Çıkmış sınav soruları (`local-data/`, `cikmis_sorular/`) **yalnızca yerelde** kalır; yayına (`public/`, GitHub) hiçbir çıkmış soru metni girmez. Yayına girebilecekler: tamamen **özgün** içerik, sayısal istatistik, kelime + anlam + sıklık. Özgün içerik ÖSYM metninden kopya/uyarlama olmamalı.
- **Git:** her anlamlı adımda **yalnızca ilgili dosyaları tek tek `git add` ile** ekleyip commit’le (`git add -A` yasak; başka dosyalar takipsiz kalabilir). **Push yok.** Commit mesajı sonuna `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` ekle. Kasa şifrelemesi (`npm run vault:lock`) ve push **kullanıcıya** aittir; yerel veri değiştiyse raporda hatırlat.
- **Anahtar/şifre:** API anahtarı ya da parola isteme, yazma, günlüğe koyma. Betiklerden Gemini’yi **çağırma** (anahtar yok); yapay zekâ özellikleri uygulama içinde `src/services/ai.ts` üzerinden çalışır. Test ederken `generativelanguage` isteğini taklit et (mock), test verisini sonra temizle.
- **Her adım sonunda `YOL_HARITASI.md` güncelle** (ilgili satır ✅, değişiklik günlüğü, “Sıradakiler”); sonra `GECE_ILERLEME.md`’yi güncelle.
- **Belirsizlikte** en makul, geri alınabilir varsayılanı seç, devam et ve kararı `SABAHA_SORULAR.md`’ye yaz (soru + seçtiğin varsayılan + neden). Karar gerektirip riskli olanı (silme, veri kaybı, bütçe) atla.
- Bütçe kaygısı: Gemini ayda ~10 $ kişisel bütçe; yeni YZ özellikleri sonuçları **önbelleğe alsın** (Dexie), soru başına tek sefer ücretlensin.

## Teknik tuzaklar (Windows + bash)

- `node -e` / heredoc içinde ters eğik çizgi ve `\n` bozuluyor → betikleri **Write aracıyla dosya olarak yaz** ve çalıştır; regex/kaçışlı Python için `<<'PYEOF'` kullan, çıktıyı kontrol et.
- Depodaki birçok dosya **CRLF**; çok satırlı Edit başarısız olursa Python ile CRLF’i normalleştirerek düzenle.
- Geçici dosyalar için scratchpad dizinini kullan (sistem istemi verir).
- Geliştirme sunucusu: `.claude/launch.json` → `preview_start`; yerel sınav verisi yalnızca dev sunucusunda `/local-api/yds` altında görünür (şu an port 5174). Tarayıcı doğrulaması için `read_page`, `javascript_tool`, ekran görüntüsü kullan.
- `npx tsc -b` hatasız, `npx oxlint` yeni uyarı eklemeden geçmeli. Test altyapısı yok (10.2’de kurulacak).
- PDF araçları: yalnızca `pdftotext` var (sayfa görüntüsü çıkaramazsın).
- `src/services/ydsSections.ts`: `sectionOf(no, examId)`; YÖKDİL sınav kimlikleri `yokdil-` ile başlar. Sınav verisi `local-data/yds/<id>.json` + `<id>.tr.json`; havuz süzgeci `src/pages/exam/examData.ts` (`inPool`, `readPool`).

## Çalışma sırası (YOL_HARITASI’ndaki öncelikle birebir)

Her adımda: **kodla → tsc/oxlint → tarayıcıda doğrula (previewable ise) → roadmap + günlük → commit.**

**Blok 1 — Kullanıcı tarafı özellikler (Faz 7.1–7.6)**
1. 7.1 Hedef puan planlayıcı (Ayarlar’daki hedef puan; `ydsScore`; tipe göre dağılım önerisi; Bugünkü Plan’a bağla).
2. 7.2 Deneme zaman analizi (MockExam’da soru başına süre kaydı → `mockResults`; sonuç ekranında tip başına süre tablosu, yavaş tipler).
3. 7.3 Yanlış nedeni etiketi (Dexie sürümü artır, JSON yedeğe ekle; “Hatalarımı analiz et” kullansın).
4. 7.4 Özel deneme oluşturucu (tip / yıl / havuz süzgeci / soru sayısı / süre).
5. 7.5 Denemeler arası karşılaştırma tablosu + sınava kalan zamana göre deneme sıklığı önerisi.
6. 7.6 Gramer konusu sınav sıklığı (önce yerel betikle sayıları üret; yayına yalnızca sayılar).

**Blok 2 — Özgün içerik (Faz 8; yayına girebilir) — paralel/aralarda sürdür**
7. 8.1 Özgün soru bankası: `public/data/ozgun/` altında `ExamBundle` biçiminde (kelime, gramer, cloze, cümle tamamlama, çeviri, paragraf) **300+ soru**, her şık için Türkçe çeldirici açıklaması; tip başına en az 40 soru. Sonra “Alıştırma Merkezi” sayfası (YDS TEST’i genişlet). Kalite kontrol betiği: tek doğru cevap, şık tekrarı yok, açıklama var, uzunluk dengesi.
8. 8.2 Gramer mikro-alıştırmalar 5 → 10. 8.3 Özgün okuma metinleri (+sorular). 8.5 Çeviri cümleleri.
9. 8.4 YÖKDİL alan terimleri paketleri (Fen/Sağlık/Sosyal): `scripts/tagYokdil.mjs` mantığıyla havuzda olmayan sık terimleri çıkar, **anlam/tür/eş anlam sen yaz** (`scripts/data/*.txt` biçimi), yalnızca kelime+anlam+sıklık yayına girer.

**Blok 3 — Veri hazırlama (Faz 9; yerel)**
10. 9.1 Soru etiket veritabanı (`local-data/analiz/soru_etiketleri.json`; konu/alt konu; hedefli çalışma ve konu bazlı Yanlış Defteri için API’ye hazırla). 9.2 Kelime–soru eşleme (YÖKDİL dâhil). 9.3 Doğrulama notları (2018 Aralık: S29 69 PDF’te doğru görünüyor, S65 bizde doğru görünüyor; 67/68/70 için gerekçeli not; PDF’te eksik 5 yer listesi).

**Blok 4 — Kalite (Faz 10)**
11. 10.1 Yayın güvenlik denetimi betiği (`scripts/checkDist.mjs`: `dist` içinde `local-data` metin parçaları ve “YÖKDİL/YDS çıkmış” imzaları ara; `npm run build` sonrası çalıştır). 10.2 Vitest kur, çekirdek servislere test yaz. 10.3 Uyarıları temizle.

**Blok 5 — Zaman kalırsa (Faz 7.7–7.10)**
12. Çeviri atölyesi → benzer özgün soru üret → leech/boşluk kartı → metinden kelime çıkar → haftalık koç raporu. (Hepsi `ai.ts` üzerinden, önbellekli, bütçe sınırlı.)

**Bekleyenler — dokunma, sadece raporda hatırlat:** 6.7b Taktik Kitabı (hoca PDF’leri), 6.3 senkron, File Search, 5.3, kasa kilitleme/push.

## Süreklilik dosyaları

- `GECE_ILERLEME.md`: her adımdan sonra güncelle — “Yapılanlar (commit özetiyle)”, “Şu an”, “Sıradaki 3 iş”, “Engeller”. Session yeniden başladığında ilk iş bunu ve `git log --oneline -20` ile `git status`’u oku.
- `SABAHA_SORULAR.md`: kullanıcıya soracakların ve seçtiğin varsayılanlar.
- Sabah 06:05’e doğru `SABAH_RAPORU.md`: ne yapıldı (özellik özellik, commit’lerle), neyi nasıl dene (adım adım, Türkçe), bilinen sorunlar, kullanıcının yapması gerekenler (`npm run vault:lock`, push, sorulara cevap), sonraki öneriler. Aynı özeti sohbete de yaz.

## Çıktı kalitesi

- Özgün sorular: ÖSYM tarzında ama telif içermeyen, bilgi olarak doğru, tek doğru cevaplı; her cevabı ikinci kez kendin doğrula. Kısa, doğal İngilizce; konu çeşitliliği (bilim, tarih, toplum, sağlık…).
- Her yeni ekran: boş durum, hata durumu, mobil genişlik, koyu tema kontrol et.
- Veritabanı değişikliğinde: Dexie sürümü + yedek (JSON) + geri uyumluluk.
- Büyük işlerde araya küçük commit’ler koy; her commit tek konulu olsun.
