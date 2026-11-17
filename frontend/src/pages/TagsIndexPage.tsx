// frontend/src/pages/TagsIndexPage.tsx
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search, Tag } from 'lucide-react'
import { EmptyState, Panel } from '../components/ui'
import { apiGet } from '../lib/api'
import type { Tag as TagItem } from '../lib/types'

const TABS = [
  { key: '', label: 'すべて' },
  { key: 'parody', label: '原作' },
  { key: 'character', label: 'キャラクター' },
  { key: 'author', label: '作者（サークル/著者）' },
  { key: 'series', label: 'シリーズ' },
  { key: 'event', label: '頒布イベント' },
]

export default function TagsIndexPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeCategory = searchParams.get('category') || ''
  const [tags, setTags] = useState<TagItem[]>([])
  const [filterQ, setFilterQ] = useState('')

  useEffect(() => {
    apiGet<TagItem[]>('/api/tags')
      .then((data) => setTags(data || []))
      .catch(() => setTags([]))
  }, [])

  const filtered = tags.filter((t) => {
    if (activeCategory && t.category !== activeCategory) return false
    if (filterQ.trim()) {
      const q = filterQ.trim().toLowerCase()
      return t.name.toLowerCase().includes(q) || t.reading.toLowerCase().includes(q)
    }
    return true
  })

  return (
    <Panel title="タグ一覧から探す" icon={Tag} bodyClassName="p-4 sm:p-5 space-y-4">
      <div className="relative">
        <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="search"
          value={filterQ}
          onChange={(e) => setFilterQ(e.target.value)}
          placeholder="タグ名・読み仮名で絞り込み"
          className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:bg-white focus:border-brand-400"
        />
      </div>

      {/* スマホでは横スクロールのタブ */}
      <div className="-mx-4 sm:mx-0 px-4 sm:px-0 flex sm:flex-wrap gap-1.5 overflow-x-auto scrollbar-none text-xs font-bold border-b border-stone-100 pb-4">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setSearchParams(tab.key ? { category: tab.key } : {})}
            className={`px-3.5 py-2 rounded-xl transition cursor-pointer whitespace-nowrap shrink-0 ${
              activeCategory === tab.key
                ? 'bg-brand-600 text-white shadow-2xs'
                : 'bg-stone-50 border border-stone-200 text-stone-600 hover:bg-stone-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState>該当するタグがありません。</EmptyState>
      ) : (
        <div className="flex flex-wrap gap-2">
          {filtered.map((t) => (
            <Link
              key={t.id}
              to={`/search?include_tags=${t.id}${t.category === 'series' ? '&sort=series_asc' : ''}`}
              className="bg-stone-50/80 border border-stone-200 hover:border-brand-300 hover:bg-brand-50/60 text-stone-700 hover:text-brand-700 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition"
            >
              <span>{t.name}</span>
              <span className="text-[10px] bg-white border border-stone-200 text-stone-500 px-1.5 py-0.5 rounded-md">
                {t.count ?? 0}
              </span>
            </Link>
          ))}
        </div>
      )}
    </Panel>
  )
}
