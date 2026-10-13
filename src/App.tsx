import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { HomePage } from './pages/Home'
import { SettingsPage } from './pages/Settings'

import { StatsPage } from './pages/Stats'
import { StudyPage } from './pages/Study'
import { WordsPage } from './pages/Words'
import { SynonymMatchPage } from './pages/SynonymMatch'
import { ExamQuizPage } from './pages/ExamQuiz'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="study" element={<StudyPage />} />
          <Route path="match" element={<SynonymMatchPage />} />
          <Route path="quiz" element={<ExamQuizPage />} />
          <Route path="words" element={<WordsPage />} />
          <Route path="stats" element={<StatsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
