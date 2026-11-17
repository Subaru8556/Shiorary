// frontend/src/reader/ImageViewer.tsx
// 画像ページの本（ZIP/CBZ・画像フォルダ・漫画EPUB）のビューワー
//  - ページめくり：単ページ／見開き（自動・常時・オフ）、表紙単独、右綴じ・左綴じ
//  - 縦スクロール：全ページを縦に並べて表示
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { loadPref, savePref } from '../lib/storage'
import type { PageDirection, ScrollPref } from '../lib/types'
import { Segmented } from '../components/ui'
import { FinishedToast, ReaderBottomBar, ReaderSettingsSheet, ReaderTopBar, SettingRow } from './ReaderChrome'
import { useBookmarkSync } from './useBookmarkSync'
import { useKeyboardPaging, useTapAndSwipe } from './usePagingInput'

type SpreadMode = 'auto' | 'double' | 'single'

interface Props {
  bookId: number
  title: string
  pageCount: number
  initialPage: number
  initialDirection: PageDirection
  initialScroll: ScrollPref
  pageUrl: (page: number) => string
  onBack: () => void
}

/** 見開きの自動判定：横長の画面で幅 768px 以上 */
function useAutoSpread() {
  const query = '(orientation: landscape) and (min-width: 768px)'
  const [match, setMatch] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => setMatch(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])
  return match
}

/** 指定ページを含む見開きのページ番号一覧（読む順） */
function spreadPages(page: number, total: number, spread: boolean, coverSingle: boolean): number[] {
  if (!spread || total <= 1) return [page]
  let start: number
  if (coverSingle) {
    if (page <= 1) return [1]
    start = page % 2 === 0 ? page : page - 1
  } else {
    start = page % 2 === 1 ? page : page - 1
  }
  return start + 1 <= total ? [start, start + 1] : [start]
}

