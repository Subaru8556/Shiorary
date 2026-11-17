// frontend/src/admin/TagManager.tsx
// 管理画面：タグの名称変更・名寄せ統合
import { useState } from 'react'
import { Check, Edit3, GitMerge } from 'lucide-react'
import { apiSend } from '../lib/api'
import type { TagItem } from './types'

export default function TagManager({
  allTags,
  onChanged,
  setMsg,
}: {
  allTags: TagItem[]
  onChanged: () => void
  setMsg: (m: string) => void
}) {
  const [sourceTagId, setSourceTagId] = useState<number>(0)
  const [targetTagId, setTargetTagId] = useState<number>(0)
  const [editingTagId, setEditingTagId] = useState<number | null>(null)
  const [editTagName, setEditTagName] = useState('')
  const [editTagReading, setEditTagReading] = useState('')

  const handleMergeTags = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!sourceTagId || !targetTagId || sourceTagId === targetTagId) return
    try {
      await apiSend('POST', '/api/admin/tags/merge', { source_tag_id: sourceTagId, target_tag_id: targetTagId })
      setMsg('タグを統合しました')
      onChanged()
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'タグの統合に失敗しました')
    }
  }

  const handleUpdateTag = async (id: number) => {
    try {
      await apiSend('PUT', `/api/admin/tags/${id}`, { name: editTagName, reading: editTagReading })
      setEditingTagId(null)
      onChanged()
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'タグの更新に失敗しました')
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-stone-200/80 shadow-2xs p-4 sm:p-6 space-y-6 text-sm">
      <form
        onSubmit={handleMergeTags}
        className="bg-stone-50/80 rounded-xl border border-stone-200/80 p-4 grid grid-cols-1 sm:flex sm:flex-wrap sm:items-end gap-3"
      >
        <div>
          <label className="block font-bold text-xs text-stone-600 mb-1">統合元タグ（消える側）</label>
          <select
            value={sourceTagId}
            onChange={(e) => setSourceTagId(Number(e.target.value))}
            className="w-full sm:w-auto border border-stone-200 rounded-xl bg-white px-3 py-2 text-xs font-semibold"
          >
            <option value={0}>選択してください</option>
            {allTags.map((t) => (
              <option key={t.id} value={t.id}>
                [{t.category}] {t.name} ({t.count}冊)
              </option>
            ))}
          </select>
        </div>
        <div className="font-bold py-2 text-stone-400">→</div>
        <div>
          <label className="block font-bold text-xs text-stone-600 mb-1">統合先タグ（残る側）</label>
          <select
            value={targetTagId}
            onChange={(e) => setTargetTagId(Number(e.target.value))}
            className="w-full sm:w-auto border border-stone-200 rounded-xl bg-white px-3 py-2 text-xs font-semibold"
          >
            <option value={0}>選択してください</option>
            {allTags.map((t) => (
              <option key={t.id} value={t.id}>
                [{t.category}] {t.name} ({t.count}冊)
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="bg-brand-600 hover:bg-brand-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer"
        >
          <GitMerge className="w-4 h-4" />
          <span>タグを統合する</span>
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-stone-200">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="bg-stone-50 border-b border-stone-200 text-stone-600">
              <th className="p-3">カテゴリ</th>
              <th className="p-3">タグ名</th>
              <th className="p-3">読み仮名・別名</th>
              <th className="p-3">登録冊数</th>
              <th className="p-3 text-right">編集</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {allTags.map((t) => (
              <tr key={t.id} className="hover:bg-stone-50/60">
                <td className="p-3 font-mono text-stone-500">{t.category}</td>
                <td className="p-3 font-bold text-stone-800">
                  {editingTagId === t.id ? (
                    <input
                      value={editTagName}
                      onChange={(e) => setEditTagName(e.target.value)}
                      className="border border-stone-300 rounded-lg px-2.5 py-1"
                    />
                  ) : (
                    t.name
                  )}
                </td>
                <td className="p-3 text-stone-600">
                  {editingTagId === t.id ? (
                    <input
                      value={editTagReading}
                      onChange={(e) => setEditTagReading(e.target.value)}
                      className="border border-stone-300 rounded-lg px-2.5 py-1"
                    />
                  ) : (
                    t.reading
                  )}
                </td>
                <td className="p-3">{t.count} 冊</td>
                <td className="p-3 text-right">
                  {editingTagId === t.id ? (
                    <button
                      onClick={() => handleUpdateTag(t.id!)}
                      className="bg-brand-600 text-white px-3 py-1 rounded-lg font-bold cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5 inline" /> 保存
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingTagId(t.id!)
                        setEditTagName(t.name)
                        setEditTagReading(t.reading)
                      }}
                      className="text-brand-600 hover:underline font-bold cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5 inline" /> 編集
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
