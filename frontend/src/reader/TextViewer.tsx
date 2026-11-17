// frontend/src/reader/TextViewer.tsx
// テキスト小説（TXT）のビューワー
//  - ページめくり：画面サイズに合わせて自動でページ分割（縦書き・横書き）
//  - スクロール：縦書きは横方向、横書きは縦方向にスクロール
//  - 青空文庫形式のルビ（｜漢字《かんじ》）に対応
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { loadPref, savePref } from '../lib/storage'
import type { PageDirection, ScrollPref } from '../lib/types'
import { Segmented } from '../components/ui'
import { FinishedToast, ReaderBottomBar, ReaderSettingsSheet, ReaderTopBar, SettingRow } from './ReaderChrome'
import { FONT_SIZE_MAX, FONT_SIZE_MIN, TEXT_THEMES, type TextTheme } from './textTheme'
import { useBookmarkSync } from './useBookmarkSync'
import { useKeyboardPaging, useTapAndSwipe } from './usePagingInput'

type WritingMode = 'vertical-rl' | 'horizontal-tb'

const LINE_HEIGHT = 1.9
const COLUMN_GAP = 48

export function formatNovelText(raw: string): string {
  const escaped = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return escaped
    .replace(/[｜|]([^《\n]+)《([^》\n]+)》/g, '<ruby>$1<rt>$2</rt></ruby>')
    .replace(/([一-龠々〆ヵヶ]+)《([^》\n]+)》/g, '<ruby>$1<rt>$2</rt></ruby>')
}

interface Props {
  bookId: number
  title: string
  text: string
  initialRatio: number
  initialWritingMode: WritingMode
  initialScroll: ScrollPref
  onBack: () => void
}

