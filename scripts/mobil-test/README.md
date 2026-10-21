# Telefon boyutunda uçtan uca denemeler (başsız Chrome + CDP)

Neden: Claude'un tarayıcı paneli gizliyken `requestAnimationFrame` çalışmaz; sayfa çevirme, odak modu gibi animasyonlu
akışlar orada denenemez. Bu betikler kurulu Chrome'u başsız açar, 390×844 mobil öykünmeyle gerçek dokunma olayları gönderir
(`Input.dispatchTouchEvent`) ve sonuçları yazdırır. Ayrıntı ve geçmiş sorunlar: `docs/GELISTIRME_NOTLARI.md` §5–6.

## Hazırlık

1. Ayrı bir geliştirme sunucusu (port 5176) aç: `.claude/launch.json`'a geçici olarak
   `{ "name": "gorunum-test", "runtimeExecutable": "npx", "runtimeArgs": ["vite", "--port", "5176", "--strictPort"], "port": 5176 }`
   ekle ve `preview_start gorunum-test` (bitince durdur, girdiyi kaldır). Kullanıcının 5173'teki sunucusuna dokunma.
2. Her betik ilk argüman olarak bir çıktı klasörü alır (başsız Chrome profili `prof-*` ve ekran görüntüleri oraya yazılır;
   test sonunda sil). Örnek (Git Bash):
   `MSYS_NO_PATHCONV=1 node scripts/mobil-test/stuckTest.mjs "<scratchpad>" ETIKET`
3. Betikler başsız profile birkaç deneme kelimesi ekler (kullanıcının verisi etkilenmez; profil ayrı).
   Kalan Chrome süreçleri: PowerShell'de komut satırında `prof-` geçen `chrome.exe`'leri kapat (kullanıcının Chrome'una dokunma).

## Betikler

| Dosya | Ne dener |
| :--- | :--- |
| `stuckTest.mjs` | **Kaydırmayı şık/kelime üstünden başlatır** (iPhone'daki takılı kopya hatasını üreten durum); sınav + kelime kartı, takılı kopya sayısı (`[data-page-turn]`) 0 olmalı |
| `rapidTest.mjs` | Kitap (hızlı dokunma/kaydırma), sınav (odak; hızlı ileri-geri, ok tuşu yağmuru), kelime kartı — donma ve artık kopya |
| `hangTest.mjs` | Sınavda aralıksız ileri-geri; 2. argüman `1`/`0` = odak açık/kapalı; sayfa geçmişi (tarayıcı "geri git") kaydı |
| `focusTest.mjs` | Odak modunda yalnızca ana alan, sayfa kilidi (scrollY 0), çevirme/vazgeçme/geri, sınav, kitapta genel odak |
| `cornerTest.mjs` | Odak düğmesi ve çıkışın sağ üstte aynı yerde olması, odakta kelime balonu, kitap çıkışı, sürüm etiketi |
| `flipTest.mjs` | Kitap: yarım sayfada dikey kayma, katlanma ara kareleri (ekran görüntüsü), geri çevirme |
| `penTest.mjs` | Kitap: aynalı geri çevirme, kalemle tek parmak çizgi / iki parmak (çizgi çizilmemeli), çizim silmenin kalıcılığı |
| `prodTest.mjs` | Yayın derlemesi (`vite preview` 4173, `/YDS/`): `.ydsk` paketini yükle, kitap/sınav/Strateji 3, çevrimdışı. 2. argüman paket dosyası |

## Dikkat

- Chrome dokunma hedefi davranışı iOS Safari'den farklıdır; dokunmayı içerik öğesinin (şık, kelime) üstünden başlatan test yaz.
- Mobil öykünmede yatay taşma `innerWidth`'i büyütür (ör. 375 yerine 483): taşma belirtisi budur.
- Sınav sayfası kimliği `yds-2018-aralik`, kitap `essential-grammar-in-use` yerel veride olmalı (`local-data/`).
