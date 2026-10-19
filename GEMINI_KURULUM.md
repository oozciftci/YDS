# Gemini (Yapay Zekâ) Kurulum Rehberi

Bu rehber, uygulamadaki yapay zekâ özelliklerini (soru açıklaması, ileride yazma geri bildirimi ve sohbet) Google Gemini ile çalıştırmak için gereken her adımı sırayla anlatır.

> Son kontrol: 19 Ekim 2026. Google arayüzdeki düğme adlarını zaman zaman değiştirebilir; adlar birebir tutmazsa en yakın seçeneği kullan.

---

## Önce kısaca mantık

- **Google AI Pro üyeliğin API kullanımını kapsamaz.** Gemini uygulamasındaki hakların ayrıdır ve bu kurulumdan etkilenmez.
- AI Pro aboneleri her ay **10 $ Google Cloud kredisi** alır; bu kredi Gemini API’de kullanılabilir.
- **İki ayrı proje ve iki anahtar** kuracağız:
  1. **Ücretli proje** (faturalandırma açık): Önce bu kullanılır. Veriler Google’ın model eğitiminde kullanılmaz, sınırlar yüksektir.
  2. **Ücretsiz proje** (faturalandırma kapalı): Ücretli bakiye biter, harcama sınırına ulaşılır ya da uygulamadaki aylık üst sınır aşılırsa uygulama **kendiliğinden** buna geçer. Günlük kullanım sınırı vardır; buraya gönderilen metinler Google’ın ürün geliştirmesinde kullanılabilir.
- Ücretli projenin bakiyesi bitince Google projeyi kendiliğinden ücretsize çevirmez, istekler hata verir (402). Yedek anahtar bu yüzden gerekli.

Tahmini maliyet (Gemini 3.8 Flash): bir soru açıklaması yaklaşık **0,003 $**. Günde 30 açıklama ayda yaklaşık 2,7 $ eder; bu, 10 $ kredinin içinde kalır.

---

## Adım 1 — AI Pro kredisini etkinleştir (bir kez)

1. Google AI Pro üyeliğinin bağlı olduğu Google hesabıyla şu adrese gir: **https://developers.google.com/program/my-benefits**
2. Sayfadaki avantajları **etkinleştir** (Activate) düğmesine bas.
3. Aylık 10 $ Google Cloud kredisi faturalandırma hesabına tanımlanır.

> Not: Google’ın belgelerine göre uygun krediler ön ödemeli bakiyeden **önce** harcanır. Yine de bazı kullanıcılar kredinin AI Studio ön ödemesine yansımadığını bildiriyor. Adım 3’ten sonra **AI Studio > Billing** sayfasında kredinin görünüp görünmediğini kontrol et.

---

## Adım 2 — Google AI Studio’ya gir

1. **https://aistudio.google.com** adresini aç ve aynı Google hesabıyla giriş yap.
2. Kullanım koşullarını kabul et (ilk girişte sorulur).

---

## Adım 3 — Ücretli projeyi ve anahtarını oluştur

### 3a. Proje
1. Sol menüden **Dashboard > Projects** sayfasına git.
2. **Create project** de, ad olarak `YDS-Ucretli` yaz ve oluştur.

### 3b. Faturalandırma (ücretli katman, Tier 1)
1. **Projects** (ya da **API keys**) sayfasında `YDS-Ucretli` satırında, **Billing Tier** sütunundaki **Set up billing** düğmesine bas.
2. Ülke olarak **Türkiye**’yi seç, koşulları kabul et, iletişim bilgilerini ve kartını gir.
3. Plan olarak **Prepay** (ön ödemeli) gelecektir. **Buy credits** ile en az **5 $** yükle. Bu, Tier 1’e geçmek için gerekli asgari tutardır.
4. **Otomatik yükleme (Setup auto-reload) KAPALI kalsın.** Böylece bakiye bitince kartından otomatik çekim olmaz; uygulama ücretsiz anahtara geçer. Açmak istersen **Manage auto-reload > Monthly Limit** ile aylık bir tavan koy.
5. Ek güvenlik için harcama sınırı koy: **Spend** sayfası > **Monthly spend cap** > **Edit spend cap** > **10 $**. Bu özellik deneysel; yaklaşık 10 dakikalık gecikmeyle devreye girebilir.

### 3c. Ücretli anahtar
1. **API keys** sayfasına git ve **Create API key** de.
2. Proje olarak `YDS-Ucretli`’yi seç.
3. Oluşan anahtarı (`AIza…` ile başlar) **kopyala**. Adım 6’da uygulamaya yapıştıracaksın.
4. Anahtarı sınırla: listede anahtarın yanındaki **Unrestricted** yazısının üzerine gel > **Add restrictions** > **Restrict to Gemini API only** > **Restrict key**.

---

## Adım 4 — Ücretsiz (yedek) projeyi ve anahtarını oluştur

1. **Dashboard > Projects > Create project** de, ad: `YDS-Ucretsiz`.
2. Bu projede **Set up billing**’e BASMA. Faturalandırması kapalı kalmalı; ücretsiz katman ancak böyle çalışır.
3. **API keys > Create API key** de, proje olarak `YDS-Ucretsiz`’i seç ve anahtarı kopyala.
4. Bu anahtarı da sınırla: **Unrestricted > Add restrictions > Restrict to Gemini API only > Restrict key**.

