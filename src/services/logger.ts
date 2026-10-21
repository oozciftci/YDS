import { db } from '../db'
import { useUserStore } from '../stores/user'
import type { AppLog, LogCategory, LogLevel } from '../types/database'

const PRUNE_THRESHOLD_BYTES = 200 * 1024 * 1024 // 200 MB kuralı
// Cihazda tutulan uygulama kayıtları sınırı (telefon depolaması şişmesin): son 14 gün, en fazla 2000 kayıt
const KEEP_LOG_DAYS = 14
const KEEP_LOG_MAX = 2000

class LoggerService {
  private isInitialized = false

  public init() {
    if (this.isInitialized || typeof window === 'undefined') return
    this.isInitialized = true

    // Yakalanmamış global JavaScript hatalarını otomatik kaydet
    window.addEventListener('error', (event) => {
      this.error('system', `Global JS Hatası: ${event.message}`, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack,
      })
    })

    // Yakalanmamış Promise reddedilmelerini otomatik kaydet
    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason
      const msg = typeof reason === 'object' && reason !== null ? reason.message || JSON.stringify(reason) : String(reason)
      this.error('system', `İşlenmemiş Promise Hatası: ${msg}`, {
        stack: reason?.stack,
      })
    })

    // Eski kayıtları kırp (açılışta bir kez, arayüzü bekletmeden)
    setTimeout(() => void this.trimLocalLogs(), 5000)

    // Ağ durumu değişimlerini logla
    window.addEventListener('online', () => {
      this.info('system', 'Cihaz çevrimiçi duruma geçti (online)')
    })
    window.addEventListener('offline', () => {
      this.warn('system', 'Cihaz çevrimdışı duruma geçti (offline)')
    })
  }

  private async writeLog(
    level: LogLevel,
    category: LogCategory,
    message: string,
    details?: Record<string, unknown> | string,
  ) {
    try {
      const userId = useUserStore.getState().activeUserId
      const logEntry: AppLog = {
        id: crypto.randomUUID(),
        userId,
        level,
        category,
        message,
        details: typeof details === 'string' ? details : details ? JSON.parse(JSON.stringify(details)) : undefined,
        timestamp: new Date().toISOString(),
        deviceInfo: {
          userAgent: navigator.userAgent,
          isOnline: navigator.onLine,
          url: window.location.pathname,
        },
        synced: 0, // Henüz sunucuya gitmedi
      }

      await db.logs.add(logEntry)

      // Geliştirici konsoluna da renkli bas
      const styleMap: Record<LogLevel, string> = {
        error: 'color: #ef4444; font-weight: bold;',
        warn: 'color: #f59e0b; font-weight: bold;',
        info: 'color: #3b82f6;',
        interaction: 'color: #10b981;',
      }
      // eslint-disable-next-line no-console
      console.log(`%c[${level.toUpperCase()}][${category}] ${message}`, styleMap[level], details || '')
    } catch (err) {
      // IndexedDB log yazarken patlarsa sonsuz döngüye girmemek için sadece console'a yaz
      // eslint-disable-next-line no-console
      console.error('Log yerel veritabanına yazılamadı:', err)
    }
  }

  public info(category: LogCategory, message: string, details?: Record<string, unknown> | string) {
    void this.writeLog('info', category, message, details)
  }

  public warn(category: LogCategory, message: string, details?: Record<string, unknown> | string) {
    void this.writeLog('warn', category, message, details)
  }

  public error(
    category: LogCategory,
    message: string,
    details?: Record<string, unknown> | string,
    err?: unknown,
  ) {
    const errorDetails =
      err instanceof Error
        ? { message: err.message, stack: err.stack, ...(typeof details === 'object' ? details : { raw: details }) }
        : details
    void this.writeLog('error', category, message, errorDetails)
  }

  /**
   * Kullanıcı etkileşimlerini loglar (Örn: bildi/bilemedi, soru çözme, ses dinleme, arama)
   */
  public interaction(category: LogCategory, message: string, details?: Record<string, unknown> | string) {
    void this.writeLog('interaction', category, message, details)
  }

  /** Cihazdaki uygulama kayıtlarını sınırla: KEEP_LOG_DAYS günden eskiler ve en yeni KEEP_LOG_MAX dışındakiler silinir. */
  public async trimLocalLogs(): Promise<number> {
    try {
      const cutoff = new Date(Date.now() - KEEP_LOG_DAYS * 86_400_000).toISOString()
      let removed = await db.logs.where('timestamp').below(cutoff).delete()
      const extra = (await db.logs.count()) - KEEP_LOG_MAX
      if (extra > 0) {
        const oldest = await db.logs.orderBy('timestamp').limit(extra).primaryKeys()
        await db.logs.bulkDelete(oldest)
        removed += oldest.length
      }
      return removed
    } catch {
      return 0
    }
  }

  /**
   * 200 MB Kontrolü ve Temizleme Kuralı:
   * "Gönderildikten sonra (Başarıyla gönderildiği teyit edildikten sonra)
   *  eğer cihazda 200 MB'dan fazla yer kaplıyorsa silinsin."
   */
  public async pruneSyncedLogsIfStorageExceeded(): Promise<{ prunedCount: number; currentUsageBytes: number | null }> {
    let currentUsage: number | null = null
    let shouldPrune = false

    if (navigator.storage && navigator.storage.estimate) {
      try {
        const estimate = await navigator.storage.estimate()
        currentUsage = estimate.usage ?? null
        if (currentUsage && currentUsage > PRUNE_THRESHOLD_BYTES) {
          shouldPrune = true
        }
      } catch {
        // storage estimate desteklenmiyorsa fallback
      }
    }

    if (!shouldPrune) {
      return { prunedCount: 0, currentUsageBytes: currentUsage }
    }

    // 200 MB aşıldı! Yalnızca başarıyla gönderildiği teyit edilmiş (synced === 1) logları sil
    const syncedLogs = await db.logs.where('synced').equals(1).sortBy('timestamp')
    const toDeleteIds = syncedLogs.map((l) => l.id)

    if (toDeleteIds.length > 0) {
      await db.logs.bulkDelete(toDeleteIds)
      this.info('storage', `200 MB aşıldığı için ${toDeleteIds.length} adet gönderilmiş log temizlendi.`, {
        deletedCount: toDeleteIds.length,
        usageBefore: currentUsage,
      })
    }

    return { prunedCount: toDeleteIds.length, currentUsageBytes: currentUsage }
  }
}

export const logger = new LoggerService()
