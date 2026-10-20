# Sabah Raporu (20.10.2026)

Gece boyunca Faz 7–10’dan aşağıdaki işler yapıldı. Hepsi commit’li (`git log --oneline` ile bak); **hiçbir şey push edilmedi.** Kontroller: `npx tsc -b` temiz, `npm test` 19/19 geçiyor, `npm run build` + `npm run check:dist` temiz.

## Önce yapman gerekenler
1. **`npm run vault:lock` ve push** — yerel veri değişti (`local-data/`: 2018 Aralık cevap düzeltmeleri, yeni `analiz/` dosyaları). Kasayı sen kilitleyip gönderiyorsun.
2. **`SABAHA_SORULAR.md`**’yi oku (aldığım varsayılan kararlar; en önemlisi: yeni çeldiricilerin ikinci okumada tek doğru cevap açısından gözden geçirilmesi).
3. **Gerçek Gemini ile dene:** Çeviri Atölyesi, “Benzer soru”, Haftalık koç yorumu ve Zor kelime ipucu özellikleri yalnızca **sahte yanıtla** test edildi (anahtar yok). Gerçek anahtarla bir kez deneyip yanıt biçimini kontrol et.
4. Bekleyenler (dokunmadım): hoca PDF’leri (Taktik Kitabı), 6.3 senkron, File Search, 5.3 okuma kütüphanesi.

## Yapılanlar (özellik özellik)

### Kullanıcı tarafı (Faz 7)
| # | Ne | Nerede dene |
| :-- | :-- | :-- |
| 7.1 | **Hedef puan planı**: hedef puan → gereken doğru, tahmini doğru, eksiğin hangi tiplerden kapatılacağı; Bugünkü Plan ipucu en çok kazandıran tipi önerir | Soru Merkezi (`/yds-sorular`) “Hedef puan planı” kartı; Ana Sayfa plan altındaki 🎯 ipucu (en az 20 YDS cevabı gerekir) |
| 7.2 | **Deneme süre analizi**: her soruda geçen süre kaydı; sonuç ekranında tip başına süre + “yavaş” işareti | Bir deneme bitir → “Süre analizi” |
| 7.3 | **Yanlış nedeni**: “Bilmiyordum / Dikkatsizlik / Süre yetmedi” tek dokunuş; “Hatalarımı analiz et”te dağılım kartı ve Gemini istemine bilgi | Yanlış cevap sonrası; `/yds-sorular/analiz` |
| 7.4 | **Özel deneme**: havuz + tipler + 10/20/40 soru + süre | Soru Merkezi → “🎛️ Özel Deneme” |
| 7.5 | **Denemeler arası tablo + sıklık önerisi** | Deneme geçmişi kartı |
| 7.6 | **Gramer konusu sınav sıklığı** (yalnızca sayılar yayında) | Dilbilgisi Rehberi (`/dilbilgisi`) |
| 7.7 | **Çeviri Atölyesi** (24 cümle, Gemini puanlar, önbellekli) | `/yds-test/ceviri` |
| 7.8 | **Benzer özgün soru üret** (yanlıştan sonra) | Soru çözerken yanlış yap → “✨ Benzer bir soru çöz” |
| 7.9 (kısmen) | **Zor kelime (leech) yardımı**: 5+ unutulan kelimede uyarı + akılda kalıcı ipucu. *Sınav cümlesinden boşluk kartı yapılmadı.* | Çalış → kartı çevir (5+ unutulmuş kelime) |
| 7.10 | **Haftalık rapor** (+ isteğe bağlı koç yorumu) ve **Metinden kelime çıkar** | İstatistik sayfasının başı; Kelimeler → “📄 Metinden Kelime” |

### Özgün içerik (Faz 8 — yayına girebilir, çıkmış soru içermez)
- **Alıştırma Merkezi** (`/yds-test`, eski “YDS TEST”): **359 özgün soru, 60 set** — kelime 50, dilbilgisi 50, cloze 40, cümle tamamlama 51, çeviri 42, yakın anlam 20, paragraf tamamlama 21, anlam bütünlüğü 25, diyalog 20 + **okuma 10 metin / 40 soru**. Her şıkkın Türkçe açıklaması, cümle çevirisi ve kelime dokunma var.
- **8.2** Gramer alıştırmaları konu başına 5 → **10**.
- **8.4** YÖKDİL alan terimleri: Fen 62, Sağlık 55, Sosyal 51 (Kelimeler → Hazır Paketler → “🧪 YÖKDİL Alan Terimleri”).
- **8.5** Çeviri cümleleri 24 (Çeviri Atölyesi için).
- Araçlar: `node scripts/qcOzgun.mjs` (kalite kontrol), `node scripts/balanceOzgun.mjs` (A–E dengesi).

### Yerel veri (Faz 9 — yayına girmez)
- `local-data/analiz/soru_etiketleri.json` (3.120 soru etiketli), `kelime_soru_eslesme.json`, `dogrulama_notlari.md`.
- **2018 Aralık cevap düzeltmesi:** 29→A, 67→E, 69→D düzeltildi; 65, 68, 70 gerekçeyle korundu. Gerekçeler `local-data/analiz/dogrulama_notlari.md`’de. Kesin teyit için orijinal ÖSYM anahtarı gerekir.

### Kalite (Faz 10)
- **10.1** `npm run build` sonra **`npm run check:dist`** — yayın klasöründe çıkmış sınav metni sızıntısı taraması. **Yayına çıkmadan önce her seferinde çalıştır.** İlk koşu temiz (yalnızca `Coach` paketinde “local-data/”, “cikmis2.pdf” **adları** geçtiği için UYARI var; içerik yok).
- **10.2** Vitest kuruldu (`npm test`), 19 test.
- **10.3** (kısmen) Yeni kodda lint uyarısı yok; eski sayfalardaki ~17 React uyarısı duruyor (davranış değiştirebilir, ayrı ele alınmalı).

## Bilinen sorunlar / dikkat
- Özgün sorular benim yazdığım içerik: bilgi ve tek doğru cevap açısından **birkaç soruyu rastgele çözerek** kontrol et; hata görürsen `public/data/ozgun/*.json` içinde düzelt (sonra `node scripts/qcOzgun.mjs`).
- Cümle tamamlama çeldiricileri bazen bariz yanlış (SABAHA_SORULAR’da).
- Anlam bütünlüğü cevapları çoğunlukla III/IV (dengelenmedi).
- Zor kelime yardımı ve haftalık rapor arayüzde gerçek kullanıcı verisiyle görülmedi (bu tarayıcıda kelime havuzu boştu); haftalık rapor sahte kayıtla denendi.
- Çeviri Atölyesi puanları Gemini’nin yargısıdır; örnek çeviriyle her zaman aynı fikirde olmayabilir.
- Dexie sürümü artırılmadı: `examAnswers.wrongReason` ve `mockResults.times` isteğe bağlı alanlar (eski kayıtlarla uyumlu, JSON yedeğe girer).

## Sonraki öneriler
1. Gerçek Gemini ile 4 yapay zekâ özelliğini dene (bütçe: hepsi önbellekli).
2. Özgün soru bankasını 600+’a çıkar (tip başına en az 60); özellikle çeviri ve cloze.
3. 7.9’un ikinci yarısı: sınav cümlesinden boşluk kartı (yalnızca yerelde).
4. 10.3: eski sayfalardaki React uyarılarını gözle test ederek temizle.
5. `scripts/grammarFreq.mjs` kalıpları: “Devrik Yapılar” 0 çıktı, kalıplar güçlendirilmeli.
