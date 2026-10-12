import { getBackendConfig, normalizeUrl, type BackendSettings } from '../stores/settings'

export interface ConnectionTestResult {
  ok: boolean
  message: string
  latencyMs?: number
}

/**
 * Girilen Supabase adresine/anahtarına erişilebiliyor mu kontrol eder.
 * Parametre verilmezse kayıtlı ayarları kullanır.
 */
export async function testBackendConnection(
  cfg: BackendSettings | null = getBackendConfig(),
  timeoutMs = 8000,
): Promise<ConnectionTestResult> {
  if (!cfg || !cfg.url || !cfg.anonKey) {
    return { ok: false, message: 'Sunucu adresi veya anahtar girilmemiş.' }
  }
  if (!navigator.onLine) {
    return { ok: false, message: 'Cihaz çevrimdışı. Bağlantı testi için internet gerekli.' }
  }

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  const started = performance.now()
  try {
    const res = await fetch(`${normalizeUrl(cfg.url)}/auth/v1/health`, {
      headers: { apikey: cfg.anonKey },
      signal: ctrl.signal,
      cache: 'no-store',
    })
    const latencyMs = Math.round(performance.now() - started)
    if (res.ok) return { ok: true, message: `Bağlantı başarılı (${latencyMs} ms).`, latencyMs }
    if (res.status === 401 || res.status === 403) {
      return { ok: false, message: `Sunucuya ulaşıldı ama anahtar reddedildi (HTTP ${res.status}).` }
    }
    return { ok: false, message: `Sunucu beklenmeyen yanıt verdi (HTTP ${res.status}).` }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { ok: false, message: 'Zaman aşımı: sunucu yanıt vermedi.' }
    }
    return { ok: false, message: 'Sunucuya ulaşılamadı. Adresi kontrol edin.' }
  } finally {
    clearTimeout(timer)
  }
}
