# Yeni oturum için başlangıç metni

Aşağıdaki metni yeni bir Claude Code oturumunun ilk mesajı olarak yapıştır.

---

YDS Kelime projesinde (C:\Projeler\YDS_Proje) çalışmaya devam ediyoruz. Önce şunları oku: `YOL_HARITASI.md` (özellikle 20.10.2026 değişiklik günlüğü), `PROJECT_MEMORY.md`, `DEVAM_PROMPT.md` (bu dosya; aşağıdaki durum özeti).

**Kurallar (değişmedi):** Tüm kullanıcıya dönük metin Türkçe. Her adımdan sonra YOL_HARITASI.md güncellenir. Sade arayüz. `git add` dosya dosya (asla `-A`); commit yap, push yapma; commit mesajı "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" ile biter. API anahtarı isteme/kullanma; betiklerden Gemini çağırma; testlerde `generativelanguage` sahte yanıtla. Telifli içerik (`kaynaklar/`, `cikmis_sorular/`, `local-data/`) yalnızca yerelde kalır, gitignore'da; `npm run check:dist` yayında sızıntı olmadığını kontrol eder. Tarayıcıda denemede yüklenen deneme verilerini sonra sil.

**Kullanıcı:** YDS'ye neredeyse sıfırdan hazırlanıyor (önceki puan 30). Sınav tarihi ve günlük süre henüz netleşmedi — sorulacak.

**Kaynaklar (hepsi yerel):**
- `kaynaklar/Essential Grammar in Use.pdf` (Murphy, A1–A2) ve `English Grammar in Use 5th` (B1–B2) → "Kitaptan çalış" (`/kitap`), görüntüler `local-data/kitaplar/`, `scripts/buildBooks.py`.
- `kaynaklar/Modadil sınav stratejileri 3.pdf` → görüntü tabanlı 193 test / 2680 soru (`/yds-sorular/bankalar/strateji-3`), anahtar `local-data/yds/_eksik/strateji3_anahtar.txt` (görüntüden elle okundu), `scripts/buildStrateji3.py` + `scripts/winOcr.ps1` (Windows OCR).
- `kaynaklar/SUAT GÜRCAN - RIDVAN GÜRBÜZ sınav stratejileri 1-2-1.pdf` → 745 sayfa OCR, `local-data/kaynaklar/sinav-stratejileri-12/sayfa-NNNN.md` + `icindekiler.json`; koç modu haritası `local-data/kaynaklar/harita.json` (`scripts/buildSourceMap.py`).
- `cikmis_sorular/modadil-soru-bankasi-2.pdf` → MODADİL gramer bankası 20 test / 500 soru, kitabın çözümüyle (`local-data/yds/banka-grammar-modadil-NN.json`, `scripts/parseModadilGramer.py`).
- Çıkmış YDS/YÖKDİL sınavları (`local-data/yds/`), Taktik Kitabı vb. önceden vardı.
- `cikmis_sorular/remzi-50-deneme.pdf`: cevap anahtarı yok → kullanıcı eklenmesini istemedi.
- Kelime aileleri (özgün, yayında): `public/data/word_families.json` ← `scripts/data/word_families/*.txt`, `scripts/buildWordFamilies.py`.

**Son eklenenler (hepsi commit'li, push yok):** Çalış merkezi + sade ana sayfa; üst menü başlıkta; Kelimeler sayfası listesi/sayfalama; katlanır soru gezgini + üstte önceki/sonraki; Dinle duraklat/devam + EN↔TR; Gece Modu; kaydedilenler/sık kullanılanlar; × ile kaldırma; tersten çalış; MODADİL gramer bankası; Kitaptan çalış; Sınav Stratejileri 3 testleri + yanlış defteri; yazarak cevap (doğruda ✓ ve 1 sn sonra otomatik geçiş); hafıza kancası; kelime ailesi/ekler sayfası + "👪 Aynı aileden" (türev+tür+Türkçe, eş/zıt anlam); günün hikâyesi; okuma hızı antrenörü; kitap üniteleri günlük planda + ilgili MODADİL testi önerisi; Ctrl+K hızlı arama; odak modu (F); koç modunda Sınav Stratejileri 1-2 sayfaları kaynak.

**Doğrulanmamış / açık işler:**
1. Gerçek Gemini anahtarıyla denenmedi: günün hikâyesi, hafıza kancası önerisi, koç modu (Sınav Stratejileri 1-2 kaynaklı açıklama).
2. Telefondan erişim yok: kitaplar, MODADİL testleri, çıkmış sorular, Gece Modu yalnızca bu bilgisayarın dev sunucusunda (`npm run dev`, localhost). Ev ağı üzerinden şifreli erişim büyük iş olarak bekliyor.
3. Kişisel çalışma planı: sınav tarihi + günlük süre öğrenilince haftalık plan ve ana sayfa planına bağlama.
4. Kullanıcıya "Yenilikler" sayfası önerildi (cevap bekliyor).
5. Yazarak cevapta "neredeyse doğru" otomatik geçmiyor (kullanıcı isterse değişecek).
6. Sınav Stratejileri 3'te 9 sorunun kutusu bulunamadı (tam sayfa gösteriliyor); kitap okuyucuda bazı bölme yerleri bölüm ortasına düşebilir — kullanıcı sayfa bildirirse elle düzelt.
7. Sınav Stratejileri 1-2 OCR metinleri ayrıca kitap okuyucuya (görüntü) ya da konu anlatımı olarak uygulamaya eklenebilir — kullanıcıya sorulmadı.
8. YOL_HARITASI'ndaki eski bekleyenler: 6.2 Yazma pratiği, 5.3 Okuma kütüphanesi, 6.7b, 6.3 senkron, File Search.

İlk iş: kullanıcıya sınav tarihini ve günde ayırabileceği süreyi sor; sonra yukarıdaki açık işlerden hangisiyle devam etmek istediğini sor.
