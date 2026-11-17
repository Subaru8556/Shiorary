// frontend/src/pages/BookDetailPage.tsx
// 作品詳細：表紙・読書ボタン・メタデータ・ページ一覧・同シリーズ作品
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  BookOpen,
  Bookmark,
  BookmarkX,
  Calendar,
  ChevronDown,
  Clock,
  Grid,
  Heart,
  Layers,
  PenTool,
  RotateCcw,
  ShieldAlert,
  Tag as TagIcon,
  Trash2,
  Tv,
  User as UserIcon,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import BookTileGrid from '../components/BookTileGrid'
import { LoadingBlock, Panel } from '../components/ui'
import { useAuthStore } from '../store/authStore'
import { apiGet, apiSend } from '../lib/api'
import { formatProgress, type BookDetail, type Tag } from '../lib/types'

const FILE_LABEL: Record<string, string> = {
  zip: 'ZIP',
  dir: 'フォルダ',
  pdf: 'PDF',
  epub: 'EPUB',
  txt: 'TXT',
}

function TagRow({ icon: Icon, label, tags, linkSuffix = '' }: { icon: LucideIcon; label: string; tags: Tag[]; linkSuffix?: string }) {
  return (
    <div className="flex gap-3 py-3 first:pt-0 last:pb-0">
      <div className="w-24 sm:w-28 shrink-0 flex items-center gap-1.5 text-xs font-bold text-stone-500 self-start pt-1.5">
        <Icon className="w-3.5 h-3.5 text-brand-500 shrink-0" />
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5 min-w-0">
        {tags.length === 0 ? (
          <span className="text-xs text-stone-400 pt-1.5">未設定</span>
        ) : (
          tags.map((t) => (
            <Link
              key={t.id}
              to={`/search?include_tags=${t.id}${linkSuffix}`}
              className="bg-stone-50 border border-stone-200 hover:border-brand-400 hover:text-brand-600 text-stone-700 px-2.5 py-1 rounded-lg text-xs font-bold transition"
            >
              {t.name}
            </Link>
          ))
        )}
      </div>
    </div>
  )
}

