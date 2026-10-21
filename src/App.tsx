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
import { StudyHubPage } from './pages/StudyHub'
import { hasLocalContent } from './services/localContent'

// Dilbilgisi rehberi ayrı parça olarak yüklenir (uzun içerik ana paketi büyütmesin)
const GrammarPage = lazy(() => import('./pages/Grammar'))
const CoachPage = lazy(() => import('./pages/Coach'))
const YdsTestPage = lazy(() => import('./pages/YdsTest'))
const NightModePage = lazy(() => import('./pages/NightMode'))
const WordFamiliesPage = lazy(() => import('./pages/WordFamilies').then((m) => ({ default: m.WordFamiliesPage })))
const ReadingLibraryPage = lazy(() => import('./pages/ReadingLibrary').then((m) => ({ default: m.ReadingLibraryPage })))
const ReadingBookPage = lazy(() => import('./pages/ReadingBook').then((m) => ({ default: m.ReadingBookPage })))
const LibraryReader = lazy(() => import('./pages/ReadingLibrary').then((m) => ({ default: m.LibraryReader })))

// YDS soru çalışma ve Kitaptan çalış sayfaları telifli yerel içerik ister: geliştirmede yerel sunucudan, yayında cihaza
// yüklenen kaynak paketinden (src/services/localContent.ts). Paket yüklenmemişse sayfa yolu hiç tanımlanmaz.
const ExamStudyPage = hasLocalContent() ? lazy(() => import('./pages/ExamStudy')) : null
const BooksPage = hasLocalContent() ? lazy(() => import('./pages/Books')) : null

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="calis" element={<StudyHubPage />} />
          <Route path="study" element={<StudyPage />} />
          <Route
            path="okuma"
            element={
              <Suspense fallback={<p className="muted">Yükleniyor…</p>}>
                <ReadingLibraryPage />
              </Suspense>
            }
          />
          <Route
            path="okuma/kitap/:bookId"
            element={
              <Suspense fallback={<p className="muted">Yükleniyor…</p>}>
                <ReadingBookPage />
              </Suspense>
            }
          />
          <Route
            path="okuma/kitap/:bookId/:page"
            element={
              <Suspense fallback={<p className="muted">Yükleniyor…</p>}>
                <ReadingBookPage />
              </Suspense>
            }
          />
          <Route
            path="okuma/:textId"
            element={
              <Suspense fallback={<p className="muted">Yükleniyor…</p>}>
                <LibraryReader />
              </Suspense>
            }
          />
          <Route
            path="kelime-ailesi"
            element={
              <Suspense fallback={<p className="muted">Yükleniyor…</p>}>
                <WordFamiliesPage />
              </Suspense>
            }
          />
          <Route
            path="gece"
            element={
              <Suspense fallback={<p className="muted">Yükleniyor…</p>}>
                <NightModePage />
              </Suspense>
            }
          />
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
          {BooksPage && (
            <Route
              path="kitap/*"
              element={
                <Suspense fallback={<p className="muted">Yükleniyor…</p>}>
                  <BooksPage />
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
          <Route
            path="koc/*"
            element={
              <Suspense fallback={<p className="muted">Yükleniyor…</p>}>
                <CoachPage />
              </Suspense>
            }
          />
          <Route
            path="yds-test/*"
            element={
              <Suspense fallback={<p className="muted">Yükleniyor…</p>}>
                <YdsTestPage />
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
