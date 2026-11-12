import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import { initServiceWorker } from './pwa/registerSW'
import { logger } from './services/logger'
import { migrateWordLevels } from './services/levelMigration'
import { migrateNotebook } from './services/notebook'
import { startReminderLoop } from './services/reminder'
import { initAutoSync } from './services/sync'
import { initTheme } from './stores/theme'
import { applyAppearance, useAppearance } from './stores/appearance'
import { useUserStore } from './stores/user'

initTheme()
applyAppearance(useAppearance.getState().appearance)
logger.init()
initServiceWorker()
initAutoSync()
startReminderLoop()
void useUserStore
  .getState()
  .loadUsers()
  .then(() => migrateWordLevels())
  .catch((err) => logger.warn('system', 'Seviye düzeltmesi yapılamadı, sonraki açılışta denenecek', String(err)))

// Eski notlar (tek metinli sayfa notu, Blob olarak saklanan ses/görsel) yeni biçime; başarısızsa sonraki açılışta dener
void migrateNotebook().catch((err) => logger.warn('system', 'Notlar yeni biçime getirilemedi', String(err)))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
