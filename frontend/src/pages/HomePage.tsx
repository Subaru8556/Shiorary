// frontend/src/pages/HomePage.tsx
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Bookmark, RefreshCw, Sparkles } from 'lucide-react'
import BookTileGrid from '../components/BookTileGrid'
import { LoadingBlock, Panel } from '../components/ui'
import { apiGet } from '../lib/api'
import type { BookCard } from '../lib/types'

interface HomeResponse {
  bookmarks: BookCard[] | null
  random: BookCard[] | null
}

export default function HomePage() {
  const [bookmarks, setBookmarks] = useState<BookCard[]>([])
  const [randoms, setRandoms] = useState<BookCard[]>([])
  const [loading, setLoading] = useState(true)
  const [initialized, setInitialized] = useState(false)

  const fetchHome = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiGet<HomeResponse>('/api/home')
      setBookmarks(data.bookmarks || [])
      setRandoms(data.random || [])
    } catch {
      /* 失敗時は空表示 */
    } finally {
      setLoading(false)
      setInitialized(true)
    }
  }, [])

  useEffect(() => {
    fetchHome()
  }, [fetchHome])

  if (!initialized) return <LoadingBlock />

  return (
    <>
      {bookmarks.length > 0 && (
        <Panel
          title="続きを読む"
          icon={Bookmark}
          tone="amber"
          actions={
            <Link to="/bookmarks" className="text-xs font-bold text-brand-600 hover:text-brand-800 flex items-center gap-1">
              すべて ({bookmarks.length})
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          }
        >
          <BookTileGrid books={bookmarks} layout="row" />
        </Panel>
      )}

      <Panel
        title="ピックアップ"
        icon={Sparkles}
        actions={
          <button
            onClick={fetchHome}
            disabled={loading}
            className="text-xs font-bold bg-stone-100 hover:bg-brand-50 text-stone-700 hover:text-brand-600 px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            シャッフル
          </button>
        }
      >
        <BookTileGrid
          books={randoms}
          emptyMessage="登録済みの作品がまだありません。メニューの「作品の登録・管理」から本を登録してください。"
        />
      </Panel>
    </>
  )
}
