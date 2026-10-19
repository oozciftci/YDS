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

## Güncelleme (limit doldu)
- 8.1 altyapısı hazır: `src/data/ozgunTypes.ts`, `src/pages/exam/ozgunData.ts`, Alıştırma Merkezi (`src/pages/YdsTest.tsx`, yol `/yds-test`, `/yds-test/:setId`).
- **Henüz soru yok:** `public/data/ozgun/<tip>.json` dosyaları (vocab, grammar, cloze, completion, translation, reading, dialogue, paraphrase, paragraph, irrelevant) yazılacak. Biçim `ozgunTypes.ts` içinde. Sonra `scripts/qcOzgun.mjs` kalite kontrol betiği.
- Sıradaki: önce vocab.json (8 set × 6 soru), grammar (5×10), cloze (4×10), completion (5×10), translation (7×6)…
- Home kartı/appMap etiketi “Alıştırma Merkezi” olarak güncellenecek.
