// frontend/src/pages/SettingsPage.tsx
import { useEffect, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { Trash2, UserPlus, Settings, ShieldCheck, Smartphone } from 'lucide-react'
import { Panel } from '../components/ui'

export default function SettingsPage() {
  const { user, setUser } = useAuthStore()
  const [username, setUsername] = useState(user?.username || '')
  const [newPassword, setNewPassword] = useState('')
  const [prefImage, setPrefImage] = useState<'horizontal' | 'vertical'>(user?.pref_image_scroll || 'horizontal')
  const [prefPdf, setPrefPdf] = useState<'horizontal' | 'vertical'>(user?.pref_pdf_scroll || 'horizontal')
  const [prefEpub, setPrefEpub] = useState<'horizontal' | 'vertical'>(user?.pref_epub_scroll || 'horizontal')
  const [prefTxt, setPrefTxt] = useState<'horizontal' | 'vertical'>(user?.pref_txt_scroll || 'horizontal')
  const [msg, setMsg] = useState('')

  const [usersList, setUsersList] = useState<{ id: number; username: string; is_admin: boolean; created_at: string }[]>([])
  const [newUserName, setNewUserName] = useState('')
  const [newUserPass, setNewUserPass] = useState('')
  const [newUserAdmin, setNewUserAdmin] = useState(false)

  const fetchUsers = async () => {
    if (!user?.is_admin) return
    const res = await fetch('/api/admin/users')
    if (res.ok) setUsersList(await res.json())
  }

  useEffect(() => {
    fetchUsers()
  }, [user?.is_admin])

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg('')
    const res = await fetch('/api/user/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        new_password: newPassword,
        pref_image_scroll: prefImage,
        pref_pdf_scroll: prefPdf,
        pref_epub_scroll: prefEpub,
        pref_txt_scroll: prefTxt,
      }),
    })
    if (res.ok) {
      setUser(await res.json())
      setNewPassword('')
      setMsg('設定を保存しました')
    } else {
      const err = await res.json()
      setMsg(err.error || 'エラーが発生しました')
    }
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: newUserName, password: newUserPass, is_admin: newUserAdmin }),
    })
    if (res.ok) {
      setNewUserName('')
      setNewUserPass('')
      setNewUserAdmin(false)
      fetchUsers()
    }
  }

  const handleDeleteUser = async (id: number) => {
    if (!confirm('このユーザーを削除しますか？')) return
    await fetch(`/api/admin/users/${id}`, { method: 'DELETE' })
    fetchUsers()
  }

  return (
    <>
      {/* ユーザー個人設定 */}
      <Panel title="ユーザー設定・表示の初期値" icon={Settings}>
        <form onSubmit={handleSaveSettings} className="p-4 sm:p-6 space-y-5 text-sm">
          {msg && (
            <div className="bg-brand-50 border border-brand-200 text-brand-800 rounded-xl px-4 py-2.5 text-xs font-bold">
              {msg}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-600 mb-1.5">ユーザー名</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:bg-white focus:border-brand-500 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-600 mb-1.5">
                新しいパスワード（変更する場合のみ入力）
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="未入力なら変更しません"
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:bg-white focus:border-brand-500 transition"
              />
            </div>
          </div>

          <div className="border-t border-stone-100 pt-5">
            <h3 className="font-bold text-xs text-stone-600 mb-1">形式別のめくり方（初期値）</h3>
            <p className="text-[11px] text-stone-400 mb-3">ビューワーの「表示設定」からいつでも切り替えられます。</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
              {[
                { label: '画像 (ZIP/CBZ)', val: prefImage, setter: setPrefImage },
                { label: 'PDF', val: prefPdf, setter: setPrefPdf },
                { label: 'EPUB', val: prefEpub, setter: setPrefEpub },
                { label: 'テキスト (TXT)', val: prefTxt, setter: setPrefTxt },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-stone-200/80 p-3.5 bg-stone-50/70">
                  <div className="font-bold mb-2 text-xs text-stone-600">{item.label}</div>
                  <select
                    value={item.val}
                    onChange={(e) => item.setter(e.target.value as 'horizontal' | 'vertical')}
                    className="w-full border border-stone-200 rounded-lg bg-white px-2.5 py-1.5 text-xs font-bold text-stone-700"
                  >
                    <option value="horizontal">ページめくり</option>
                    <option value="vertical">縦スクロール</option>
                  </select>
                </div>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="bg-brand-600 hover:bg-brand-700 text-white font-bold px-6 py-2.5 rounded-xl text-xs sm:text-sm shadow-xs transition cursor-pointer"
          >
            設定を保存する
          </button>
        </form>
      </Panel>

      <InstallGuide />

      {/* 管理者専用メニュー */}
      {user?.is_admin && (
        <Panel title="ユーザーアカウント管理" icon={ShieldCheck} tone="amber">
          <div className="p-4 sm:p-6 space-y-6 text-sm">
            <form
              onSubmit={handleCreateUser}
              className="grid grid-cols-1 sm:flex sm:flex-wrap sm:items-end gap-3 bg-stone-50/80 p-4 rounded-xl border border-stone-200/80"
            >
              <div>
                <label className="block font-bold text-xs text-stone-600 mb-1">新規ユーザー名</label>
                <input
                  type="text"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="w-full border border-stone-200 rounded-xl bg-white px-3 py-2 text-xs"
                  required
                />
              </div>
              <div>
                <label className="block font-bold text-xs text-stone-600 mb-1">初期パスワード</label>
                <input
                  type="password"
                  value={newUserPass}
                  onChange={(e) => setNewUserPass(e.target.value)}
                  className="w-full border border-stone-200 rounded-xl bg-white px-3 py-2 text-xs"
                  required
                />
              </div>
              <label className="flex items-center gap-1.5 font-bold text-xs text-stone-700 py-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newUserAdmin}
                  onChange={(e) => setNewUserAdmin(e.target.checked)}
                />
                <span>管理者権限を付与</span>
              </label>
              <button
                type="submit"
                className="bg-stone-900 hover:bg-brand-950 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>ユーザー作成</span>
              </button>
            </form>

            <div className="overflow-x-auto rounded-xl border border-stone-200">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200 text-stone-600">
                    <th className="p-3">ID</th>
                    <th className="p-3">ユーザー名</th>
                    <th className="p-3">権限</th>
                    <th className="p-3">作成日時</th>
                    <th className="p-3 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {usersList.map((u) => (
                    <tr key={u.id} className="hover:bg-stone-50/60">
                      <td className="p-3 text-stone-500">{u.id}</td>
                      <td className="p-3 font-bold text-stone-800">{u.username}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            u.is_admin
                              ? 'bg-brand-50 text-brand-700 border border-brand-200'
                              : 'bg-stone-100 text-stone-600'
                          }`}
                        >
                          {u.is_admin ? '管理者' : '一般'}
                        </span>
                      </td>
                      <td className="p-3 text-stone-400 font-mono">{u.created_at}</td>
                      <td className="p-3 text-right">
                        {u.id !== user.id && (
                          <button
                            onClick={() => handleDeleteUser(u.id)}
                            className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"
                            title="削除"
                          >
                            <Trash2 className="w-4 h-4 inline" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Panel>
      )}
    </>
  )
}

/** ホーム画面に追加（PWA）の案内 */
function InstallGuide() {
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  return (
    <Panel title="アプリとして使う（ホーム画面に追加）" icon={Smartphone} tone="emerald" bodyClassName="p-4 sm:p-6 text-xs text-stone-600 space-y-3">
      {standalone ? (
        <p className="font-bold text-emerald-700">現在アプリモードで起動しています。</p>
      ) : (
        <>
          <div>
            <div className="font-bold text-stone-800 mb-1">iPhone / iPad（Safari）</div>
            <p>画面下（iPad は上）の共有ボタン → 「ホーム画面に追加」 → 「追加」。ホーム画面のアイコンから全画面で起動できます。</p>
          </div>
          <div>
            <div className="font-bold text-stone-800 mb-1">Android（Chrome）・PC（Chrome / Edge）</div>
            <p>メニュー（︙）→「アプリをインストール」または「ホーム画面に追加」。</p>
          </div>
          <p className="text-[11px] text-stone-400">※ アプリとして初めて起動したときにログイン画面が出た場合は、もう一度ログインしてください（ブラウザとログイン状態が別管理になる場合があります）。</p>
        </>
      )}
    </Panel>
  )
}