export default function BookDetailPage() {
  const isAdmin = useAuthStore((s) => s.user?.is_admin)
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [book, setBook] = useState<BookDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [showPageList, setShowPageList] = useState(false)
  const [showAdmin, setShowAdmin] = useState(false)

  const fetchDetail = useCallback(async () => {
    setLoading(true)
    try {
      setBook(await apiGet<BookDetail>(`/api/books/${id}`))
    } catch {
      setBook(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchDetail()
    setShowPageList(false)
    setShowAdmin(false)
  }, [fetchDetail])

  if (loading) return <LoadingBlock />
  if (!book) {
    return (
      <div className="bg-white rounded-2xl border border-stone-200 p-10 text-center text-sm text-rose-600">作品が見つかりません。</div>
    )
  }

  const byCat = (cat: string) => book.tags.filter((t) => t.category === cat)
  const parodies = byCat('parody')
  const hasBookmark = book.bookmark_page > 0 || book.epub_cfi !== ''
  const hasPages = book.page_count > 0 && ['zip', 'dir', 'epub'].includes(book.file_type)

  const handleRemoveBookmark = async () => {
    await apiSend('DELETE', `/api/books/${book.id}/bookmark`)
    setBook({ ...book, bookmark_page: 0, epub_cfi: '' })
  }

  const handleToggleFavorite = async () => {
    const data = await apiSend<{ is_favorite: boolean }>('POST', `/api/books/${book.id}/favorite`)
    setBook({ ...book, is_favorite: data.is_favorite })
  }

  const handleAdminDelete = async (mode: 'unorganize' | 'db_only' | 'with_file') => {
    const msg =
      mode === 'unorganize'
        ? `「${book.title}」を未整理一覧へ戻しますか？`
        : mode === 'db_only'
          ? `「${book.title}」のDB登録情報を削除しますか？`
          : `【警告】「${book.title}」の元ファイルも含めて完全に削除しますか？`
    if (!confirm(msg)) return
    try {
      await apiSend('DELETE', `/api/admin/books/${book.id}?mode=${mode}`)
      navigate('/')
    } catch (err) {
      alert(err instanceof Error ? err.message : '削除に失敗しました')
    }
  }

  const readFromStart = () => navigate(`/books/${book.id}/read?page=1&direct=1`)
  const readFromBookmark = () => navigate(`/books/${book.id}/read?page=${book.bookmark_page || 1}&resume=1`)

  return (
    <>
      <Panel as="div" bodyClassName="p-4 sm:p-6">
        <div className="flex gap-4 sm:gap-6">
          {/* 表紙 */}
          <button
            onClick={hasBookmark ? readFromBookmark : readFromStart}
            className="relative w-28 sm:w-44 md:w-56 shrink-0 self-start rounded-xl overflow-hidden bg-stone-100 ring-1 ring-stone-200 shadow-sm group cursor-pointer"
            aria-label="ビューワーで開く"
          >
            <img
              src={`/api/thumbnails/${book.id}?type=orig`}
              alt=""
              className="w-full h-auto object-cover group-hover:scale-[1.03] transition duration-300 min-h-32"
              onError={(e) => (e.currentTarget.style.visibility = 'hidden')}
            />
            <span className="absolute inset-0 flex items-center justify-center bg-stone-900/0 group-hover:bg-stone-900/30 transition">
              <BookOpen className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition drop-shadow" />
            </span>
          </button>

          {/* タイトル・基本情報 */}
          <div className="min-w-0 flex-1 flex flex-col gap-2 sm:gap-3">
            <div className="text-[11px] sm:text-xs font-bold text-stone-400 flex flex-wrap items-center gap-1">
              <Link to={`/search?sale_type=${book.sale_type}`} className="text-brand-600 hover:underline">
                {book.sale_type}
              </Link>
              <span>/</span>
              <Link to={`/search?book_type=${book.book_type}`} className="text-stone-600 hover:underline">
                {book.book_type}
              </Link>
              {parodies[0] && (
                <>
                  <span>/</span>
                  <Link to={`/search?include_tags=${parodies[0].id}`} className="text-stone-600 hover:underline truncate">
                    {parodies[0].name}
                  </Link>
                </>
              )}
            </div>
            <h1 className="font-extrabold text-base sm:text-xl md:text-2xl text-stone-900 leading-snug break-words">
              {book.series_number !== null && <span className="mr-1.5 text-brand-600">[{book.series_number}巻]</span>}
              {book.title}
            </h1>
            <div className="flex flex-wrap gap-1.5 text-[11px] font-bold text-stone-500">
              <span className="bg-stone-100 px-2 py-0.5 rounded-md">{FILE_LABEL[book.file_type] || book.file_type}</span>
              {book.page_count > 0 && <span className="bg-stone-100 px-2 py-0.5 rounded-md">{book.page_count}ページ</span>}
              <span className="bg-stone-100 px-2 py-0.5 rounded-md">{book.page_direction === 'rtl' ? '右綴じ' : '左綴じ'}</span>
              {book.release_date && <span className="bg-stone-100 px-2 py-0.5 rounded-md">{book.release_date}</span>}
            </div>

            {/* PC・タブレットではタイトルの下にボタン */}
            <div className="hidden sm:block mt-auto">
              <ActionButtons
                hasBookmark={hasBookmark}
                progress={formatProgress(book.file_type, book.bookmark_page, book.page_count)}
                isFavorite={book.is_favorite}
                onStart={readFromStart}
                onResume={readFromBookmark}
                onFavorite={handleToggleFavorite}
                onRemoveBookmark={handleRemoveBookmark}
              />
            </div>
          </div>
        </div>

        {/* スマホでは表紙の下に全幅でボタン */}
        <div className="sm:hidden mt-4">
          <ActionButtons
            hasBookmark={hasBookmark}
            progress={formatProgress(book.file_type, book.bookmark_page, book.page_count)}
            isFavorite={book.is_favorite}
            onStart={readFromStart}
            onResume={readFromBookmark}
            onFavorite={handleToggleFavorite}
            onRemoveBookmark={handleRemoveBookmark}
          />
        </div>
      </Panel>

      <Panel title="作品情報" icon={Layers} bodyClassName="px-4 sm:px-6 py-4 divide-y divide-stone-100">
        <TagRow icon={Tv} label="原作" tags={parodies} />
        <TagRow icon={UserIcon} label="キャラクター" tags={byCat('character')} />
        <TagRow icon={PenTool} label="作者" tags={byCat('author')} />
        <TagRow icon={TagIcon} label="シリーズ" tags={byCat('series')} linkSuffix="&sort=series_asc" />
        <TagRow icon={Calendar} label="イベント" tags={byCat('event')} />
        <div className="flex gap-3 py-3 last:pb-0 text-xs">
          <div className="w-24 sm:w-28 shrink-0 flex items-center gap-1.5 font-bold text-stone-500">
            <Clock className="w-3.5 h-3.5 text-brand-500" />
            登録日
          </div>
          <div className="text-stone-600 font-mono">{book.created_at}</div>
        </div>
      </Panel>

      {hasPages && (
        <Panel as="div">
          <button
            onClick={() => setShowPageList(!showPageList)}
            className="w-full px-4 sm:px-5 py-3.5 font-bold text-sm text-stone-800 hover:bg-stone-50 flex items-center justify-between cursor-pointer transition"
          >
            <span className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-brand-50 text-brand-600">
                <Grid className="w-4 h-4" />
              </span>
              ページ一覧から開く（全 {book.page_count} ページ）
            </span>
            <ChevronDown className={`w-4 h-4 text-stone-400 transition ${showPageList ? 'rotate-180' : ''}`} />
          </button>
          {showPageList && (
            <div className="p-3 sm:p-4 border-t border-stone-100 grid grid-cols-4 sm:grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-2 sm:gap-3 max-h-[60vh] overflow-y-auto overscroll-contain">
              {Array.from({ length: book.page_count }, (_, idx) => idx + 1).map((pageNum) => (
                <Link
                  key={pageNum}
                  to={`/books/${book.id}/read?page=${pageNum}&direct=1`}
                  className="group rounded-lg border border-stone-200 hover:border-brand-400 bg-stone-50 flex flex-col items-center p-1 transition"
                >
                  <div className="aspect-[3/4] w-full bg-stone-200 rounded-md overflow-hidden">
                    <img
                      src={`/api/books/${book.id}/pages/${pageNum}`}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <span className="text-[10px] font-bold text-stone-500 group-hover:text-brand-600 pt-0.5">{pageNum}</span>
                </Link>
              ))}
            </div>
          )}
        </Panel>
      )}

      {book.series_books && book.series_books.length > 1 && (
        <Panel title="同じシリーズの作品" icon={TagIcon}>
          <BookTileGrid books={book.series_books} layout="row" />
        </Panel>
      )}

      {isAdmin && (
        <Panel as="div">
          <button
            onClick={() => setShowAdmin(!showAdmin)}
            className="w-full px-4 sm:px-5 py-3 font-bold text-xs text-stone-500 hover:bg-stone-50 flex items-center justify-between cursor-pointer transition"
          >
            <span className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" />
              管理者メニュー
            </span>
            <ChevronDown className={`w-4 h-4 transition ${showAdmin ? 'rotate-180' : ''}`} />
          </button>
          {showAdmin && (
            <div className="px-4 sm:px-5 pb-4 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <button
                onClick={() => handleAdminDelete('unorganize')}
                className="bg-white border border-stone-200 hover:bg-stone-50 text-stone-700 font-bold py-2.5 px-2 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                未整理へ戻す
              </button>
              <button
                onClick={() => handleAdminDelete('db_only')}
                className="bg-white border border-rose-200 hover:bg-rose-50 text-rose-700 font-bold py-2.5 px-2 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                DB登録を削除
              </button>
              <button
                onClick={() => handleAdminDelete('with_file')}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 px-2 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                ファイルごと削除
              </button>
            </div>
          )}
        </Panel>
      )}
    </>
  )
}

function ActionButtons({
  hasBookmark,
  progress,
  isFavorite,
  onStart,
  onResume,
  onFavorite,
  onRemoveBookmark,
}: {
  hasBookmark: boolean
  progress: string
  isFavorite: boolean
  onStart: () => void
  onResume: () => void
  onFavorite: () => void
  onRemoveBookmark: () => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {hasBookmark ? (
          <>
            <button
              onClick={onResume}
              className="flex-1 bg-brand-600 hover:bg-brand-700 text-white py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-bold text-sm shadow-xs transition cursor-pointer"
            >
              <Bookmark className="w-4 h-4 fill-white shrink-0" />
              <span className="truncate">続きから（{progress}）</span>
            </button>
            <button
              onClick={onStart}
              className="bg-stone-100 hover:bg-stone-200 text-stone-700 py-3 px-4 rounded-xl font-bold text-sm transition cursor-pointer whitespace-nowrap"
            >
              最初から
            </button>
          </>
        ) : (
          <button
            onClick={onStart}
            className="flex-1 bg-brand-600 hover:bg-brand-700 text-white py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-bold text-sm shadow-xs transition cursor-pointer"
          >
            <BookOpen className="w-4 h-4" />
            読む
          </button>
        )}
        <button
          onClick={onFavorite}
          aria-label={isFavorite ? 'お気に入りから外す' : 'お気に入りに追加'}
          title={isFavorite ? 'お気に入りから外す' : 'お気に入りに追加'}
          className={`px-3.5 rounded-xl flex items-center justify-center transition cursor-pointer border ${
            isFavorite ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-white border-stone-200 text-stone-400 hover:text-rose-500'
          }`}
        >
          <Heart className={`w-5 h-5 ${isFavorite ? 'fill-rose-500' : ''}`} />
        </button>
      </div>
      {hasBookmark && (
        <button
          onClick={onRemoveBookmark}
          className="text-xs font-bold text-stone-400 hover:text-rose-600 flex items-center gap-1 cursor-pointer"
        >
          <BookmarkX className="w-3.5 h-3.5" />
          しおりを外す
        </button>
      )}
    </div>
  )
}
