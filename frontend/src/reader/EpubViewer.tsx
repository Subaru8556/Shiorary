// frontend/src/reader/EpubViewer.tsx
// 文章主体（リフロー型）EPUB のビューワー（epub.js）
//  ※ 漫画などの固定レイアウト EPUB はサーバー側で画像に分解し ImageViewer で表示する
import { useCallback, useEffect, useRef, useState } from 'react'
import ePub from 'epubjs'
import type { Book as EpubBook, Rendition, NavItem } from 'epubjs'
import { List } from 'lucide-react'
import { loadPref, savePref } from '../lib/storage'
import type { PageDirection, ScrollPref } from '../lib/types'
import { Segmented, Spinner } from '../components/ui'
import { FinishedToast, ReaderBottomBar, ReaderSettingsSheet, ReaderTopBar, SettingRow } from './ReaderChrome'
import { TEXT_THEMES, type TextTheme } from './textTheme'
import { TextSettings } from './TextViewer'
import { useBookmarkSync } from './useBookmarkSync'
import { sideAction, useKeyboardPaging } from './usePagingInput'

interface Props {
  bookId: number
  title: string
  initialCfi: string
  initialScroll: ScrollPref
  fallbackDirection: PageDirection
  onBack: () => void
}

interface RelocatedLocation {
  start: { cfi: string; percentage: number; displayed?: { page: number; total: number } }
  atStart?: boolean
  atEnd?: boolean
}

const LOCATIONS_CHARS = 1200

