// frontend/src/components/BookTileGrid.tsx
// 作品タイル一覧。画面幅に応じて列数が自動で変わる（auto-fill グリッド）
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Bookmark, BookOpen, Heart } from 'lucide-react'
import { formatProgress, type BookCard } from '../lib/types'
import { EmptyState } from './ui'

export type { BookCard }

function BookTile({ book, compact = false }: { book: BookCard; compact?: boolean }) {
  const [imgFailed, setImgFailed] = useState(false)

  return (
    <Link
      to={`/books/${book.id}`}
      className="group flex flex-col rounded-xl bg-white transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
    >
      <div className="relative aspect-[3/4] bg-stone-100 rounded-xl overflow-hidden ring-1 ring-stone-200/80 group-hover:ring-brand-300 group-hover:shadow-lg group-hover:-translate-y-0.5 transition-all duration-200">
        {imgFailed ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-3 text-center bg-gradient-to-br from-stone-100 to-stone-200">
            <BookOpen className="w-6 h-6 text-stone-400" />
            <span className="text-[11px] font-bold text-stone-500 line-clamp-4 leading-snug">{book.title}</span>
          </div>
        ) : (
          <img
            src={`/api/thumbnails/${book.id}`}
            alt=""
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover"
            onError={() => setImgFailed(true)}
          />
        )}

        <span
          className={`absolute top-1.5 left-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md text-white shadow-xs ${
            book.sale_type === '商業誌' ? 'bg-brand-600/90' : 'bg-stone-800/85'
          }`}
        >
          {book.sale_type}
        </span>

        {book.is_favorite && (
          <span className="absolute top-1.5 right-1.5 bg-white/95 p-1 rounded-full text-rose-500 shadow-xs">
            <Heart className="w-3 h-3 fill-rose-500" />
          </span>
        )}

        {book.bookmark_page > 0 && (
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/75 to-transparent pt-5 pb-1.5 px-2 text-white text-[10px] font-bold flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Bookmark className="w-3 h-3 fill-amber-400 text-amber-400" />
              読書中
            </span>
            <span>{formatProgress(book.file_type, book.bookmark_page, book.page_count)}</span>
          </div>
        )}
      </div>

      <div className={`pt-2 px-0.5 ${compact ? 'space-y-0.5' : 'space-y-1'}`}>
        <div className="text-xs font-bold text-stone-800 group-hover:text-brand-600 line-clamp-2 leading-snug transition-colors">
          {book.series_number !== null && <span className="text-brand-600 mr-1">[{book.series_number}巻]</span>}
          {book.title}
        </div>
        {!compact && (
          <div className="text-[11px] text-stone-500 truncate">
            {book.parody_name || book.author_name || book.book_type}
          </div>
        )}
      </div>
    </Link>
  )
}

export default function BookTileGrid({
  books,
  emptyMessage = '該当する作品がありません。',
  layout = 'grid',
}: {
  books: BookCard[]
  emptyMessage?: string
  /** row: 横スクロールの1列表示（ホームの「読書中」など） */
  layout?: 'grid' | 'row'
}) {
  if (!books || books.length === 0) {
    return <EmptyState>{emptyMessage}</EmptyState>
  }

  if (layout === 'row') {
    return (
      <div className="flex gap-3 overflow-x-auto scrollbar-none snap-x snap-mandatory px-4 py-4 sm:px-5">
        {books.map((book) => (
          <div key={book.id} className="w-28 sm:w-32 shrink-0 snap-start">
            <BookTile book={book} compact />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-x-3 gap-y-5 sm:gap-x-4 p-4 sm:p-5">
      {books.map((book) => (
        <BookTile key={book.id} book={book} />
      ))}
    </div>
  )
}
