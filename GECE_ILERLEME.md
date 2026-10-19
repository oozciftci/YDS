# Gece İlerleme Günlüğü

Başlangıç: 19.10.2026 22:35. Hedef bitiş: 20.10.2026 06:05.

## Yapılanlar
- 7.1 Hedef puan planlayıcı (src/services/targetPlan.ts, TargetPlanner.tsx, Home ipucu)
- 7.2 Deneme zaman analizi (mockTime.ts, MockExam süre kaydı + TimeTable)
- 7.3 Yanlış nedeni etiketi (wrongReasons.ts, ReasonPicker, MistakeAnalysis kartı)
- 7.4 Özel deneme oluşturucu (CustomMock.tsx, /yds-sorular/ozel)

## Şu an
7.5 Denemeler arası tablo

## Sıradaki 3 iş
1. 7.5 Denemeler arası tablo  2. 7.6 Gramer konusu sıklığı  3. 8.1 Özgün soru bankası

## Engeller / notlar
- Tarayıcı testi için IndexedDB’ye `TESTX_*` kimlikli sahte cevaplar eklendi (user_ozgur). Ayrıca 7.2 testinden bir sahte `mockResults` kaydı (yds-2013-ilkbahar, bugün) var. Ayrıca yds-2013-ilkbahar S1 için sahte yanlış cevap (id user_ozgur_yds-2013-ilkbahar_1). Blok 1 sonunda hepsi silinecek.
