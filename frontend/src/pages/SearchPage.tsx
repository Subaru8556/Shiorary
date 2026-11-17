// frontend/src/pages/SearchPage.tsx
// 複合検索（全作品／お気に入り／しおり）
// 検索条件はすべて URL のクエリに持たせる（戻る・共有・リロードで条件が保たれる）
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Ban, ChevronLeft, ChevronRight, Plus, Search, SlidersHorizontal, X } from 'lucide-react'
import BookTileGrid from '../components/BookTileGrid'
import { Panel, Segmented, Spinner } from '../components/ui'
import { apiGet } from '../lib/api'
import { CATEGORY_LABELS, type BookCard, type Tag } from '../lib/types'

interface SearchResponse {
  books: BookCard[] | null
  total: number
  total_pages: number
}

const SORTS = [
  { value: 'created_desc', label: '追加日（新しい順）' },
  { value: 'created_asc', label: '追加日（古い順）' },
  { value: 'release_desc', label: '発行日（新しい順）' },
  { value: 'release_asc', label: '発行日（古い順）' },
  { value: 'title_asc', label: 'タイトル（五十音順）' },
  { value: 'series_asc', label: 'シリーズ巻数順' },
]

const PAGE_SIZE = 24

function parseIds(raw: string | null): number[] {
  return raw ? raw.split(',').map(Number).filter(Boolean) : []
}

const selectClass =
  'w-full border border-stone-200 bg-stone-50 rounded-xl px-3 py-2 text-xs font-bold text-stone-700 focus:outline-none focus:border-brand-400'

