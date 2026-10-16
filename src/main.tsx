import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import { initServiceWorker } from './pwa/registerSW'
import { logger } from './services/logger'
import { migrateWordLevels } from './services/levelMigration'
import { initAutoSync } from './services/sync'
import { initTheme } from './stores/theme'
import { useUserStore } from './stores/user'

initTheme()
logger.init()
initServiceWorker()
initAutoSync()
void useUserStore
  .getState()
  .loadUsers()
  .then(() => migrateWordLevels())
  .catch((err) => logger.warn('system', 'Seviye düzeltmesi yapılamadı, sonraki açılışta denenecek', String(err)))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
