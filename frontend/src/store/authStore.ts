// frontend/src/store/authStore.ts
import { create } from 'zustand'

export interface User {
  id: number
  username: string
  is_admin: boolean
  pref_image_scroll: 'horizontal' | 'vertical'
  pref_pdf_scroll: 'horizontal' | 'vertical'
  pref_epub_scroll: 'horizontal' | 'vertical'
  pref_txt_scroll: 'horizontal' | 'vertical'
}

interface AuthState {
  user: User | null
  loading: boolean
  checkAuth: () => Promise<void>
  setUser: (user: User | null) => void
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  checkAuth: async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (res.ok) {
        const data = await res.json()
        set({ user: data, loading: false })
      } else {
        set({ user: null, loading: false })
      }
    } catch {
      set({ user: null, loading: false })
    }
  },
  setUser: (user) => set({ user }),
  logout: async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    set({ user: null })
  },
}))