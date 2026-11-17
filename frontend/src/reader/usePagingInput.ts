// frontend/src/reader/usePagingInput.ts
// キーボード・スワイプ・画面タップによるページ送りを、綴じ方向に合わせて共通処理する
import { useCallback, useEffect, useRef } from 'react'
import type { PageDirection } from '../lib/types'

export interface PagingHandlers {
  next: () => void
  prev: () => void
  toggleChrome: () => void
}

/**
 * 画面上の「左側」「右側」をタップ／スワイプしたときに進むか戻るかを決める。
 * 右綴じ（rtl）の本は左へ進み、左綴じ（ltr）の本は右へ進む。
 */
export function sideAction(side: 'left' | 'right', direction: PageDirection): 'next' | 'prev' {
  if (direction === 'rtl') return side === 'left' ? 'next' : 'prev'
  return side === 'right' ? 'next' : 'prev'
}

export function useKeyboardPaging(direction: PageDirection, handlers: PagingHandlers, enabled = true) {
  const ref = useRef(handlers)
  ref.current = handlers

  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) return
      if (e.altKey || e.ctrlKey || e.metaKey) return
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault()
          ref.current[sideAction('left', direction)]()
          break
        case 'ArrowRight':
          e.preventDefault()
          ref.current[sideAction('right', direction)]()
          break
        case 'PageDown':
        case ' ':
          e.preventDefault()
          if (e.shiftKey && e.key === ' ') ref.current.prev()
          else ref.current.next()
          break
        case 'PageUp':
          e.preventDefault()
          ref.current.prev()
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [direction, enabled])
}

/**
 * ステージ要素に付けるポインタハンドラ。
 *  - 横スワイプ：ページ送り
 *  - 左右 30% のタップ：ページ送り
 *  - 中央のタップ：メニュー表示切替
 */
export function useTapAndSwipe(direction: PageDirection, handlers: PagingHandlers) {
  const ref = useRef(handlers)
  ref.current = handlers
  const start = useRef<{ x: number; y: number; t: number; id: number } | null>(null)
  const multiTouch = useRef(false)

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    if (!e.isPrimary) {
      multiTouch.current = true
      return
    }
    multiTouch.current = false
    start.current = { x: e.clientX, y: e.clientY, t: Date.now(), id: e.pointerId }
  }, [])

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const s = start.current
      start.current = null
      if (!s || s.id !== e.pointerId || multiTouch.current) return
      // ピンチズーム中（拡大表示中）はページ送りしない
      if (window.visualViewport && window.visualViewport.scale > 1.05) return
      const dx = e.clientX - s.x
      const dy = e.clientY - s.y
      const dt = Date.now() - s.t
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()

      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5 && dt < 800) {
        // 指を左へ払う＝画面右側から次の内容を引き出す操作 → 右側タップと同じ意味
        ref.current[sideAction(dx < 0 ? 'right' : 'left', direction)]()
        return
      }
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) return

      const x = (e.clientX - rect.left) / rect.width
      if (x < 0.3) ref.current[sideAction('left', direction)]()
      else if (x > 0.7) ref.current[sideAction('right', direction)]()
      else ref.current.toggleChrome()
    },
    [direction],
  )

  const onPointerCancel = useCallback(() => {
    start.current = null
  }, [])

  return { onPointerDown, onPointerUp, onPointerCancel }
}
