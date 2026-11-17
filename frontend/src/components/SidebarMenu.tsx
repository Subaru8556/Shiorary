// frontend/src/components/SidebarMenu.tsx
// PC では右サイドバー、スマホ・タブレットでは「メニュー」ドロワーに表示する共通メニュー
import { Link, useNavigate } from 'react-router-dom'
import {
  Bookmark,
  BookOpen,
  Calendar,
  Compass,
  FileText,
  FolderPlus,
  Heart,
  Layers,
  LogOut,
  PenTool,
  Settings,
  Sparkles,
  Tag,
  Tv,
  User as UserIcon,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAuthStore } from '../store/authStore'

const CATEGORY_LINKS: { to: string; label: string; icon: LucideIcon; hover: string }[] = [
  { to: '/tags?category=parody', label: '原作', icon: Tv, hover: 'brand' },
  { to: '/tags?category=character', label: 'キャラ', icon: UserIcon, hover: 'brand' },
  { to: '/tags?category=author', label: '作者', icon: PenTool, hover: 'brand' },
  { to: '/tags?category=event', label: 'イベント', icon: Calendar, hover: 'brand' },
  { to: '/tags', label: 'タグ一覧', icon: Tag, hover: 'brand' },
  { to: '/search?sort=created_desc', label: '新着', icon: Sparkles, hover: 'brand' },
  { to: '/favorites', label: 'お気に入り', icon: Heart, hover: 'rose' },
  { to: '/bookmarks', label: 'しおり', icon: Bookmark, hover: 'amber' },
]

const HOVER: Record<string, string> = {
  brand: 'hover:bg-brand-50 hover:border-brand-200 hover:text-brand-700',
  rose: 'hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600',
  amber: 'hover:bg-amber-50 hover:border-amber-200 hover:text-amber-700',
}

function SectionTitle({ icon: Icon, children }: { icon: LucideIcon; children: string }) {
  return (
    <div className="flex items-center gap-2 mb-3 px-1">
      <Icon className="w-4 h-4 text-brand-600" />
      <span className="text-xs font-bold tracking-wider text-stone-500">{children}</span>
    </div>
  )
}

export default function SidebarMenu() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-stone-200/80 p-4 shadow-2xs">
        <SectionTitle icon={Compass}>カテゴリーから探す</SectionTitle>
        <div className="grid grid-cols-4 lg:grid-cols-2 gap-2">
          {CATEGORY_LINKS.map(({ to, label, icon: Icon, hover }) => (
            <Link
              key={to}
              to={to}
              className={`group bg-stone-50/80 border border-stone-200/70 rounded-xl px-1.5 py-2.5 flex flex-col lg:flex-row items-center justify-center lg:justify-start lg:px-2.5 gap-1.5 text-stone-700 transition ${HOVER[hover]}`}
            >
              <Icon className="w-4 h-4 text-stone-400 group-hover:text-current shrink-0" />
              <span className="text-[11px] font-bold whitespace-nowrap tracking-tight">{label}</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200/80 p-4 shadow-2xs">
        <SectionTitle icon={Layers}>区分から探す</SectionTitle>
        <div className="space-y-2 text-xs font-bold">
          <div className="grid grid-cols-2 gap-2">
            <Link
              to="/search?sale_type=同人誌"
              className="bg-stone-800 hover:bg-stone-900 text-white text-center py-2.5 rounded-xl transition"
            >
              同人誌
            </Link>
            <Link
              to="/search?sale_type=商業誌"
              className="bg-brand-600 hover:bg-brand-700 text-white text-center py-2.5 rounded-xl transition"
            >
              商業誌
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { type: '漫画', icon: BookOpen },
              { type: '小説', icon: FileText },
              { type: 'その他', icon: null },
            ].map(({ type, icon: Icon }) => (
              <Link
                key={type}
                to={`/search?book_type=${type}`}
                className="bg-stone-50 border border-stone-200/80 hover:border-brand-300 hover:bg-brand-50/50 text-stone-700 py-2 rounded-xl transition flex items-center justify-center gap-1"
              >
                {Icon && <Icon className="w-3.5 h-3.5 text-stone-400" />}
                {type}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200/80 p-4 shadow-2xs space-y-2.5 text-xs">
        <div className="flex items-center justify-between border-b border-stone-100 pb-2.5 px-1">
          <span className="text-stone-500">アカウント</span>
          <span className="font-bold text-stone-800 flex items-center gap-1.5">
            {user?.username}
            {user?.is_admin && (
              <span className="text-[10px] bg-brand-50 text-brand-700 border border-brand-200 px-1.5 py-0.5 rounded-md">
                管理者
              </span>
            )}
          </span>
        </div>
        {user?.is_admin && (
          <Link
            to="/admin/unorganized"
            className="w-full bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200/80 font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition"
          >
            <FolderPlus className="w-4 h-4" />
            <span>作品の登録・管理</span>
          </Link>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Link
            to="/settings"
            className="border border-stone-200 text-stone-600 font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 hover:bg-stone-50 transition"
          >
            <Settings className="w-4 h-4" />
            <span>設定</span>
          </Link>
          <button
            onClick={handleLogout}
            className="border border-stone-200 text-stone-600 font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>ログアウト</span>
          </button>
        </div>
      </div>
    </div>
  )
}
