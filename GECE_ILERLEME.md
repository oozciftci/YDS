# Gece İlerleme Günlüğü

Başlangıç: 19.10.2026 22:35. Hedef bitiş: 20.10.2026 06:05.

## Yapılanlar
- 7.1 Hedef puan planlayıcı (src/services/targetPlan.ts, TargetPlanner.tsx, Home ipucu)
- 7.2 Deneme zaman analizi (mockTime.ts, MockExam süre kaydı + TimeTable)
- 7.3 Yanlış nedeni etiketi (wrongReasons.ts, ReasonPicker, MistakeAnalysis kartı)
- 7.4 Özel deneme oluşturucu (CustomMock.tsx, /yds-sorular/ozel)
- 7.5 Denemeler arası tablo + sıklık önerisi (mockPlan.ts, MockHistory)
- 7.6 Gramer konusu sınav sıklığı (scripts/grammarFreq.mjs, public/data/grammar_freq.json, Grammar.tsx)
- Test verisi temizlendi (IndexedDB: TESTX/TESTM/sahte denemeler silindi)

## Şu an
8.1 Özgün soru bankası

## Sıradaki 3 iş
1. 8.1 Özgün soru bankası (public/data/ozgun)  2. Alıştırma Merkezi  3. 8.2 Gramer alıştırma 5→10

## Engeller / notlar

## Güncelleme (05:05)
- Blok 1–4 ve Blok 5’in çoğu tamam; ayrıntı `SABAH_RAPORU.md`.
- Kalan/isteğe bağlı: 7.9 ikinci yarı (sınav cümlesinden boşluk kartı), özgün soruları 600+’a çıkarmak, 10.3 eski React uyarıları, Devrik konusu kalıpları.
- Test: `npm test` (19), `npm run build && npm run check:dist` temiz.
- Bekleyenler (dokunulmadı): 6.7b, 6.3, File Search, 5.3, kasa kilitleme + push (kullanıcı).
