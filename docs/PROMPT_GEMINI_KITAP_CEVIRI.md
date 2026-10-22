# Gemini (Antigravity) için istemler — kalan kitap çevirisi

İki istem var: **1. iş istemi** (Antigravity'ye ilk mesaj), **2. rapor istemi** (iş bitince gönderilir).

---

## 1. İş istemi

```
Proje: C:\Projeler\YDS_Proje (React + Vite, Türkçe arayüzlü YDS çalışma uygulaması). Benimle Türkçe konuş.

GÖREV: Yerel okuma kitabı "mf-sherlock-4000"ün (The Adventures of Sherlock Holmes, B2/C1, 12 öykü) TÜM cümlelerini
Türkçeye çevirip projenin çeviri haritasına eklemek. Toplam ~6.090 tekil cümle; 3 tanesi çevrili. Diğer 6 kitap bitti,
onlara dokunma.

ÇEVİRİYİ SEN YAPACAKSIN:
- Hiçbir çeviri API'si, web servisi, Google Translate, betik içinden model çağrısı vb. KULLANMA. Cümleleri kendin oku ve
  Türkçesini kendin yaz.
- Doğal, akıcı, edebî ama anlaşılır Türkçe. Kullanıcı YDS'ye hazırlanıyor; çeviri İngilizce cümleyi anlamasına yardım
  etmeli: anlamı eksiksiz ver, cümle atlama, özetleme.
- Özel adlar korunur (Holmes, Watson, Baker Street, Irene Adler...). "Mr./Mrs./Miss" → "Bay/Bayan". Para birimleri:
  pound → sterlin, guinea → gine, shilling → şilin.
- Her cümle tek başına çevrilir ama hikâyenin akışına uygun olmalı (konuşmalarda "dedi Holmes" düzeni, tırnaklar korunur).
- Bir cümle yarım/bozuksa (kaynaktaki bölünme) yine de anlamlı karşılığını yaz; boş bırakma.

KULLANACAĞIN ARAÇ (tek betik, değiştirme): scripts/okuma/ceviri_eksik.mjs
- Durum:            node scripts/okuma/ceviri_eksik.mjs --durum
- Sıradaki parti:   node scripts/okuma/ceviri_eksik.mjs mf-sherlock-4000 --adet 150
  → Çıktı: "1<TAB>English sentence" satırları. Bu partiyi betik
    local-data/okuma/ceviri/_parti/mf-sherlock-4000.json dosyasına kaydeder; numaralar bu partiye aittir.
- Çevirini bir metin dosyasına yaz:
    local-data/okuma/ceviri/_parti/mf-sherlock-4000.tr.txt
  Her satır: "<numara> | <Türkçe>"   (ör. "12 | Holmes başını salladı.")
  Bir cümle = bir satır; satır içinde satır sonu olmasın. Numaralar partideki numaralarla birebir aynı olmalı.
- Ekle:             node scripts/okuma/ceviri_eksik.mjs mf-sherlock-4000 --ekle local-data/okuma/ceviri/_parti/mf-sherlock-4000.tr.txt
  → "N eklendi, X/6093 çevirili" yazar. "! atlandı" görürsen o satırı düzelt ve tekrar ekle.
- ÖNEMLİ: --ekle'yi, numaraları aldığın partiden SONRA ve yeni bir "--adet" çağırmadan ÖNCE çalıştır (yeni --adet
  parti dosyasını ve numaraları değiştirir).
- Döngü: --adet 150 → çevir → .tr.txt yaz → --ekle → tekrar. Bitene kadar (--durum'da "mf-sherlock-4000: 6093/6093 ✓").

Çeviriler nereye gidiyor: local-data/okuma/ceviri/mf-sherlock-4000.json  ({ "<İngilizce cümle>": "<Türkçe>" }).
Bu dosyayı ELLE düzenleme; yalnızca betikle ekle. local-data/okuma/kitaplar/*.json dosyalarını da elle düzenleme.

BİTİNCE:
1. node scripts/okuma/kitap_yap.mjs   → "mf-sherlock-4000: ... cümle (çevirili N)" satırında N, cümle sayısına eşit olmalı.
2. node scripts/okuma/ceviri_eksik.mjs --durum  → 7 kitabın hepsi ✓.
3. Kalite denetimi: haritadan rastgele 30 çeviriyi İngilizcesiyle karşılaştır; İngilizce bırakılmış ya da boş/çok kısa
   çeviri varsa bul ve düzelt. Basit bir kontrol: Türkçe değeri İngilizceyle aynı olan ya da hiç Türkçe karakter
   (çğıöşü) içermeyen uzun cümleleri listele ve gözden geçir (bunun için geçici bir node komutu yazabilirsin; projeye
   dosya ekleme).
4. local-data/okuma/ceviri/_parti/ içindeki geçici .tr.txt dosyasını silebilirsin.

KURALLAR:
- local-data/ git'e girmez (gitignore'da); bu dosyaları commit etme. Kod dosyalarını değiştirme, git commit/push yapma.
- Uzun iş: oturum kesilirse --durum ile kaldığın yeri bul ve devam et (harita her --ekle'de kaydedilir).
- Tüm mesajların Türkçe olsun.
```

---

## 2. Rapor istemi (iş bitince Antigravity'ye gönder)

```
Çeviri işini bitirdiysen bana Türkçe, kısa bir rapor ver. Bu rapor Claude'a (projedeki diğer yapay zekâ) iletilecek;
o yüzden kesin ve doğrulanabilir olsun:

1. Son durum: `node scripts/okuma/ceviri_eksik.mjs --durum` çıktısının tamamı (çalıştırıp yapıştır).
2. `node scripts/okuma/kitap_yap.mjs` çıktısının mf-sherlock-4000 satırı.
3. Hangi dosyaları oluşturdun/değiştirdin/sildin (tam yollarıyla). Kod dosyası değiştirdiysen hangisi ve neden.
4. Kaç partide bitirdin; "! atlandı" ya da hata aldıysan ne yaptın.
5. Kalite denetimi: kaç çeviri inceledin, bulduğun ve düzelttiğin sorunlar; İngilizce kalmış/boş çeviri kaldı mı.
6. Emin olmadığın ya da kaynağı bozuk olduğu için zorlandığın cümleler (varsa birkaç örnek, İngilizcesi + Türkçesi).
7. Yapmadığın ya da yarım kalan bir şey var mı?
Kod çalıştırmadan tahminle yazma; her sayıyı komut çıktısından al.
```

---

## Claude'a dönünce

Raporu Claude'a yapıştır. Claude: `--durum` ile doğrular, `kitap_yap.mjs`'i çalıştırır, örnek çevirileri denetler,
YOL_HARITASI ve GELISTIRME_NOTLARI'nı günceller; telefona Ayarlar › Kaynak paketi › “Okuma kitapları” yeniden indirilir.
