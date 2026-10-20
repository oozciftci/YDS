# YDS Çalışma Platformu — Yol Haritası

Bu dosya, uygulamayı kelime odaklı bir araçtan tam kapsamlı bir YDS / dil çalışma platformuna dönüştürme planıdır.
**Her adım bittiğinde güncellenir.** Durum işaretleri: ✅ bitti · 🔄 üzerinde çalışılıyor · ⏳ sırada · 💤 ertelendi.

> Son güncelleme: 19 Ekim 2026

---

## Şu an

- ✅ YÖKDİL (12 sınav) havuza girdi, çevrildi, YDS metinleri PDF ile doğrulandı, kelime etiketleri ayrıldı. Piyasa araştırması yapıldı (`docs/PIYASA_ARASTIRMASI.md`); Faz 7–10 eklendi.
- ⏸️ Faz 6.7 altyapısı tamamlandı (veri biçimi, yerel API, Koç / Saf Gemini seçimi, Taktik Kitabı ekranı, `kaynakTools.mjs`). **Hoca PDF’leri bekleniyor:** `local-data/kaynaklar/` klasörüne konunca OCR → harita → kurallar çıkarılacak. Faz 6.5c (Geliştirici danışmanı + Öneriler) ve “Hatalarımı analiz et” de tamamlandı.

**Alınan kararlar (19.10.2026):** Sağlayıcı Gemini; önce ücretli Tier 1 (ön ödemeli, otomatik yükleme kapalı, 10 $ harcama sınırı), bakiye/sınır bitince ücretsiz katman anahtarına otomatik geçiş; çıkmış soru metinlerinin Gemini’ye gönderilmesine izin var (yalnızca başka kullanıcılara açılmamalı); varsayılan model gemini-3.8-flash, Ayarlar’dan değiştirilebilir; anahtarlar yalnızca cihazda.

## Sıradakiler (yakın)

> Piyasa araştırması ve gerekçeler: **`docs/PIYASA_ARASTIRMASI.md`**. Gece/otonom çalışma yönergesi: **`PROMPT_GECE_OTONOM.md`**. Eski kararlar: `PROMPT_YZ_KOC_VE_TAKTIK.md`.

**Bu sırayla yürütülür (Faz 7–10 aşağıda ayrıntılı):**

1. ✅ 7.1 Hedef puan planlayıcı · ✅ 7.2 Deneme zaman analizi → 7.3 Yanlış nedeni etiketi ✅ → ✅ 7.4 Özel deneme oluşturucu → ✅ 7.5 Denemeler arası tablo + deneme sıklığı önerisi → ✅ 7.6 Gramer konusu sınav sıklığı
2. ✅ 8.1 Özgün soru bankası (yayına girebilir) ve Alıştırma Merkezi · 8.2 Gramer mikro-alıştırma genişletme · 8.3 Özgün okuma metinleri · 8.4 YÖKDİL alan terimi paketleri · 8.5 Çeviri cümleleri
3. ⏳ 9.1 Soru etiket veritabanı (yerel) · 9.2 Kelime–soru eşleme (YÖKDİL dâhil) · 9.3 Doğrulama notları (2018 Aralık cevap farkı)
4. ⏳ 10.1 Yayın güvenlik denetimi · 10.2 Birim testleri · 10.3 Temizlik
5. 💡 Faz 7.7–7.10: Çeviri atölyesi, benzer özgün soru üretimi, leech yönetimi, metinden kelime çıkar, haftalık koç raporu
6. ⏳ Faz 6.7b Taktik Kitabı içeriği (**hoca PDF’lerini bekliyor**)
7. 💡 Gemini File Search “kaynağa sor” · ❓ Faz 6.3 senkron · 💡 Faz 5.3 okuma kütüphanesi · 💡 Telefonda çıkmış sorulara erişim

## Yapılanlar