export default function SearchPage({
  scope = 'all',
  pageTitle = '作品の検索',
}: {
  scope?: 'all' | 'favorites' | 'bookmarks'
  pageTitle?: string
}) {
  const [searchParams, setSearchParams] = useSearchParams()
  const q = searchParams.get('q') || ''
  const saleType = searchParams.get('sale_type') || ''
  const bookType = searchParams.get('book_type') || ''
  const tagMode = (searchParams.get('tag_mode') as 'and' | 'or') || 'and'
  const sort = searchParams.get('sort') || 'created_desc'
  const page = Number(searchParams.get('page')) || 1
  const includeIds = useMemo(() => parseIds(searchParams.get('include_tags')), [searchParams])
  const excludeIds = useMemo(() => parseIds(searchParams.get('exclude_tags')), [searchParams])

  const [books, setBooks] = useState<BookCard[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [keyword, setKeyword] = useState(q)
  const [tagInput, setTagInput] = useState('')
  const [tagCat, setTagCat] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const resultsRef = useRef<HTMLDivElement | null>(null)

  /** URL の検索条件を更新（page はリセット） */
  const update = (changes: Record<string, string | number[] | null>, opts: { keepPage?: boolean; replace?: boolean } = {}) => {
    const next = new URLSearchParams(searchParams)
    for (const [k, v] of Object.entries(changes)) {
      const str = Array.isArray(v) ? v.join(',') : v
      if (str) next.set(k, str)
      else next.delete(k)
    }
    if (!opts.keepPage) next.delete('page')
    if (next.get('tag_mode') === 'and') next.delete('tag_mode')
    if (next.get('sort') === 'created_desc') next.delete('sort')
    setSearchParams(next, { replace: opts.replace })
  }

  useEffect(() => {
    apiGet<Tag[]>('/api/tags')
      .then((d) => setAllTags(d || []))
      .catch(() => setAllTags([]))
  }, [])

  // URL 側のキーワードが変わったら入力欄へ反映（ヘッダー検索からの遷移など）
  useEffect(() => setKeyword(q), [q])

  // キーワード入力は 400ms 待ってから検索
  useEffect(() => {
    if (keyword === q) return
    const t = window.setTimeout(() => update({ q: keyword.trim() }, { replace: true }), 400)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyword])

  useEffect(() => {
    const params = new URLSearchParams({
      scope,
      tag_mode: tagMode,
      sort,
      page: String(page),
      limit: String(PAGE_SIZE),
    })
    if (q) params.set('q', q)
    if (saleType) params.set('sale_type', saleType)
    if (bookType) params.set('book_type', bookType)
    if (includeIds.length) params.set('include_tags', includeIds.join(','))
    if (excludeIds.length) params.set('exclude_tags', excludeIds.join(','))

    let cancelled = false
    setLoading(true)
    apiGet<SearchResponse>(`/api/books/search?${params}`)
      .then((data) => {
        if (cancelled) return
        setBooks(data.books || [])
        setTotal(data.total || 0)
        setTotalPages(data.total_pages || 1)
      })
      .catch(() => !cancelled && setBooks([]))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [scope, q, saleType, bookType, includeIds, excludeIds, tagMode, sort, page])

  const tagById = (id: number) => allTags.find((t) => t.id === id)
  const tagText = tagInput.trim().toLowerCase()
  const candidates = tagText
    ? allTags
        .filter(
          (t) =>
            (!tagCat || t.category === tagCat) &&
            !includeIds.includes(t.id) &&
            !excludeIds.includes(t.id) &&
            (t.name.toLowerCase().includes(tagText) || t.reading.toLowerCase().includes(tagText)),
        )
        .slice(0, 30)
    : []

  const activeFilterCount = [saleType, bookType].filter(Boolean).length + includeIds.length + excludeIds.length

  const goPage = (p: number) => {
    update({ page: p > 1 ? String(p) : null }, { keepPage: true })
    resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <>
      <Panel
        title={pageTitle}
        icon={SlidersHorizontal}
        tone={scope === 'favorites' ? 'rose' : scope === 'bookmarks' ? 'amber' : 'brand'}
        bodyClassName="p-4 sm:p-5 space-y-3 text-xs"
      >
        {/* キーワード＋絞り込みボタン（スマホ） */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="タイトル・作者・キャラ名など"
              enterKeyHint="search"
              className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:bg-white focus:border-brand-400 transition"
            />
          </div>
          <button
            onClick={() => setFiltersOpen((v) => !v)}
            className={`md:hidden shrink-0 px-3 rounded-xl border font-bold flex items-center gap-1.5 cursor-pointer ${
              filtersOpen || activeFilterCount > 0
                ? 'bg-brand-50 border-brand-200 text-brand-700'
                : 'bg-white border-stone-200 text-stone-600'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            絞り込み
            {activeFilterCount > 0 && (
              <span className="bg-brand-600 text-white rounded-full min-w-4 h-4 px-1 text-[10px] flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        <div className={`${filtersOpen ? 'block' : 'hidden'} md:block space-y-3`}>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <select value={saleType} onChange={(e) => update({ sale_type: e.target.value })} className={selectClass} aria-label="販売区分">
              <option value="">販売区分</option>
              <option value="同人誌">同人誌</option>
              <option value="商業誌">商業誌</option>
            </select>
            <select value={bookType} onChange={(e) => update({ book_type: e.target.value })} className={selectClass} aria-label="書籍区分">
              <option value="">書籍区分</option>
              <option value="漫画">漫画</option>
              <option value="小説">小説</option>
              <option value="その他">その他</option>
            </select>
            <select value={sort} onChange={(e) => update({ sort: e.target.value })} className={`${selectClass} col-span-2 md:col-span-1`} aria-label="並び順">
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {/* タグ条件 */}
          <div className="rounded-xl border border-stone-200/80 bg-stone-50/50 p-3 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold text-stone-600">タグで絞り込む</span>
              <Segmented
                size="sm"
                value={tagMode}
                onChange={(v) => update({ tag_mode: v })}
                options={[
                  { value: 'and', label: 'すべて含む' },
                  { value: 'or', label: 'どれか含む' },
                ]}
              />
            </div>
            <div className="flex gap-2">
              <select value={tagCat} onChange={(e) => setTagCat(e.target.value)} className={`${selectClass} !w-auto bg-white`} aria-label="タグの種類">
                <option value="">全種類</option>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
              <div className="relative flex-1 min-w-0">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="タグ名・読み仮名"
                  className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 focus:outline-none focus:border-brand-400"
                />
                {candidates.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-stone-200 rounded-xl shadow-lg max-h-64 overflow-y-auto z-20 divide-y divide-stone-100">
                    {candidates.map((t) => (
                      <div key={t.id} className="px-3 py-2 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <span className="text-[10px] bg-stone-100 text-stone-600 rounded px-1.5 py-0.5 mr-1.5 font-bold">
                            {CATEGORY_LABELS[t.category] || t.category}
                          </span>
                          <span className="font-bold text-stone-800">{t.name}</span>
                          <span className="text-stone-400 ml-1">({t.count ?? 0})</span>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              update({ include_tags: [...includeIds, t.id] })
                              setTagInput('')
                            }}
                            className="bg-brand-600 hover:bg-brand-700 text-white px-2 py-1.5 rounded-lg font-bold flex items-center gap-0.5 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            含む
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              update({ exclude_tags: [...excludeIds, t.id] })
                              setTagInput('')
                            }}
                            className="bg-rose-600 hover:bg-rose-700 text-white px-2 py-1.5 rounded-lg font-bold flex items-center gap-0.5 cursor-pointer"
                          >
                            <Ban className="w-3 h-3" />
                            除外
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {(includeIds.length > 0 || excludeIds.length > 0) && (
              <div className="flex flex-wrap gap-1.5">
                {includeIds.map((id) => {
                  const t = tagById(id)
                  return (
                    <span key={`i${id}`} className="inline-flex items-center gap-1 bg-brand-50 border border-brand-200 text-brand-700 pl-2.5 pr-1 py-1 rounded-lg font-bold">
                      {t ? `${CATEGORY_LABELS[t.category] || ''}: ${t.name}` : `タグ#${id}`}
                      <button
                        type="button"
                        onClick={() => update({ include_tags: includeIds.filter((x) => x !== id) })}
                        className="p-0.5 rounded hover:bg-brand-100 cursor-pointer"
                        aria-label="条件を外す"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  )
                })}
                {excludeIds.map((id) => {
                  const t = tagById(id)
                  return (
                    <span key={`e${id}`} className="inline-flex items-center gap-1 bg-rose-50 border border-rose-200 text-rose-700 pl-2.5 pr-1 py-1 rounded-lg font-bold">
                      除外 {t ? `${CATEGORY_LABELS[t.category] || ''}: ${t.name}` : `タグ#${id}`}
                      <button
                        type="button"
                        onClick={() => update({ exclude_tags: excludeIds.filter((x) => x !== id) })}
                        className="p-0.5 rounded hover:bg-rose-100 cursor-pointer"
                        aria-label="条件を外す"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  )
                })}
              </div>
            )}
          </div>

          {activeFilterCount > 0 && (
            <button
              onClick={() => update({ sale_type: null, book_type: null, include_tags: null, exclude_tags: null })}
              className="text-stone-500 hover:text-rose-600 font-bold cursor-pointer"
            >
              条件をすべてクリア
            </button>
          )}
        </div>
      </Panel>

      <div ref={resultsRef} className="scroll-mt-20">
        <Panel
          title={
            <span className="flex items-center gap-2">
              検索結果
              {loading && <Spinner className="w-3.5 h-3.5 text-brand-500" />}
            </span>
          }
          actions={<span className="text-xs font-bold bg-stone-100 text-stone-600 px-2.5 py-1 rounded-full">{total} 件</span>}
        >
          <BookTileGrid books={books} emptyMessage={loading ? '検索中...' : '該当する作品がありません。'} />

          {totalPages > 1 && (
            <div className="p-4 border-t border-stone-100 flex items-center justify-center gap-2 text-xs font-bold">
              <button
                disabled={page <= 1}
                onClick={() => goPage(page - 1)}
                className="px-3 py-2 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 disabled:opacity-40 flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" /> 前へ
              </button>
              <select
                value={page}
                onChange={(e) => goPage(Number(e.target.value))}
                className="px-3 py-2 rounded-xl bg-brand-600 text-white font-bold cursor-pointer"
                aria-label="ページ"
              >
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <option key={p} value={p}>
                    {p} / {totalPages}
                  </option>
                ))}
              </select>
              <button
                disabled={page >= totalPages}
                onClick={() => goPage(page + 1)}
                className="px-3 py-2 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 disabled:opacity-40 flex items-center gap-1 cursor-pointer"
              >
                次へ <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </Panel>
      </div>
    </>
  )
}
