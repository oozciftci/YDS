# Görev: YZ Koç, Hafıza ve Taktik Kitabı (devir prompt'u)

> Bu dosya, 19 Ekim 2026'daki planlama konuşmasının özetidir. Yeni bir Claude Code oturumunda aşağıdaki “PROMPT” bölümünü olduğu gibi ver.

---

## PROMPT

`C:\Projeler\YDS_Proje` içindeki **YDS Kelime** uygulamasında (React 19 + TypeScript + Vite + Dexie PWA, arayüz Türkçe) yapay zekâ özelliklerini genişleteceğiz. Benimle Türkçe konuş. Aşağıdaki kararlar alındı; tekrar tartışma, uygula. Belirsiz bir nokta çıkarsa sor.

### Önce oku
- `YOL_HARITASI.md` — yol haritası. **Her adım bitince** “Şu an / Sıradakiler / Yapılanlar”, faz tablosu ve değişiklik günlüğü güncellenir.
- `PROJECT_MEMORY.md` — mimari ve kurallar (OCR hattı, yerel veri, telif).
- `GEMINI_KURULUM.md` — Gemini kurulumu (kullanıcı tamamladı).
- Mevcut YZ kodu: `src/services/ai.ts` (`generate`, `generateChat`, ücretli → ücretsiz anahtar geçişi, aylık maliyet tahmini, `ChatTurn`), `src/pages/exam/AiExplain.tsx` (soru başına sohbet; “Ben:” / “YZ:”; ilk mesajda soru bağlamı + öğrencinin takıldığı nokta), `src/components/AiText.tsx` (güvenli sade Markdown), `src/stores/settings.ts` (`AiSettings`), Dexie `aiNotes` tablosu (DB v6, `AiNote.messages`), `src/services/ydsSections.ts` (YDS’nin 10 soru tipi), `src/data/grammar.ts` (14 dilbilgisi konusu), `src/services/examProgress.ts` (cevap kayıtları), `src/services/dailyPlan.ts`, `src/services/milestones.ts`.

### Değişmez kurallar
1. **Telif:** Çıkmış YDS soruları, çevirileri, hocaların kitapları (PDF ve OCR çıktıları) ve onlardan türetilen Taktik Kitabı **yalnızca yerelde** kalır: `local-data/` altında (gitignore’da, `scripts/dataVault.mjs` şifreli kasasına zaten dahil). Yayın derlemesine ve GitHub’a girmez. Bunları okuyan sayfalar/bileşenler yalnızca `import.meta.env.DEV` ile ve dev-only Vite ara katmanından (`vite.config.ts`, `/local-api/...`, yalnızca 127.0.0.1) veri alır. Derlemeden sonra `dist/` içinde bu içeriklerin olmadığını kontrol et.
2. **Gemini** kullanılır (kullanıcının tercihi; Claude kodlama için ayrılıyor). Varsayılan model `gemini-3.8-flash`, Ayarlar’dan değiştirilebilir. API anahtarlarını asla sohbette isteme; anahtarlar yalnızca cihazda (Ayarlar). Testlerde gerçek anahtar kullanma: `window.fetch`’i `generativelanguage` adresleri için taklit et, sonra test verisini temizle.
3. **Bütçe:** Aylık ≈ 10 $ Developer Program kredisi + küçük ön ödeme. İstekleri kısa tut; sabit kalan büyük içeriği (sistem talimatı, taktik kuralları, profil) isteğin **başına** koy ki Gemini’nin otomatik önbelleği indirim versin. Uzun sohbetlerde eski mesajları özetle.
4. **Arayüz:** Sade, kendini anlatan ekranlar; her bölümde bir cümlelik açıklama ve boş durum yönlendirmesi; yeni menü kalabalığı yok; mobil uyum.
5. **Git:** Dosyaları tek tek stage et (`git add -A` kullanma; başka oturumların takipsiz dosyaları olabilir). Her anlamlı adımda commit. Push etme, kullanıcı ister.

### Alınan kararlar

**A. Taktik Kitabı (ilk öncelik, ama PDF’lere bağlı)**
- Kullanıcı YDS hocalarının kitaplarını PDF olarak verecek. **Taktik Kitabı’nı Claude (sen) çıkaracaksın**, Gemini değil.
- Akış:
  1. PDF’ler `local-data/kaynaklar/` altına konur. Taranmışsa mevcut OCR hattı: `C:\Projeler\OCR` (olmOCR, `--models olmocr --no-consensus`, 300 sayfa sınırı → gerekirse parçala; ayrıntı `PROJECT_MEMORY.md`’de). Çıktı: sayfa sayfa metin, `local-data/kaynaklar/<kitap-id>/`.
  2. **Kaynak haritası:** Her kitap için konu → sayfa aralıkları dizini (`local-data/kaynaklar/harita.json`): YDS soru tipi (`ydsSections.ts` anahtarları), dilbilgisi konusu (`grammar.ts` id’leri) ve serbest konu etiketleri. Amaç: bir soruda tüm kitap değil, yalnızca ilgili **3-4 sayfa** okunur.
  3. **Taktik Kitabı:** Soru tipine (ve gerektiğinde dilbilgisi konusuna) göre kısa, uygulanabilir kurallar. Örnek: “Cümle tamamlamada boşluğun başında *although* varsa diğer yarı zıt anlam taşır.” Her kural, kaynağına (kitap + sayfa) atıf taşır. Biçim önerisi: `local-data/kaynaklar/taktik-kitabi.json`. Kullanıcı kuralları görüp düzeltebilmeli (yerel bir görüntüleme/düzenleme ekranı ya da düzenlenebilir dosya).
