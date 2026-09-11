import { create } from 'zustand'
import { HorizonUser } from '../types'

const TOKEN_KEY = 'horizon_session_token'

interface AuthState {
  user: HorizonUser | null
  sessionToken: string | null
  isAuthenticated: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  restoreSession: () => Promise<void>
  changePassword: (newPassword: string) => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  sessionToken: null,
  isAuthenticated: false,

  login: async (username, password) => {
    const session = await (window as any).horizon.auth.login({ username, password })
    sessionStorage.setItem(TOKEN_KEY, session.token)
    set({ user: session.user, sessionToken: session.token, isAuthenticated: true })
  },

  logout: async () => {
    const { sessionToken } = get()
    if (sessionToken) {
      await (window as any).horizon.auth.logout(sessionToken)
      sessionStorage.removeItem(TOKEN_KEY)
    }
    set({ user: null, sessionToken: null, isAuthenticated: false })
  },

  restoreSession: async () => {
    const token = sessionStorage.getItem(TOKEN_KEY)
    if (!token) {
      set({ user: null, sessionToken: null, isAuthenticated: false })
      return
    }
    const session = await (window as any).horizon.auth.getSession(token)
    if (session) {
      set({ user: session.user, sessionToken: session.token, isAuthenticated: true })
    } else {
      sessionStorage.removeItem(TOKEN_KEY)
      set({ user: null, sessionToken: null, isAuthenticated: false })
    }
  },

  changePassword: async (newPassword) => {
    const { sessionToken } = get()
    if (!sessionToken) throw new Error('Not authenticated')
    await (window as any).horizon.auth.changePassword(sessionToken, newPassword)
  }
}))

