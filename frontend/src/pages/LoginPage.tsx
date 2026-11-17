// frontend/src/pages/LoginPage.tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const { setUser } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    if (res.ok) {
      const user = await res.json()
      setUser(user)
      navigate('/')
    } else {
      const data = await res.json()
      setError(data.error || 'ログインに失敗しました')
    }
  }

  return (
    <div className="min-h-dvh bg-gradient-to-b from-brand-50 to-paper flex items-center justify-center p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="max-w-md w-full bg-white rounded-2xl border border-stone-200/80 shadow-lg overflow-hidden">
        <div className="px-6 py-6 border-b border-stone-100 flex flex-col items-center gap-2 text-center">
          <img
            src="/shiorary-logo.svg"
            alt="Shiorary"
            className="w-12 h-12 rounded-2xl shadow-sm"
          />
          <h1 className="font-display font-bold text-2xl text-brand-800">Shiorary</h1>
          <p className="text-xs text-stone-400 font-semibold">あなたの書庫にログイン</p>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-600 rounded-xl px-3.5 py-2.5 text-xs font-bold">
              {error}
            </div>
          )}
          <div>
            <label className="block text-xs font-bold text-stone-600 mb-1.5">ユーザー名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:bg-white focus:border-brand-500 transition"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-600 mb-1.5">パスワード</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:bg-white focus:border-brand-500 transition"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 rounded-xl transition shadow-xs cursor-pointer"
          >
            ログイン
          </button>
        </form>
      </div>
    </div>
  )
}