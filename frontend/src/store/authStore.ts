import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types/auth'

interface AuthState {
  token: string | null
  user: User | null
  setAuth: (token: string, user: User) => void
  logout: () => void
  isAuthenticated: () => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,

      setAuth: (token, user) => {
        // Keep localStorage in sync for the axios interceptor in client.ts
        localStorage.setItem('token', token)
        set({ token, user })
      },

      logout: () => {
        localStorage.removeItem('token')
        set({ token: null, user: null })
      },

      isAuthenticated: () => get().token !== null,
    }),
    {
      name: 'chatliox-auth',
      partialize: (state) => ({ token: state.token, user: state.user }),
      onRehydrateStorage: () => (state) => {
        // Re-sync localStorage so axios interceptor has the token after a page refresh
        if (state?.token) localStorage.setItem('token', state.token)
      },
    }
  )
)
