// frontend/src/admin/BookEditor.tsx
// 管理画面：作品情報の編集フォーム（ISBN参照・表紙変更・タグ・削除）
import { useState } from 'react'
import { FolderPlus, RotateCcw, Search, Trash2, Upload } from 'lucide-react'
import TagCategoryInput from './TagCategoryInput'
import { CATEGORIES, type AdminTab, type BookAdminItem, type TagItem } from './types'

export type DeleteMode = 'unorganize' | 'db_only' | 'with_file'

export default function BookEditor({
  tab,
  selectedBook,
  setSelectedBook,
  allTags,
  thumbBust,
  onSave,
  onDelete,
  onIsbnLookup,
  onCoverUpload,
}: {
  tab: AdminTab
  selectedBook: BookAdminItem | null
  setSelectedBook: (b: BookAdminItem) => void
  allTags: TagItem[]
  thumbBust: number
  onSave: (b: BookAdminItem) => void
  onDelete: (mode: DeleteMode) => void
  onIsbnLookup: (isbn: string) => void
  onCoverUpload: (file: File) => void
}) {
  const [isbnInput, setIsbnInput] = useState('')

  const handleSaveBook = (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedBook) onSave(selectedBook)
  }
  const handleIsbnLookup = () => {
    if (isbnInput.trim()) onIsbnLookup(isbnInput.trim())
  }
  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onCoverUpload(file)
  }
  const handleDeleteBook = onDelete

  return (
    <div className="bg-white rounded-2xl border border-stone-200/80 shadow-2xs overflow-hidden">
      <div className="px-5 py-4 border-b border-stone-100 flex items-center gap-2.5 font-bold text-stone-800 text-sm">
        <span className="p-2 rounded-xl bg-brand-50 text-brand-600">
          <FolderPlus className="w-4 h-4" />
        </span>
        <span>作品情報の編集・本登録</span>
      </div>
      {!selectedBook ? (
        <div className="p-10 text-center text-sm text-stone-400">
          左のリストから編集するファイルを選択してください。
        </div>
      ) : (
        <form onSubmit={handleSaveBook} className="p-4 sm:p-5 space-y-5 text-sm">
          {/* 商業誌向けISBN情報参照バー */}
          <div className="bg-stone-50/80 rounded-xl border border-stone-200/80 p-3.5 flex flex-wrap items-center gap-2.5">
            <span className="text-xs font-bold text-stone-600">商業誌ISBN自動入力 (openBD):</span>
            <input
              type="text"
              value={isbnInput}
              onChange={(e) => setIsbnInput(e.target.value)}
              placeholder="例: 978404..."
              className="border border-stone-200 rounded-xl bg-white px-3 py-1.5 text-xs flex-1 min-w-36 sm:flex-none sm:w-48 focus:outline-none focus:border-brand-500"
            />
            <button
              type="button"
              onClick={handleIsbnLookup}
              className="bg-brand-600 hover:bg-brand-700 text-white font-bold px-3.5 py-1.5 rounded-xl text-xs flex items-center gap-1 transition cursor-pointer"
            >
              <Search className="w-3.5 h-3.5" />
              <span>情報参照</span>
            </button>
          </div>

          {/* サムネイルプレビュー＆基本属性 */}
          <div className="flex flex-col sm:flex-row gap-5">
            <div className="w-32 sm:w-36 shrink-0 space-y-2 mx-auto sm:mx-0">
              <div className="aspect-[3/4] rounded-xl bg-stone-100 border border-stone-200 flex items-center justify-center overflow-hidden">
                <img
                  src={`/api/thumbnails/${selectedBook.id}?type=orig&v=${thumbBust}`}
                  alt="サムネイル"
                  className="w-full h-full object-cover"
                  onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
                />
              </div>
              <label className="block w-full bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-center py-2 text-xs font-bold transition cursor-pointer">
                <Upload className="w-3.5 h-3.5 inline mr-1" />
                表紙画像を変更
                <input type="file" accept="image/*" onChange={handleCoverUpload} className="hidden" />
              </label>
            </div>

            <div className="flex-1 space-y-3.5">
              <div>
                <label className="block font-bold text-xs text-stone-600 mb-1">作品タイトル</label>
                <input
                  type="text"
                  value={selectedBook.title}
                  onChange={(e) => setSelectedBook({ ...selectedBook, title: e.target.value })}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2 font-bold focus:outline-none focus:bg-white focus:border-brand-500 transition"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-xs text-stone-600 mb-1">販売区分</label>
                  <select
                    value={selectedBook.sale_type}
                    onChange={(e) => setSelectedBook({ ...selectedBook, sale_type: e.target.value as '同人誌' | '商業誌' })}
                    className="w-full border border-stone-200 rounded-xl px-2.5 py-2 font-bold bg-stone-50 text-xs"
                  >
                    <option value="同人誌">同人誌</option>
                    <option value="商業誌">商業誌</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-xs text-stone-600 mb-1">書籍区分</label>
                  <select
                    value={selectedBook.book_type}
                    onChange={(e) => setSelectedBook({ ...selectedBook, book_type: e.target.value as '漫画' | '小説' | 'その他' })}
                    className="w-full border border-stone-200 rounded-xl px-2.5 py-2 font-bold bg-stone-50 text-xs"
                  >
                    <option value="漫画">漫画</option>
                    <option value="小説">小説</option>
                    <option value="その他">その他</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-xs text-stone-600 mb-1">綴じ方向</label>
                  <select
                    value={selectedBook.page_direction}
                    onChange={(e) => setSelectedBook({ ...selectedBook, page_direction: e.target.value as 'rtl' | 'ltr' })}
                    className="w-full border border-stone-200 rounded-xl px-2.5 py-2 font-bold bg-stone-50 text-xs"
                  >
                    <option value="rtl">右綴じ（漫画・縦書）</option>
                    <option value="ltr">左綴じ（横書等）</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-xs text-stone-600 mb-1">発行日・頒布日</label>
                  <input
                    type="text"
                    value={selectedBook.release_date}
                    onChange={(e) => setSelectedBook({ ...selectedBook, release_date: e.target.value })}
                    placeholder="例: 2026-08-15"
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:bg-white focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-xs text-stone-600 mb-1">シリーズ内連番（巻数）</label>
                  <input
                    type="number"
                    step="0.1"
                    value={selectedBook.series_number ?? ''}
                    onChange={(e) =>
                      setSelectedBook({
                        ...selectedBook,
                        series_number: e.target.value === '' ? null : parseFloat(e.target.value),
                      })
                    }
                    placeholder="例: 1, 2, 1.5"
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:bg-white focus:border-brand-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* カテゴリ別タグ入力 */}
          <div className="space-y-3">
            {CATEGORIES.map((cat) => (
              <TagCategoryInput
                key={cat.key}
                category={cat.key}
                label={cat.label}
                selectedTags={selectedBook.tags.filter((t) => t.category === cat.key)}
                allCategoryTags={allTags.filter((t) => t.category === cat.key)}
                onAdd={(newTag) => {
                  if (selectedBook.tags.some((t) => t.category === cat.key && t.name === newTag.name)) return
                  setSelectedBook({ ...selectedBook, tags: [...selectedBook.tags, newTag] })
                }}
                onRemove={(name) =>
                  setSelectedBook({
                    ...selectedBook,
                    tags: selectedBook.tags.filter((t) => !(t.category === cat.key && t.name === name)),
                  })
                }
              />
            ))}
          </div>

          <button
            type="submit"
            className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 rounded-xl text-sm shadow-xs transition cursor-pointer"
          >
            この内容で作品を本登録・保存する
          </button>

          {/* 作品の登録解除・削除メニュー */}
          <div className="border-t border-stone-100 pt-4 mt-4 flex flex-wrap items-center justify-end gap-2 text-xs">
            {tab === 'organized' && (
              <button
                type="button"
                onClick={() => handleDeleteBook('unorganize')}
                className="border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 font-bold px-3.5 py-2 rounded-xl flex items-center gap-1 transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>未整理一覧へ戻す</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => handleDeleteBook('db_only')}
              className="border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold px-3.5 py-2 rounded-xl flex items-center gap-1 transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>DB登録のみ削除</span>
            </button>
            <button
              type="button"
              onClick={() => handleDeleteBook('with_file')}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-3.5 py-2 rounded-xl flex items-center gap-1 transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>元ファイルごと完全削除</span>
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
