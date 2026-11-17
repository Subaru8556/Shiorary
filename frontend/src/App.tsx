// frontend/src/App.tsx
import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import Layout from './components/Layout'
import { LoadingBlock, Spinner } from './components/ui'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import SearchPage from './pages/SearchPage'
import TagsIndexPage from './pages/TagsIndexPage'
import BookDetailPage from './pages/BookDetailPage'
import SettingsPage from './pages/SettingsPage'

// ビューワー（epub.js を含む）と管理画面は必要になったときに読み込む
const ReaderPage = lazy(() => import('./pages/ReaderPage'))
const AdminUnorganizedPage = lazy(() => import('./pages/AdminUnorganizedPage'))

function FullscreenLoading() {
  return (
    <div className="min-h-dvh bg-paper flex items-center justify-center gap-3 font-bold text-sm text-stone-400">
      <Spinner className="w-4 h-4" />
      読み込み中...
    </div>
  )
}

function App() {
  const { user, loading, checkAuth } = useAuthStore()

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  if (loading) return <FullscreenLoading />

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />

        <Route
          path="/books/:id/read"
          element={
            user ? (
              <Suspense fallback={<div className="fixed inset-0 bg-neutral-950" />}>
                <ReaderPage />
              </Suspense>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route path="/" element={user ? <Layout /> : <Navigate to="/login" replace />}>
          <Route index element={<HomePage />} />
          <Route path="search" element={<SearchPage key="all" scope="all" pageTitle="作品の検索" />} />
          <Route path="favorites" element={<SearchPage key="favorites" scope="favorites" pageTitle="お気に入り" />} />
          <Route path="bookmarks" element={<SearchPage key="bookmarks" scope="bookmarks" pageTitle="しおり（読書中）" />} />
          <Route path="tags" element={<TagsIndexPage />} />
          <Route path="books/:id" element={<BookDetailPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route
            path="admin/unorganized"
            element={
              user?.is_admin ? (
                <Suspense fallback={<LoadingBlock />}>
                  <AdminUnorganizedPage />
                </Suspense>
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
