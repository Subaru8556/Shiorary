// frontend/src/reader/ReaderChrome.tsx
// ビューワー上下のメニュー（タイトル・戻る・設定・ページスライダー）
import type { ReactNode } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight, Settings2, X } from 'lucide-react'
import type { PageDirection } from '../lib/types'

export function ReaderTopBar({
  visible,
  title,
  subtitle,
  onBack,
  onOpenSettings,
}: {
  visible: boolean
  title: string
  subtitle?: string
  onBack: () => void
  onOpenSettings?: () => void
}) {
  return (
    <header
      className={`absolute top-0 inset-x-0 z-30 bg-stone-950/85 backdrop-blur-md text-white border-b border-white/5 pt-safe pl-safe pr-safe transition-transform duration-200 ${
        visible ? 'translate-y-0' : '-translate-y-full pointer-events-none'
      }`}
    >
      <div className="h-13 px-2 flex items-center gap-1">
        <button
          onClick={onBack}
          className="p-2.5 rounded-xl hover:bg-white/10 cursor-pointer shrink-0"
          aria-label="作品ページへ戻る"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="min-w-0 flex-1 px-1">
          <div className="text-sm font-bold truncate">{title}</div>
          {subtitle && <div className="text-[11px] text-stone-400 truncate">{subtitle}</div>}
        </div>
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="p-2.5 rounded-xl hover:bg-white/10 cursor-pointer shrink-0"
            aria-label="表示設定"
          >
            <Settings2 className="w-5 h-5" />
          </button>
        )}
      </div>
    </header>
  )
}

/** 下部のページ移動バー。右綴じの本はスライダーも右から左へ進む */
export function ReaderBottomBar({
  visible,
  direction,
  value,
  max,
  label,
  onChange,
  onNext,
  onPrev,
  disabled = false,
  children,
}: {
  visible: boolean
  direction: PageDirection
  value: number
  max: number
  label: ReactNode
  onChange: (v: number) => void
  onNext: () => void
  onPrev: () => void
  disabled?: boolean
  children?: ReactNode
}) {
  const rtl = direction === 'rtl'
  // 画面左側のボタン：rtl なら「次へ」、ltr なら「前へ」
  const leftAction = rtl ? onNext : onPrev
  const rightAction = rtl ? onPrev : onNext
  return (
    <footer
      className={`absolute bottom-0 inset-x-0 z-30 bg-stone-950/85 backdrop-blur-md text-white border-t border-white/5 pb-safe pl-safe pr-safe transition-transform duration-200 ${
        visible ? 'translate-y-0' : 'translate-y-full pointer-events-none'
      }`}
    >
      {children}
      <div className="h-14 px-2 sm:px-3 flex items-center gap-2 sm:gap-3">
        <button
          onClick={leftAction}
          className="p-2 rounded-xl hover:bg-white/10 cursor-pointer shrink-0"
          aria-label={rtl ? '次のページ' : '前のページ'}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <input
          type="range"
          min={1}
          max={Math.max(1, max)}
          value={Math.min(value, Math.max(1, max))}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          dir={rtl ? 'rtl' : 'ltr'}
          className="flex-1 min-w-0 accent-brand-400 cursor-pointer disabled:opacity-40 h-8"
          aria-label="ページ位置"
        />
        <button
          onClick={rightAction}
          className="p-2 rounded-xl hover:bg-white/10 cursor-pointer shrink-0"
          aria-label={rtl ? '前のページ' : '次のページ'}
        >
          <ChevronRight className="w-5 h-5" />
        </button>
        <span className="min-w-[4.5rem] text-right text-xs font-bold text-stone-300 tabular-nums shrink-0 pr-1">
          {label}
        </span>
      </div>
    </footer>
  )
}

/** 表示設定パネル（スマホは下からのシート、PC は右上のパネル） */
export function ReaderSettingsSheet({
  open,
  onClose,
  title = '表示設定',
  children,
}: {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}) {
  if (!open) return null
  return (
    <div className="absolute inset-0 z-40" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="absolute bottom-0 inset-x-0 sm:bottom-auto sm:left-auto sm:top-[calc(env(safe-area-inset-top)+3.75rem)] sm:right-3 sm:w-80 max-h-[75dvh] overflow-y-auto bg-stone-900/95 backdrop-blur-md text-white rounded-t-3xl sm:rounded-2xl border border-white/10 shadow-2xl pb-safe sm:pb-0 animate-sheet-up"
      >
        <div className="sticky top-0 bg-stone-900/95 px-5 py-3.5 flex items-center justify-between border-b border-white/10">
          <span className="text-sm font-bold">{title}</span>
          <button onClick={onClose} className="p-1.5 -mr-1.5 rounded-lg hover:bg-white/10 cursor-pointer" aria-label="閉じる">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-5 text-xs">{children}</div>
      </div>
    </div>
  )
}

export function SettingRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="font-bold text-stone-400">{label}</div>
      <div>{children}</div>
    </div>
  )
}

/** 読了してしおりが外れたときのトースト */
export function FinishedToast({ show }: { show: boolean }) {
  if (!show) return null
  return (
    <div className="absolute left-1/2 -translate-x-1/2 bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-30 bg-emerald-600 text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg animate-fade-in pointer-events-none">
      最後まで読みました（しおりを外しました）
    </div>
  )
}
