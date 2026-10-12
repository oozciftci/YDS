import { useEffect, useState, type FormEvent } from 'react'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { testBackendConnection, type ConnectionTestResult } from '../services/backend'
import { formatBytes, useStorageInfo } from '../services/storage'
import { isValidHttpUrl, normalizeUrl, useSettings } from '../stores/settings'
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

export function SettingsPage() {
  const backend = useSettings((s) => s.backend)
  const setBackend = useSettings((s) => s.setBackend)
  const resetBackend = useSettings((s) => s.resetBackend)
  const online = useOnlineStatus()
  const sw = useSwStatus()
  const storage = useStorageInfo()

  const [url, setUrl] = useState(backend.url)
  const [anonKey, setAnonKey] = useState(backend.anonKey)
  const [showKey, setShowKey] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState<ConnectionTestResult | null>(null)

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
    setTimeout(() => setSaved(false), 2500)
  }

  async function onTest() {
    setTesting(true)
    setResult(null)
    setResult(await testBackendConnection({ url, anonKey: anonKey.trim() }))
    setTesting(false)
  }

  function onReset() {
    resetBackend()
    setUrl('')
    setAnonKey('')
    setResult(null)
  }

  const usagePct =
    storage.usageBytes != null && storage.quotaBytes
      ? Math.min(100, (storage.usageBytes / storage.quotaBytes) * 100)
      : 0

  return (
    <section className={styles.page}>
      <header>
        <h1>Ayarlar</h1>
        <p className="muted">Sunucu bağlantısı ve cihaz durumu. Değerler yalnızca bu cihazda saklanır.</p>
      </header>

      <form className="card" onSubmit={onSave} noValidate>
        <h2 className={styles.cardTitle}>Sunucu (Senkronizasyon)</h2>

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
          <span className="hint">Yalnızca “anon” anahtarı girin. “service_role” anahtarını asla buraya yazmayın.</span>
        </div>

        <div className={styles.actions}>
          <button id="save-backend" type="submit" className="btn btn-primary" disabled={!urlValid || !dirty}>
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
        </div>
      </form>

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
