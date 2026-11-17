// frontend/src/components/ui.tsx
// 画面共通の小さな UI 部品（カード枠・見出し・空表示・モーダルなど）
import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type Tone = 'brand' | 'amber' | 'rose' | 'emerald' | 'stone'

const TONE_CLASSES: Record<Tone, string> = {
  brand: 'bg-brand-50 text-brand-600',
  amber: 'bg-amber-50 text-amber-600',
  rose: 'bg-rose-50 text-rose-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  stone: 'bg-stone-100 text-stone-600',
}

/** 角丸の白いカード。title を渡すとアイコン付きの見出し行を表示する */
export function Panel({
  title,
  icon: Icon,
  tone = 'brand',
  actions,
  children,
  className = '',
  bodyClassName = '',
  as: As = 'section',
}: {
  title?: ReactNode
  icon?: LucideIcon
  tone?: Tone
  actions?: ReactNode
  children?: ReactNode
  className?: string
  bodyClassName?: string
  as?: 'section' | 'div'
}) {
  return (
    <As className={`bg-white rounded-2xl border border-stone-200/80 shadow-2xs overflow-hidden ${className}`}>
      {title && (
        <div className="px-4 sm:px-5 py-3.5 border-b border-stone-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {Icon && (
              <span className={`p-2 rounded-xl shrink-0 ${TONE_CLASSES[tone]}`}>
                <Icon className="w-4 h-4" />
              </span>
            )}
            <h2 className="font-bold text-stone-800 text-sm sm:text-base truncate">{title}</h2>
          </div>
          {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </As>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="px-6 py-12 text-center text-sm text-stone-400">{children}</div>
}

export function Spinner({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <span
      className={`inline-block rounded-full border-2 border-current border-r-transparent animate-spin ${className}`}
      role="status"
      aria-label="読み込み中"
    />
  )
}

export function LoadingBlock({ label = '読み込み中...' }: { label?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-stone-200/80 p-10 flex items-center justify-center gap-3 text-sm text-stone-400">
      <Spinner className="w-4 h-4" />
      {label}
    </div>
  )
}

/** モーダル。スマホでは画面下からのシート、PC では中央ダイアログとして表示 */
export function Modal({
  open,
  title,
  onClose,
  children,
  className = '',
}: {
  open: boolean
  title?: ReactNode
  onClose: () => void
  children: ReactNode
  className?: string
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-stone-900/50 backdrop-blur-xs animate-fade-in" onClick={onClose} />
      <div
        className={`relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden animate-sheet-up pb-safe sm:pb-0 ${className}`}
      >
        {title && (
          <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
            <div className="font-bold text-stone-800 text-sm">{title}</div>
            <button
              onClick={onClose}
              className="p-1.5 -mr-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer"
              aria-label="閉じる"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

/** ボタン風のセグメント切替 */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = 'md',
  dark = false,
}: {
  value: T
  options: { value: T; label: ReactNode }[]
  onChange: (v: T) => void
  size?: 'sm' | 'md'
  dark?: boolean
}) {
  return (
    <div className={`inline-flex p-1 rounded-xl gap-1 ${dark ? 'bg-white/10' : 'bg-stone-100'}`}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`rounded-lg font-bold transition cursor-pointer whitespace-nowrap ${
              size === 'sm' ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'
            } ${
              active
                ? dark
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'bg-white text-brand-700 shadow-xs'
                : dark
                  ? 'text-stone-300 hover:text-white'
                  : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