| Tarih | İş | Not |
| :--- | :--- | :--- |
| 19.10.2026 | Yol haritası oluşturuldu | Mevcut özellikler envanteri çıkarıldı |
| 19.10.2026 | **Faz 1 – Soru Merkezi** (1.1–1.6) | Soru tipleri, cevaplar veritabanında, giriş ekranı, konuya göre çalışma, Yanlış Defteri, 180 dk deneme + sonuç raporu, tip bazlı başarı çubukları |
| 19.10.2026 | **Faz 2.1 – FSRS hataları giderildi** | 3 puanlı kartlar 10 dk döngüsünde, "Öğrendim (4)" kartları her gün takılı kalıyordu; yeni kartlarda ilk aralıklar kısaydı. Düğmelerde "sonraki tekrar" önizlemesi. |
| 19.10.2026 | **Faz 2.2 + 2.5 – Akıllı desteler** | "🎯 Zorlandıklarım" ve "📥 Sınavdan Topladıklarım" (boşken gizli); Ana Sayfa deste kısayolları artık desteyi açıyor. |
| 19.10.2026 | **Faz 2.3 – Dinleme modu** | Sesi duy, anlamını seç; karışık modda da ara sıra gelir. |
| 19.10.2026 | **Faz 2.4 – Soru bağlamı** (yerel) | Kart arkasında "Çıkmış YDS sorularında N kez geçti" + çevirili örnekler. |
| 19.10.2026 | **Faz 3.1 – Bugünkü Planın** | Ana sayfada tekrar + yeni kelime + soru görevleri; hedefler sınava kalan güne göre; en zayıf soru tipi önerisi. "Günün Tekrarları" artık yalnızca çalışılmış kartlar; yeni "🌱 Yeni Kelimeler" destesi YDS sıklığına göre. |
| 19.10.2026 | **Faz 3.2 – Çalışma Takvimi** | İstatistik'te 12 haftalık ısı haritası, 30 günde çalışılan gün, şu anki/en uzun seri. |
| 19.10.2026 | **Faz 3.5 – Deneme geçmişi** (yerel) | Soru Merkezi'nde puan grafiği + hedef çizgisi + son 5 deneme. |
| 19.10.2026 | **Faz 3.3 – Kilometre Taşları** | 11 rozet (seri, kelime, soru, Yanlış Defteri, deneme); veriden hesaplanır, ayrıca saklanmaz. |
| 19.10.2026 | **Faz 3.4 – Günlük hatırlatma** | Ayarlar'da saat seçimi; o gün çalışılmadıysa bildirim (uygulama açıkken). |
| 19.10.2026 | **YÖKDİL sınavları** (yerel) | `cikmis2.pdf`’teki 12 resmî YÖKDİL sınavı (2018 İlkbahar/Yaz, 2019 Mart/Kasım × Sosyal/Sağlık/Fen) içe aktarıldı (`scripts/importYokdil.mjs`, kontrol: `scripts/qcYokdil.mjs`). Soru Merkezi’nde YDS ve YÖKDİL tek havuzda, üstteki süzgeçle (Tümü / YDS / YÖKDİL / alan) ayrılıyor; soru tipi haritası sınava göre (YÖKDİL: 1-20 Kelime ve Dilbilgisi, 21-30 Cloze, 31-41 Cümle Tamamlama, 42-53 Çeviri, 54-59 Paragraf Tamamlama, 60-65 Anlam Bütünlüğü, 66-80 Okuma). Modadil “özgün deneme” sınavları eklenmedi. |
| 19.10.2026 | **YDS metinleri PDF ile karşılaştırıldı** | 16 YDS sınavı (2013-2019) `cikmis2.pdf` metniyle parça parça karşılaştırıldı; OCR kaynaklı ~330 Türkçe yazım hatası düzeltildi (İngilizce metinde PDF’in kendi OCR hataları olduğu için yalnızca belirgin hatalar). Cevap anahtarı yalnızca 2018 Aralık ve 2019 Eylül için PDF’te var: 2019 Eylül aynı; 2018 Aralık’ta 6 soruda fark (29, 65, 67, 68, 69, 70) — elle bakılmalı. |
| 19.10.2026 | **Faz 7.1 – Hedef puan planlayıcı** | Soru Merkezi’nde “Hedef puan planı” kartı: hedef puan → gereken doğru, tahmini doğru, eksiğin hangi tiplerden kapatılacağı (`src/services/targetPlan.ts`). Bugünkü Plan ipucu en çok kazandıran tipi önerir. |
| 19.10.2026 | **Faz 7.2 – Deneme zaman analizi** | Denemede her soruda geçen süre kaydedilir (`mockResults.times`, eski kayıtlarda yok); sonuç ekranında tip başına süre + soru başı ortalama, yavaş tipler işaretli (`src/services/mockTime.ts`). |
| 19.10.2026 | **Faz 7.3 – Yanlış nedeni etiketi** | Yanlış cevabın altında tek dokunuşluk “Bilmiyordum / Dikkatsizlik / Süre yetmedi” (alıştırma, Yanlış Defteri, deneme incelemesi). `examAnswers.wrongReason` (isteğe bağlı alan; Dexie sürümü gerekmedi, JSON yedeğe kendiliğinden girer). “Hatalarımı analiz et” sayfasında dağılım kartı (7 gün/toplam) ve Gemini isteminde neden bilgisi. |
| 19.10.2026 | **Faz 7.4 – Özel deneme oluşturucu** | Soru Merkezi’nde “🎛️ Özel Deneme”: havuz (YDS/YÖKDİL/alan) + soru tipleri + 10/20/40 soru + süre (varsayılan 135 sn/soru) + “yalnızca çözmediklerim”. Süreli çözüm, sonuç ve inceleme; cevaplar ilerlemeye/Yanlış Defteri’ne işlenir, deneme geçmişi grafiğine yazılmaz (`CustomMock.tsx`, yol `/yds-sorular/ozel`). |
| 19.10.2026 | **Faz 7.5 – Denemeler arası tablo + sıklık önerisi** | Deneme geçmişi kartında: son 4 denemenin tip bazlı % karşılaştırması (açılır tablo, ▲/▼ fark) ve sınava kalan güne göre deneme sıklığı önerisi (>180 gün ayda 1 … ≤14 gün haftada 2); zamanı gelince uyarı (`src/services/mockPlan.ts`). |
| 19.10.2026 | **Faz 7.6 – Gramer konusu sınav sıklığı** | `scripts/grammarFreq.mjs` 39 sınavın dilbilgisi + cloze sorularını (900) `guessGrammarTopics` ile konulara eşler; **yalnızca sayılar** `public/data/grammar_freq.json`’a yazılır (soru metni yok). Dilbilgisi Rehberi’nde üstte “en sık sorulan 3 konu” ve her konuda “≈N soru · k/39 sınav”. Tahmin kalıp tabanlıdır (≈); Devrik Yapılar 0 çıktı — kalıpları gözden geçirilmeli (9.1 ile birlikte). |
| 20.10.2026 | **Faz 8.1 – Alıştırma Merkezi (ilk kısım)** | `/yds-test` artık Alıştırma Merkezi: tipe göre özgün set listesi, şık şık açıklama, set sonucu. Özgün sorular `public/data/ozgun/<tip>.json` (yayına girebilir, çıkmış soru içermez). **407 soru, 66 set (okuma 40, cloze 70, çeviri 60 dâhil):** kelime 50, dilbilgisi 50, cloze 70, cümle tamamlama 51, çeviri 60, yakın anlam 20, paragraf tamamlama 21, anlam bütünlüğü 25, diyalog 20. Diyalog/paragraf çeldiricileri yeniden yazıldı (uzunluk ve konu bakımından dengeli; `qcOzgun.mjs` 1 uyarı). Okuma metinleri 8.3’te. Araçlar: `scripts/qcOzgun.mjs` (kalite kontrol), `scripts/balanceOzgun.mjs` (doğru şık harf dağılımını dengeler). Gramer, cloze, cümle tamamlama, çeviri vb. sırada. |
| 20.10.2026 | **Faz 8.2 – Gramer alıştırmaları 5 → 10** | 14 konuya 5’er özgün soru eklendi (`src/data/grammarExtra.ts`, doğru şık harfleri dengelenmiş); Dilbilgisi Rehberi artık konu başına 10 soru. |
| 20.10.2026 | **Faz 8.3 – Özgün okuma metinleri** | 6 özgün metin (mercan resifleri, kentsel ısı adaları, iki dilli beyin, haritalar, uzaktan eğitim, mikroplastikler) × 4 soru; cümle çevirileri, kelime dokunma ve şık açıklamalarıyla Alıştırma Merkezi’nde (“Okuma” tipi). |
| 20.10.2026 | **Faz 8.4 – YÖKDİL alan terimi paketleri** | Fen (62), Sağlık (55), Sosyal (51) temel terim; özgün derleme `scripts/data/yokdil_alan_terimleri.txt` → `scripts/buildYokdilTerms.mjs` → `public/data/yokdil_<alan>.json` (kelime + anlam + eş anlamlı + o alandaki YÖKDİL sınavlarında kaç kez geçtiği; sınav cümlesi yok). Kelime paketleri penceresinde “🧪 YÖKDİL Alan Terimleri” kartı. |
| 20.10.2026 | **Faz 10.1 – Yayın güvenlik denetimi** | `npm run build` sonrası `npm run check:dist` (`scripts/checkDist.mjs`): yerel sınav metinlerinden 169 bin 8-kelimelik parça çıkarılıp `dist/` içinde aranır (≥10 kelimelik ortak dizi = HATA, çıkış kodu 1); yasak dosya adları ve yol anmaları listelenir. Zararsız ortaklıklar `scripts/data/checkDist_allow.txt`. İlk koşu temiz. Not: `Coach` paketi YOL_HARITASI özetini içerdiği için “local-data/”, “cikmis2.pdf” **adları** anılıyor (içerik yok; UYARI). |
| 20.10.2026 | **Faz 10.2 – Birim testleri** | Vitest kuruldu (`npm test`); `src/services/core.test.ts` 15 test: soru tipi eşleme, YDS/YÖKDİL aralıkları, puan, tarih/seri, hedef puan planı, deneme süre analizi, deneme sıklığı/karşılaştırma, yanlış nedeni, Bugünkü Plan. FSRS/Dexie bağımlı servisler (veritabanı gerektirir) henüz kapsanmadı. |
| 20.10.2026 | **Faz 10.3 – Temizlik (kısmen)** | Yeni kodda uyarı yok; betiklerdeki kullanılmayan değişkenler silindi, Alıştırma Merkezi’ndeki efekt uyarısı giderildi. Eski sayfalardaki (Study, Words, Suggestions, SynonymMatch, ExamQuiz vb.) ~17 React uyarısı (saf olmayan `Date`, efektte setState) duruyor; davranışı değiştirebileceği için gözle test edilerek ayrıca ele alınmalı. |
| 20.10.2026 | **Notlarım (sağ alttaki not pencereleri)** | Her sayfada sağ altta iki küçük pencere; tıklayınca genişler (Esc ile küçülür). **📄 Bu sayfa:** sayfaya özel tek not, yazdıkça kaydedilir; sayfa değişince o sayfanın notu açılır. **📓 Defterim:** tüm çalışma için tek defter; her girdi o an kullanılan özelliğin adı + tarih/saatle başlıklanır (başlığa tıklayıp değiştirilebilir); metin (Enter ile ekler, Shift+Enter yeni satır), 🎤 sesli not (▶ satırına tıklayınca çalar), 🖼️ ekran görüntüsü (dosya ya da yapıştır; tıklayınca büyür). Dexie sürüm 10 (`notebook` tablosu), JSON yedeğe girer (ses/görsel data URL). `src/components/NotesDock.tsx`, `src/services/notebook.ts`. Mikrofon sahte akışla test edildi. |
| 20.10.2026 | **Arayüz düzeni: Çalış merkezi, sade ana sayfa** | Üst menü başlık çubuğuna taşındı (sayfa en üstten başlar). **Çalış** artık kategori merkezi (`/calis`): 📚 Kelime · 📝 Soru çöz · 📘 Dilbilgisi · 🎧 Dinle & Oku · 🤖 YZ Koç; her kategorinin altında ilgili özellikler; “Yeni misin?” 4 adımlı başlangıç rehberi. Kelime/soru sayfaları açıkken menüde Çalış seçili kalır; kelime çalışmasının geri düğmesi Çalış’a döner. Ana sayfa: günlük plan + kaldığın yerden devam + 5 kategori kutusu + günün kelimesi (mod kartları, seviye düğmeleri, hakimiyet kartı kaldırıldı). `?mode=cloze/listen` bağlantıları artık çalışma türünü seçiyor. `src/services/studyMap.ts`, `src/pages/StudyHub.tsx`. |
| 20.10.2026 | **Kelimeler sayfası hızlandı** | Yüklenirken “henüz kelime yok” yerine yükleniyor çubukları; kartlar yerine tek satırlık liste (kelime · tür · anlam · seviye · 🔊), satıra tıklayınca ayrıntılı kart açılır; 50’şer gösterilir (“50 kelime daha göster”). Seyrek kullanılan düğmeler “Diğer ▾” menüsünde. 3354 kelimeyle ilk görüntü ~0,1 sn. |
| 20.10.2026 | **Sınav ekranında katlanır soru gezgini** | 12’den fazla sorulu ekranlarda (sınav, deneme, özel deneme, alıştırma) numaralar tek satırlık “▦ Soru 12 / 80 · Tüm sorular ▾” çubuğunda; tıklayınca açılır, numara seçilince kapanır. Sınav başlığı tek satıra indi. `src/pages/exam/QuestionNav.tsx`. |
| 20.10.2026 | **Dinle: duraklat / devam + cümle cümle EN↔TR** | Paragraf dinlerken ⏸ Duraklat → ▶ Devam et kaldığı cümleden sürer (⏮ Baştan ayrı). Çeviri varsa okuma sırası seçilir: yalnız İngilizce · İngilizce → Türkçe · Türkçe → İngilizce (cümle cümle). Soru kartı ve Okuma Modu’nda. Tarayıcının kendi sesi (Türkçe ses varsa onunla). `src/pages/exam/ListenControls.tsx`, `speakQueue` (`src/services/tts.ts`; takılan sese karşı süre aşımı). |
| 20.10.2026 | **🌙 Gece Modu** | `/gece` (Çalış › Dinle & Oku). Kelime (apple, elma ×N) ya da paragraf cümleleri (EN+TR ×N); kaynak: tüm kelimeler / öğrenmekte olduklarım / bugün tekrarı gelenler · özgün okuma paragrafları (yerelde çıkmış sınav paragrafları da); sıra EN→TR ya da TR→EN; tekrar 1–5; ara 1–8 sn; hız; süre (sabaha kadar / 30 dk–4 sa); karışık sıra; liste bitince başa döner. Siyah, karartılmış oynatıcı (⏮ ⏸ ⏭ ⏹), ekranı açık tutma (Wake Lock). İnternet ve yapay zekâ kullanmaz (token yok). |
| 20.10.2026 | **⭐ Kaydedilenler ve 🕘 sık kullanılanlar** | Üst çubuktaki ☆ o sayfayı kaydeder (★ = kayıtlı, tekrar basınca çıkar). Ana sayfada ve Çalış’ın üstünde tek tıkla açılan satır: kaydedilenler (× ile kaldırılır) + en çok açılan 6 sayfa (en az 2 ziyaret; menüdeki sayfalar hariç). Kişiye özel, tarayıcı deposunda. `src/services/favorites.ts`, `src/components/QuickLinks.tsx`. |
| 20.10.2026 | **Soru kartında üstte önceki/sonraki** | “Tüm cümle çevirilerini aç” satırının sağında ← Önceki / Sonraki → (sınav, deneme, özel deneme, alıştırma, yanlış defteri/konu kuyruğu); alttakiler de duruyor. |
| 20.10.2026 | **Gramer soru bankası (yerel)** | Bir gramer soru bankası kitabının 20 testi (500 soru) + her sorunun kitaptaki ayrıntılı çözümü yerel sınav verisine eklendi (`local-data/yds/banka-grammar-modadil-NN.json`, git’e ve yayına girmez; kaynak PDF `cikmis_sorular/`). Soru Merkezi › 📚 Soru bankaları (`/yds-sorular/bankalar`) ve Çalış › Dilbilgisi’nden açılır; cevaptan sonra “📘 Kitabın çözümü” görünür; tüm sorular Dilbilgisi sayılır (`banka-<tip>-…` kimliği), yanlışlar Yanlış Defteri’ne girer. Bankalar çıkmış sınav listesine, deneme ve konuya göre çalışmaya karışmaz (`listBanks`). Ayrıştırıcı: `scripts/parseModadilGramer.py` (taranmış PDF’in OCR metni: sütun ayırma, OCR düzeltmeleri, 7 soru elle; 500/500 cevaplı). 50 deneme sınavı PDF’i cevap anahtarı olmadığı için eklenmedi. Kökteki PDF’ler için `.gitignore`’a `/*.pdf`. |
| 20.10.2026 | **Kelime çalışması: × ile kaldır, süzgeç, tersten çalış** | Son çalışılanlar kartlarının sağ üstünde × (ilerleme silinmez, yalnızca gizlenir; yeniden çalışılınca geri gelir); aynı yapı ana sayfadaki “Kaldığın yerden devam” ve “Sık kullanılanlar”da (`src/services/dismissed.ts`, ortak `.dismiss-x`). Son çalışılanlar duruma (yarıda / tamamlanan) ve gruba göre süzülür, “Tümünü göster”. Öğrendim/Öğrenmedim ve 1–5 düzeyi kartın ön yüzünde de görünür (Öğrenmedim = 1, Öğrendim = 4). Üstte “Tersten çalış (TR → EN)” anahtarı: ön yüzde Türkçe, çevirince İngilizce (tercih hatırlanır). |
| 20.10.2026 | **Son çalışılanlar katlanır; düzeyler A1 → C2** | “🕒 Son Çalışılanlar & Yarıda Bırakılanlar” başlığa tıklayınca kapanır/açılır (kapalıyken sayısı görünür), tercih hatırlanır. Düzey sekmeleri: 📚 Tümü (yeni, varsayılan) · A1-A2 · B1-B2 · C1-C2 · diğerleri. |
| 20.10.2026 | **Eş anlamlı eşleştirmede Türkçe anlam** | Doğru eşleşen iki kartın altında aynı Türkçe anlam görünür; tur sonunda çiftler anlamlarıyla listelenir. Geri bağlantısı Çalış’a döner. |
| 20.10.2026 | **Faz 9 – Yerel veri hazırlığı** | **9.1** `scripts/tagQuestions.mjs` → `local-data/analiz/soru_etiketleri.json` (3.120 soru: tip, dilbilgisi konusu tahmini, bağlaç/ipucu sınıfı, çeviri yönü, okuma soru türü; elle düzeltme için `soru_etiketleri_duzeltme.json`). **9.2** `scripts/mapWordsToQuestions.mjs` → `kelime_soru_eslesme.json` (havuzdaki 3.895 kelimeden 3.657’si sorularda geçiyor; YÖKDİL dâhil). **9.3** `local-data/analiz/dogrulama_notlari.md`: 2018 Aralık’ta 6 farktan 3’ü düzeltildi (29→A, 67→E, 69→D), 3’ü gerekçeyle korundu (65, 68, 70); PDF’te eksik 5 yer listelendi. Tümü yerel; yayına girmez. |
| 20.10.2026 | **Faz 7.7 + 8.5 – Çeviri Atölyesi** | Alıştırma Merkezi → “🔁 Çeviri Atölyesi” (`/yds-test/ceviri`): 24 özgün cümle (12 EN→TR, 12 TR→EN; `public/data/ozgun/ceviri_cumleleri.json`, yapı ipucuyla). Kullanıcı çevirir, Gemini örnek çeviriyle karşılaştırıp 0-10 puan + iyi yönü + hataları + düzeltilmiş çeviriyi verir (`ai.ts`, JSON şeması). Aynı metin için sonuç `aiNotes`’ta önbelleklenir (ikinci ücret yok); en iyi puanlar tarayıcı deposunda. Sahte yanıtla test edildi; **gerçek Gemini ile denenmedi** (anahtar yok). |
| 20.10.2026 | **Faz 7.8 – Benzer özgün soru üret** | Soru Merkezi’nde (alıştırma + Yanlış Defteri/konu çalışması) yanlış cevabın altında “✨ Benzer bir soru çöz”: Gemini aynı kalıpta yeni, özgün bir soru + Türkçe açıklama yazar (`SimilarQuestion.tsx`); “Bir tane daha” ile yenisi. Üretilen soru yalnızca cihazdaki `aiNotes` önbelleğinde (yayına girmez, aynı soru için tek ücret). Sahte yanıtla test edildi; gerçek Gemini ile denenmedi. |
| 20.10.2026 | **Faz 7.10 (kısmen) – Haftalık koç raporu** | İstatistik sayfasının başında “📅 Haftalık rapor”: son 7 gün çalışılan gün, tekrar + başarı, yeni kelime, çıkmış soru doğruluğu, en zayıf tip, deneme; geçen haftayla ▲▼ karşılaştırma (yerelde hesaplanır, `src/services/weeklyReport.ts`, 2 test). İsteğe bağlı “🧑‍🏫 Koç yorumu al” (yalnızca sayılar Gemini’ye gider; hafta başına önbellek).  |
| 20.10.2026 | **Faz 7.10 – Metinden kelime çıkar** | Kelimeler sayfasında “📄 Metinden Kelime”: yapıştırılan İngilizce metindeki sözcükler (çekimli biçimler dâhil) Oxford + Yeni YDS + YÖKDİL alan paketleri + yerleşik paketlerle eşleştirilir; havuzda olmayanlar sınav sıklığına, sonra metindeki sayıya göre sıralanır; A1-A2 gizlenebilir; seçilenler havuza eklenir (`src/services/textWords.ts`, test var). Yapay zekâ gerekmez. |
| 20.10.2026 | **Faz 7.9 (kısmen) – Zor kelime (leech) yardımı** | Bir kelime 5+ kez unutulduysa kart arkasında “🩹 Bu kelimede takılıyorsun” uyarısı + “✨ Akılda kalıcı ipucu üret” (Gemini; ses benzerliği/kök ipucu + örnek cümle; kelime başına tek sefer, `aiNotes` önbelleği) — `LeechHelp.tsx`, `src/services/leech.ts`. **Yapılmadı:** sınav cümlesinden boşluk kartı (yerel telifli cümle gerektirir; ayrı tasarım). Arayüzde gerçek kartla denenmedi (tarayıcıda kelime havuzu boştu); tsc + birim test geçiyor. |
| 19.10.2026 | **YÖKDİL kelime etiketleri** | `scripts/tagYokdil.mjs` YÖKDİL-Çok-Sık / Sık / Ara etiketlerini YDS etiketlerinden ayrı üretir (kelime başına etiket havuzda). Ayarlar → Hedef Sınav’da “yeni kelimeler hangi sınavın sıklığına göre sıralansın” seçimi: YDS, YÖKDİL ya da ikisi birlikte. |
| 19.10.2026 | **YÖKDİL çevirileri tamam** (yerel) | 12 sınavın tüm İngilizce segmentleri Türkçeye çevrildi (`local-data/yds/yokdil-*.tr.json`, ~6.000 segment; Türkçe olan 42-53. soru parçaları çevrilmedi). PDF metin katmanındaki kusurlar (2019 Mart Sosyal 9. soru E şıkkı, 54-59. sorularda bazı boşluklar, 2019 Kasım Sağlık 53-54. E şıkları, 68. soruya karışan okuma metni) olduğu gibi bırakıldı. |
| 19.10.2026 | **“60 Günde YDS Kelimeleri” paketi** (yerel) | Modadil kitabından 1663 girdi (1586 benzersiz kelime): 54 günlük kelime kartları (anlam, örnek cümle + çeviri, eş/zıt anlamlı), phrasal verb ve edat tabloları, son sınavların sık kelimeleri. Telifli olduğu için PDF ve paket `local-data/paketler/` altında (gitignore + şifreli kasa); Hazır Paketler’de yalnızca `npm run dev`’de görünür. |
| 19.10.2026 | **Hatalarımı analiz et** (yerel) | Soru Merkezi > 🔍: son 40 yanlıştan tekrar eden kök hatalar (açıklama, örnek sorular, çalışma önerisi, uygulama bağlantıları), Koç / Saf Gemini seçimi, onaylı hafıza notu önerileri (zaten hafızada olanlar ikinci kez eklenmez), son analiz cihazda saklanır. |
| 19.10.2026 | **Faz 6.5c – Geliştirici danışmanı** | YZ Koç’ta üçüncü mod: teknik yapıyı, kuralları, uygulama haritasını, yol haritası özetini ve kullanım sayılarını bilerek öneri verir; öneriler kart olarak gelir, “＋ Önerilere ekle” ile `/koc/oneriler` listesine düşer (durum takibi, “Claude için kopyala”). |
| 19.10.2026 | **Faz 6.7a – Taktik Kitabı altyapısı** (yerel) | `local-data/kaynaklar/` biçimi (harita.json, taktik-kitabi.json, sayfa-NNNN.md), dev-only `/local-api/kaynak`, soru açıklamasında ve YDS koçunda **📒 Koç (kaynaklı) / ✨ Saf Gemini** seçimi (kitap boşken Koç pasif, her yanıtta mod etiketi), `/yds-sorular/taktik` görüntüleme/düzenleme ekranı (kaynak sayfasını açma), `scripts/kaynakTools.mjs`. |
| 19.10.2026 | **Faz 6.5b – YDS koçu** | YZ Koç’ta yeni mod: profil + hafıza notları + bugünkü plan ile durum değerlendirmesi, plan, motivasyon; uygulamadaki alıştırmalara tıklanabilir bağlantılar (yalnızca uygulama haritasındaki adresler); hızlı sorular (“Durumumu değerlendir”, “Bu hafta için plan yap” …). |
| 19.10.2026 | **Faz 6.6 – Hafıza (“beni tanısın”)** | Otomatik profil (uygulama verisinden), “🧠 Hafızaya kaydet” (YZ önerir, sen seçip düzeltip kaydedersin), `/koc/hafiza` (profil + notlar: düzenle/sil/elle ekle), İngilizce pratikte notlar bağlam olarak, soru açıklamasında “beni tanıyarak açıkla”. Notlar ve koç sohbetleri JSON yedeğinde. |
| 19.10.2026 | **Faz 6.5a – YZ Koç: İngilizce pratik** | `/koc`: sohbet listesi, 6 senaryo (serbest, iş görüşmesi, restoran, seyahat, doktor, akademik tartışma) + CEFR seviyesi; YZ sohbeti başlatır, rolde kalır; düzeltmeler (yanlış → doğru + Türkçe açıklama) ve “daha doğal” söyleyiş öğrenci mesajının altında; 🔊 dinleme; uzun sohbet özetleme. Ana Sayfa’da “YZ Koç” kartı. |
| 19.10.2026 | **Soru ekranı iyileştirmeleri** (yerel) | Hızlı cevap modu (şıkka dokununca kontrol), ← → tuşları ve sola/sağa kaydırma ile gezinme, soru başına YZ sohbeti ("Ben:" / "YZ:" geçmişi, takıldığın noktayı önceden yazma kutusu, devam soruları). |
| 19.10.2026 | **Faz 6.1 – Gemini entegrasyonu** | Ücretli → ücretsiz otomatik geçiş, tahmini aylık maliyet ve üst sınır, soru açıklaması, adım adım kurulum rehberi. |
| 19.10.2026 | **Faz 6.4 – CSV / Anki içe-dışa aktarma** | Kelimeler > ⇅ İçe / Dışa Aktar: CSV (Türkçe Excel uyumlu, geri yüklenebilir) ve Anki dosyası indirme; Anki dosyasını otomatik tanıyan, yönü çeviren, önizlemeli içe aktarma. |
| 19.10.2026 | **Faz 5 – Okuma ve dinleme** (yerel) | Soru Merkezi > Okuma Modu: 130 paragraf, süre ve kelime/dk, dinleme + cümle vurgusu, hız ayarı, baktığın kelimeler, ardından paragrafın soruları. Soru kartlarındaki paragraflarda da "🔊 Dinle". |
| 19.10.2026 | **Faz 4 – Dilbilgisi Rehberi** | 14 konu, 70 alıştırma (özgün içerik); Ana Sayfa'dan giriş; çıkmış dilbilgisi/cloze sorusundan ilgili konuya bağlantı. |

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
- Çalışma modları: flaş kart, çoktan seçmeli, eş anlamlı, cümle içi boşluk, dinleme, karışık
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
| 2.1 | FSRS'in doğru kullanımı | ✅ | `learningSteps` artık kaydediliyor (eski takılı kartlar bir sonraki "3/4" puanında kurtulur); yeni kartlara sahte başlangıç değeri verilmiyor; 4 puan öğrenme adımlarını atlar, ×1,3 bonus yalnızca tekrar aşamasında. Puan düğmelerinde "X sonra" önizlemesi. Not: Supabase senkronunda `learningSteps` sütunu yok (6.3'te eklenecek). |
| 2.2 | Zayıf kelimeler destesi | ✅ | "🎯 Zorlandıklarım": son puanı 1-2 ya da 2+ kez unutulmuş ve henüz 4-5 almamış kelimeler; öğrenilince kendiliğinden çıkar. |
| 2.3 | Dinleme kartı | ✅ | "🎧 Dinleme" modu: kelime seslendirilir, yazılışı cevaptan sonra görünür, anlamı seçilir. Ses desteği yoksa gizli. |
| 2.4 | Soru bağlamında kelime | ✅ | *Yerel:* kart arkasında açılır kutu; en fazla 3 örnek, Türkçesi ve kaynağı (sınav · soru · tip). Veritabanına kopyalanmaz. |
| 2.5 | Sorudan kelime toplama | ✅ | Kelime balonunda "Havuzuma ekle" / havuzdakiler için "Topladıklarıma ekle"; Soru Merkezi'nde "topladığın N kelimeyi çalış" bağlantısı. |