export default function EpubViewer({ bookId, title, initialCfi, initialScroll, fallbackDirection, onBack }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const bookRef = useRef<EpubBook | null>(null)
  const renditionRef = useRef<Rendition | null>(null)
  const cfiRef = useRef(initialCfi)
  const navigatedRef = useRef(false)

  const [scrollMode, setScrollMode] = useState<ScrollPref>(initialScroll)
  const [fontSize, setFontSize] = useState<number>(() => loadPref('epub.fontSize', 18))
  const [theme, setTheme] = useState<TextTheme>(() => loadPref('text.theme', 'paper'))
  const [direction, setDirection] = useState<PageDirection>(fallbackDirection)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState('')
  const [chrome, setChrome] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [tocOpen, setTocOpen] = useState(false)
  const [toc, setToc] = useState<NavItem[]>([])
  const [percent, setPercent] = useState(0)
  const [locationsReady, setLocationsReady] = useState(false)
  const { save, finished } = useBookmarkSync(bookId)

  useEffect(() => savePref('epub.fontSize', fontSize), [fontSize])
  useEffect(() => savePref('text.theme', theme), [theme])

  // 最新の値をイベントハンドラから参照するための Ref
  const latest = useRef({ direction, settingsOpen })
  latest.current = { direction, settingsOpen }

  const next = useCallback(() => {
    navigatedRef.current = true
    renditionRef.current?.next()
    setChrome(false)
  }, [])
  const prev = useCallback(() => {
    navigatedRef.current = true
    renditionRef.current?.prev()
    setChrome(false)
  }, [])
  const toggleChrome = useCallback(() => setChrome((v) => !v), [])
  useKeyboardPaging(direction, { next, prev, toggleChrome }, !settingsOpen && !tocOpen)

  // 1. EPUB の読み込みと描画（表示方式が変わったときだけ作り直す）
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let destroyed = false
    let book: EpubBook | null = null
    setStatus('loading')
    setError('')

    const init = async () => {
      try {
        const res = await fetch(`/api/books/${bookId}/file`)
        if (!res.ok) throw new Error(`EPUBファイルの取得に失敗しました (${res.status})`)
        const buffer = await res.arrayBuffer()
        if (destroyed) return

        // ArrayBuffer で渡す（URL で渡すと拡張子がないためフォルダ形式と誤認される）
        book = ePub(buffer)
        bookRef.current = book
        await book.ready
        if (destroyed) return

        const pkgDir = (book.packaging as unknown as { metadata?: { direction?: string } })?.metadata?.direction
        const dir: PageDirection = pkgDir === 'rtl' ? 'rtl' : pkgDir === 'ltr' ? 'ltr' : fallbackDirection
        setDirection(dir)
        setToc(book.navigation?.toc || [])

        container.innerHTML = ''
        const rendition = book.renderTo(container, {
          width: '100%',
          height: '100%',
          flow: scrollMode === 'vertical' ? 'scrolled' : 'paginated',
          manager: scrollMode === 'vertical' ? 'continuous' : 'default',
          spread: 'auto',
          minSpreadWidth: 900,
          allowScriptedContent: false,
        })
        renditionRef.current = rendition

        Object.entries(TEXT_THEMES).forEach(([key, t]) => {
          rendition.themes.register(key, {
            body: { background: `${t.bg} !important`, color: `${t.fg} !important` },
            'a, a:visited': { color: 'inherit !important' },
            img: { 'max-width': '100% !important' },
          })
        })
        rendition.themes.select(loadPref<TextTheme>('text.theme', 'paper'))
        rendition.themes.fontSize(`${loadPref('epub.fontSize', 18)}px`)

        rendition.on('relocated', (loc: RelocatedLocation) => {
          const cfi = loc?.start?.cfi
          if (!cfi) return
          cfiRef.current = cfi
          const pct = book && book.locations.length() > 0 ? book.locations.percentageFromCfi(cfi) : loc.start.percentage || 0
          setPercent(Math.round(pct * 1000) / 10)
          save({
            current_page: Math.max(1, Math.round(pct * 100)),
            epub_cfi: cfi,
            is_finished: Boolean(loc.atEnd) && navigatedRef.current,
          })
        })

        // 本文（iframe 内）でのタップ・スワイプ・キー操作
        let touchStart: { x: number; y: number; t: number } | null = null
        rendition.on('touchstart', (e: TouchEvent) => {
          const t = e.changedTouches[0]
          touchStart = { x: t.screenX, y: t.screenY, t: Date.now() }
        })
        rendition.on('touchend', (e: TouchEvent) => {
          const s = touchStart
          touchStart = null
          if (!s || scrollMode === 'vertical') return
          const t = e.changedTouches[0]
          const dx = t.screenX - s.x
          const dy = t.screenY - s.y
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5 && Date.now() - s.t < 800) {
            const act = sideAction(dx < 0 ? 'right' : 'left', latest.current.direction)
            if (act === 'next') next()
            else prev()
          }
        })
        rendition.on('click', (e: MouseEvent) => {
          // リンクや選択中の文字はそのまま
          const target = e.target as HTMLElement | null
          if (target?.closest('a')) return
          const sel = (e.view as Window | null)?.getSelection?.()
          if (sel && sel.toString().length > 0) return
          toggleChrome()
        })
        rendition.on('keydown', (e: KeyboardEvent) => {
          if (latest.current.settingsOpen) return
          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            const act = sideAction(e.key === 'ArrowLeft' ? 'left' : 'right', latest.current.direction)
            if (act === 'next') next()
            else prev()
          }
        })

        try {
          await rendition.display(cfiRef.current || undefined)
        } catch {
          await rendition.display()
        }
        if (destroyed) return
        setStatus('ready')

        // 2. 進捗（%）計算用のロケーションを生成（前回の結果があれば再利用）
        const cacheKey = `epub.locations.${bookId}`
        const cached = loadPref<string>(cacheKey, '')
        if (cached) {
          book.locations.load(cached)
        } else {
          await book.locations.generate(LOCATIONS_CHARS)
          savePref(cacheKey, book.locations.save())
        }
        if (destroyed) return
        setLocationsReady(true)
        if (cfiRef.current) setPercent(Math.round(book.locations.percentageFromCfi(cfiRef.current) * 1000) / 10)
      } catch (err) {
        console.error('EPUB load error:', err)
        if (!destroyed) {
          setStatus('error')
          setError(err instanceof Error ? err.message : 'EPUBの展開に失敗しました')
        }
      }
    }
    init()

    return () => {
      destroyed = true
      renditionRef.current = null
      bookRef.current = null
      try {
        book?.destroy()
      } catch {
        /* 読み込み途中で閉じた場合 */
      }
    }
    // fallbackDirection はページ方向の初期値のみに使用
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId, scrollMode])

  // 文字サイズ・配色は描画し直さずに即時反映
  useEffect(() => {
    renditionRef.current?.themes.fontSize(`${fontSize}px`)
  }, [fontSize])
  useEffect(() => {
    renditionRef.current?.themes.select(theme)
  }, [theme])

  // 画面サイズ変更（回転・ウィンドウリサイズ）に追従
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    let raf = 0
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const r = renditionRef.current as (Rendition & { manager?: unknown }) | null
        if (!r?.manager || el.clientWidth === 0 || el.clientHeight === 0) return
        try {
          r.resize(el.clientWidth, el.clientHeight)
        } catch {
          /* 描画の切り替え中は無視 */
        }
      })
    })
    ro.observe(el)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])

  const colors = TEXT_THEMES[theme]
  const sliderMax = 1000

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: colors.bg, color: colors.fg }}>
      <div className="absolute inset-0 pt-[calc(env(safe-area-inset-top)+1rem)] pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] sm:px-8">
        <div className="relative w-full h-full">
          <div ref={containerRef} className="absolute inset-0" />
          {/* 左右の端はタップでページ送り（本文の中央部はそのまま操作できる） */}
          {scrollMode === 'horizontal' && status === 'ready' && (
            <>
              <button
                aria-label={direction === 'rtl' ? '次のページ' : '前のページ'}
                onClick={() => (sideAction('left', direction) === 'next' ? next() : prev())}
                className="absolute left-0 inset-y-0 w-[18%] max-w-28 z-10 cursor-pointer outline-none"
              />
              <button
                aria-label={direction === 'rtl' ? '前のページ' : '次のページ'}
                onClick={() => (sideAction('right', direction) === 'next' ? next() : prev())}
                className="absolute right-0 inset-y-0 w-[18%] max-w-28 z-10 cursor-pointer outline-none"
              />
            </>
          )}
        </div>
      </div>

      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center gap-3 text-sm opacity-70 pointer-events-none">
          <Spinner className="w-5 h-5" />
          EPUBを読み込み中...
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
          <div className="text-sm font-bold text-rose-500">{error}</div>
          <a
            href={`/api/books/${bookId}/file`}
            download
            className="text-xs font-bold px-4 py-2 rounded-xl bg-stone-800 text-white"
          >
            ファイルをダウンロード
          </a>
        </div>
      )}

      <ReaderTopBar
        visible={chrome}
        title={title}
        subtitle={`EPUB・${scrollMode === 'vertical' ? 'スクロール' : 'ページめくり'}`}
        onBack={onBack}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <ReaderBottomBar
        visible={chrome}
        direction={direction}
        value={Math.max(1, Math.round((percent / 100) * sliderMax))}
        max={sliderMax}
        disabled={!locationsReady}
        label={locationsReady ? `${percent.toFixed(1)}%` : '計算中…'}
        onChange={(v) => {
          const book = bookRef.current
          if (!book || !locationsReady) return
          navigatedRef.current = true
          const cfi = book.locations.cfiFromPercentage(v / sliderMax)
          if (cfi) renditionRef.current?.display(cfi)
        }}
        onNext={next}
        onPrev={prev}
      >
        {toc.length > 0 && (
          <div className="px-3 pt-2 flex">
            <button
              onClick={() => setTocOpen(true)}
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 cursor-pointer"
            >
              <List className="w-4 h-4" />
              目次
            </button>
          </div>
        )}
      </ReaderBottomBar>
      <FinishedToast show={finished} />

      <ReaderSettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)}>
        <TextSettings fontSize={fontSize} setFontSize={setFontSize} theme={theme} setTheme={setTheme} />
        <SettingRow label="めくり方">
          <Segmented
            dark
            value={scrollMode}
            onChange={setScrollMode}
            options={[
              { value: 'horizontal', label: 'ページめくり' },
              { value: 'vertical', label: 'スクロール' },
            ]}
          />
        </SettingRow>
        <p className="text-[11px] text-stone-500 leading-relaxed">
          画面の左右端をタップ（またはスワイプ・矢印キー）でページ移動、本文をタップでメニューを表示／非表示にできます。縦書きの本は左へ進みます。
        </p>
      </ReaderSettingsSheet>

      <ReaderSettingsSheet open={tocOpen} onClose={() => setTocOpen(false)} title="目次">
        <nav className="-mx-2 space-y-0.5">
          <TocList
            items={toc}
            onSelect={(href) => {
              navigatedRef.current = true
              renditionRef.current?.display(href)
              setTocOpen(false)
            }}
          />
        </nav>
      </ReaderSettingsSheet>
    </div>
  )
}

function TocList({ items, onSelect, depth = 0 }: { items: NavItem[]; onSelect: (href: string) => void; depth?: number }) {
  return (
    <>
      {items.map((item) => (
        <div key={item.id || item.href}>
          <button
            onClick={() => onSelect(item.href)}
            style={{ paddingLeft: `${0.5 + depth}rem` }}
            className="w-full text-left text-sm py-2 pr-2 rounded-lg hover:bg-white/10 cursor-pointer truncate"
          >
            {item.label.trim()}
          </button>
          {item.subitems && item.subitems.length > 0 && (
            <TocList items={item.subitems} onSelect={onSelect} depth={depth + 1} />
          )}
        </div>
      ))}
    </>
  )
}
