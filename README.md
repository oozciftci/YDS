# 🎯 YDS Kelime Çalışma & Akıllı Tekrar Platformu

YDS (Yabancı Dil Bilgisi Seviye Tespit Sınavı), YÖKDİL ve TIPDİL sınavlarına hazırlananlar için geliştirilmiş, **Spaced Repetition (FSRS / Aralıklı Tekrar)** algoritmasıyla güçlendirilmiş, **çevrimdışı (offline-first) çalışan Progressive Web App (PWA)** kelime öğrenme ve pratik platformu.

---

## 🚀 Öne Çıkan Özellikler

1. **📚 3.350+ YDS Kelime Havuzu & Seviye Grupları (Levels):**
   - Kelimeler seviyelere (`C1-C2 İleri Düzey Akademik`, `B1-B2 Orta Düzey`, `A1-A2 Temel`, `Phrasal Verbs`, `Bağlaçlar & Edatlar`) ayrılmıştır.
   - Her seviye **20'şer kelimelik alt seviyelere (Level 1, Level 2...)** bölünerek odaklanmış çalışma imkanı sunar.

2. **🧠 FSRS (Free Spaced Repetition Scheduler) Akıllı Tekrar Algoritması:**
   - Anki standardı FSRS algoritması (`ts-fsrs`), kelimenin hatırlanma zorluğuna ve yanıt süresine göre bir sonraki tekrar zamanını bilimsel unutma eğrisine göre optimize eder.

3. **🗂️ Simetrik Flaşkart & Çoklu Çalışma Modları:**
   - **Flaşkart Modu (Önerilen):** Ön yüzde İngilizce kelime, arka yüzde Türkçe tanım, eş anlamlılar ve örnek cümle. Kartı çevirirken sıfır kayma sağlayan simetrik tasarım.
   - **Çoktan Seçmeli Test Modu:** 4 seçenekli anlık YDS deneme pratiği.
   - **YDS Eş Anlamlı Eşleştirme:** Sınavda en çok sorulan eş anlamlıları interaktif eşleme.
   - **Cümle İçi Boşluk Doldurma (Cloze):** Cümle bağlamında doğru kelimeyi bulma.

4. **🏷️ Özel Çalışma Grupları & Sıralı Kelime Ekleme:**
   - Seviyelerden bağımsız olarak dilediğiniz kelimeleri kendi açtığınız özel destelere ekleyebilirsiniz.
   - Kelime eklerken **gruptaki sıra numarasını** belirleyebilirsiniz (örn: 4. sıraya yerleştirip sonrakileri kaydırma veya boş bırakıp en sona atma).
   - Kartın ön yüzünde son işlem yapılan 2 grup hızlı erişim butonu olarak yer alır (`⚡ [Grup Adı]`).

5. **🕒 Kesintisiz İlerleme & "Yarıda Bırakıldı" Takibi:**
   - Seviye tamamlanmadan çıkılırsa sistem tam olarak hangi soruda kalındığını hatırlar.
   - Ana sayfada ve çalışma listesinde seviye adı, numarası ve çalışma moduyla birlikte listelenir.

6. **👥 Çoklu Kullanıcı & Profil Yönetimi:**
   - Farklı kullanıcı profilleri (Özgür, İzafet vb.) ile bağımsız ilerleme takibi ve profiller arası kelime aktarımı.

7. **💾 Çevrimdışı (Offline-First) & JSON Veri Yedekleme:**
   - İnternet olmasa dahi Dexie.js (IndexedDB) üzerinde tam performansla çalışır.
   - Tüm ilerlemenizi, özel gruplarınızı ve çalışma loglarınızı tek tıkla JSON olarak dışa aktarabilir ve farklı cihazlara aktarabilirsiniz.

---

## 🛠️ Teknoloji Yığını

- **Çekirdek:** [React 19](https://react.dev/), [TypeScript 5](https://www.typescriptlang.org/), [Vite 8](https://vitejs.dev/)
- **Yerel Veritabanı:** [Dexie.js v4](https://dexie.org/) (IndexedDB Wrapper)
- **Aralıklı Tekrar Algoritması:** [ts-fsrs v5](https://github.com/open-spaced-repetition/ts-fsrs)
- **Stil & Tasarım:** Vanilla CSS / CSS Modules, CSS Değişkenleri, Inter fontu
- **PWA / Çevrimdışı:** [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) & Workbox Service Worker
- **State Yönetimi:** [Zustand v5](https://zustand-demo.pmnd.rs/)

---

## 💻 Hızlı Başlangıç

### Gereksinimler
- **Node.js:** v20.x veya daha güncel LTS sürümü
- **Git**
- **npm** (Node.js ile birlikte gelir)

### Kurulum Adımları
```bash
# 1. Projeyi klonlayın
git clone https://github.com/oozciftci/YDS.git
cd YDS

# 2. Bağımlılıkları yükleyin
npm install

# 3. Geliştirme sunucusunu başlatın
npm run dev
```

Sunucu başladığında tarayıcınızdan `http://localhost:5173` adresine giderek uygulamayı kullanmaya başlayabilirsiniz.

---

## 📦 Mevcut Komutlar (NPM Scripts)

| Komut | Açıklama |
| :--- | :--- |
| `npm run dev` | Geliştirme sunucusunu başlatır (`localhost:5173`). |
| `npm run build` | TypeScript tip denetimi yapar ve üretim (production) bundle'ını derler (`dist/`). |
| `npm run preview` | Derlenen üretim sürümünü yerel sunucuda önizler. |
| `npm run lint` | Oxlint ile hızlı statik kod analizi çalıştırır. |
| `npm run history` | IDE oturum geçmişini ve konuşma dökümlerini inceler/dışa aktarır. |

---

## 📖 Detaylı Kurulum ve Geliştirme Rehberi

Evdeki bilgisayarınızda veya yeni bir ortamda projeyi kurmak, verilerinizi taşımak ve geliştirmeye devam etmek için hazırlanan kapsamlı kılavuz:
👉 **[KURULUM_VE_GELISTIRME_REHBERI.md](./KURULUM_VE_GELISTIRME_REHBERI.md)**

---

## 📂 Proje Dizin Yapısı

```
YDS_Proje/
├── public/                 # Statik dosyalar, PWA ikonları ve manifest
├── scripts/                # Oturum geçmişi araçları (history.js)
├── session-history/        # Arşivlenmiş IDE oturum dökümleri
├── src/
│   ├── components/         # Ortak UI bileşenleri (Navbar, Layout, Modallar, Kartlar)
│   ├── data/               # 3.350+ hazır kelime listeleri ve kelime paketleri
│   ├── db/                 # Dexie.js veritabanı şeması ve migration'lar
│   ├── pages/              # Sayfalar (Home, Study, Words, Stats, Settings)
│   ├── services/           # Servis katmanı (FSRS, gruplar, seviyeler, yedekleme)
│   ├── store/              # Zustand global state (kullanıcı profilleri, ayarlar)
│   ├── types/              # TypeScript veri tipleri ve arayüzler
│   ├── App.tsx             # Ana uygulama yönlendirmesi (Routing)
│   └── main.tsx            # Uygulama giriş noktası
├── KURULUM_VE_GELISTIRME_REHBERI.md # Adım adım kurulum ve geliştirme rehberi
├── PROJECT_MEMORY.md       # Kalıcı mimari hafıza ve kararlar
└── package.json            # Proje bağımlılıkları ve scriptler
```
