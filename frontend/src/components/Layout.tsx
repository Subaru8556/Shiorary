// frontend/src/components/Layout.tsx
// 全画面共通のレイアウト
//  - PC (lg 以上)   : 上部ヘッダーにナビ＋検索、右にサイドバー
//  - タブレット/スマホ : 上部ヘッダー（ロゴ＋検索）、画面下部にタブバー、メニューはドロワー
import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Bookmark, Heart, Home, Menu, Search, Settings, Tag, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import SidebarMenu from './SidebarMenu'

const DESKTOP_NAV: { to: string; label: string; icon: LucideIcon; active: string }[] = [
  { to: '/search', label: '検索', icon: Search, active: 'bg-brand-50 text-brand-600' },
  { to: '/favorites', label: 'お気に入り', icon: Heart, active: 'bg-rose-50 text-rose-600' },
  { to: '/bookmarks', label: 'しおり', icon: Bookmark, active: 'bg-amber-50 text-amber-600' },
  { to: '/tags', label: 'タグ', icon: Tag, active: 'bg-brand-50 text-brand-600' },
  { to: '/settings', label: '設定', icon: Settings, active: 'bg-brand-50 text-brand-600' },
]

const MOBILE_TABS: { to: string; label: string; icon: LucideIcon; end?: boolean }[] = [
  { to: '/', label: 'ホーム', icon: Home, end: true },
  { to: '/search', label: '検索', icon: Search },
  { to: '/favorites', label: 'お気に入り', icon: Heart },
  { to: '/bookmarks', label: 'しおり', icon: Bookmark },
]

function QuickSearch({ autoFocus = false, onDone }: { autoFocus?: boolean; onDone?: () => void }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [q, setQ] = useState('')

  // 検索画面の URL からキーワードを反映
  useEffect(() => {
    if (location.pathname === '/search') {
      setQ(new URLSearchParams(location.search).get('q') || '')
    }
  }, [location.pathname, location.search])

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        const v = q.trim()
        navigate(v ? `/search?q=${encodeURIComponent(v)}` : '/search')
        onDone?.()
      }}
      className="relative w-full"
    >
      <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
      <input
        type="search"
        value={q}
        autoFocus={autoFocus}
        onChange={(e) => setQ(e.target.value)}
        placeholder="タイトル・作者・キャラで検索"
        enterKeyHint="search"
        className="w-full pl-9 pr-3 py-2 text-sm bg-stone-100/80 border border-transparent rounded-xl focus:outline-none focus:bg-white focus:border-brand-400 focus:ring-4 focus:ring-brand-100 transition"
      />
    </form>
  )
}

export default function Layout() {
  const location = useLocation()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  // 管理画面は作業領域を広く取るためサイドバーを出さない
  const wide = location.pathname.startsWith('/admin')

  // 画面遷移したらドロワー・検索バーを閉じ、先頭へスクロール
  useEffect(() => {
    setDrawerOpen(false)
    setSearchOpen(false)
  }, [location.pathname, location.search])
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  useEffect(() => {
    if (!drawerOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawerOpen(false)
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [drawerOpen])

  return (
    <div className="min-h-dvh bg-paper text-stone-800 flex flex-col">
      <header className="bg-white/90 backdrop-blur-md border-b border-stone-200/80 sticky top-0 z-40 pt-safe">
        <div className="max-w-7xl mx-auto pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] h-14 sm:h-16 flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2.5 shrink-0 hover:opacity-85 transition">
            <img src="/shiorary-logo.svg" alt="" className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl shadow-xs" />
            <span className="font-display text-xl sm:text-2xl font-bold text-brand-800">
              Shiorary
            </span>
          </Link>

          {/* タブレット以上：ヘッダー中央に検索ボックス */}
          <div className="hidden md:block flex-1 max-w-md mx-auto">
            <QuickSearch />
          </div>
          <div className="flex-1 md:hidden" />

          {/* PC：テキスト付きナビ */}
          <nav className="hidden lg:flex items-center gap-1 text-sm font-bold shrink-0">
            {DESKTOP_NAV.map(({ to, label, icon: Icon, active }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `px-3 py-2 rounded-xl flex items-center gap-1.5 transition whitespace-nowrap ${
                    isActive ? active : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                {label}
              </NavLink>
            ))}
          </nav>

          {/* スマホ：検索アイコン */}
          <button
            onClick={() => setSearchOpen((v) => !v)}
            className="md:hidden p-2 -mr-1 rounded-xl text-stone-600 hover:bg-stone-100 cursor-pointer"
            aria-label="検索"
          >
            {searchOpen ? <X className="w-5 h-5" /> : <Search className="w-5 h-5" />}
          </button>
        </div>
        {searchOpen && (
          <div className="md:hidden px-4 pb-3 animate-fade-in">
            <QuickSearch autoFocus onDone={() => setSearchOpen(false)} />
          </div>
        )}
      </header>

      <div className="max-w-7xl w-full mx-auto pt-4 sm:pt-6 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-10 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] sm:pl-[max(1rem,env(safe-area-inset-left))] sm:pr-[max(1rem,env(safe-area-inset-right))]">
        <main className={`${wide ? 'lg:col-span-12' : 'lg:col-span-9'} space-y-5 sm:space-y-6 min-w-0`}>
          <Outlet />
        </main>
        <aside className={wide ? 'hidden' : 'hidden lg:block lg:col-span-3'}>
          <div className="sticky top-22">
            <SidebarMenu />
          </div>
        </aside>
      </div>

      {/* スマホ・タブレット：下部タブバー */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-stone-200/80 pb-safe">
        <div className="max-w-xl mx-auto grid grid-cols-5 h-15">
          {MOBILE_TABS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition ${
                  isActive ? 'text-brand-600' : 'text-stone-500 active:text-stone-800'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`px-4 py-1 rounded-full transition ${isActive ? 'bg-brand-50' : ''}`}>
                    <Icon className="w-5 h-5" />
                  </span>
                  {label}
                </>
              )}
            </NavLink>
          ))}
          <button
            onClick={() => setDrawerOpen(true)}
            className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold cursor-pointer ${
              drawerOpen ? 'text-brand-600' : 'text-stone-500'
            }`}
          >
            <span className="px-4 py-1 rounded-full">
              <Menu className="w-5 h-5" />
            </span>
            メニュー
          </button>
        </div>
      </nav>

      {/* スマホ・タブレット：メニュードロワー */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-xs animate-fade-in" onClick={() => setDrawerOpen(false)} />
          <div className="absolute right-0 inset-y-0 w-[min(22rem,88vw)] bg-paper shadow-2xl flex flex-col animate-slide-in-right pt-safe pb-safe pr-safe">
            <div className="h-14 px-4 flex items-center justify-between border-b border-stone-200/80 bg-white shrink-0">
              <span className="font-bold text-stone-800">メニュー</span>
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-2 -mr-2 rounded-xl text-stone-500 hover:bg-stone-100 cursor-pointer"
                aria-label="閉じる"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 overscroll-contain">
              <SidebarMenu />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
