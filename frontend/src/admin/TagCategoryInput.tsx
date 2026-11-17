// frontend/src/admin/TagCategoryInput.tsx
import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import type { TagItem } from './types'

// カテゴリ別・読み仮名対応のオートコンプリート入力コンポーネント
export default function TagCategoryInput({
  category,
  label,
  selectedTags,
  allCategoryTags,
  onAdd,
  onRemove,
}: {
  category: string
  label: string
  selectedTags: TagItem[]
  allCategoryTags: TagItem[]
  onAdd: (t: TagItem) => void
  onRemove: (name: string) => void
}) {
  const [nameInput, setNameInput] = useState('')
  const [readingInput, setReadingInput] = useState('')
  const [focused, setFocused] = useState(false)

  const suggestions = nameInput.trim()
    ? allCategoryTags.filter(
        (t) =>
          !selectedTags.some((st) => st.name === t.name) &&
          (t.name.toLowerCase().includes(nameInput.toLowerCase()) ||
            t.reading.toLowerCase().includes(nameInput.toLowerCase()))
      )
    : []

  const handleAddClick = () => {
    if (!nameInput.trim()) return
    onAdd({ category, name: nameInput.trim(), reading: readingInput.trim() })
    setNameInput('')
    setReadingInput('')
  }

  return (
    <div className="rounded-xl border border-stone-200/80 p-3.5 bg-stone-50/70 space-y-2.5">
      <div className="font-bold text-xs text-stone-700">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {selectedTags.map((t) => (
          <span
            key={t.name}
            className="inline-flex items-center gap-1.5 bg-white border border-brand-200 text-brand-700 px-2.5 py-1 rounded-lg text-xs font-bold shadow-2xs"
          >
            {t.name}
            {t.reading && <span className="text-[10px] text-stone-400">({t.reading})</span>}
            <button
              type="button"
              onClick={() => onRemove(t.name)}
              className="text-stone-400 hover:text-rose-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </span>
        ))}
      </div>

      <div className="relative flex flex-wrap sm:flex-nowrap gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={nameInput}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 180)}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleAddClick()
              }
            }}
            placeholder="タグ名（漢字・ひらがなで補完検索）"
            className="w-full border border-stone-200 rounded-xl bg-white px-3 py-1.5 text-xs focus:outline-none focus:border-brand-500 transition"
          />
          {focused && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-stone-200 rounded-xl shadow-lg max-h-40 overflow-y-auto z-20 divide-y divide-stone-100">
              {suggestions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    onAdd({ category, name: s.name, reading: s.reading })
                    setNameInput('')
                    setReadingInput('')
                  }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-brand-50/70 flex items-center justify-between cursor-pointer"
                >
                  <span className="font-bold text-stone-800">{s.name}</span>
                  <span className="text-stone-400 text-[11px]">{s.reading}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <input
          type="text"
          value={readingInput}
          onChange={(e) => setReadingInput(e.target.value)}
          placeholder="読み仮名・別名（新規時・任意）"
          className="w-full sm:w-44 border border-stone-200 rounded-xl bg-white px-3 py-1.5 text-xs focus:outline-none focus:border-brand-500 transition"
        />
        <button
          type="button"
          onClick={handleAddClick}
          className="bg-brand-600 hover:bg-brand-700 text-white font-bold px-3.5 py-1.5 rounded-xl text-xs flex items-center gap-1 shrink-0 transition cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>追加</span>
        </button>
      </div>
    </div>
  )
}