export default function TextViewer({ bookId, title, text, initialRatio, initialWritingMode, initialScroll, onBack }: Props) {
  const [writingMode, setWritingMode] = useState<WritingMode>(() => loadPref('text.writingMode', initialWritingMode))
  const [scrollMode, setScrollMode] = useState<ScrollPref>(initialScroll)
  const [fontSize, setFontSize] = useState<number>(() => loadPref('text.fontSize', 18))
  const [theme, setTheme] = useState<TextTheme>(() => loadPref('text.theme', 'paper'))
  const [chrome, setChrome] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { save, finished } = useBookmarkSync(bookId)

  useEffect(() => savePref('text.writingMode', writingMode), [writingMode])
  useEffect(() => savePref('text.fontSize', fontSize), [fontSize])
  useEffect(() => savePref('text.theme', theme), [theme])

  const html = useMemo(() => formatNovelText(text), [text])
  const vertical = writingMode === 'vertical-rl'
  const paged = scrollMode === 'horizontal'
  const direction: PageDirection = vertical ? 'rtl' : 'ltr'
  const lineH = Math.round(fontSize * LINE_HEIGHT)

  // ステージ（余白を除いた表示領域）のサイズ
  const stageRef = useRef<HTMLDivElement | null>(null)
  const [stage, setStage] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const el = stageRef.current
    if (!el) return
    const update = () => setStage({ w: el.clientWidth, h: el.clientHeight })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // 縦書きは行の途中でページが切れないよう、幅を行送りの倍数に揃える
  const pageW = paged && vertical && stage.w > 0 ? Math.max(lineH, Math.floor(stage.w / lineH) * lineH) : stage.w
  const stride = paged ? (vertical ? pageW : pageW + COLUMN_GAP) : 0

  const viewportRef = useRef<HTMLDivElement | null>(null)
  const [pages, setPages] = useState(1)
  const [pageIdx, setPageIdx] = useState(0)
  const ratioRef = useRef(Math.min(Math.max(initialRatio || 0, 0), 1))
  const navigatedRef = useRef(false)

  // レイアウトが変わったらページ数を数え直し、読んでいた位置（比率）を復元
  useLayoutEffect(() => {
    const vp = viewportRef.current
    if (!vp || stage.w === 0) return
    if (paged) {
      const total = vertical ? vp.scrollWidth : vp.scrollWidth + COLUMN_GAP
      const n = Math.max(1, Math.round(total / stride))
      setPages(n)
      const idx = Math.min(n - 1, Math.round(ratioRef.current * (n - 1)))
      setPageIdx(idx)
      vp.scrollLeft = vertical ? -idx * stride : idx * stride
    } else {
      if (vertical) {
        const max = vp.scrollWidth - vp.clientWidth
        vp.scrollLeft = -ratioRef.current * max
      } else {
        const max = vp.scrollHeight - vp.clientHeight
        vp.scrollTop = ratioRef.current * max
      }
    }
  }, [paged, vertical, stage.w, stage.h, fontSize, stride, html])

  // ページ移動
  useLayoutEffect(() => {
    const vp = viewportRef.current
    if (!vp || !paged) return
    vp.scrollLeft = vertical ? -pageIdx * stride : pageIdx * stride
  }, [pageIdx, paged, vertical, stride])

  const record = useCallback(
    (ratio: number, atEnd: boolean) => {
      ratioRef.current = ratio
      save({
        current_page: Math.max(1, Math.round(ratio * 100)),
        epub_cfi: `ratio:${ratio.toFixed(5)}`,
        is_finished: atEnd && navigatedRef.current,
      })
    },
    [save],
  )

  const goToIdx = useCallback(
    (idx: number) => {
      const clamped = Math.min(Math.max(0, idx), pages - 1)
      navigatedRef.current = true
      setPageIdx(clamped)
      record(pages > 1 ? clamped / (pages - 1) : 0, pages > 1 && clamped === pages - 1)
    },
    [pages, record],
  )

  const onScroll = () => {
    const vp = viewportRef.current
    if (!vp || paged) return
    let ratio: number
    if (vertical) {
      const max = vp.scrollWidth - vp.clientWidth
      ratio = max > 0 ? Math.abs(vp.scrollLeft) / max : 0
    } else {
      const max = vp.scrollHeight - vp.clientHeight
      ratio = max > 0 ? vp.scrollTop / max : 0
    }
    navigatedRef.current = true
    record(ratio, ratio > 0.995)
  }

  const next = useCallback(() => {
    const vp = viewportRef.current
    if (paged) {
      if (pageIdx < pages - 1) {
        goToIdx(pageIdx + 1)
        setChrome(false)
      }
    } else if (vp) {
      if (vertical) vp.scrollBy({ left: -vp.clientWidth * 0.85, behavior: 'smooth' })
      else vp.scrollBy({ top: vp.clientHeight * 0.85, behavior: 'smooth' })
    }
  }, [paged, pageIdx, pages, goToIdx, vertical])

  const prev = useCallback(() => {
    const vp = viewportRef.current
    if (paged) {
      if (pageIdx > 0) {
        goToIdx(pageIdx - 1)
        setChrome(false)
      }
    } else if (vp) {
      if (vertical) vp.scrollBy({ left: vp.clientWidth * 0.85, behavior: 'smooth' })
      else vp.scrollBy({ top: -vp.clientHeight * 0.85, behavior: 'smooth' })
    }
  }, [paged, pageIdx, goToIdx, vertical])

  const handlers = { next, prev, toggleChrome: () => setChrome((v) => !v) }
  useKeyboardPaging(direction, handlers, !settingsOpen)
  const pointer = useTapAndSwipe(direction, handlers)

  const colors = TEXT_THEMES[theme]
  const percent = Math.round((paged ? (pages > 1 ? pageIdx / (pages - 1) : 0) : ratioRef.current) * 100)

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: colors.bg, color: colors.fg }}>
      <div
        {...(paged ? pointer : { onClick: () => setChrome((v) => !v) })}
        className="absolute inset-0 px-[max(1.25rem,env(safe-area-inset-left))] sm:px-12 pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-[calc(env(safe-area-inset-bottom)+2rem)]"
      >
        <div ref={stageRef} className="w-full h-full flex justify-center">
          <div
            ref={viewportRef}
            onScroll={onScroll}
            className={`h-full ${paged ? 'overflow-hidden' : vertical ? 'overflow-x-auto' : 'overflow-y-auto'}`}
            style={{
              width: paged ? pageW : '100%',
              maxWidth: !paged && !vertical ? '44rem' : undefined,
              writingMode: vertical ? 'vertical-rl' : 'horizontal-tb',
            }}
          >
            <div
              className="font-serif whitespace-pre-wrap break-words select-text [&_rt]:text-[0.5em]"
              style={{
                fontSize,
                lineHeight: `${lineH}px`,
                letterSpacing: '0.04em',
                ...(paged && !vertical
                  ? { columnWidth: pageW, columnGap: COLUMN_GAP, columnFill: 'auto', height: stage.h }
                  : {}),
                ...(vertical ? { height: '100%' } : {}),
              }}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </div>
        </div>
      </div>

      <ReaderTopBar
        visible={chrome}
        title={title}
        subtitle={`${vertical ? '縦書き' : '横書き'}・${paged ? 'ページめくり' : 'スクロール'}`}
        onBack={onBack}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <ReaderBottomBar
        visible={chrome}
        direction={direction}
        value={paged ? pageIdx + 1 : Math.max(1, percent)}
        max={paged ? pages : 100}
        label={paged ? `${pageIdx + 1} / ${pages}` : `${percent}%`}
        onChange={(v) => {
          if (paged) goToIdx(v - 1)
          else {
            const vp = viewportRef.current
            if (!vp) return
            const r = v / 100
            if (vertical) vp.scrollLeft = -r * (vp.scrollWidth - vp.clientWidth)
            else vp.scrollTop = r * (vp.scrollHeight - vp.clientHeight)
          }
        }}
        onNext={next}
        onPrev={prev}
      />
      <FinishedToast show={finished} />

      <ReaderSettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)}>
        <TextSettings
          fontSize={fontSize}
          setFontSize={setFontSize}
          theme={theme}
          setTheme={setTheme}
        />
        <SettingRow label="書字方向">
          <Segmented
            dark
            value={writingMode}
            onChange={setWritingMode}
            options={[
              { value: 'vertical-rl', label: '縦書き' },
              { value: 'horizontal-tb', label: '横書き' },
            ]}
          />
        </SettingRow>
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
      </ReaderSettingsSheet>
    </div>
  )
}

