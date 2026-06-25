import { create } from 'zustand'
import type { User } from '../types'
import { authService } from '../services/authService'
import { apiClient } from '../services/apiClient'
import { socketService } from '../services/socketService'
import { toast } from './toastStore'

interface AuthStore {
  user: User | null
  isLoading: boolean
  error: string | null

  login: (email: string, password: string) => Promise<boolean>
  register: (payload: {
    username: string
    email: string
    fullName: string
    password: string
    role: 'listener' | 'artist'
  }) => Promise<boolean>
  logout: () => void
  refreshUser: () => Promise<void>
  clearError: () => void

  isAuthenticated: () => boolean
  isAdmin: () => boolean
  isArtist: () => boolean
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: apiClient.getUser<User>(),
  isLoading: false,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null })
    const result = await authService.login({ email, password })
    if (result.success) {
      const user = result.data?.user ?? apiClient.getUser<User>()
      set({ user, isLoading: false })
      const token = apiClient.getToken()
      if (token) socketService.connect(token)
      toast.show('Login successful!', 'success')
      return true
    }
    set({ error: result.error ?? 'Login failed', isLoading: false })
    toast.show(result.error ?? 'Login failed', 'error')
    return false
  },

  register: async (payload) => {
    set({ isLoading: true, error: null })
    const result = await authService.register(payload)
    if (result.success) {
      const user = result.data?.user ?? apiClient.getUser<User>()
      set({ user, isLoading: false })
      const token = apiClient.getToken()
      if (token) socketService.connect(token)
      toast.show('Account created!', 'success')
      return true
    }
    set({ error: result.error ?? 'Registration failed', isLoading: false })
    toast.show(result.error ?? 'Registration failed', 'error')
    return false
  },

  logout: () => {
    authService.logout()
    socketService.disconnect()
    set({ user: null })
  },

  refreshUser: async () => {
    const result = await authService.getMe()
    if (result.success && result.data?.user) set({ user: result.data.user })
  },

  clearError: () => set({ error: null }),

  isAuthenticated: () => !!get().user && apiClient.isAuthenticated(),
  isAdmin: () => get().user?.role === 'admin',
  isArtist: () => get().user?.role === 'artist',
}))