## Faz 3 — Plan ve motivasyon

| # | İş | Durum | Açıklama |
| :--- | :--- | :---: | :--- |
| 3.1 | Sınav tarihine göre günlük plan | ✅ | Ana sayfadaki "Bugünkü Planın" kartı: tekrar (zamanı gelenlerin hepsi), yeni kelime (kalan / gün, Ayarlar'daki üst sınırı aşmaz), soru (yerel; kalan / gün, 10-40). Halka ile toplam ilerleme, sıradaki görev vurgulu. |
| 3.2 | Çalışma takvimi (ısı haritası) | ✅ | İstatistik'te son 12 hafta; kelime tekrarı + çözülen soru; seri bilgileri. |
| 3.3 | Rozetler / kilometre taşları | ✅ | İstatistik'te 11 kilometre taşı; kazanılmayanlarda ilerleme çubuğu. |
| 3.4 | Hatırlatma bildirimi | ✅ | Ayarlar > Günlük Hatırlatma. Sınır: push sunucusu olmadığından uygulama tamamen kapalıyken çalışmaz (6.3 ile çözülebilir). |
| 3.5 | Deneme sonuçları grafiği | ✅ | Soru Merkezi'nde, ilk denemeden sonra görünür. |

## Faz 4 — Dilbilgisi rehberi

| # | İş | Durum | Açıklama |
| :--- | :--- | :---: | :--- |
| 4.1 | YDS gramer konu anlatımları | ✅ | `/dilbilgisi`: Zamanlar, Kipler, Edilgen, Koşul, Sıfat cümleleri, İsim cümleleri, Zarf cümleleri/bağlaçlar, Geçiş ifadeleri, Edatlar, -ing/to, Karşılaştırma, Miktar ifadeleri, Çift bağlaçlar, Devrik yapılar. Her konuda "Sınavda nasıl tanırsın?", örnekler (TR'li), sık hatalar. İçerik `src/data/grammar.ts`. |
| 4.2 | Konu başına mikro alıştırma | ✅ | Konu başına 5 özgün YDS tarzı soru, anında açıklama; en iyi skor listede rozet olarak görünür (tarayıcı deposu). |
| 4.3 | Sorudan konuya bağlantı | ✅ | Dilbilgisi ve cloze sorularında cevaptan sonra "📘 İlgili dilbilgisi konusu" (şıklardan tahmin; 540 sorunun %87'sinde konu bulunur, kalanlar kelime boşluğu). |

## Faz 5 — Okuma ve dinleme

| # | İş | Durum | Açıklama |
| :--- | :--- | :---: | :--- |
| 5.1 | Okuma modu | ✅ | *Yerel:* `/yds-sorular/okuma`. Paragraf listesi (okundu / kelime/dk), okuyucu (sayaç, kelimeye dokun → anlam ve topla, çeviri anahtarı), "bitirdim" → kelime/dk + 5 paragrafı okuma süresi tahmini + baktığın kelimeler; 400 k/dk üstü göz gezdirme sayılır, kaydedilmez. Sonra "Bu paragrafın sorularını çöz". |
| 5.3 | Okuma kütüphanesi (yayında da) | 💡 | Açık lisanslı / kamu malı metinler ve özgün metinler; seviye, konu, uzunluk; kelime-cümle-paragraf çevirisi ve Türkçe özet. Lisans koşulları (atıf, değişiklik yasağı) metin başına tutulur. |
| 5.2 | Cümle seslendirme | ✅ | Cümle cümle okuma, okunan cümle vurgulu, durdur, hız 0,75–1,15× (tarayıcıda hatırlanır; kelime telaffuzu da bu hızı kullanır). |

## Faz 6 — Yapay zekâ ve platform

| # | İş | Durum | Açıklama |
| :--- | :--- | :---: | :--- |
| 6.1 | "Neden yanlış?" açıklaması ve soru sohbeti | ✅ | *Yerel:* cevaptan sonra "🤖 Yapay zekâ ile açıkla": doğru cevabın gerekçesi, her şık, sınav ipucu, önemli kelimeler. Soru başına bir kez ücretlenir (Dexie `aiNotes`). Ayarlar > Yapay Zekâ: iki anahtar, model, aylık üst sınır, test. Kurulum: `GEMINI_KURULUM.md`. |
| 6.2 | Yazma pratiği geri bildirimi | ⏳ | Gemini ile; konu önerisi, düzeltilmiş metin, hata açıklamaları, kelime önerileri. |
| 6.3 | Cihazlar arası ilerleme senkronu | 💤 | Supabase altyapısı mevcut; yalnızca ilerleme verisi, soru metni asla. |
| 6.5 | Yapay zekâ sohbet öğretmeni | ✅ | 6.5a İngilizce pratik ✅ · 6.5b YDS koçu ✅ · 6.5c Geliştirici danışmanı ✅. Sesli (Gemini Live) ve konuşan karakter sonra (💡). |
| 6.6 | Hafıza (“beni tanısın”) | ✅ | Otomatik profil, “Hafızaya kaydet” (onaylı), Hafızam sayfası, “Hatalarımı analiz et”. |
| 6.7 | Taktik Kitabı (yerel) | 🔄 | 6.7a altyapı ✅ · 6.7b içerik (hoca PDF’leri → OCR → harita → kurallar) ⏳ |
| 6.4 | Anki / CSV içe-dışa aktarma | ✅ | Dışa: CSV (BOM + `;`, öğrenme puanı ve sonraki tekrar dahil) ve Anki "Notes in Plain Text" (Basic not türü, etiketler). İçe: Anki .txt kendiliğinden tanınır (HTML/ses/cloze temizlenir, TR→EN destede yön otomatik çevrilir, elle değiştirilebilir); CSV ayrıştırıcı artık tırnaklı ayırıcı/satır sonu ve "" kaçışını destekliyor. FSRS geçmişi Anki'ye aktarılmaz. |

---

## Faz 7 — Piyasa araştırmasından çıkan özellikler (kullanıcı tarafı)

| # | İş | Durum | Açıklama |
| :--- | :--- | :---: | :--- |
| 7.1 | Hedef puan planlayıcı | ✅ | Hedef puan → gereken doğru sayısı; güncel tip başarısına göre “şu tiplerden şu kadar daha”; Bugünkü Plan’a bağlanır. |
| 7.2 | Deneme zaman analizi | ✅ | Soru başına / tip başına süre, yavaş tipler, süre hedefi; sonuç ekranında tablo. |
| 7.3 | Yanlış nedeni etiketi | ✅ | Bilmiyordum · Dikkatsizlik · Süre yetmedi; “Hatalarımı analiz et” bunu kullanır; haftalık dağılım. |
| 7.4 | Özel deneme oluşturucu | ✅ | Tip / yıl / YDS-YÖKDİL-alan / soru sayısı / süre seç → mini deneme. |
| 7.5 | Denemeler arası tablo + sıklık önerisi | ✅ | Tip bazlı karşılaştırma tablosu; sınava kalan zamana göre deneme sıklığı (6+ ay: ayda 1 … son 2 hafta: haftada 2). |
| 7.6 | Gramer konusu sınav sıklığı | ✅ | 39 sınavdan sayısal istatistik (yayına girebilir); Dilbilgisi Rehberi sırası/rozeti. |
| 7.7 | Çeviri atölyesi | ✅ | Kendin çevir → Gemini referansla puanlasın (37-42 / 42-53). |
| 7.8 | Benzer özgün soru üret | ✅ | Yanlıştan sonra aynı kalıpta yeni özgün soru + açıklama; bütçe sınırına bağlı, yerelde saklanır. |
| 7.9 | Kelime: leech yönetimi + sınav cümlesinden boşluk kartı | ✅ (kısmen: leech) | Çok unutulan kelimeye farklı ipuçları; sınav yılı/alan etiketi. |
| 7.10 | Metinden kelime çıkar + haftalık koç raporu | ✅ | Paragraf yapıştır → bilinmeyenleri toplu ekle; Gemini ile haftalık özet. |

## Faz 8 — Özgün içerik (yayına girebilir, telifsiz)

| # | İş | Durum | Açıklama |
| :--- | :--- | :---: | :--- |
| 8.1 | Özgün soru bankası + Alıştırma Merkezi | ✅ (kısmen: 310 soru) | 300+ özgün soru (kelime, gramer, cloze, cümle tamamlama, çeviri, paragraf), Türkçe çeldirici açıklamalı; YDS TEST sayfası genişler. |
| 8.2 | Gramer mikro-alıştırma genişletme | ✅ | Konu başına 5 → 10 özgün soru. |
| 8.3 | Özgün okuma metinleri | ✅ (10 metin) | Seviyeli kısa metinler + sorular. |
| 8.4 | YÖKDİL alan terimi paketleri | ✅ | Fen / Sağlık / Sosyal en sık terimler (kelime + anlam + sayısal sıklık). |
| 8.5 | Çeviri cümleleri | ✅ (24 cümle) | Özgün EN→TR / TR→EN cümleler (çeviri atölyesi için). |

## Faz 9 — Veri hazırlama (yerel)

| # | İş | Durum | Açıklama |
| :--- | :--- | :---: | :--- |
| 9.1 | Soru etiket veritabanı | ✅ | 39 sınavın her sorusu için konu / alt konu → hedefli çalışma, konu bazlı Yanlış Defteri. |
| 9.2 | Kelime–soru eşleme | ✅ | `kelime_ornekleri` YÖKDİL’i de kapsasın. |
| 9.3 | Doğrulama notları | ✅ | 2018 Aralık cevap farkı (29, 65, 67, 68, 69, 70) ve PDF’te eksik 5 yer için gerekçeli not. |

## Faz 10 — Kalite ve güvenlik

| # | İş | Durum | Açıklama |
| :--- | :--- | :---: | :--- |
| 10.1 | Yayın güvenlik denetimi | ✅ | `dist` içinde telifli metin sızıntısı taraması (komut dosyası). |
| 10.2 | Birim testleri | ✅ | FSRS sarmalayıcı, `sectionOf`, `ydsScore`, havuz süzgeci, normalleştirme. |
| 10.3 | Temizlik | ✅ (kısmen) | `oxlint` uyarıları, erişilebilirlik, bundle boyutu. |

---

## Değişiklik günlüğü

- **19.10.2026** — Modadil paketi: `scripts/parseModadil.mjs` (`pdftotext -raw` + `-layout` çıktılarından), `vite.config.ts` `localPacks()` (`/local-api/paket`), `WordPacksModal` yerel kart. PDF kök klasörde takipsiz ve gitignore dışındaydı; `local-data/paketler/` altına taşındı. Not: `local-data` değişti, başka bilgisayara aktarmak için `npm run vault:lock` ve YDS-data’yı push etmek gerekir.

- **19.10.2026** — “Hatalarımı analiz et”: `exam/analysis.ts` (yanlışlar kısa satırlara dönüşür, okuma paragrafları gönderilmez; JSON şeması: özet, en fazla 5 kök hata, bağlantılar `isKnownRoute` ile süzülür, hafıza önerileri), `exam/MistakeAnalysis.tsx` (`/yds-sorular/analiz`), son analiz `aiNotes` içinde `analysis:last`. Analiz ≈ 0,006-0,01 $. Taklit edilmiş Gemini ile doğrulandı.

- **19.10.2026** — Faz 6.5c: `coach.sendDev` (JSON şeması: yanıt + en fazla 4 öneri), `services/roadmapDigest.ts` (YOL_HARITASI.md `?raw` ile paketlenir, ~1k token özet; değişiklikler bir sonraki derlemede yansır), `pages/Suggestions.tsx` (`/koc/oneriler`), Dexie v9 `suggestions`, yedek v5. Faz 6 tablosuna 6.6 ve 6.7 satırları eklendi.

- **19.10.2026** — Faz 6.7a: `services/tactics.ts` (yükleyiciler yayında boş döner; Koç modunda soru tipinin ve şıklardan tahmin edilen dilbilgisi konusunun kuralları + haritadan en fazla 4 sayfa alıntı; YDS koçunda en zayıf 2 soru tipinin kuralları, alıntısız), `components/SourceModeToggle.tsx`, `exam/TacticsBookPage.tsx`, vite `localSources()` eklentisi (yalnızca 127.0.0.1; kaydetmede `.bak.json`), `scripts/kaynakTools.mjs` (`ekle`, `ocr-al`, `sayfa`, `ara`, `kontrol`). Geçici test kitabıyla uçtan uca doğrulandı (yol aşma denemeleri reddedildi), test verisi silindi.

- **19.10.2026** — Faz 6.5b: `services/appMap.ts` (koçun bağlantı verebileceği sayfalar; çıkmış soru sayfaları yalnızca dev derlemesinde), `AiText` güvenli uygulama içi bağlantı (`isAllowedLink`), `coach.sendYds` / `sendMessage`; sistem talimatında sabit kısım (rol, kurallar, harita) önce, değişen kısım (profil, hafıza, plan) sonra. Taklit edilmiş Gemini ile doğrulandı; dış ve bilinmeyen bağlantıların düz metin kaldığı test edildi.

- **19.10.2026** — Faz 6.6: `services/memory.ts` (`buildProfile`, not CRUD, `memoryContext`, `suggestNotes` JSON şemalı), `components/SaveToMemory.tsx`, `pages/Memory.tsx` (`/koc/hafiza`), Dexie v8 `memoryNotes`, yedek v4 (`memoryNotes`, `coachChats`). Taklit edilmiş Gemini ile doğrulandı.

- **19.10.2026** — Faz 6.5a: `services/coach.ts` (senaryolar, seviyeler, sistem talimatı, açılış mesajı, 24 mesajdan sonra özetleme: son 12 mesaj + özet), `pages/Coach.tsx` (lazy), Dexie v7 `coachChats` (yalnızca cihazda; yedek/senkron kararı bekliyor), `ai.generateChat` için JSON şeması seçeneği (`responseMimeType` + `responseSchema`). Taklit edilmiş Gemini ile doğrulandı.

- **19.10.2026** — YZ yol haritası kararları alındı: Taktik Kitabı (kaynak: hoca PDF’leri, OCR + kaynak haritası + kurallar, Claude çıkarır), hafıza yalnızca “Hafızaya kaydet” ile, YZ Koç üç mod (önce İngilizce pratik, sonra YDS koçu, sonra geliştirici danışmanı). Devir prompt’u: `PROMPT_YZ_KOC_VE_TAKTIK.md`.

- **19.10.2026** — Soru ekranı: `exam/answerControls.tsx` (`useQuickAnswer`, `useQuestionNav`: ← → ve kaydırma; yazı alanında, metin seçiliyken ve açık modalda çalışmaz). `AiExplain` sohbete dönüştü: `services/ai.generateChat` (Gemini çok mesajlı `contents`; her istekte geçmişin tamamı gider), `AiNote.messages` (ekranda gösterilen metin + modele giden metin ayrı tutulur). Öğrencinin özel sorusu sistem talimatına değil kullanıcı mesajına eklenir. Gemini hesabı kuruldu: Developer Program kredisi (₺489,83/ay ≈ 10 $) faturalandırma hesabında görünür; 250 TL ön ödeme ayrı bakiye.

- **19.10.2026** — Faz 6.1: `services/ai.ts` (Gemini REST, `x-goog-api-key`; 402/429/403 → ücretsiz anahtar; ücretli 6 saat sonra ya da Kaydet ile yeniden denenir), Ayarlar’da `AiCard`, `exam/AiExplain.tsx`, `components/AiText.tsx` (güvenli sade Markdown), DB v6 `aiNotes`. Ücretli/ücretsiz geçiş ve maliyet hesabı taklit edilmiş API ile doğrulandı; gerçek anahtarla test kullanıcıda.

- **19.10.2026** — Faz 6.4 tamamlandı: `services/exchange.ts` (dışa aktarma + Anki okuma), `importer.parseCsvRows` (RFC 4180). İçe/dışa aktarma tek pencerede (yeni üst düğme eklenmedi).

- **19.10.2026** — Faz 5 tamamlandı. Kelime balonu ve tıklanabilir cümle `exam/WordPopover.tsx` içine ayrıldı (soru kartı ve okuyucu ortak kullanır). `tts.ts`: `speakSentences`, `stopSpeaking`, `getSpeechRate/setSpeechRate`. Okuma kayıtları `yds-reading:<kullanıcı>` (tarayıcı deposu). Okuma modu yayın derlemesinde yok (dist kontrol edildi).

- **19.10.2026** — Faz 4 tamamlandı. Dilbilgisi rehberi ayrı parça olarak yüklenir (gzip ~18 KB). Alıştırma skorları `yds-grammar:<kullanıcı>` anahtarında (tarayıcı deposu; yedeğe dahil değil).

- **19.10.2026** — Faz 3 tamamlandı. Yeni servisler: `dailyPlan.ts`, `dates.ts` (yerel gün anahtarı — önceki kod UTC kullanıyordu, gece 00-03 arası önceki güne yazılıyordu), `milestones.ts`, `reminder.ts`. `fsrs_due` artık yeni kartları içermiyor; `new_words` destesi eklendi (`order` desteği). Ayarlar'daki "günlük kota" = günlük yeni kelime üst sınırı.

- **19.10.2026** — Faz 2 tamamlandı. FSRS'te üç hata bulundu ve giderildi (öğrenme adımı her tekrarda sıfırlanıyordu → 3 puanlı kartlar 10 dk'da, 4 puanlı kartlar 1 günde takılıyordu; yeni kartlara sahte stability/difficulty veriliyordu). Yeni yerleşik desteler `weak_words`, `yds_collected` (`hideWhenEmpty`). `/study?group=<id>` artık `auto` olmadan da desteyi açıyor. Dinleme modu (`listen`). Yerel `ExamContext` bileşeni yayın derlemesinde yok (dist kontrol edildi).
- **19.10.2026** — Faz 1 tamamlandı: `/yds-sorular` artık Soru Merkezi (alt sayfalar: `sinav/:id`, `konu/:tip`, `yanlislar`, `deneme/:id`). Cevaplar Dexie `examAnswers`, deneme sonuçları `mockResults` tablosunda (DB v5); eski tarayıcı kayıtları otomatik taşındı; JSON yedek v3 bu tabloları içerir. Yayın derlemesinde modül yok (dist kontrol edildi).
- **19.10.2026** — Yol haritası oluşturuldu. Faz 1.1'e başlandı.
