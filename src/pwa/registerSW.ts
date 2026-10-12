import { registerSW } from 'virtual:pwa-register'
import { create } from 'zustand'

/**
 * Service Worker kaydı ve SESSİZ güncelleme stratejisi.
 *
 * - Yeni sürüm indirildiğinde kullanıcıya soru sorulmaz.
 * - Kullanıcı bir çalışma oturumundaysa (`/study`) sayfa yenilenmez;
 *   güncelleme, sekme arka plana geçtiğinde veya çalışma ekranından
 *   çıkıldığında uygulanır.
 * - Çevrimiçiyken saatte bir yeni sürüm kontrol edilir.
 */

type SwStatus = 'unsupported' | 'registering' | 'offline-ready' | 'update-pending' | 'active' | 'error'

interface SwState {
  status: SwStatus
  error?: string
}

export const useSwStatus = create<SwState>(() => ({
  status: 'serviceWorker' in navigator ? 'registering' : 'unsupported',
}))

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000
let applyUpdate: ((reload?: boolean) => Promise<void>) | null = null

function tryApplyPendingUpdate(force = false) {
  if (useSwStatus.getState().status !== 'update-pending' || !applyUpdate) return
  // Kullanıcı sayfayı aktif görüntülerken ekranı aniden yeniden yükleme;
  // güncelleme sekme arka plana geçtiğinde (hidden) veya kullanıcı gezinirken uygulanır.
  if (!force && document.visibilityState === 'visible') return
  void applyUpdate(true)
}

/** Router her sayfa değişiminde çağırır; bekleyen güncelleme uygunsa uygulanır. */
export function notifyRouteChanged() {
  if (document.visibilityState === 'hidden') {
    tryApplyPendingUpdate(true)
  }
}

export function initServiceWorker() {
  if (!('serviceWorker' in navigator)) return

  applyUpdate = registerSW({
    immediate: true,
    onNeedRefresh() {
      useSwStatus.setState({ status: 'update-pending' })
      tryApplyPendingUpdate()
    },
    onOfflineReady() {
      useSwStatus.setState({ status: 'offline-ready' })
    },
    onRegisteredSW(_url, registration) {
      if (useSwStatus.getState().status === 'registering') {
        useSwStatus.setState({ status: 'active' })
      }
      if (!registration) return
      setInterval(() => {
        if (navigator.onLine && registration.installing == null) {
          void registration.update().catch(() => {})
        }
      }, UPDATE_CHECK_INTERVAL_MS)
    },
    onRegisterError(err: unknown) {
      useSwStatus.setState({ status: 'error', error: String(err) })
    },
  })

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') tryApplyPendingUpdate(true)
  })
}
