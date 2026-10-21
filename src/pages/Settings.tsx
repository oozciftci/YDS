import { useEffect, useState, useRef, type FormEvent, type ChangeEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { exportDatabaseToJson, importDatabaseFromJson } from '../services/backup'
import { testBackendConnection, type ConnectionTestResult } from '../services/backend'
import { logger } from '../services/logger'
import { notificationsSupported, requestReminderPermission, showReminder } from '../services/reminder'
import { AI_MODELS, getAiUsage, resetPaidBlock, testKey } from '../services/ai'
import { formatBytes, useStorageInfo } from '../services/storage'
import { useSyncStatus } from '../services/sync'
import { isValidHttpUrl, normalizeUrl, useSettings, type FreqSource } from '../stores/settings'
import { useTheme, type ThemeChoice } from '../stores/theme'
import { useUserStore } from '../stores/user'
import { useSwStatus } from '../pwa/registerSW'
import styles from './Settings.module.css'

const SW_LABELS: Record<string, string> = {
  unsupported: 'Desteklenmiyor',
  registering: 'Kaydediliyor…',
  'offline-ready': 'Çevrimdışı kullanıma hazır',
  'update-pending': 'Güncelleme bekliyor (otomatik uygulanacak)',
  active: 'Aktif',
  error: 'Hata',
}

const THEME_OPTIONS: { value: ThemeChoice; label: string }[] = [
  { value: 'system', label: '📱 Sistem' },
  { value: 'light', label: '☀️ Açık' },
  { value: 'dark', label: '🌙 Koyu' },
]

export function SettingsPage() {
  const theme = useTheme((s) => s.theme)
  const setTheme = useTheme((s) => s.setTheme)
  const backend = useSettings((s) => s.backend)
  const setBackend = useSettings((s) => s.setBackend)
  const resetBackend = useSettings((s) => s.resetBackend)
  const online = useOnlineStatus()
  const sw = useSwStatus()
  const storage = useStorageInfo()
  const sync = useSyncStatus()
  const { activeUser, allUsers, setActiveUser, addUser } = useUserStore()

  const [url, setUrl] = useState(backend.url)
  const [anonKey, setAnonKey] = useState(backend.anonKey)
  const [showKey, setShowKey] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState<ConnectionTestResult | null>(null)

  const exam = useSettings((s) => s.exam)
  const setExam = useSettings((s) => s.setExam)
  const [examName, setExamName] = useState(exam?.targetExamName || 'YDS 2026')
  const [examDate, setExamDate] = useState(exam?.targetExamDate || '2026-11-22')
  const [examScore, setExamScore] = useState(exam?.targetScore || 80)
  const [examDailyGoal, setExamDailyGoal] = useState(exam?.dailyGoal || 20)
  const [freqSource, setFreqSource] = useState<FreqSource>(exam?.freqSource ?? 'yds')
  const [examSaved, setExamSaved] = useState(false)

  function onSaveExam(e: FormEvent) {
    e.preventDefault()
    setExam({
      targetExamName: examName.trim(),
      targetExamDate: examDate,
      targetScore: Number(examScore),
      dailyGoal: Number(examDailyGoal),
      freqSource,
    })
    setExamSaved(true)
    setTimeout(() => setExamSaved(false), 2000)
  }

  // Yeni kullanıcı ekleme state'i
  const [newUserName, setNewUserName] = useState('')

  // Yedekleme bildirimleri
  const [backupMsg, setBackupMsg] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Veritabanı canlı sayaçları
  const wordCount = useLiveQuery(() => db.words.count(), [], 0)
  const cardCount = useLiveQuery(() => db.cardStates.count(), [], 0)
  const logCount = useLiveQuery(() => db.logs.count(), [], 0)
  const unsyncedLogCount = useLiveQuery(() => db.logs.where('synced').equals(0).count(), [], 0)

  const refreshStorage = storage.refresh
  useEffect(() => {
    void refreshStorage()
  }, [refreshStorage])

  const urlValid = url.trim() === '' || isValidHttpUrl(url)
  const dirty = normalizeUrl(url) !== backend.url || anonKey.trim() !== backend.anonKey

  function onSave(e: FormEvent) {
    e.preventDefault()
    if (!urlValid) return
    setBackend({ url: normalizeUrl(url), anonKey: anonKey.trim() })
    setSaved(true)
    setResult(null)
    logger.interaction('ui', 'Kullanıcı sunucu ayarlarını güncelledi.')
    setTimeout(() => setSaved(false), 2500)
  }

  async function onTest() {
    setTesting(true)
    setResult(null)
    const res = await testBackendConnection({ url, anonKey: anonKey.trim() })
    setResult(res)
    setTesting(false)
    if (res.ok) {
      logger.info('sync', 'Sunucu bağlantı testi başarılı.', { latencyMs: res.latencyMs })
    } else {
      logger.warn('sync', `Sunucu bağlantı testi başarısız: ${res.message}`)
    }
  }

  function onReset() {
    resetBackend()
    setUrl('')
    setAnonKey('')
    setResult(null)
    logger.interaction('ui', 'Kullanıcı sunucu ayarlarını sıfırladı.')
  }

  async function handleAddUser(e: FormEvent) {
    e.preventDefault()
    if (!newUserName.trim()) return
    await addUser(newUserName.trim())
    logger.interaction('ui', `Yeni profil eklendi: ${newUserName.trim()}`)
    setNewUserName('')
  }

  async function handleExportBackup() {
    try {
      await exportDatabaseToJson()
      setBackupMsg('✓ Veritabanı yedeği JSON dosyası olarak indirildi.')
      setTimeout(() => setBackupMsg(null), 3000)
    } catch {
      setBackupMsg('Yedek indirilirken bir sorun oluştu.')
    }
  }

  async function handleImportBackup(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const res = await importDatabaseFromJson(file)
      setBackupMsg(`✓ Yedek başarıyla geri yüklendi (${res.wordsImported} kelime).`)
      setTimeout(() => setBackupMsg(null), 3500)
    } catch (err) {
      setBackupMsg(`Geri yükleme hatası: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function generateTestLog(type: 'error' | 'warn' | 'info' | 'interaction') {
    if (type === 'error') {
      logger.error('system', 'Bu bir deneme HATA logudur.', { code: 500, time: Date.now() })
    } else if (type === 'warn') {
      logger.warn('sync', 'Bu bir deneme UYARI logudur: Çevrimdışı işlem algılandı.')
    } else if (type === 'info') {
      logger.info('study', 'Bu bir deneme BİLGİ logudur: Çalışma oturumu simüle edildi.')
    } else {
      logger.interaction('study', 'Bu bir deneme ETKİLEŞİM logudur: Kullanıcı "Bilemedim" seçeneğine bastı.')
    }
    void sync.refreshPendingCounts()
  }

  const usagePct =
    storage.usageBytes != null && storage.quotaBytes
      ? Math.min(100, (storage.usageBytes / storage.quotaBytes) * 100)
      : 0

  return (
    <section className={styles.page}>
      <header>
        <h1>Ayarlar</h1>
        <p className="muted">
          Senkronizasyon, kullanıcı profilleri ve yerel veritabanı yönetimi.
        </p>
      </header>

      {/* GÖRÜNÜM */}
      <section className="card">
        <h2 className={styles.cardTitle}>Görünüm</h2>
        <p className="muted">"Sistem" seçiliyse telefonun açık/koyu ayarı izlenir.</p>
        <div className={styles.actions}>
          {THEME_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              className={`btn ${theme === o.value ? 'btn-primary' : 'btn-secondary'}`}
              aria-pressed={theme === o.value}
              onClick={() => setTheme(o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
      </section>

      {/* 1. KULLANICI PROFİLLERİ */}
      <section className="card" id="users">
        <h2 className={styles.cardTitle}>Kullanıcı Profilleri</h2>
        <p className="muted">
          Her kullanıcının kelime havuzu ve tekrar geçmişi ayrı tutulur. Farklı cihazlardan da girseniz profiliniz eşitlenir.
        </p>

        <div className={styles.userList}>
          {allUsers.map((u) => {
            const isActive = u.id === activeUser?.id
            return (
              <div
                key={u.id}
                className={`${styles.userCard} ${isActive ? styles.userCardActive : ''}`}
              >
                <div className={styles.userInfo}>
                  <span
                    className={styles.userColorDot}
                    style={{ backgroundColor: u.avatarColor || '#7c5cff' }}
                  />
                  <span>{u.displayName}</span>
                </div>
                {!isActive ? (
                  <button
                    type="button"
                    className={`btn ${styles.btnSm}`}
                    onClick={() => void setActiveUser(u.id)}
                  >
                    Geçiş Yap
                  </button>
                ) : (
                  <span className={styles.ok}>Aktif ✓</span>
                )}
              </div>
            )
          })}
        </div>

        <form onSubmit={handleAddUser} className={styles.addUserRow}>
          <input
            className="input"
            type="text"
            placeholder="Yeni isim (örn: Kardeşim)"
            value={newUserName}
            onChange={(e) => setNewUserName(e.target.value)}
          />
          <button type="submit" className="btn btn-primary" disabled={!newUserName.trim()}>
            Ekle
          </button>
        </form>
      </section>

      {/* 2. HEDEF SINAV VE GÜNLÜK ÇALIŞMA HEDEFİ */}
      <section id="exam" className="card">
        <h2 className={styles.cardTitle}>Hedef Sınav ve Çalışma Kotası</h2>
        <p className="muted" style={{ margin: '0 0 1rem' }}>
          Sınav geri sayımını ve günlük kelime tekrar kotanızı buradan belirleyebilirsiniz.
        </p>

        <form onSubmit={onSaveExam} style={{ display: 'grid', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="field">
              <label htmlFor="exam-name">Hedef Sınav Adı</label>
              <input
                id="exam-name"
                className="input"
                type="text"
                placeholder="Örn: YDS 2026, YÖKDİL Sağlık"
                value={examName}
                onChange={(e) => setExamName(e.target.value)}
              />
            </div>

            <div className="field">
              <label htmlFor="exam-date">Sınav Tarihi</label>
              <input
                id="exam-date"
                className="input"
                type="date"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="field">
              <label htmlFor="exam-score">Hedef Sınav Puanı (0 - 100)</label>
              <input
                id="exam-score"
                className="input"
                type="number"
                min={50}
                max={100}
                value={examScore}
                onChange={(e) => setExamScore(Number(e.target.value))}
              />
            </div>

            <div className="field">
              <label htmlFor="exam-daily-goal">Günlük Yeni Kelime Üst Sınırı</label>
              <input
                id="exam-daily-goal"
                className="input"
                type="number"
                min={5}
                max={100}
                value={examDailyGoal}
                onChange={(e) => setExamDailyGoal(Number(e.target.value))}
              />
              <small className="muted">
                Günlük plan, kalan yeni kelimeleri sınava kadar eşit dağıtır ama bu sayıyı aşmaz. Tekrarlar sınırsızdır.
              </small>
            </div>
          </div>

          <div className="field">
            <label htmlFor="exam-freq">Yeni kelimeler hangi sınavın sıklığına göre sıralansın?</label>
            <select id="exam-freq" className="input" value={freqSource} onChange={(e) => setFreqSource(e.target.value as FreqSource)}>
              <option value="yds">YDS (çıkmış YDS sorularında sık geçenler önce)</option>
              <option value="yokdil">YÖKDİL (çıkmış YÖKDİL sorularında sık geçenler önce)</option>
              <option value="both">İkisi birlikte (hangisinde çok geçiyorsa önce)</option>
            </select>
            <small className="muted">Kelimelerde YDS-Sık ve YÖKDİL-Sık etiketleri ayrı tutulur; filtrelemek için etiket olarak da kullanabilirsin.</small>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button type="submit" className="btn btn-primary">
              Sınav Hedefini Kaydet
            </button>
            {examSaved && (
              <span style={{ color: 'var(--success)', fontWeight: 600, fontSize: '0.85rem' }}>
                ✓ Hedef ayarları kaydedildi!
              </span>
            )}
          </div>
        </form>
      </section>

      <ReminderCard />

      <AiCard />

      {import.meta.env.DEV && <PhoneCard />}

      {/* 3. SENKRONİZASYON VE SUNUCU AYARLARI */}
      <form className="card" onSubmit={onSave} noValidate>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className={styles.cardTitle}>Sunucu (Supabase Senkronizasyonu)</h2>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void sync.syncNow()}
            disabled={sync.status === 'syncing' || !online || !backend.url}
          >
            {sync.status === 'syncing' ? 'Eşitleniyor…' : 'Şimdi Senkronize Et'}
          </button>
        </div>

        <div className="field">
          <label htmlFor="backend-url">Sunucu adresi (Supabase URL)</label>
          <input
            id="backend-url"
            className="input"
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder="https://xxxx.supabase.co"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            aria-invalid={!urlValid}
          />
          {!urlValid && <span className={styles.error}>Geçerli bir http(s) adresi girin.</span>}
        </div>

        <div className="field">
          <label htmlFor="backend-key">Genel anahtar (anon / public key)</label>
          <div className={styles.inputRow}>
            <input
              id="backend-key"
              className="input"
              type={showKey ? 'text' : 'password'}
              autoComplete="off"
              spellCheck={false}
              placeholder="eyJhbGciOi…"
              value={anonKey}
              onChange={(e) => setAnonKey(e.target.value)}
            />
            <button
              id="toggle-key-visibility"
              type="button"
              className="btn btn-ghost"
              onClick={() => setShowKey((v) => !v)}
              aria-pressed={showKey}
            >
              {showKey ? 'Gizle' : 'Göster'}
            </button>
          </div>
          <span className="hint">
            Yalnızca “anon” anahtarı girin. “service_role” anahtarını asla buraya yazmayın.
          </span>
        </div>

        <div className={styles.actions}>
          <button
            id="save-backend"
            type="submit"
            className="btn btn-primary"
            disabled={!urlValid || !dirty}
          >
            Kaydet
          </button>
          <button
            id="test-backend"
            type="button"
            className="btn"
            onClick={onTest}
            disabled={testing || !online || !url || !anonKey || !urlValid}
            title={!online ? 'Çevrimdışıyken test yapılamaz' : undefined}
          >
            {testing ? 'Test ediliyor…' : 'Bağlantıyı test et'}
          </button>
          <button id="reset-backend" type="button" className="btn btn-ghost" onClick={onReset}>
            Temizle
          </button>
        </div>

        <div role="status" aria-live="polite" className={styles.statusArea}>
          {saved && <p className={styles.ok}>✓ Ayarlar kaydedildi.</p>}
          {result && <p className={result.ok ? styles.ok : styles.error}>{result.message}</p>}
          {sync.lastError && <p className={styles.error}>Senkronizasyon: {sync.lastError}</p>}
        </div>
      </form>

      {/* 3. VERİTABANI VE LOGLAMA SİSTEMİ */}
      <section className="card">
        <h2 className={styles.cardTitle}>Veritabanı & Loglama Sistemi (Offline-First)</h2>
        <p className="muted">
          Kelimeler, FSRS kartları ve sistem/etkileşim logları doğrudan IndexedDB'de tutulur.
          İnternet geldiğinde otomatik olarak buluta aktarılır.
        </p>

        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statVal}>{wordCount}</div>
            <div className={styles.statLbl}>Kayıtlı Kelime</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statVal}>{cardCount}</div>
            <div className={styles.statLbl}>Tekrar Kartı</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statVal}>{logCount}</div>
            <div className={styles.statLbl}>Toplam Log</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statVal}>{unsyncedLogCount}</div>
            <div className={styles.statLbl}>Bekleyen Log</div>
          </div>
        </div>

        <div>
          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Loglama Testi: </span>
          <span className="muted" style={{ fontSize: '0.8rem' }}>
            Aşağıdaki butonlara basarak çevrimdışı log kaydını test edebilirsiniz:
          </span>
          <div className={styles.testLogsRow}>
            <button
              type="button"
              className={`btn ${styles.btnSm}`}
              onClick={() => generateTestLog('info')}
            >
              + Bilgi Logu
            </button>
            <button
              type="button"
              className={`btn ${styles.btnSm}`}
              onClick={() => generateTestLog('interaction')}
            >
              + Etkileşim Logu
            </button>
            <button
              type="button"
              className={`btn ${styles.btnSm}`}
              onClick={() => generateTestLog('warn')}
            >
              + Uyarı Logu
            </button>
            <button
              type="button"
              className={`btn ${styles.btnSm}`}
              onClick={() => generateTestLog('error')}
            >
              + Hata Logu
            </button>
            <button
              type="button"
              className={`btn ${styles.btnSm} btn-ghost`}
              onClick={() => void logger.pruneSyncedLogsIfStorageExceeded()}
            >
              200 MB Temizliği Kontrolü
            </button>
          </div>
        </div>
      </section>

      {/* 4. VERİ YEDEKLEME VE GERİ YÜKLEME */}
      <section className="card">
        <h2 className={styles.cardTitle}>Veri Yedekleme (JSON)</h2>
        <p className="muted">
          İnternet veya sunucu olmadan da tüm kelimelerinizi, kartlarınızı ve loglarınızı tek tıkla dosya olarak indirebilir ve dilediğiniz zaman geri yükleyebilirsiniz.
        </p>

        <div className={styles.backupRow}>
          <button type="button" className="btn" onClick={() => void handleExportBackup()}>
            📥 Yedeği JSON Olarak İndir
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => fileInputRef.current?.click()}
          >
            📤 JSON Yedeğini Geri Yükle
          </button>
          <input
            type="file"
            accept=".json,application/json"
            ref={fileInputRef}
            className={styles.fileInputHidden}
            onChange={(e) => void handleImportBackup(e)}
          />
        </div>
        {backupMsg && (
          <div role="status" aria-live="polite" style={{ marginTop: '0.75rem' }}>
            <p className={backupMsg.startsWith('✓') ? styles.ok : styles.error}>{backupMsg}</p>
          </div>
        )}
      </section>

      {/* 5. CİHAZ VE ÇEVRİMD IŞI DURUMU */}
      <div className="card">
        <h2 className={styles.cardTitle}>Cihaz ve Çevrimdışı Durumu</h2>
        <dl className={styles.dl}>
          <div>
            <dt>Ağ</dt>
            <dd>{online ? 'Çevrimiçi' : 'Çevrimdışı'}</dd>
          </div>
          <div>
            <dt>Service Worker</dt>
            <dd>{SW_LABELS[sw.status]}</dd>
          </div>
          <div>
            <dt>Kalıcı depolama</dt>
            <dd>
              {storage.persisted == null ? '—' : storage.persisted ? 'Verildi ✓' : 'Verilmedi'}
              {storage.persisted === false && (
                <button
                  id="request-persist"
                  type="button"
                  className={`btn btn-ghost ${styles.inlineBtn}`}
                  onClick={() => void storage.requestPersist()}
                >
                  İzin iste
                </button>
              )}
            </dd>
          </div>
          <div>
            <dt>Kullanılan alan</dt>
            <dd>
              {formatBytes(storage.usageBytes)} / {formatBytes(storage.quotaBytes)}
            </dd>
          </div>
        </dl>
        <div className={styles.meter} aria-hidden="true">
          <span style={{ width: `${usagePct}%` }} />
        </div>
      </div>
    </section>
  )
}

/** Günlük hatırlatma: seçilen saatte, o gün hiç çalışılmadıysa bildirim. */
function ReminderCard() {
  const reminder = useSettings((s) => s.reminder)
  const setReminder = useSettings((s) => s.setReminder)
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(() =>
    notificationsSupported() ? Notification.permission : 'unsupported',
  )

  async function toggle(enabled: boolean) {
    if (enabled) {
      const p = await requestReminderPermission()
      setPermission(p)
      if (p !== 'granted') return
    }
    setReminder({ enabled })
  }

  return (
    <section id="reminder" className="card">
      <h2 className={styles.cardTitle}>Günlük Hatırlatma</h2>
      <p className="muted" style={{ margin: '0 0 1rem' }}>
        Seçtiğin saatte o gün hiç çalışmadıysan bir bildirim gelir. Uygulama ya da sekmesi açıkken çalışır; tamamen
        kapalıyken bildirim gönderilemez.
      </p>
      {permission === 'unsupported' ? (
        <p className="muted">Bu tarayıcı bildirimleri desteklemiyor.</p>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={reminder.enabled && permission === 'granted'}
              onChange={(e) => void toggle(e.target.checked)}
            />
            Hatırlatmayı aç
          </label>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            Saat
            <input
              type="time"
              className="input"
              value={reminder.time}
              onChange={(e) => setReminder({ time: e.target.value || '20:00' })}
              style={{ width: 'auto' }}
            />
          </label>
          {reminder.enabled && permission === 'granted' && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => showReminder('YDS çalışma zamanı 📚', 'Deneme bildirimi: hatırlatmalar böyle görünecek.')}
            >
              Deneme bildirimi gönder
            </button>
          )}
        </div>
      )}
      {permission === 'denied' && (
        <p style={{ color: 'var(--danger)', fontSize: '0.85rem', margin: '0.75rem 0 0' }}>
          Bildirim izni reddedilmiş. Tarayıcının site ayarlarından bu siteye bildirim izni verip sayfayı yenile.
        </p>
      )}
    </section>
  )
}

/** Yapay zekâ (Gemini) ayarları: ücretli + yedek ücretsiz anahtar, model, aylık üst sınır. */
/** Telefondan aç (yalnızca geliştirme sunucusu, bu bilgisayarda): `npm run telefon` ile ev ağına açılan adres ve şifre. */
function PhoneCard() {
  const [info, setInfo] = useState<{ active: boolean; urls?: string[]; password?: string } | null>(null)
  useEffect(() => {
    fetch('/local-api/telefon')
      .then((r) => (r.ok ? r.json() : null))
      .then(setInfo)
      .catch(() => setInfo(null))
  }, [])
  // Telefondan açıldığında (ya da sunucu eskiyse) kart görünmez
  if (!info) return null

  return (
    <section id="telefon" className="card">
      <h2 className={styles.cardTitle}>📱 Telefondan aç</h2>
      {info.active ? (
        <>
          <p className="muted" style={{ margin: '0 0 0.75rem' }}>
            Telefon bu bilgisayarla aynı Wi-Fi ağında olmalı. Adresi telefonun tarayıcısına yaz, şifreyi gir (bir kez
            sorulur). İlk açılışta “bağlantı gizli değil” uyarısı çıkar: <b>Gelişmiş › Devam et</b> de.
          </p>
          <dl className={styles.dl}>
            <div>
              <dt>Adres</dt>
              <dd>{info.urls?.length ? info.urls.map((u) => <div key={u}><code>{u}</code></div>) : 'Ev ağı bulunamadı'}</dd>
            </div>
            <div>
              <dt>Şifre</dt>
              <dd>
                <div>
                  <code>{info.password}</code>
                </div>
              </dd>
            </div>
          </dl>
          <p className="muted" style={{ margin: '0.75rem 0 0', fontSize: '0.85rem' }}>
            Telefondaki ilerleme ve Gemini anahtarı telefonda ayrı tutulur. Bilgisayar kapanınca ya da sunucu durunca
            telefondan da açılmaz.
          </p>
        </>
      ) : (
        <p className="muted" style={{ margin: 0 }}>
          Kitapları ve çıkmış soruları telefonda da açmak için sunucuyu <code>npm run dev</code> yerine{' '}
          <code>npm run telefon</code> ile başlat. İlk seferde Windows izin sorarsa <b>Özel ağlar</b> için izin ver.
        </p>
      )}
    </section>
  )
}

function AiCard() {
  const ai = useSettings((s) => s.ai)
  const setAi = useSettings((s) => s.setAi)
  const [paidKey, setPaidKey] = useState(ai.paidKey)
  const [freeKey, setFreeKey] = useState(ai.freeKey)
  const [model, setModel] = useState(ai.model)
  const [limit, setLimit] = useState(ai.monthlyLimitUsd)
  const [showKeys, setShowKeys] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [results, setResults] = useState<{ label: string; ok: boolean; message: string }[]>([])
  const [usage, setUsage] = useState(getAiUsage)

  function save(e: FormEvent) {
    e.preventDefault()
    setAi({ paidKey: paidKey.trim(), freeKey: freeKey.trim(), model, monthlyLimitUsd: Math.max(0, Number(limit) || 0) })
    resetPaidBlock()
    setUsage(getAiUsage())
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  async function test() {
    setTesting(true)
    setResults([])
    const out: { label: string; ok: boolean; message: string }[] = []
    if (paidKey.trim()) out.push({ label: 'Ücretli anahtar', ...(await testKey(paidKey, model)) })
    if (freeKey.trim()) out.push({ label: 'Ücretsiz yedek anahtar', ...(await testKey(freeKey, model)) })
    if (!out.length) out.push({ label: 'Anahtar', ok: false, message: 'Önce en az bir anahtar gir.' })
    setResults(out)
    setTesting(false)
  }

  const blocked = usage.paidBlockedAt
  return (
    <section id="ai" className="card">
      <h2 className={styles.cardTitle}>Yapay Zekâ (Gemini)</h2>
      <p className="muted" style={{ margin: '0 0 1rem' }}>
        Soru açıklamaları ve yazma geri bildirimi Google Gemini ile yapılır. Önce ücretli anahtar kullanılır; bakiye ya da
        aşağıdaki aylık üst sınır biterse ücretsiz yedek anahtarla devam edilir. Anahtarlar yalnızca bu cihazda saklanır
        (GitHub’a ve yedek dosyasına girmez), her cihazda ayrıca girilmelidir. Kurulum adımları:{' '}
        <code>GEMINI_KURULUM.md</code>.
      </p>
      <form onSubmit={save} style={{ display: 'grid', gap: '1rem' }}>
        <div className="field">
          <label htmlFor="ai-paid-key">Ücretli anahtar (faturalandırması açık proje)</label>
          <input
            id="ai-paid-key"
            className="input"
            type={showKeys ? 'text' : 'password'}
            autoComplete="off"
            spellCheck={false}
            placeholder="AIza…"
            value={paidKey}
            onChange={(e) => setPaidKey(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="ai-free-key">Ücretsiz yedek anahtar (faturalandırması kapalı ayrı proje)</label>
          <input
            id="ai-free-key"
            className="input"
            type={showKeys ? 'text' : 'password'}
            autoComplete="off"
            spellCheck={false}
            placeholder="AIza…"
            value={freeKey}
            onChange={(e) => setFreeKey(e.target.value)}
          />
        </div>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={showKeys} onChange={(e) => setShowKeys(e.target.checked)} />
          Anahtarları göster
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          <div className="field">
            <label htmlFor="ai-model">Model</label>
            <select id="ai-model" className="input" value={model} onChange={(e) => setModel(e.target.value)}>
              {AI_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="ai-limit">Aylık ücretli kullanım üst sınırı ($)</label>
            <input
              id="ai-limit"
              className="input"
              type="number"
              min={0}
              step={1}
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
            />
            <small className="muted">Uygulamanın tahminidir; aşılınca ücretsiz anahtara geçilir. 0 = sınırsız.</small>
          </div>
        </div>

        <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
          Bu ay (tahmini): <strong>{usage.paidUsd.toFixed(3)} $</strong> · {usage.paidCalls} ücretli, {usage.freeCalls}{' '}
          ücretsiz istek.
          {blocked && (
            <>
              {' '}
              <span style={{ color: 'var(--warning)' }}>
                Ücretli anahtar {new Date(blocked).toLocaleString('tr-TR')} itibarıyla ücretsiz yedeğe devretti (bakiye veya
                limit). Kaydet’e basınca yeniden denenir.
              </span>
            </>
          )}
        </p>

        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="submit" className="btn btn-primary">
            Kaydet
          </button>
          <button type="button" className="btn btn-secondary" disabled={testing} onClick={() => void test()}>
            {testing ? 'Deneniyor…' : 'Bağlantıyı test et'}
          </button>
          {saved && <span style={{ color: 'var(--success)', fontWeight: 600, fontSize: '0.85rem' }}>✓ Kaydedildi</span>}
        </div>
        {results.length > 0 && (
          <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.88rem', display: 'grid', gap: '0.25rem' }}>
            {results.map((r) => (
              <li key={r.label} style={{ color: r.ok ? 'var(--success)' : 'var(--danger)' }}>
                {r.ok ? '✓' : '✗'} {r.label}: {r.message}
              </li>
            ))}
          </ul>
        )}
      </form>
    </section>
  )
}
