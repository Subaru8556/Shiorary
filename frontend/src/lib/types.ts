// frontend/src/lib/types.ts
// API レスポンスの型定義（複数画面で共有）

export type FileType = 'zip' | 'dir' | 'pdf' | 'epub' | 'txt'
export type PageDirection = 'rtl' | 'ltr'
export type ScrollPref = 'horizontal' | 'vertical'

export type TagCategory = 'parody' | 'character' | 'author' | 'series' | 'event'

export interface Tag {
  id: number
  category: TagCategory | string
  name: string
  reading: string
  count?: number
}

export interface BookCard {
  id: number
  title: string
  file_type: FileType | string
  page_count: number
  sale_type: string
  book_type: string
  page_direction: string
  release_date: string
  series_number: number | null
  parody_name: string
  author_name: string
  bookmark_page: number
  is_favorite: boolean
}

export interface BookDetail {
  id: number
  title: string
  file_type: FileType
  page_count: number
  sale_type: string
  book_type: string
  page_direction: PageDirection
  release_date: string
  series_number: number | null
  created_at: string
  updated_at: string
  bookmark_page: number
  epub_cfi: string
  is_favorite: boolean
  tags: Tag[]
  series_books: BookCard[]
}

export const CATEGORY_LABELS: Record<string, string> = {
  parody: '原作',
  character: 'キャラ',
  author: '作者',
  series: 'シリーズ',
  event: 'イベント',
}

export const CATEGORY_LONG_LABELS: Record<string, string> = {
  parody: '原作',
  character: 'キャラクター',
  author: '作者（サークル・著者）',
  series: 'シリーズ',
  event: '頒布イベント',
}

/**
 * 進捗を「%」で記録する形式か（リフロー型 EPUB・TXT はページ数が画面サイズで変わるため）
 * ページ数が確定している（画像型 EPUB など）場合はページ番号で記録する
 */
export function isPercentProgress(fileType: string, pageCount: number): boolean {
  return (fileType === 'epub' || fileType === 'txt') && pageCount === 0
}

export function formatProgress(fileType: string, bookmarkPage: number, pageCount: number): string {
  if (isPercentProgress(fileType, pageCount)) return `${bookmarkPage}%`
  return pageCount > 0 ? `${bookmarkPage} / ${pageCount}P` : `${bookmarkPage}P`
}
