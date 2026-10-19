# Gece İlerleme Günlüğü

Başlangıç: 19.10.2026 22:35. Hedef bitiş: 20.10.2026 06:05.

## Yapılanlar
- 7.1 Hedef puan planlayıcı (src/services/targetPlan.ts, TargetPlanner.tsx, Home ipucu)
- 7.2 Deneme zaman analizi (mockTime.ts, MockExam süre kaydı + TimeTable)
- 7.3 Yanlış nedeni etiketi (wrongReasons.ts, ReasonPicker, MistakeAnalysis kartı)
- 7.4 Özel deneme oluşturucu (CustomMock.tsx, /yds-sorular/ozel)
- 7.5 Denemeler arası tablo + sıklık önerisi (mockPlan.ts, MockHistory)

## Şu an
7.6 Gramer konusu sınav sıklığı

## Sıradaki 3 iş
1. 7.6 Gramer konusu sıklığı  2. 8.1 Özgün soru bankası  3. Test verisi temizliği (Blok 1 sonu)

## Engeller / notlar
- Tarayıcı testi için IndexedDB’ye `TESTX_*` kimlikli sahte cevaplar eklendi (user_ozgur). Ayrıca 7.2 testinden bir sahte `mockResults` kaydı (yds-2013-ilkbahar, bugün) var. Ayrıca yds-2013-ilkbahar S1 için sahte yanlış cevap (id user_ozgur_yds-2013-ilkbahar_1). Ayrıca TESTM_1, TESTM_2 sahte mockResults. Blok 1 sonunda hepsi (TESTX_*, TESTM_*, bugünkü test denemeleri, S1 sahte cevabı) silinecek.
