// frontend/src/reader/useBookmarkSync.ts
// 読書位置（しおり）をサーバーへ保存する。ページ送りのたびに送信しないよう間引き、
// 画面を閉じる・アプリを切り替えるときは確実に送信する。
import { useCallback, useEffect, useRef, useState } from 'react'

export interface BookmarkPayload {
  /** 画像系: 表示中の最終ページ / リフロー系: 進捗 % (1〜100) */
  current_page: number
  /** EPUB の CFI、TXT の位置比率など */
  epub_cfi: string
  is_finished: boolean
}

const DEBOUNCE_MS = 700

export function useBookmarkSync(bookId: number | null) {
  const pending = useRef<BookmarkPayload | null>(null)
  const timer = useRef<number | null>(null)
  const lastSent = useRef<string>('')
  const [finished, setFinished] = useState(false)

  const send = useCallback(
    (keepalive = false) => {
      if (timer.current) {
        window.clearTimeout(timer.current)
        timer.current = null
      }
      const payload = pending.current
      pending.current = null
      if (!payload || bookId === null) return
      const body = JSON.stringify(payload)
      if (body === lastSent.current) return
      lastSent.current = body
      fetch(`/api/books/${bookId}/bookmark`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive,
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) setFinished(Boolean(data.cleaned))
        })
        .catch(() => {
          // 通信失敗時は次回の送信で再試行できるよう記録を戻す
          lastSent.current = ''
        })
    },
    [bookId],
  )

  /** 位置を記録（間引いて送信）。immediate=true で即時送信 */
  const save = useCallback(
    (payload: BookmarkPayload, immediate = false) => {
      pending.current = payload
      if (immediate) {
        send()
        return
      }
      if (timer.current) window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => send(), DEBOUNCE_MS)
    },
    [send],
  )

  useEffect(() => {
    const flush = () => send(true)
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onVisibility)
      flush()
    }
  }, [send])

  return { save, finished }
}
