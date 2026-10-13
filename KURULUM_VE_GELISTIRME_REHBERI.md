# 🏠 YDS Projesi: Ev Bilgisayarı Kurulum ve Geliştirme Rehberi

Bu rehber, iş veya diğer bilgisayarınızdaki YDS Kelime Çalışma Projesini evdeki bilgisayarınıza sıfırdan kurmanız, mevcut çalışma verilerinizi (öğrenilen kelimeler, seviye ilerlemeleri, özel gruplar) kayıpsız aktarmanız ve geliştirmeye kaldığınız yerden sorunsuz devam etmeniz için adım adım hazırlanmıştır.

---

## 📋 İÇİNDEKİLER
1. [Ön Hazırlık (Ev Bilgisayarı Gereksinimleri)](#1-ön-hazırlık)
2. [Sıfırdan Kurulum Adımları (Git & NPM)](#2-sıfırdan-kurulum-adımları)
3. [Çok Önemli: Mevcut Çalışma Verilerini Ev Bilgisayarına Aktarma](#3-mevcut-verileri-aktarma)
4. [Proje Mimarisi ve Kod Haritası (Nerede Ne Var?)](#4-proje-mimarisi-ve-kod-haritası)
5. [Geliştirmeye Kaldığı Yerden Devam Etme](#5-geliştirmeye-devam-etme)
6. [Sık Karşılaşılan Sorunlar ve Çözümleri](#6-sık-karşılaşılan-sorunlar)

---

## 1. Ön Hazırlık

Evdeki bilgisayarınızda aşağıdaki temel araçların kurulu olduğundan emin olun:

1. **Node.js (LTS Sürümü - v20 veya v22 önerilir):**
   * Kurulu olup olmadığını kontrol etmek için terminalde çalıştırın:
     ```bash
     node -v
     npm -v
     ```
   * Eğer kurulu değilse [nodejs.org](https://nodejs.org/) adresinden LTS sürümünü indirip kurun.

2. **Git:**
   * Kontrol:
     ```bash
     git --version
     ```
   * Kurulu değilse [git-scm.com](https://git-scm.com/) adresinden kurun.

3. **Kod Editörü:**
   * **Antigravity IDE** veya **VS Code** (TypeScript ve React eklentileriyle).

---

## 2. Sıfırdan Kurulum Adımları

Evdeki bilgisayarınızda terminali (PowerShell veya CMD) açın ve projeyi kurmak istediğiniz dizine gidin (örneğin `C:\Projeler`):

```bash
# 1. Proje klasörüne geçin
cd C:\Projeler

# 2. GitHub reposunu klonlayın
git clone https://github.com/oozciftci/YDS.git

# 3. Proje dizinine girin
cd YDS

# 4. Gerekli tüm kütüphaneleri yükleyin
npm install

# 5. Geliştirme sunucusunu başlatın
npm run dev
```

Terminalde şu çıktıyı göreceksiniz:
```
  VITE v8.3.4  ready in 180 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

Tarayıcınızı açıp `http://localhost:5173` adresine girin. Tebrikler, proje artık evinizdeki bilgisayarda çalışıyor! 🎉

---

## 3. Mevcut Verileri Aktarma (Çok Önemli!)

Bu uygulama **Offline-First** mimarisinde olup verilerini tarayıcının yerel veritabanında (**IndexedDB / Dexie.js**) saklar. Bu nedenle GitHub'dan kodu çektiğinizde kaynak kodlar gelir ancak çalışma geçmişiniz, özel oluşturduğunuz gruplar ve ezberlediğiniz kartların skorları yerel tarayıcınızda kalır.

Tüm geçmişinizi evdeki bilgisayarınıza aktarmak yalnızca **10 saniyenizi** alır:

### Adım 1: Şu Anki Bilgisayarınızdan Yedek Alın
1. Uygulamada üst menüden **Ayarlar** (`/settings`) sayfasına gidin.
2. Sayfayı aşağı kaydırın: **"Yerel Veritabanı ve Depolama Yönetimi"** bölümünü bulun.
3. **"💾 Veritabanı Yedeğini İndir (JSON)"** butonuna tıklayın.
4. Bilgisayarınıza `yds_kelime_yedek_YYYY-MM-DD.json` adında bir dosya inecektir.
5. Bu dosyayı kendinize e-posta atın, Google Drive'a yükleyin veya bir USB belleğe atın.

### Adım 2: Evdeki Bilgisayarda Yedeği Yükleyin
1. Evdeki bilgisayarınızda projeyi çalıştırın (`http://localhost:5173`).
2. **Ayarlar** (`/settings`) sayfasına gidin.
3. Yine aynı alandaki **"📁 Yedekten Geri Yükle"** butonuna tıklayın ve indirdiğiniz JSON dosyasını seçin.
4. Ekranda `✓ Yedek başarıyla geri yüklendi` mesajı çıkacaktır.
5. Artık hangi kelimeleri öğrendiğiniz, hangi seviyede kaldığınız ve özel kelime gruplarınız birebir evdeki bilgisayarınızda da aktif!

---

## 4. Proje Mimarisi ve Kod Haritası

Projeyi incelerken veya yeni bir özellik eklerken hangi dosyanın ne işe yaradığını bilmek işinizi çok kolaylaştıracaktır:

### 📁 Veritabanı ve Modeller (`src/db/` ve `src/types/`)
* **`src/db/index.ts`:** Dexie.js veritabanı konfigürasyonu. 8 temel tablo barındırır:
  * `words`: 3.350+ kelimenin tanımları, eş anlamlıları, örnek cümleleri.
  * `cardStates`: FSRS algoritmasının her kelime için hesapladığı tekrar tarihleri ve zorluk puanları.
  * `wordGroups`: Özel kullanıcı grupları (kelime kimlik listeleri ile birlikte).
  * `sessionLogs`: Yapılan çalışma oturumlarının tarih, soru sayısı ve başarı kayıtları.
  * `levelProgress`: Seviyelerin tamamlanma ve "yarıda bırakıldı" durumları.
  * `users`: Kullanıcı profilleri (Özgür, İzafet vb.).
* **`src/types/database.ts`:** Tüm TypeScript veri modelleri ve arayüzleri.

### 📁 Sayfalar (`src/pages/`)
* **`Home.tsx`:** Ana gösterge paneli. Günün/haftanın tekrarları, son çalışılanlar ve yarıda bırakılan seviyeler, hızlı pratik kartları.
* **`Study.tsx`:** Ana çalışma ekranı.
  * 20'şer kelimelik seviye seçim listesi.
  * Simetrik, ekran kaydırmayan flaşkart modülü (`faceContainer`).
  * Kelimeyi özel gruba ekleme (`➕ Gruba Ekle`), sıra numarası belirleme ve son 2 grup hızlı butonları (`⚡`).
  * 1-5 puanlama (Öğrendim / Öğrenmedim) ve klavye kısayolları (Boşluk, 1-5, Sağ-Sol Oklar).
* **`Words.tsx`:** 3.350 kelimelik kelime kütüphanesi. Arama, filtreleme, TTS sesli telaffuz, tekil veya toplu kelime ekleme/aktarma.
* **`Stats.tsx`:** Öğrenme kademeleri grafikleri, haftalık çalışma performansı ve unutma eğrisi analizleri.
* **`Settings.tsx`:** Profil yönetimi, JSON tam veritabanı yedekleme ve geri yükleme.

### 📁 Servis Katmanı (`src/services/`)
* **`groups.ts`:** Seviye bölme (`chunkIntoSubLevels`), seviye başlık biçimlendirme (`formatLevelStudyTitle`), özel gruba sıralı kelime ekleme (`addWordToGroupAtPosition`) ve son 2 grubu hatırlama mantığı.
* **`backup.ts`:** Tüm tabloları kapsayan tam veritabanı JSON export/import motoru.
* **`fsrs.ts`:** `ts-fsrs` kütüphanesini kullanarak aralıklı tekrar hesaplayan çekirdek algoritma.
* **`speech.ts`:** Web Speech API ile İngilizce telaffuz motoru.

---

## 5. Geliştirmeye Kaldığı Yerden Devam Etme

### Yapay Zeka Asistanı ile Çalışıyorsanız (Antigravity IDE / Claude / Cursor)
Proje kök dizininde kalıcı hafıza dosyaları yer almaktadır:
* **`PROJECT_MEMORY.md`:** Projenin başlangıcından bu yana yapılan tüm aşamalar, mimari kurallar ve kararlar burada özetlenmiştir. Yeni oturuma başlarken asistana *"PROJECT_MEMORY.md dosyasını incele ve kaldığımız yerden devam edelim"* demeniz yeterlidir.
* **`session-history/`:** Daha önceki oturumların detaylı konuşma dökümleri bu klasörde arşivlenmiştir.

### Yeni Özellik Eklerken Dikkat Edilecek İlkeler
1. **Offline-First:** Tüm yeni özellikler internet olmadan da çalışacak şekilde Dexie IndexedDB üzerinde çalışmalıdır.
2. **CSS Standartları:** Stil dosyalarında `src/index.css` içindeki CSS değişkenleri (`var(--primary)`, `var(--surface)`, `var(--border)` vb.) kullanılmalıdır. TailwindCSS kullanılmamaktadır.
3. **TypeScript Tipleri:** Yeni bir tablo veya veri alanı ekleneceğinde önce `src/types/database.ts` güncellenmeli ve `npm run build` ile doğrulanmalıdır.

---

## 6. Sık Karşılaşılan Sorunlar ve Çözümleri

### 1. Port 5173 Zaten Kullanımda Hatası
* **Sebep:** Arka planda açık kalmış başka bir Vite sunucusu.
* **Çözüm:** Vite otomatik olarak `5174` portuna geçer. İsterseniz görev yöneticisinden açık kalan `node` işlemini sonlandırabilirsiniz.

### 2. Node Bağımlılık Hataları (`node_modules`)
* **Çözüm:** Klasörü temizleyip tekrar yükleyin:
  ```bash
  rm -rf node_modules package-lock.json
  npm install
  ```

### 3. Tarayıcıda Eski Kodların Görünmesi (PWA Önbelleği)
* **Sebep:** Service Worker uygulamanın önceki sürümünü önbelleğe almış olabilir.
* **Çözüm:** Tarayıcıda `Ctrl + F5` (Hard Refresh) yapın veya Geliştirici Araçları (`F12`) > **Application** > **Service Workers** > **Update on reload** seçeneğini işaretleyin.

---

İyi çalışmalar ve YDS hazırlığında başarılar! 🚀