export default function ImageViewer({
  bookId,
  title,
  pageCount,
  initialPage,
  initialDirection,
  initialScroll,
  pageUrl,
  onBack,
}: Props) {
  const total = Math.max(1, pageCount)
  const [direction, setDirection] = useState<PageDirection>(initialDirection)
  const [scrollMode, setScrollMode] = useState<ScrollPref>(initialScroll)
  const [spreadMode, setSpreadMode] = useState<SpreadMode>(() => loadPref('image.spread', 'auto'))
  const [coverSingle, setCoverSingle] = useState<boolean>(() => loadPref('image.coverSingle', true))
  const [page, setPage] = useState(() => Math.min(Math.max(1, initialPage), total))
  const [chrome, setChrome] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const autoSpread = useAutoSpread()
  const { save, finished } = useBookmarkSync(bookId)
  const scrollerRef = useRef<HTMLDivElement | null>(null)

  const spread = scrollMode === 'horizontal' && (spreadMode === 'double' || (spreadMode === 'auto' && autoSpread))
  const visible = useMemo(() => spreadPages(page, total, spread, coverSingle), [page, total, spread, coverSingle])
  const lastVisible = visible[visible.length - 1]

  useEffect(() => savePref('image.spread', spreadMode), [spreadMode])
  useEffect(() => savePref('image.coverSingle', coverSingle), [coverSingle])

  // しおり保存（表示中の最終ページを記録。最終ページ到達でサーバー側が自動消去）
  useEffect(() => {
    save({ current_page: lastVisible, epub_cfi: '', is_finished: lastVisible >= total })
  }, [lastVisible, total, save])

  // 先読み（次の見開き2つ分）
  useEffect(() => {
    if (scrollMode !== 'horizontal') return
    for (let p = lastVisible + 1; p <= Math.min(total, lastVisible + 4); p++) {
      const img = new Image()
      img.decoding = 'async'
      img.src = pageUrl(p)
    }
  }, [lastVisible, total, pageUrl, scrollMode])

  const goTo = useCallback(
    (p: number) => {
      const clamped = Math.min(Math.max(1, p), total)
      setPage(spreadPages(clamped, total, spread, coverSingle)[0])
    },
    [total, spread, coverSingle],
  )

  const next = useCallback(() => {
    if (scrollMode === 'vertical') {
      scrollerRef.current?.scrollBy({ top: (scrollerRef.current?.clientHeight || 600) * 0.85, behavior: 'smooth' })
      return
    }
    if (lastVisible < total) {
      setPage(lastVisible + 1)
      setChrome(false)
    }
  }, [scrollMode, lastVisible, total])

  const prev = useCallback(() => {
    if (scrollMode === 'vertical') {
      scrollerRef.current?.scrollBy({ top: -(scrollerRef.current?.clientHeight || 600) * 0.85, behavior: 'smooth' })
      return
    }
    if (visible[0] > 1) {
      goTo(visible[0] - 1)
      setChrome(false)
    }
  }, [scrollMode, visible, goTo])

  const handlers = { next, prev, toggleChrome: () => setChrome((v) => !v) }
  useKeyboardPaging(direction, handlers, !settingsOpen)
  const pointer = useTapAndSwipe(direction, handlers)

  // ---- 縦スクロールモード ----
  const restoredRef = useRef(false)
  useEffect(() => {
    if (scrollMode !== 'vertical') {
      restoredRef.current = false
      return
    }
    const root = scrollerRef.current
    if (!root) return
    // 表示中のページを判定（画面中央より上にある最後のページ）
    const io = new IntersectionObserver(
      (entries) => {
        if (!restoredRef.current) return
        let best: number | null = null
        for (const en of entries) {
          if (en.isIntersecting) {
            const n = Number((en.target as HTMLElement).dataset.page)
            if (best === null || n > best) best = n
          }
        }
        if (best !== null) setPage(best)
      },
      { root, rootMargin: '0px 0px -50% 0px', threshold: 0 },
    )
    root.querySelectorAll('[data-page]').forEach((el) => io.observe(el))
    // 開いた直後に現在ページへスクロール
    const target = root.querySelector(`[data-page="${page}"]`) as HTMLElement | null
    if (target) root.scrollTop = target.offsetTop
    window.setTimeout(() => (restoredRef.current = true), 300)
    return () => io.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollMode, total])

  // 表示順：右綴じは読む順の1ページ目を右側に置く
  const displayOrder = direction === 'rtl' ? [...visible].reverse() : visible

  return (
    <div className="fixed inset-0 bg-neutral-950 text-white overflow-hidden select-none">
      {scrollMode === 'horizontal' ? (
        <div
          {...pointer}
          className="absolute inset-0 flex items-center justify-center cursor-pointer touch-pan-y touch-pinch-zoom"
          style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {displayOrder.map((p, i) => (
            <div
              key={p}
              className={`h-full flex items-center ${
                displayOrder.length === 2 ? `w-1/2 ${i === 0 ? 'justify-end' : 'justify-start'}` : 'w-full justify-center'
              }`}
            >
              <img
                src={pageUrl(p)}
                alt={`${p}ページ`}
                draggable={false}
                decoding="async"
                className="max-h-full max-w-full object-contain"
              />
            </div>
          ))}
        </div>
      ) : (
        <div
          ref={scrollerRef}
          onClick={() => setChrome((v) => !v)}
          className="absolute inset-0 overflow-y-auto overscroll-contain"
        >
          <div className="mx-auto max-w-3xl flex flex-col items-center gap-1 py-[calc(env(safe-area-inset-top)+3.5rem)]">
            {Array.from({ length: total }, (_, i) => i + 1).map((p) => (
              <img
                key={p}
                data-page={p}
                src={pageUrl(p)}
                alt={`${p}ページ`}
                loading="lazy"
                decoding="async"
                className="w-full h-auto min-h-[40vh] object-contain bg-neutral-900"
                onLoad={(e) => e.currentTarget.classList.remove('min-h-[40vh]', 'bg-neutral-900')}
              />
            ))}
          </div>
        </div>
      )}

      <ReaderTopBar
        visible={chrome}
        title={title}
        subtitle={`${direction === 'rtl' ? '右綴じ' : '左綴じ'}・${scrollMode === 'vertical' ? '縦スクロール' : spread ? '見開き' : '単ページ'}`}
        onBack={onBack}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <ReaderBottomBar
        visible={chrome}
        direction={direction}
        value={scrollMode === 'vertical' ? page : visible[0]}
        max={total}
        label={visible.length === 2 ? `${visible[0]}-${visible[1]} / ${total}` : `${page} / ${total}`}
        onChange={(v) => {
          if (scrollMode === 'vertical') {
            const el = scrollerRef.current?.querySelector(`[data-page="${v}"]`) as HTMLElement | null
            if (el && scrollerRef.current) scrollerRef.current.scrollTop = el.offsetTop
            setPage(v)
          } else {
            goTo(v)
          }
        }}
        onNext={next}
        onPrev={prev}
      />

      <FinishedToast show={finished} />

      <ReaderSettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)}>
        <SettingRow label="めくり方">
          <Segmented
            dark
            value={scrollMode}
            onChange={setScrollMode}
            options={[
              { value: 'horizontal', label: 'ページめくり' },
              { value: 'vertical', label: '縦スクロール' },
            ]}
          />
        </SettingRow>
        <SettingRow label="綴じ方向">
          <Segmented
            dark
            value={direction}
            onChange={setDirection}
            options={[
              { value: 'rtl', label: '右綴じ（漫画）' },
              { value: 'ltr', label: '左綴じ' },
            ]}
          />
        </SettingRow>
        {scrollMode === 'horizontal' && (
          <>
            <SettingRow label="見開き表示">
              <Segmented
                dark
                value={spreadMode}
                onChange={setSpreadMode}
                options={[
                  { value: 'auto', label: '自動' },
                  { value: 'double', label: '見開き' },
                  { value: 'single', label: '単ページ' },
                ]}
              />
              <p className="mt-1.5 text-[11px] text-stone-500">「自動」は横向きの画面（PC・タブレット横持ち）で見開きにします。</p>
            </SettingRow>
            <SettingRow label="表紙">
              <Segmented
                dark
                value={coverSingle ? 'single' : 'pair'}
                onChange={(v) => setCoverSingle(v === 'single')}
                options={[
                  { value: 'single', label: '表紙は単独表示' },
                  { value: 'pair', label: '表紙も見開き' },
                ]}
              />
            </SettingRow>
          </>
        )}
        <p className="text-[11px] text-stone-500 leading-relaxed">
          画面の左右をタップ（またはスワイプ・矢印キー）でページ移動、中央タップでメニューを表示／非表示にできます。
        </p>
      </ReaderSettingsSheet>
    </div>
  )
}