/** 文字サイズ・配色の設定（TXT と EPUB で共通） */
export function TextSettings({
  fontSize,
  setFontSize,
  theme,
  setTheme,
}: {
  fontSize: number
  setFontSize: (v: number) => void
  theme: TextTheme
  setTheme: (v: TextTheme) => void
}) {
  return (
    <>
      <SettingRow label={`文字サイズ（${fontSize}px）`}>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setFontSize(Math.max(FONT_SIZE_MIN, fontSize - 2))}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 font-bold text-xs cursor-pointer"
            aria-label="文字を小さく"
          >
            A-
          </button>
          <input
            type="range"
            min={FONT_SIZE_MIN}
            max={FONT_SIZE_MAX}
            step={1}
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
            className="flex-1 accent-brand-400"
            aria-label="文字サイズ"
          />
          <button
            onClick={() => setFontSize(Math.min(FONT_SIZE_MAX, fontSize + 2))}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 font-bold text-base cursor-pointer"
            aria-label="文字を大きく"
          >
            A+
          </button>
        </div>
      </SettingRow>
      <SettingRow label="背景色">
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(TEXT_THEMES) as TextTheme[]).map((key) => (
            <button
              key={key}
              onClick={() => setTheme(key)}
              style={{ background: TEXT_THEMES[key].bg, color: TEXT_THEMES[key].fg }}
              className={`py-2.5 rounded-xl font-bold border-2 cursor-pointer ${
                theme === key ? 'border-brand-400' : 'border-transparent'
              }`}
            >
              {TEXT_THEMES[key].label}
            </button>
          ))}
        </div>
      </SettingRow>
    </>
  )
}
