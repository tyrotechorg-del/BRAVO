import { apiClient } from './apiClient'
import { API_ENDPOINTS } from '../lib/config'
import type { ApiResult, User } from '../types'

const AUTH = API_ENDPOINTS.AUTH

interface AuthData {
  token?: string
  refreshToken?: string
  user?: User
}

export const authService = {
  async login(credentials: { email: string; password: string }): Promise<ApiResult<AuthData>> {
    const { ok, data, status } = await apiClient.request<AuthData>(`${AUTH}/login`, {
      method: 'POST',
      body: JSON.stringify(credentials),
    })
    if (ok) {
      if (data.token) apiClient.setToken(data.token)
      if (data.refreshToken) apiClient.setRefreshToken(data.refreshToken)
      if (data.user) apiClient.setUser(data.user)
      return { success: true, data }
    }
    return { success: false, error: data?.error || 'Login failed', status }
  },

  async register(userData: {
    username: string
    email: string
    fullName: string
    password: string
    role: 'listener' | 'artist'
  }): Promise<ApiResult<AuthData>> {
    const { ok, data, status } = await apiClient.request<AuthData>(`${AUTH}/register`, {
      method: 'POST',
      body: JSON.stringify(userData),
    })
    if (ok) {
      if (data.token) apiClient.setToken(data.token)
      if (data.refreshToken) apiClient.setRefreshToken(data.refreshToken)
      if (data.user) apiClient.setUser(data.user)
      return { success: true, data }
    }
    return { success: false, error: data?.error || 'Registration failed', status }
  },

  async logout(): Promise<ApiResult> {
    await apiClient.call(`${AUTH}/logout`, { method: 'POST' }).catch(() => null)
    apiClient.clearStorage()
    return { success: true }
  },

  async getMe(): Promise<ApiResult<{ user: User }>> {
    const result = await apiClient.call<{ user: User }>(`${AUTH}/me`, { method: 'GET' })
    if (result.success && result.data?.user) apiClient.setUser(result.data.user)
    return result
  },

  forgotPassword(email: string) {
    return apiClient.call(`${AUTH}/forgot-password`, { method: 'POST', body: JSON.stringify({ email }) })
  },

  async resetPassword(token: string, password: string): Promise<ApiResult> {
    const { ok, data, status } = await apiClient.request(`${AUTH}/reset-password/${encodeURIComponent(token)}`, {
      method: 'POST',
      body: JSON.stringify({ password }),
    })
    if (ok) return { success: true, message: data?.message || 'Password reset successful' }
    return { success: false, error: data?.error || 'Failed to reset password', status }
  },

  async verifyEmail(token: string): Promise<ApiResult> {
    const result = await apiClient.call(`${AUTH}/verify-email/${encodeURIComponent(token)}`, { method: 'GET' })
    if (result.success) await this.getMe()
    return result
  },

  resendVerification(email: string) {
    return apiClient.call(`${AUTH}/resend-verification`, { method: 'POST', body: JSON.stringify({ email }) })
  },

  updatePassword(currentPassword: string, newPassword: string) {
    return apiClient.call(`${AUTH}/update-password`, { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) })
  },

  getUser(): User | null {
    return apiClient.getUser<User>()
  },
  isAuthenticated(): boolean {
    return apiClient.isAuthenticated()
  },
  isAdmin(): boolean {
    return apiClient.getUser<User>()?.role === 'admin'
  },
  isArtist(): boolean {
    return apiClient.getUser<User>()?.role === 'artist'
  },
}
