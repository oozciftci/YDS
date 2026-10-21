# Geliştirme Notları (21.10.2026 oturumu ve sonrası için başvuru)

Bu belge 21.10.2026 oturumunda kurulan yapıları, alınan kararları ve gerekçelerini, karşılaşılan sorunları ve çözümlerini,
test yöntemini ve dikkat edilmesi gerekenleri anlatır. Özellik listesi ve tarihçe: `YOL_HARITASI.md` (Yapılanlar tablosu +
Değişiklik günlüğü). Genel mimari ve eski kararlar: `PROJECT_MEMORY.md`. Yeni oturum başlangıcı: `DEVAM_PROMPT.md`.

---

## 1. Kullanıcı ve çalışma biçimi

- **Dil:** Kullanıcıya dönük her metin Türkçe (arayüz, mesajlar, özetler). Kod yorumları da Türkçe yazılıyor.
- **Kullanıcı:** YDS'ye neredeyse sıfırdan hazırlanıyor (önceki puan 30). Sınav tarihi henüz belli değil; günde yaklaşık 1 saat.
- **Cihaz:** iPhone. Uygulamayı **GitHub Pages yayın sürümünden** (https://oozciftci.github.io/YDS/) ana ekrana eklenmiş
  uygulama olarak kullanıyor; telifli kaynaklar telefona `.ydsk` paketiyle yüklendi. Telefon depolaması kısıtlı.
- **Ekran görüntüsüyle geri bildirim** veriyor; sorunları çoğu zaman gerçek iPhone'da yakalıyor. Bizim testlerimiz başsız
  Chrome'da; iOS Safari farklı davranabilir (bkz. §6).
- **Push:** Kural "commit yap, push yapma". Bu oturumda kullanıcı her değişiklikten sonra "Evet, push et" diyerek onay verdi.
  Akış: commit → wrap_up ile "push edeyim mi?" sor → onayda push → yayını izle → telefonda görülecek sürümü söyle (§3.6).
- **İstek tarzı:** "Tek tek söylettirme" — bir ilke istediğinde (ör. odak modu, kaydırma) bunu uygulama geneline uygula;
  benzer bozulmaları kendin tara.

## 2. Değişmeyen kurallar

- Her adımdan sonra `YOL_HARITASI.md` güncellenir (Yapılanlar satırı + Değişiklik günlüğü).
- Sade arayüz; her yeni şeyin ekranda bir cümlelik açıklaması.
- `git add` dosya dosya (asla `-A`: başka oturumlar takipsiz dosya bırakıyor). Commit mesajı
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` ile biter.
- API anahtarı isteme/kullanma; betiklerden Gemini çağırma; testlerde `generativelanguage` sahte yanıtla.
- Telifli içerik (`kaynaklar/`, `cikmis_sorular/`, `local-data/`) yalnızca yerelde, gitignore'da. Yayından önce
  `npm run check:dist`. Push öncesi kontrol: `git ls-files | grep -iE "local-data|cikmis_sorular|^kaynaklar/|\.pdf$|\.ydsk$|erisim"` boş olmalı.
- Tarayıcıda denerken eklenen deneme verileri (kelime, çizim, localStorage anahtarları) sonra silinir.

## 3. Dağıtım ve veri mimarisi

### 3.1 Üç çalışma biçimi
| Biçim | Komut / adres | Telifli içerik nereden |
| :--- | :--- | :--- |
| Yerel geliştirme (PC) | `npm run dev` → http://localhost:5173 | `/local-api/*` (vite.config.ts eklentileri, `local-data/`) |
| Telefon, ev ağı | `npm run telefon` → PC'de yine localhost:5173, telefonda https://<PC IP>:5180 | Aynı `/local-api/*`, şifreli kapıdan |
| Yayın (GitHub Pages) | push → Actions → https://oozciftci.github.io/YDS/ | Cihaza yüklenen `.ydsk` paketi (IndexedDB) |

### 3.2 Telefondan erişim (ev ağı) — `vite.phone.ts`
- Ayrı HTTPS sunucusu (port 5180, `YDS_TELEFON_PORT`), aynı Vite ara katmanlarını kullanır; HMR için `upgrade` olayı ana sunucuya aktarılır.
- **Neden ayrı port:** tek sunucu https olsaydı PC'deki adres (origin) değişir, IndexedDB'deki ilerleme "kaybolmuş" görünürdü.
- **Neden HTTPS:** `crypto.randomUUID`, mikrofon vb. yalnızca güvenli bağlamda çalışıyor; düz http'de uygulama çöküyordu.
  Sertifika kendinden imzalı (`@vitejs/plugin-basic-ssl` → `getCertificate`, `local-data/telefon/sertifika/`); telefonda bir kez uyarı.
- **Şifre kapısı:** bilgisayar dışından gelen her istek (sayfa, kod, `/local-api`) şifre ister. Şifre ilk çalıştırmada üretilir
  (`local-data/telefon/erisim.json`), Ayarlar › 📱 Telefondan aç kartında gösterilir. Çerez 400 gün, HMAC(şifre); 5 yanlışta 10 dk bekleme.
  Tüm `/local-api` uçları `trusted(req)` kullanır (localhost ya da geçerli çerez).

### 3.3 Cihazlar arası eşitleme — `src/services/deviceSync.ts`
- Ortak kopya PC'de: `/local-api/esitle` → `local-data/telefon/esitleme.json` (`rev` ile; çakışmada 409, istemci baştan dener).
- **Birleştirme tarayıcıda** (`mergeSnapshots`, `mergeStorage` saf işlevler + birim testleri): kayıt kayıt "yeni olan kazanır"
  (tabloya göre damga: `updatedAt`, `answeredAt`, `lastStudiedAt` …); `users` için `updatedAt` (profil resmi/renk).
  Aynı kelime iki cihazda farklı kimlikle eklenmişse ortak kopyadaki kimliğe taşınır (kart, tekrar kaydı, grup, oturum referanslarıyla).
- Tarayıcı deposundaki kişiye özel ilerleme (`yds-*:user_*` anahtarları: kitapta kaldığın yer, biten üniteler …) üç yollu birleştirilir.
- **İlerleme dosyası** (Ayarlar › İlerlemeyi dosyayla taşı): aynı birleştirme, sunucusuz. Yayın sürümü ↔ PC aktarımı bununla.
- **Sınır:** kalıcı silmeler (ör. defter notu) karşı cihazdan geri gelir; çizim silme boş liste olarak tutulduğu için doğru eşitlenir.

### 3.4 Yerel kaynak paketi (.ydsk) — `vite.localBundle.ts` + `src/services/localContent.ts`
- **Karar:** telifli içerik yayına girmez; kullanıcı onu kendi telefonuna bir kez dosya olarak indirir, yayın sürümü onu
  cihazın deposuna (IndexedDB `YdsLocalContent`, ayrı veritabanı) alır → bilgisayarsız, internetsiz çalışır.
- **Biçim:** `YDSK1\n` + her kayıt için tek satır JSON başlık `{"p":"<local-api yolu>","t":"<mime>","n":<bayt>}` + ham bayt;
  başta manifest, sonda `{"end":true}`. Her kayıt sunucunun kendi `/local-api` yanıtıdır (sunucu kendine sorar) → iki taraf aynı biçimi görür.
- Liste kayıtları (`yds/`, `kitap/`, `paket`) cihazda kimliğe göre birleştirilir → parça parça yüklenebilir.
- `localFetch(path)`: geliştirmede `fetch`, yayında depodan `Response`. Görüntüler için `useLocalUrl` (nesne adresi).
  `hasLocalContent()` = DEV ya da `yds-local-content` bayrağı; rotalar/menüler buna bakar (paket yükleyince sayfa yenilenir).
- **İndirme geri bildirimi:** paket önce geçici dosyada üretilir (Content-Length bilinsin, telefonun indirme bildiriminde yüzde
  görünsün); sayfa `/local-api/kaynak-paketi/durum?id=` ile "hazırlanıyor / gönderiliyor % / ✓ / ✗" gösterir.
- Orijinal PDF düğmesi yalnızca geliştirmede (PDF'ler pakete girmez).

### 3.5 Güncelleme ve önbellek
- Workbox `registerType: 'prompt'` + sessiz uygulama (`src/pwa/registerSW.ts`): yeni sürüm arka planda iner, uygulama arka plana
  geçince devreye girer. Kullanıcı: internet varken aç, birkaç sn bekle, kapat-aç. Ana ekrana yeniden eklemek gerekmez.
- Önbellek ~4 MB; eski sürüm dosyaları silinir (`cleanupOutdatedCaches`) → güncellemeler yer biriktirmez.

### 3.6 Sürüm etiketi
- Üst çubukta logonun yanında `gg.aa ss:dd` + kısa commit (`__APP_VERSION__`, `vite.config.ts` `define`; CI'da `GITHUB_SHA`,
  yerelde "yerel"). Push'tan sonra kullanıcıya "alt satırda <sha> yazıyorsa güncelleme gelmiş" denir.
- **Yayın kontrolü:** push öncesi `sw.js` özetini al, sonra arka planda 20 sn arayla değişimi bekle
  (`curl -s https://oozciftci.github.io/YDS/sw.js | md5sum`). Sürümü doğrulamak için index-*.js içinde
  `Uygulama sürümü` sonrasındaki iki satıra bak (değer satır sonu içerir; `grep -A1`).

### 3.7 Depolama (telefonu şişirmesin)
- Bulut (Supabase) ayarlı değilken eşitleme kuyruğuna (`syncQueue`) **yazılmaz**, açılışta boşaltılır, üst çubukta sayı gösterilmez.
  Önceden her kelime/kart değişikliği içeriğiyle kuyruğa yazılıyor ve hiç boşalmıyordu (kullanıcıda 9410 kayıt).
  **Dikkat:** ileride Supabase kurulursa mevcut verinin ilk tam gönderimi ayrıca yazılmalı (kuyruk geçmişi yok).
- Uygulama kayıtları (`logs`) son 14 gün / en fazla 2000 kayıt (`logger.trimLocalLogs`, açılıştan 5 sn sonra).
- Kullanıcıya: paketi yükledikten sonra Dosyalar › İndirilenler'deki `.ydsk` dosyasını silmesi söylendi (~215 MB).
- iPhone Safari, ana ekrana eklenmemiş sitelerin verisini 7 gün kullanılmazsa silebilir → ana ekrandan kullan, ilerleme dosyasıyla yedek al.

## 4. Arayüz sistemleri

### 4.1 Görünüm — `src/stores/appearance.ts`, `src/components/AppearanceCard.tsx`
- Vurgu rengi, zemin tonu, ana/alt başlık rengi, tam siyah koyu tema, yazı boyutu (rem → tüm arayüz), yazı tipi, köşeler,
  kontrast, hareket. `index.css` tasarım değişkenlerinin üzerine `<style id="yds-appearance">` yazılır (açık/koyu ayrı).
- **Varsayılan (kullanıcı seçimi):** Gece (turkuaz 174/65, koyu temada tam siyah), ana başlık kırmızı `355,70`, alt başlık yeşil
  `148,60`. Eski mavi görünüm "Klasik mavi" hazır görünümü. Vurgu yazımı `CSS_BASE` (index.css'teki mavi) ile kıyaslanır.
- Başlık değişkenleri: `--heading` (h1–h2, kart/kategori başlıkları), `--subheading` (h3–h4, seçenek ve liste öğeleri).
- Açık temada beyaz yazı okunsun diye vurgu açıklığı tona göre (`lightL`).

### 4.2 Odak modu — Layout + `src/services/focusStage.ts` + `index.css`
- **İlke:** odak açıkken yalnızca sayfanın ana alanı görünür, ekrana sığar ve ortalanır, sayfa kaymaz; alan uzunsa yalnızca
  kendi içinde kayar. Aç/kapa her sayfada **sağ üstte** (üst çubuğun en sağı; çıkış düğmesi tam aynı yerde, kitapta da).
- İşaretler: `data-focus-stage` (ana alan: kelime kartı `cardStage`, `QuestionCard` içindeki paragraf+soru `qStage`,
  Strateji 3 soru kartı, mini deneme sorusu, çeviri cümlesi), `data-focus-keep` (deneme süresi ve Bitir), `data-focus-hide`
  (alan içindeki önceki/sonraki, ipucu, Hızlı cevap). Açık balon/pencereler (`role="dialog"`) korunur.
- `focusStage.ts` korunanların atalarını görünür bırakıp her atanın öbür çocuklarına `data-focus-off` koyar; MutationObserver
  yalnızca öğe ekleme/çıkarmada yeniden uygular. **`:has()` kullanma** (bkz. §6.1).
- Odakta ana alan `overflow-x: hidden; overflow-y: auto` (bkz. §6.3). Alanın dışında görünür kalanların (süre, Bitir, okuma
  sonucu) yüksekliği ölçülüp `--focus-reserve` ile alanın `max-height`’ından düşülür (yoksa alan ekrandan taşıyordu).
- Kitap okuyucu kendi tam ekranını kullanır; genel odak açılınca kitap da tam ekran açılır (`useGlobalFocus`), çıkış `yds-focus-off` olayı.
- Telefon durum çubuğu: odak içeriği ve çıkış düğmesi `env(safe-area-inset-*)` ile aşağıda.

### 4.3 Sayfa çevirme
- **Kitap:** `src/pages/books/PageView.tsx` + `pageCurl.ts` (saf geometri, 5 birim testi): katlama çizgisi = köşe ile parmak
  noktasının orta dikmesi; Sutherland–Hodgman kırpma; yansıma matrisi. İleri: sağ köşe sola; geri: aynası (sol köşe sağa).
  Komşu kareler altta hazır (görüntüler önceden yüklenir). Yarım sayfada aynı sayfanın yarıları arasında dikey kayma.
- **Genel (soru, kart, cümle):** `src/services/pageTurn.ts` — ana alanın o anki görünümü **kopyalanıp** köşesinden katlanır,
  arka yüzü kâğıt, gölge şeritleri. Kopya `[data-page-turn]` sarmalayıcısında, ana alanın ebeveynine eklenir (kalıtılan stiller için).
  Aynı anda tek kopya (yenisi eskisini siler).
- **`src/hooks/useSwipeNav.ts`:**
  - Kaydırırken **sayfa değiştirilmez**; kalkan kopyanın altında boş kâğıt (`cover`). Bırakınca: geçilecekse önce `onNext/onPrev`,
    sonra `uncover()` ve çevirme tamamlanır; vazgeçilirse kopya geri kapanır (hiçbir şey değişmez). Bkz. §6.2.
  - Parmak olayları **dokunulan öğeye** bağlanır (`touchmove` pasif değil → yatay harekette dikey kaydırma durdurulur).
  - Yeni dokunuşta süren çevirme `skip()` ile bir karede bitirilir; yarım kalmış kopya temizlenir; animasyon `try/finally`.
  - Kenarda (ilk/son) yaylanma; yatay kaydırmalı tablo/şerit, yazı alanı, metin seçimi, açık balon kaydırmayı başlatmaz
    (ana alanın kendisi bu kontrolde sayılmaz).
  - `turn(±1)`: düğmeler ve ok tuşları aynı çevirmeyi oynatır (`useQuestionNav` döndürür; `QuestionCard` önceki/sonraki ona bağlı).
  - "Hareketi azalt" açıkken animasyonsuz.
- Bağlı ekranlar: çıkmış sınav, deneme, özel deneme, konu/Yanlış Defteri (QueueRunner), soru bankaları, Strateji 3 testleri ve
  defteri, Alıştırma Merkezi, kelime kartları (Study), mini kelime denemesi (ExamQuiz), Çeviri Atölyesi, Gece Modu.
  Okuma Modu (paragraflar arası, 21.10.2026) ve ek testi (WordFamilies) de bağlandı. Bilinçli olarak bağlı olmayanlar:
  Gramer konu sayfası (“Sonraki konu”), Eş anlam eşleştirme turları.

### 4.4 Kitap okuyucu — `src/pages/Books.tsx`, `src/pages/books/*`
- Tam ekran (odak): kare ekrana sığar; altta yalnızca sayfa no + ✏️; çıkış sağ üstte. Gerçek tam ekran API'si (iPhone'da yok).
- Kalem/fosforlu: çizgiler sayfa görüntüsü pikselinde `db.bookInk` (Dexie v11; eşitlemeye girer). Sürüklenebilir palet
  (renk, kalem/fosforlu, geri al, sayfayı temizle). İki parmak = yakınlaştırma (ikinci parmak çizgiyi iptal eder; `touch-action: pinch-zoom`).
- İçindekiler paneli (`TocPanel.tsx`): üniteler + sağda "s. N" (okuyucudaki numara = dosyadaki sayfa sırası; basılı numara
  birkaç sayfa farklı olabilir), "Sayfaya git"; odakta sayfa numarasına dokununca açılır.

### 4.5 Okuma Kütüphanesi ve ortak okuyucu
- Veri: `public/data/okuma/<seviye>.json` (özgün, yayına girer; biçim `src/services/readingLibrary.ts`). Yeni metin eklerken:
  cümle başına Türkçe, zor kelimeler için **metinde geçtiği biçimiyle küçük harfli** anlam anahtarı (ör. `muscles`, `absorbing`),
  4 şıklı 3 soru (`qt` Türkçesi, `why` metindeki dayanak), Türkçe özet; sonra `node scripts/qcOkuma.mjs` + `npx vitest run`.
  Seviye kelime sınırları: A2 80–220, B1 150–320, B2 220–420, C1 280–520.
- Okuyucu `src/pages/exam/ReaderBody.tsx` (Okuma Modu da kullanır): sonuç ve devamı (sorular, sonraki metin) aynı kartta
  metnin altında → odak modunda da görünür. Kaydırılan kapsayıcı dışarıda kalır, okuyucu metin kimliğiyle anahtarlanır (§4.3).
- Kayıtlar `src/services/readingLog.ts`; Okuma Modu `<sınav>/<paragraf>`, kütüphane `lib/<id>`.

### 4.6 Okuma kitapları
- İki kaynak, tek biçim (`src/services/readingBooks.ts`): özgün uyarlamalar yayında (`public/data/okuma/kitap/`), ücretsiz
  dış kitaplar **yalnızca yerelde** (`local-data/okuma/kitaplar/`, telefona kaynak paketinin “okuma” parçasıyla). Lisansları
  ücretsiz dağıtıma izin verse de kural gereği yayına konmaz.
- Yeni özgün uyarlama: `scripts/okuma/uyarlamalar/<id>.md` yaz (biçim `uyarlama.mjs` başında) → `node scripts/okuma/uyarlama.mjs`.
- Yeni yerel kitap (kullanıcının taradığı kitaplar dâhil): `local-data/okuma/indirilen/<dizin>/` → `metin_cikar.py` (ya da OCR +
  `ocr_duzelt.py`) → `kaynaklar.json`'a girdi (bölüm başlığı düzeni: `chapterRe`, `marks`, `markRe` + `titles`, `single`) →
  `kitap_yap.mjs`. Telifli kitaplar yalnızca kişisel kullanım için ve yalnızca yerel pakette.
- OCR: Tesseract yok; Windows'un yerleşik OCR'ı PowerShell ile kullanıldı (yalnızca Türkçe dil paketi kurulu → İngilizce metinde
  ı/İ ve "Ido" hataları; `ocr_duzelt.py` düzeltir). İngilizce OCR dili kurulursa (Ayarlar › Dil › İngilizce › OCR) daha temiz olur.
- Kaynaklar ve lisans notları: `scripts/okuma/kaynaklar.json`; indirme bağlantıları YOL_HARITASI günlüğünde.

### 4.7 Diğerleri
- Kelime balonu (`exam/WordPopover.tsx`): ekranı kaplayan arka plan yerine "dışarıya dokununca kapan" dinleyicisi → başka kelimeye tek dokunuş.
- Profil resmi/rengi (`components/Avatar.tsx`, `services/avatar.ts`): ~256 px kare JPEG data URL `users.avatarImage`.
- Dar telefonda üst çubuk: kullanıcı adı ve çevrimiçi noktası gizli; büyük yazıda iki satıra sarar.

## 5. Test yöntemi

- **Tarayıcı paneli** (preview) gizliyken `requestAnimationFrame` çalışmaz → animasyonlu her şey (çevirme, odak işaretleri
  rAF'a bağlıysa) panelde test edilemez; panel ekran görüntüsü/zoom bazen eskidir.
- **Başsız Chrome + CDP** ile gerçek dokunma olayları: `scripts/mobil-test/` (README orada). Ayrı dev sunucusu port 5176
  (`.claude/launch.json`'a geçici `gorunum-test` girdisi ekleyip `preview_start`, sonunda kaldır). Betikler deneme kelimelerini
  başsız profile ekler; profil klasörü test sonunda silinir.
- **Önemli:** iOS Safari ile Chrome dokunma hedefi davranışı farklı (§6.2). Dokunmayı **şık/kelime üstünden** başlatan test yaz.
- Yayın derlemesini denemek: `MSYS_NO_PATHCONV=1 BASE_PATH=/YDS/ npm run build`, `npx vite preview --port 4173` (`env BASE_PATH`).
- Her değişiklikte: `npx tsc -b`, `npx vitest run`, `npm run build`, `npm run check:dist`, `npx oxlint <dosyalar>`.

## 6. Karşılaşılan sorunlar ve çözümleri (tekrar yaşanmasın)

1. **`:has()` ile odak kuralı telefonu kilitledi.** Her öğe için alt ağacı tarayan kural, sayfa çevirmenin her karesinde yeniden
   hesaplanıyordu (kelimeleri düğme olan sınav paragrafı × kopyalar). → JS ile bir kez işaretle (`data-focus-off`).
2. **Takılı kalan çevirme kopyası (asıl "donma").** Kaydırma başında yeni içerik hazırlanınca parmağın altındaki öğe kalkıyordu;
   iPhone Safari sonraki olayları yalnızca o kopmuş öğeye gönderir, kapsayıcıya ulaşmaz → çevirme hiç bitmiyor, kopya önde kalıyordu.
   Chrome'da boş alandan başlayan testler bunu göstermedi; şık/kelime üstünden başlayan test 6 takılı kopya üretti.
   → Sürüklerken DOM'u değiştirme; olayları dokunulan öğeden dinle; yeni dokunuşta temizle; `finally` ile kaldır.
3. **Odakta kaydırma çalışmıyordu → tarayıcı "geri git".** Ana alana `overflow-y: auto` verilince `overflow-x` da `auto` hesaplanır;
   birkaç piksellik taşma "yana kayan alan" sanıldı ve kaydırma kapandı. → kontrolde ana alanı atla, `overflow-x: hidden`,
   `overscroll-behavior-x: none`.
4. **Kelime balonu iki dokunuş istiyordu:** tam ekran görünmez arka plan ilk dokunuşu yutuyordu. → dışarı dokunma dinleyicisi.
5. **Odakta kaybolanlar:** balon (ana alan dışında render) ve deneme Bitir düğmesi → `role="dialog"` ve `data-focus-keep` korunur.
6. **Telefonda yatay taşma:** `<select>` en uzun seçeneğe göre genişliyor; kelime kartı puan düğmeleri 500 px; büyük yazıda üst çubuk;
   Supabase kart başlığı. Çözüm: `min-width: 0`/`flex-basis: 0`, satır sarma. Tarama: 27 sayfa × 375 px'te `innerWidth`.
   Not: mobil öykünmede taşma `innerWidth`'i büyütür (ör. 483) — taşma belirtisi budur.
7. **iPhone durum çubuğu altında kalan düğme:** `viewport-fit=cover` → `env(safe-area-inset-top)`.
8. **Düz http'de uygulama çöktü:** `crypto.randomUUID` güvenli bağlam ister → telefon için HTTPS.
9. **Windows Git Bash yol dönüştürmesi:** `BASE_PATH=/YDS/` → `C:/Program Files/Git/YDS/`; curl `-d next=/kitap` bozuldu.
   → `MSYS_NO_PATHCONV=1`.
10. **Bash tırnak/heredoc hataları:** uzun Python/JS gömülü komutlarda `unexpected EOF`. → betiği Write ile scratchpad'e yaz, çalıştır.
11. **İndirmede geri bildirim yoktu (215 MB):** akış (Content-Length yok) → önce geçici dosya + durum ucu.
12. **Dev sunucusu sırasında HMR "hook sırası" hataları** panel konsolunda görünebilir; sayfa yenilenince gider (gerçek hata değil).

## 7. Açık işler ve bilinen sınırlar

- ✅ **Gerçek iPhone'da doğrulandı (21.10.2026):** son çevirme/kaydırma düzeltmesi (e3c7a7e), odak modu — kullanıcı sorun bildirmedi.
- Gemini'li özellikler gerçek anahtarla denenmedi (günün hikâyesi, kanca önerisi, koç modu, çeviri puanlama …).
- Yayın sürümü ↔ PC eşitlemesi yalnızca ilerleme dosyasıyla (otomatik değil). Ev ağı eşitlemesi yalnızca `npm run telefon` açıkken.
- Supabase eşitlemesi kuyruk yazılmadığı için fiilen kapalı; kurulursa ilk tam gönderim gerekir (§3.7).
- Kişisel çalışma planı (sınav tarihi + günde 1 saat) kurulmadı; tarih netleşince haftalık plan + ana sayfa planına bağla.
- Kaydırırken alttaki içerik boş kâğıt (bilinçli tasarım, §4.3).
- Strateji 3'te 9 sorunun kutusu yok (tam sayfa); kitap bölme yerleri bazen bölüm ortasına düşebilir.
- Okuma Kütüphanesi: daha çok özgün uyarlama (A1–B1 ağırlıklı), B2/C1 kısa metinler, “kendi metnini ekle”, konu süzgeci;
  kitaplarda okunan sayfa istatistiği yok (yalnızca kaldığın yer). Free Graded Readers’taki 1. Sherlock öyküsü (Empty House) sitede yok (404).
- YOL_HARITASI eski bekleyenler: 6.2 Yazma pratiği, 6.7b, 6.3 senkron, File Search; "Yenilikler" sayfası önerisi.
