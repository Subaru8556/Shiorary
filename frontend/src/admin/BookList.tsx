// frontend/src/admin/BookList.tsx
// 管理画面：作品ファイル一覧（絞り込み・並び替え付き）
import { useMemo, useState } from 'react'
import { Filter, Search, X } from 'lucide-react'
import type { AdminTab, BookAdminItem } from './types'

export default function BookList({
  tab,
  books,
  selectedId,
  onSelect,
  thumbBust,
}: {
  tab: AdminTab
  books: BookAdminItem[]
  selectedId: number | null
  onSelect: (b: BookAdminItem) => void
  thumbBust: number
}) {
  const [filterText, setFilterText] = useState('')
  const [filterFileType, setFilterFileType] = useState<string>('all')
  const [filterSaleType, setFilterSaleType] = useState<string>('all')
  const [filterBookType, setFilterBookType] = useState<string>('all')
  const [sortOrder, setSortOrder] = useState<'id_desc' | 'id_asc' | 'title_asc'>('id_desc')

  const filteredBooks = useMemo(() => {
    const q = filterText.trim().toLowerCase()
    return books
      .filter((b) => {
        if (filterFileType !== 'all' && b.file_type !== filterFileType) return false
        if (filterSaleType !== 'all' && b.sale_type !== filterSaleType) return false
        if (filterBookType !== 'all' && b.book_type !== filterBookType) return false
        if (q) {
          const matchTitle = b.title.toLowerCase().includes(q)
          const matchPath = b.file_path.toLowerCase().includes(q)
          const matchTag = b.tags.some((t) => t.name.toLowerCase().includes(q) || t.reading.toLowerCase().includes(q))
          if (!matchTitle && !matchPath && !matchTag) return false
        }
        return true
      })
      .sort((a, b) => {
        if (sortOrder === 'id_asc') return a.id - b.id
        if (sortOrder === 'title_asc') return a.title.localeCompare(b.title, 'ja')
        return b.id - a.id
      })
  }, [books, filterText, filterFileType, filterSaleType, filterBookType, sortOrder])

  return (
    <div className="bg-white rounded-2xl border border-stone-200/80 shadow-2xs flex flex-col overflow-hidden">
      <div className="px-4 py-3.5 border-b border-stone-100 font-bold text-stone-800 text-sm flex items-center justify-between">
        <span>{tab === 'unorganized' ? '未整理ファイル' : '登録済み作品'}</span>
        <span className="text-xs bg-stone-100 text-stone-600 px-2.5 py-0.5 rounded-full">
          {filteredBooks.length} / {books.length} 件
        </span>
      </div>

      {/* リスト絞り込みパネル */}
      <div className="p-3.5 bg-stone-50/70 border-b border-stone-100 space-y-2 text-xs">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="タイトル・ファイル名・タグで絞り込み..."
            className="w-full border border-stone-200 rounded-xl bg-white pl-8 pr-7 py-1.5 focus:outline-none focus:border-brand-500 transition"
          />
          {filterText && (
            <button
              type="button"
              onClick={() => setFilterText('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <select
            value={filterFileType}
            onChange={(e) => setFilterFileType(e.target.value)}
            className="border border-stone-200 rounded-lg bg-white px-2 py-1.5 font-semibold text-stone-700"
          >
            <option value="all">全ファイル形式</option>
            <option value="zip">ZIP / CBZ</option>
            <option value="dir">画像フォルダ</option>
            <option value="pdf">PDF</option>
            <option value="epub">EPUB</option>
            <option value="txt">TXT</option>
          </select>

          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as 'id_desc' | 'id_asc' | 'title_asc')}
            className="border border-stone-200 rounded-lg bg-white px-2 py-1.5 font-semibold text-stone-700"
          >
            <option value="id_desc">追加順（新しい順）</option>
            <option value="id_asc">追加順（古い順）</option>
            <option value="title_asc">タイトル（五十音順）</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <select
            value={filterSaleType}
            onChange={(e) => setFilterSaleType(e.target.value)}
            className="border border-stone-200 rounded-lg bg-white px-2 py-1.5 font-semibold text-stone-700"
          >
            <option value="all">全販売区分</option>
            <option value="同人誌">同人誌のみ</option>
            <option value="商業誌">商業誌のみ</option>
          </select>

          <select
            value={filterBookType}
            onChange={(e) => setFilterBookType(e.target.value)}
            className="border border-stone-200 rounded-lg bg-white px-2 py-1.5 font-semibold text-stone-700"
          >
            <option value="all">全書籍区分</option>
            <option value="漫画">漫画のみ</option>
            <option value="小説">小説のみ</option>
            <option value="その他">その他のみ</option>
          </select>
        </div>

        {(filterText || filterFileType !== 'all' || filterSaleType !== 'all' || filterBookType !== 'all') && (
          <button
            type="button"
            onClick={() => {
              setFilterText('')
              setFilterFileType('all')
              setFilterSaleType('all')
              setFilterBookType('all')
            }}
            className="w-full text-center text-brand-600 hover:underline font-bold pt-1 cursor-pointer flex items-center justify-center gap-1"
          >
            <Filter className="w-3 h-3" />
            <span>絞り込み条件をクリア</span>
          </button>
        )}
      </div>

      {/* ファイルリスト本体 */}
      <div className="divide-y divide-stone-100 lg:max-h-[calc(100dvh-14rem)] overflow-y-auto">
        {filteredBooks.length === 0 && (
          <div className="p-8 text-center text-xs text-stone-400">
            条件に一致する作品がありません。
          </div>
        )}
        {filteredBooks.map((b) => (
          <button
            key={b.id}
            onClick={() => onSelect(b)}
            className={`w-full text-left p-3 flex gap-3 hover:bg-stone-50 transition cursor-pointer ${
              selectedId === b.id ? 'bg-brand-50/70 border-l-4 border-brand-600' : ''
            }`}
          >
            <img
              src={`/api/thumbnails/${b.id}?v=${thumbBust}`}
              alt=""
              onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
              className="w-12 h-16 object-cover rounded-lg bg-stone-100 shrink-0 border border-stone-200"
            />
            <div className="min-w-0 flex-1">
              <div className="font-bold text-xs text-stone-800 truncate">{b.title}</div>
              <div className="text-[11px] text-stone-400 truncate mt-0.5">{b.file_path}</div>
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className="text-[10px] bg-stone-100 border border-stone-200 rounded px-1.5 py-0.2 text-stone-600 uppercase font-mono">
                  {b.file_type}
                </span>
                <span className="text-[10px] text-stone-400">{b.page_count}P</span>
                <span className="text-[10px] text-brand-600 font-bold">{b.book_type}</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
