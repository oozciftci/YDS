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

## Güncelleme
- 8.1 tamam (kısmen): 310 özgün soru, 49 set, Alıştırma Merkezi çalışıyor (`/yds-test`). Kalan: paragraf tamamlamayı 20’ye çıkarmak, 14 uyarılı soruda çeldirici uzatmak.
- 8.2 tamam: gramer alıştırmaları 10’a çıktı (grammarExtra.ts)
- 8.3 tamam: 6 okuma metni
- 8.4 tamam: YÖKDİL alan terimleri (168 terim)
- 10.1 tamam: scripts/checkDist.mjs (`npm run check:dist`)
- 10.2 tamam: vitest, 15 test
- Faz 9 tamam (9.1 etiket, 9.2 kelime-soru eşleme, 9.3 doğrulama notları) — local-data değişti: kasa kilitleme gerek
- Şu an: 10.3 uyarı temizliği; sonra Blok 5 (7.7–7.10)
- Sıradaki: 8.3 okuma metinleri, 8.4 YÖKDİL terimleri, 8.5 çeviri cümleleri, Faz 9, Faz 10.
