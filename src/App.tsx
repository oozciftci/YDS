import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { HomePage } from './pages/Home'
import { SettingsPage } from './pages/Settings'

import { StatsPage } from './pages/Stats'
import { StudyPage } from './pages/Study'
import { WordsPage } from './pages/Words'
import { SynonymMatchPage } from './pages/SynonymMatch'
import { ExamQuizPage } from './pages/ExamQuiz'

// YDS soru çalışma sayfası yalnızca yerel geliştirmede (npm run dev) vardır; yayın derlemesinde
// import.meta.env.DEV false olduğundan bu satır ve sayfa pakete hiç girmez.
// Dilbilgisi rehberi ayrı parça olarak yüklenir (uzun içerik ana paketi büyütmesin)
const GrammarPage = lazy(() => import('./pages/Grammar'))

const ExamStudyPage = import.meta.env.DEV ? lazy(() => import('./pages/ExamStudy')) : null

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="study" element={<StudyPage />} />
          <Route path="match" element={<SynonymMatchPage />} />
          <Route path="quiz" element={<ExamQuizPage />} />
          {ExamStudyPage && (
            <Route
              path="yds-sorular/*"
              element={
                <Suspense fallback={<p className="muted">Yükleniyor…</p>}>
                  <ExamStudyPage />
                </Suspense>
              }
            />
          )}
          <Route
            path="dilbilgisi/*"
            element={
              <Suspense fallback={<p className="muted">Yükleniyor…</p>}>
                <GrammarPage />
              </Suspense>
            }
          />
          <Route path="words" element={<WordsPage />} />
          <Route path="stats" element={<StatsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
