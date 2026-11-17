// frontend/src/pages/ReaderPage.tsx
// ビューワー画面。作品の形式に応じて各ビューワーへ振り分ける
//  - ZIP/CBZ・画像フォルダ・漫画EPUB → ImageViewer
//  - 文章EPUB                         → EpubViewer (epub.js)
//  - TXT                              → TextViewer
//  - PDF                              → PdfViewer
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { apiGet } from '../lib/api'
import type { BookDetail, PageDirection, ScrollPref } from '../lib/types'
import { Spinner } from '../components/ui'
import ImageViewer from '../reader/ImageViewer'
import EpubViewer from '../reader/EpubViewer'
import TextViewer from '../reader/TextViewer'
import PdfViewer from '../reader/PdfViewer'

interface EpubInfo {
  mode: 'image' | 'reflow'
  page_count: number
  direction: PageDirection
  fixed_layout: boolean
}

type Loaded =
  | { kind: 'image'; book: BookDetail; pageCount: number; direction: PageDirection; pageUrl: (p: number) => string }
  | { kind: 'epub'; book: BookDetail; direction: PageDirection }
  | { kind: 'txt'; book: BookDetail; text: string }
  | { kind: 'pdf'; book: BookDetail }

function parseRatio(v: string): number {
  if (!v.startsWith('ratio:')) return 0
  const n = Number(v.slice(6))
  return Number.isFinite(n) ? n : 0
}

export default function ReaderPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [error, setError] = useState('')

  const pageParam = Number(searchParams.get('page')) || 0
  // 「最初から読む」以外（しおりから再開・URL 直接アクセス）はしおり位置から開く
  const resume = searchParams.get('resume') === '1' || !searchParams.get('page')

  useEffect(() => {
    let cancelled = false
    setLoaded(null)
    setError('')
    const load = async () => {
      try {
        const book = await apiGet<BookDetail>(`/api/books/${id}`)
        const pageUrl = (p: number) => `/api/books/${book.id}/pages/${p}`
        let result: Loaded
        switch (book.file_type) {
          case 'zip':
          case 'dir':
            result = { kind: 'image', book, pageCount: book.page_count, direction: book.page_direction, pageUrl }
            break
          case 'epub': {
            const info = await apiGet<EpubInfo>(`/api/books/${book.id}/epub`)
            result =
              info.mode === 'image'
                ? { kind: 'image', book, pageCount: info.page_count, direction: info.direction || book.page_direction, pageUrl }
                : { kind: 'epub', book, direction: info.direction || book.page_direction }
            break
          }
          case 'txt': {
            const res = await fetch(`/api/books/${book.id}/file`)
            if (!res.ok) throw new Error(`テキストの取得に失敗しました (${res.status})`)
            result = { kind: 'txt', book, text: await res.text() }
            break
          }
          default:
            result = { kind: 'pdf', book }
        }
        if (!cancelled) setLoaded(result)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : '読み込みに失敗しました')
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [id])

  const onBack = useCallback(() => {
    // アプリ内から開いた場合は履歴を戻る。URL 直接・PWA 起動直後は作品ページへ
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (idx > 0) navigate(-1)
    else navigate(`/books/${id}`, { replace: true })
  }, [navigate, id])

  if (error) {
    return (
      <div className="fixed inset-0 bg-neutral-950 text-white flex flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="text-sm font-bold text-rose-400">{error}</div>
        <button onClick={onBack} className="flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 cursor-pointer">
          <ArrowLeft className="w-4 h-4" /> 戻る
        </button>
      </div>
    )
  }

  if (!loaded) {
    return (
      <div className="fixed inset-0 bg-neutral-950 text-stone-400 flex items-center justify-center gap-3 text-sm">
        <Spinner className="w-5 h-5" />
        読み込み中...
      </div>
    )
  }

  const { book } = loaded
  const pref = (key: 'pref_image_scroll' | 'pref_epub_scroll' | 'pref_txt_scroll'): ScrollPref => user?.[key] || 'horizontal'

  switch (loaded.kind) {
    case 'image':
      return (
        <ImageViewer
          bookId={book.id}
          title={book.title}
          pageCount={loaded.pageCount}
          initialPage={pageParam && !searchParams.get('resume') ? pageParam : book.bookmark_page || pageParam || 1}
          initialDirection={loaded.direction}
          initialScroll={pref('pref_image_scroll')}
          pageUrl={loaded.pageUrl}
          onBack={onBack}
        />
      )
    case 'epub':
      return (
        <EpubViewer
          bookId={book.id}
          title={book.title}
          initialCfi={resume && !book.epub_cfi.startsWith('ratio:') ? book.epub_cfi : ''}
          initialScroll={pref('pref_epub_scroll')}
          fallbackDirection={loaded.direction}
          onBack={onBack}
        />
      )
    case 'txt':
      return (
        <TextViewer
          bookId={book.id}
          title={book.title}
          text={loaded.text}
          initialRatio={resume ? parseRatio(book.epub_cfi) : 0}
          initialWritingMode={book.page_direction === 'ltr' ? 'horizontal-tb' : 'vertical-rl'}
          initialScroll={pref('pref_txt_scroll')}
          onBack={onBack}
        />
      )
    case 'pdf':
      return (
        <PdfViewer
          bookId={book.id}
          title={book.title}
          initialPage={pageParam && !searchParams.get('resume') ? pageParam : book.bookmark_page || pageParam || 1}
          onBack={onBack}
        />
      )
  }
}
