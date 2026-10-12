import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { HomePage } from './pages/Home'
import { Placeholder } from './pages/Placeholder'
import { SettingsPage } from './pages/Settings'

import { WordsPage } from './pages/Words'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route
            path="study"
            element={<Placeholder step="Adım 4" title="Çalış" description="Aralıklı tekrar oturumu ve soru türleri burada olacak." />}
          />
          <Route path="words" element={<WordsPage />} />
          <Route
            path="stats"
            element={<Placeholder step="Adım 5" title="İstatistikler" description="Günlük ilerleme, başarı oranları ve tekrar takvimi." />}
          />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
