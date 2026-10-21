# Yeni oturum için başlangıç metni

Aşağıdaki `---` çizgisinin altındaki metni yeni bir Claude Code oturumunun ilk mesajı olarak yapıştır.

---

YDS Kelime projesinde (C:\Projeler\YDS_Proje) çalışmaya devam ediyoruz. Önce şunları oku, sonra bana kısaca durumu özetle:
1. `docs/GELISTIRME_NOTLARI.md` — son oturumun mimarisi, kararlar ve gerekçeleri, çözülen sorunlar, test yöntemi, açık işler (en önemlisi).
2. `YOL_HARITASI.md` — özellikle "Yapılanlar" tablosunun 21.10.2026 satırları ve "Değişiklik günlüğü".
3. `PROJECT_MEMORY.md` — genel mimari ve eski kararlar.
4. Telefonda deneme betikleri: `scripts/mobil-test/README.md`.

**Kurallar (değişmedi):** Tüm kullanıcıya dönük metin Türkçe. Her adımdan sonra `YOL_HARITASI.md` güncellenir (Yapılanlar satırı + Değişiklik günlüğü). Sade arayüz. `git add` dosya dosya (asla `-A`). Commit yap; **push'u ancak ben onaylayınca yap** (her değişiklikten sonra "push edeyim mi?" diye sor; onaylarsam push et, yayını `sw.js` değişimiyle izle ve telefonda görmem gereken sürüm kodunu söyle). Commit mesajı "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" ile biter. API anahtarı isteme/kullanma; betiklerden Gemini çağırma; testlerde `generativelanguage` sahte yanıtla. Telifli içerik (`kaynaklar/`, `cikmis_sorular/`, `local-data/`) yalnızca yerelde, gitignore'da; push öncesi `npm run check:dist` ve takip edilen dosyalarda telifli/gizli dosya olmadığını kontrol et. Denemede eklenen verileri sonra sil.

**Ben:** YDS'ye neredeyse sıfırdan hazırlanıyorum (önceki puan 30). Sınav tarihi belli değil; günde ~1 saat çalışabiliyorum. Uygulamayı iPhone'da GitHub Pages yayın sürümünden (https://oozciftci.github.io/YDS/, ana ekrana ekli) kullanıyorum; kitaplar ve çıkmış sorular telefona `.ydsk` kaynak paketiyle yüklü. Telefon depolamam kısıtlı. Sorunları çoğu zaman ekran görüntüsüyle bildiriyorum. Bir ilke istediğimde (odak modu, sayfa çevirme gibi) bunu uygulamanın her yerine uygula ve benzer bozulmaları kendin tara; tek tek söyletme.

**Son durum (21.10.2026):** Yayındaki sürüm `21.10 14:34 · e3c7a7e` (üst çubukta logonun yanında yazar; belgeler bundan sonra commit'lendi, yayına etkisi yok). Son oturumda yapılanlar: telefondan ev ağıyla erişim (`npm run telefon`), PC↔telefon eşitleme ve ilerleme dosyası, yayın sürümüne yerel kaynak paketi (bilgisayarsız/internetsiz), geniş görünüm ayarları (varsayılan: Gece, kırmızı ana başlık, yeşil alt başlık), kitap okuyucuda tam ekran + kalem/fosforlu + gerçek sayfa katlama + içindekiler/sayfaya git, uygulama genelinde kitap gibi sayfa çevirme ve kaydırma, her ekranda "yalnızca ana alan" odak modu (sağ üstten), profil resmi, sürüm etiketi, depolama şişmesinin durdurulması, hızlı geçişte takılı kalan çevirme kopyasının (donma) giderilmesi.

**İlk iş:** Son düzeltmeler (takılı kopya/donma, odak modu, kaydırma) gerçek iPhone'da henüz doğrulanmadı. Bana bunları telefonda denediğimi ve sorun kalıp kalmadığını sor; sonra `docs/GELISTIRME_NOTLARI.md` §7'deki açık işlerden hangisiyle devam etmek istediğimi sor (öneri: sınav tarihi netleşince kişisel çalışma planı; Gemini'li özellikleri gerçek anahtarla deneme).
