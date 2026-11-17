// frontend/src/reader/textTheme.ts
// 文章系ビューワー（TXT・リフロー型EPUB）共通の配色

export type TextTheme = 'paper' | 'white' | 'dark'

export const TEXT_THEMES: Record<TextTheme, { label: string; bg: string; fg: string }> = {
  paper: { label: '和紙', bg: '#f8f3e6', fg: '#2b2620' },
  white: { label: '白', bg: '#ffffff', fg: '#1e293b' },
  dark: { label: '夜間', bg: '#15171c', fg: '#d6d3cb' },
}

export const FONT_SIZE_MIN = 12
export const FONT_SIZE_MAX = 36
