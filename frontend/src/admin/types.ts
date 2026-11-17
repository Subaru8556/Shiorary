// frontend/src/admin/types.ts
export interface TagItem {
  id?: number
  category: string
  name: string
  reading: string
  count?: number
}

export interface BookAdminItem {
  id: number
  title: string
  file_path: string
  file_type: string
  page_count: number
  sale_type: '同人誌' | '商業誌'
  book_type: '漫画' | '小説' | 'その他'
  page_direction: 'rtl' | 'ltr'
  release_date: string
  series_number: number | null
  tags: TagItem[]
}

export type AdminTab = 'unorganized' | 'organized' | 'tags'

export const CATEGORIES = [
  { key: 'parody', label: '原作タグ' },
  { key: 'character', label: 'キャラクタータグ' },
  { key: 'author', label: '作者（著者/サークル）タグ' },
  { key: 'series', label: 'シリーズタグ' },
  { key: 'event', label: '頒布イベントタグ' },
]