- Kullanım: Soru açıklamasında ve koç sohbetinde **mod seçimi**:
  - **Koç (kaynaklı):** O soru tipinin taktik kuralları + gerekirse haritadan bulunan 3-4 sayfalık alıntı gönderilir. Yanıt taktik ağırlıklı (“paragrafı anlamasan bile şu ipucuyla çözülür”) ve kaynağı (kitap + sayfa) belirtir.
  - **Saf Gemini:** Kaynak gönderilmez.
  - Karma davranış: kaynakta olmayan bir şey söylenecekse yanıtta “kaynakta yok, genel bilgi:” diye ayrılır.
  - Yanıtın altında hangi modun kullanıldığı görünür.
- **PDF’ler gelene kadar:** Taktik Kitabı ve harita için veri biçimini, dev-only yükleyiciyi ve mod seçimini (Koç / Saf) kur; boşken “henüz kaynak yok” durumunu göster. Gelince: OCR → harita → Taktik Kitabı.
- **İleride, isteğe bağlı:** Gemini **File Search** ile “kaynağa sor” (NotebookLM benzeri, sayfa atıflı). Not: File Search deposu ücretli projeye bağlı; ücretsiz yedek anahtara geçince çalışmaz.

**B. Hafıza (“beni tanısın”)**
- **Otomatik profil** (yapay zekâ gerektirmez, ücretsiz): soru tiplerine göre başarı ve en zayıf tip, Yanlış Defteri, zorlanılan kelimeler (`weak_words`), deneme puanları, seri, sınava kalan gün. Kısa bir metin özetine dönüşür.
- **Hafıza notları:** Yalnızca kullanıcı **“Hafızaya kaydet”** dediğinde, o sohbetten kalıcı gözlemler çıkarılır (Gemini’ye kısa, ucuz bir istek). Örnek: “*unless*’ı *if not* ile karıştırıyor.” **Otomatik çıkarma yok.**
- **“Hafızam” sayfası:** Notları görme, düzenleme, silme.
- Kullanım: Koç sohbetinde profil + notlar her zaman gönderilir. Soru açıklamasında isteğe bağlı **“beni tanıyarak açıkla”** seçeneği.
- (Sonra) **“Hatalarımı analiz et”:** Son 30-50 yanlışın özeti → tekrar eden kök hatalar → hafıza notu önerisi (kullanıcı onaylar) + uygulamadaki alıştırmalara bağlantılar.
- Hafıza ve profil yerelde (Dexie). Yalnızca istek anında Gemini’ye gider; senkrona ve yedeğe girip girmeyeceğini kullanıcıya sor.

**C. YZ Koç sohbet penceresi (yeni sayfa)**
- Sohbet listesi (Dexie’de saklanır), her sohbetin bir modu var. Üç mod, **bu sırayla** geliştirilecek:
  1. **İngilizce pratik:** Serbest yazışma ve rol yapma (“iş görüşmesi”, “restoran” vb. hazır senaryolar + serbest). Hataları konuşmayı bölmeden, mesajın altında kısa bir düzeltme notu olarak göster. Seviye ayarı.
  2. **YDS koçu:** Profil + hafıza + (varsa) Taktik Kitabı ile durum değerlendirmesi, plan, motivasyon. Uygulamadaki alıştırmalara **tıklanabilir bağlantı** verebilmesi için modele bir “uygulama haritası” ver (rotalar: `/study?group=…`, `/yds-sorular/konu/<tip>`, `/dilbilgisi/<konu>`, `/yds-sorular/okuma`, `/yds-sorular/yanlislar`, …). Modelin ürettiği bağlantıları yalnızca bilinen rotalarla sınırla.
  3. **Geliştirici danışmanı:** Uygulamanın özellik listesini ve `YOL_HARITASI.md` özetini bilerek iyileştirme önerir (kullanıcı yazılımcı). Beğenilen öneri tek tıkla bir “öneriler” listesine eklenir.
- Uzun sohbetlerde maliyet için eski mesajları özetle. Her mesajın altında model ve katman (ücretli/ücretsiz) bilgisi; Ayarlar’daki aylık üst sınır ve ücretsiz yedeğe geçiş mevcut `services/ai.ts` üzerinden çalışır.
- Bu sayfa yayında da çalışabilir; çıkmış soru veya kaynak içeriği gerektiren kısımlar yalnızca yerelde etkin olur.

### Önerilen sıra
1. Koç sayfasının iskeleti + **İngilizce pratik** modu
2. Otomatik profil + “Hafızaya kaydet” + “Hafızam” sayfası
3. **YDS koçu** modu (uygulama haritası ve bağlantılar)
4. Taktik Kitabı veri biçimi + mod seçimi (Koç / Saf) — PDF’ler geldikçe OCR → harita → kurallar
5. **Geliştirici danışmanı** modu
6. (İsteğe bağlı) “Hatalarımı analiz et”, File Search ile “kaynağa sor”

Her adımdan sonra tip kontrolü (`npx tsc -b`), lint (`npx oxlint`), derleme ve tarayıcıda (önizleme sunucusu, Gemini’yi taklit ederek) doğrulama yap; sonra `YOL_HARITASI.md`’yi güncelle ve commit et.
