// frontend/src/pages/AdminUnorganizedPage.tsx
// 管理画面：未整理ファイルの本登録・登録済み作品の編集・タグ管理
// スマホ・タブレットでは「一覧 → 編集」の2画面切り替え、PC では左右2カラムで表示
import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import BookList from '../admin/BookList'
import BookEditor, { type DeleteMode } from '../admin/BookEditor'
import TagManager from '../admin/TagManager'
import type { AdminTab, BookAdminItem, TagItem } from '../admin/types'
import { Spinner } from '../components/ui'
import { apiGet, apiSend } from '../lib/api'

const TABS: { key: AdminTab; label: string }[] = [
  { key: 'unorganized', label: '未整理' },
  { key: 'organized', label: '登録済みを編集' },
  { key: 'tags', label: 'タグ管理' },
]

interface IsbnResult {
  title?: string
  author?: string
  pubdate?: string
  cover_saved?: boolean
}

export default function AdminUnorganizedPage() {
  const [tab, setTab] = useState<AdminTab>('unorganized')
  const [books, setBooks] = useState<BookAdminItem[]>([])
  const [allTags, setAllTags] = useState<TagItem[]>([])
  const [selectedBook, setSelectedBook] = useState<BookAdminItem | null>(null)
  // スマホで編集画面を開いているか
  const [mobileEditing, setMobileEditing] = useState(false)
  const [thumbBust, setThumbBust] = useState(Date.now())
  const [msg, setMsg] = useState('')
  const [scanning, setScanning] = useState(false)

  const loadData = useCallback(async () => {
    const status = tab === 'organized' ? 'organized' : 'unorganized'
    const [list, tags] = await Promise.all([
      apiGet<BookAdminItem[] | null>(`/api/admin/books?status=${status}`).catch(() => null),
      apiGet<TagItem[] | null>('/api/tags').catch(() => null),
    ])
    if (list) {
      setBooks(list)
      setSelectedBook((cur) => {
        if (list.length === 0) return null
        // 選択中の作品がリストに残っていればそのまま、なければ先頭を選択
        return cur && list.some((b) => b.id === cur.id) ? cur : list[0]
      })
    } else {
      setBooks([])
    }
    if (tags) setAllTags(tags)
  }, [tab])

  useEffect(() => {
    loadData()
    setMobileEditing(false)
  }, [loadData])

  const handleScan = async () => {
    setScanning(true)
    try {
      const data = await apiSend<{ added: number }>('POST', '/api/admin/scan')
      setMsg(`スキャン完了：新しいファイルを ${data.added} 件検知しました`)
      await loadData()
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'スキャンに失敗しました')
    } finally {
      setScanning(false)
    }
  }

  const handleIsbnLookup = async (isbn: string) => {
    if (!selectedBook) return
    setMsg('書誌情報を検索中...')
    try {
      const data = await apiGet<IsbnResult>(`/api/admin/metadata/isbn/${encodeURIComponent(isbn)}?book_id=${selectedBook.id}`)
      const updatedTags = [...selectedBook.tags]
      if (data.author && !updatedTags.some((t) => t.category === 'author' && t.name === data.author)) {
        updatedTags.push({ category: 'author', name: data.author, reading: '' })
      }
      setSelectedBook({
        ...selectedBook,
        title: data.title || selectedBook.title,
        sale_type: '商業誌',
        release_date: data.pubdate || selectedBook.release_date,
        tags: updatedTags,
      })
      if (data.cover_saved) setThumbBust(Date.now())
      setMsg('openBDから書誌情報を反映しました（保存ボタンで確定します）')
    } catch (err) {
      setMsg(err instanceof Error ? err.message : '書誌情報の取得に失敗しました')
    }
  }

  const handleCoverUpload = async (file: File) => {
    if (!selectedBook) return
    const formData = new FormData()
    formData.append('cover', file)
    try {
      await apiSend('POST', `/api/admin/books/${selectedBook.id}/cover`, formData)
      setThumbBust(Date.now())
      setMsg('サムネイル画像を更新しました')
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'サムネイルの更新に失敗しました')
    }
  }

  const handleSaveBook = async (book: BookAdminItem) => {
    try {
      await apiSend('PUT', `/api/admin/books/${book.id}`, book)
      setMsg(`「${book.title}」を登録・保存しました`)
      setMobileEditing(false)
      await loadData()
    } catch (err) {
      setMsg(err instanceof Error ? err.message : '保存に失敗しました')
    }
  }

  const handleDeleteBook = async (mode: DeleteMode) => {
    if (!selectedBook) return
    const confirmMessages: Record<DeleteMode, string> = {
      unorganize: `「${selectedBook.title}」を公開一覧から外し、未整理一覧へ戻しますか？`,
      db_only: `「${selectedBook.title}」のDB登録情報とサムネイルを削除しますか？\n（※booksフォルダ内に元ファイルが残っている場合、次回スキャン時に未整理として再検知されます）`,
      with_file: `【警告】「${selectedBook.title}」のDB情報だけでなく、booksフォルダ内の元ファイル（${selectedBook.file_path}）もディスクから完全に削除します。本当によろしいですか？`,
    }
    if (!confirm(confirmMessages[mode])) return
    try {
      const data = await apiSend<{ message: string }>('DELETE', `/api/admin/books/${selectedBook.id}?mode=${mode}`)
      setMsg(data?.message || '削除しました')
      setSelectedBook(null)
      setMobileEditing(false)
      await loadData()
    } catch (err) {
      setMsg(err instanceof Error ? err.message : '削除に失敗しました')
    }
  }

  return (
    <div className="space-y-4">
      {/* タブ＆スキャン */}
      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-2xs p-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 text-xs sm:text-sm font-bold overflow-x-auto scrollbar-none">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3.5 py-2 rounded-xl transition cursor-pointer whitespace-nowrap ${
                tab === t.key ? 'bg-brand-600 text-white shadow-2xs' : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button
          onClick={handleScan}
          disabled={scanning}
          className="bg-stone-900 hover:bg-brand-950 text-white font-bold px-3.5 py-2 rounded-xl text-xs sm:text-sm flex items-center gap-1.5 transition cursor-pointer disabled:opacity-70"
        >
          {scanning ? <Spinner className="w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
          フォルダをスキャン
        </button>
      </div>

      {msg && (
        <div className="bg-brand-50 border border-brand-200 text-brand-900 rounded-xl px-4 py-3 text-xs sm:text-sm font-bold flex items-start justify-between gap-3">
          <span>{msg}</span>
          <button onClick={() => setMsg('')} className="text-brand-400 hover:text-brand-700 cursor-pointer shrink-0" aria-label="閉じる">
            ×
          </button>
        </div>
      )}

      {tab === 'tags' ? (
        <TagManager allTags={allTags} onChanged={loadData} setMsg={setMsg} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-start">
          <div className={`lg:col-span-5 xl:col-span-4 ${mobileEditing ? 'hidden lg:block' : ''}`}>
            <BookList
              tab={tab}
              books={books}
              selectedId={selectedBook?.id ?? null}
              onSelect={(b) => {
                setSelectedBook(b)
                setMobileEditing(true)
              }}
              thumbBust={thumbBust}
            />
          </div>
          <div className={`lg:col-span-7 xl:col-span-8 ${mobileEditing ? '' : 'hidden lg:block'}`}>
            <button
              onClick={() => setMobileEditing(false)}
              className="lg:hidden mb-3 flex items-center gap-1.5 text-xs font-bold text-stone-600 bg-white border border-stone-200 px-3 py-2 rounded-xl cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              一覧へ戻る
            </button>
            <BookEditor
              key={selectedBook?.id ?? 0}
              tab={tab}
              selectedBook={selectedBook}
              setSelectedBook={setSelectedBook}
              allTags={allTags}
              thumbBust={thumbBust}
              onSave={handleSaveBook}
              onDelete={handleDeleteBook}
              onIsbnLookup={handleIsbnLookup}
              onCoverUpload={handleCoverUpload}
            />
          </div>
        </div>
      )}
    </div>
  )
}