---

## Adım 5 — (İsteğe bağlı, ileri seviye) Anahtarı yalnızca uygulamanın adreslerinde çalıştır

Anahtar ele geçirilse bile başka sitelerden kullanılamaması için:

1. **https://console.cloud.google.com/apis/credentials** adresini aç ve üstten ilgili projeyi seç.
2. Anahtara tıkla > **Application restrictions** > **Websites**’i seç.
3. Şu adresleri ekle:
   - `https://oozciftci.github.io/*` (yayındaki uygulama, telefon dahil)
   - `http://localhost:5173/*` ve `http://localhost:5174/*` (bilgisayarda `npm run dev`)
4. **Save** de. Bunu her iki anahtar için ayrı ayrı yap.

> Bu kısıtlamadan sonra uygulamayı başka bir adreste ya da portta açarsan Gemini 403 hatası verir; o adresi de listeye eklemen gerekir. Emin değilsen bu adımı atlayabilirsin, Adım 3c/4’teki “yalnızca Gemini API” kısıtlaması temel güvenliği sağlar.

---

## Adım 6 — Anahtarları uygulamaya gir

1. Uygulamada **Ayarlar** sayfasına git ve **Yapay Zekâ (Gemini)** kartını bul.
2. **Ücretli anahtar** alanına `YDS-Ucretli` anahtarını yapıştır.
3. **Ücretsiz yedek anahtar** alanına `YDS-Ucretsiz` anahtarını yapıştır.
4. **Model**: `Gemini 3.8 Flash — en yeni (önerilen)` (varsayılan).
5. **Aylık ücretli kullanım üst sınırı**: `10` (AI Pro kredisi kadar). Uygulama tahmini harcamayı izler; bu tutar aşılınca ücretsiz anahtara geçer.
6. **Kaydet**’e bas.
7. **Bağlantıyı test et**’e bas. Her iki anahtar için `✓ Çalışıyor` görmelisin.

Anahtarlar yalnızca o cihazın tarayıcısında saklanır; GitHub’a, yedek dosyasına ya da senkrona girmez. **Telefonda da** kullanmak için aynı adımları telefondaki uygulamada tekrarla (anahtarları kendine güvenli bir yoldan, örneğin şifre yöneticisiyle aktar).

> Anahtarları bu sohbete ya da başka bir yere yapıştırmana gerek yok; doğrudan uygulamaya gir. Yazışmalar kayıt altında tutulduğu için bu daha güvenli.

---

## Adım 7 — Kullanım

- Soru Merkezi’nde bir soruyu cevapladıktan sonra **🤖 Yapay zekâ ile açıkla** düğmesine bas. Açıklama cihazda saklanır; aynı soruya tekrar baktığında yeniden ücret ödenmez (**↻ Yeniden üret** yeni bir açıklama ister).
- Açıklamanın altında hangi katmanın kullanıldığı ve tahmini maliyet yazar.
- Gerçek harcamayı **AI Studio > Dashboard > Usage** sayfasından izleyebilirsin. Uygulamadaki tutar bir tahmindir.

---

## Sorun giderme

| Test / hata mesajı | Anlamı | Ne yapmalı |
| :--- | :--- | :--- |
| `API anahtarı geçersiz` (400) | Anahtar yanlış ya da eksik kopyalanmış | AI Studio > API keys’ten yeniden kopyala |
| `Bakiye yok (402)` | Ücretli bakiye bitti | AI Studio > Billing > **Buy credits**; ya da ücretsiz anahtarla devam et |
| `Kota / harcama sınırı dolu (429)` | Spend cap’e ya da hız sınırına takıldın | Ücretli için ay başını bekle ya da sınırı yükselt; ücretsiz için birkaç dakika veya ertesi gün |
| 403 hatası | Adım 5’teki site kısıtlaması bu adresi kapsamıyor | Adresi **Websites** listesine ekle |
| `Seçili model bulunamadı` (404) | Model adı değişmiş ya da kaldırılmış | Ayarlar’dan başka bir model seç |
| Ücretli anahtar “yedeğe devretti” uyarısı | Ücretli anahtar hata verdi, uygulama 6 saat boyunca ücretsizden devam ediyor | Bakiye yükledikten sonra Ayarlar’da **Kaydet**’e bas; hemen yeniden denenir |

---

## Anahtar sızarsa

1. **AI Studio > API keys** sayfasında anahtarı sil (Delete).
2. Aynı projede yeni anahtar oluştur ve uygulamada Ayarlar’a gir.

---

## Kaynaklar

- [Gemini API fiyatları](https://ai.google.dev/gemini-api/docs/pricing)
- [Faturalandırma (Prepay / Postpay, harcama sınırı)](https://ai.google.dev/gemini-api/docs/billing)
- [API anahtarları ve kısıtlama](https://ai.google.dev/gemini-api/docs/api-key)
- [Hız sınırları ve katmanlar](https://ai.google.dev/gemini-api/docs/rate-limits)
- [AI Pro / Ultra geliştirici avantajları (Google blog)](https://blog.google/innovation-and-ai/technology/developers-tools/gdp-premium-ai-pro-ultra/)
