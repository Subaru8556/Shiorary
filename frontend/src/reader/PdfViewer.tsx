// frontend/src/reader/PdfViewer.tsx
// PDF はブラウザ内蔵のビューワーで表示する
// ※ iPhone/iPad の Safari は埋め込み表示で1ページ目しか出ないことがあるため「別タブで開く」を用意
import { useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { ReaderTopBar } from './ReaderChrome'
import { useBookmarkSync } from './useBookmarkSync'

interface Props {
  bookId: number
  title: string
  initialPage: number
  onBack: () => void
}

export default function PdfViewer({ bookId, title, initialPage, onBack }: Props) {
  const [page, setPage] = useState(Math.max(1, initialPage))
  const { save, finished } = useBookmarkSync(bookId)
  const fileUrl = `/api/books/${bookId}/file`

  return (
    <div className="fixed inset-0 bg-neutral-900 text-white flex flex-col">
      <div className="relative h-[calc(3.25rem+env(safe-area-inset-top))] shrink-0">
        <ReaderTopBar visible title={title} subtitle="PDF" onBack={onBack} />
      </div>
      <iframe src={`${fileUrl}#page=${initialPage}`} title={title} className="flex-1 w-full border-0 bg-white" />
      <div className="shrink-0 bg-stone-950 border-t border-white/5 pb-safe pl-safe pr-safe">
        <div className="min-h-14 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs font-bold">
          <label className="flex items-center gap-2">
            <span className="text-stone-400">しおり</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={page}
              onChange={(e) => {
                const p = Math.max(1, Number(e.target.value) || 1)
                setPage(p)
                save({ current_page: p, epub_cfi: '', is_finished: false })
              }}
              className="w-16 bg-stone-800 border border-stone-700 rounded-lg px-2 py-1 text-center"
            />
            <span className="text-stone-400">ページ目</span>
          </label>
          <div className="flex items-center gap-2">
            <a
              href={`${fileUrl}#page=${page}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 bg-stone-800 hover:bg-stone-700 px-3 py-1.5 rounded-lg"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              別タブで開く
            </a>
            <button
              onClick={() => save({ current_page: 1, epub_cfi: '', is_finished: true }, true)}
              className={`px-3 py-1.5 rounded-lg cursor-pointer ${finished ? 'bg-emerald-600' : 'bg-rose-600 hover:bg-rose-700'}`}
            >
              {finished ? '読了済み' : '読了（しおりを外す）'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
