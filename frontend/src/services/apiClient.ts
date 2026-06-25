import { API_BASE_URL, API_ENDPOINTS } from '../lib/config'
import type { ApiResult } from '../types'

const TOKEN_KEY = 'bravo_token'
const REFRESH_KEY = 'bravo_refresh_token'
const USER_KEY = 'bravo_user'

interface RawResponse<T = unknown> {
  ok: boolean
  status: number
  data: T & { error?: string; message?: string; token?: string; refreshToken?: string }
}

class ApiClient {
  private apiUrl = API_BASE_URL
  private authPath = API_ENDPOINTS.AUTH
  private refreshInFlight: Promise<boolean> | null = null

  // Token + user storage
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY)
  }
  setToken(token: string | null) {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  }
  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_KEY)
  }
  setRefreshToken(token: string | null) {
    if (token) localStorage.setItem(REFRESH_KEY, token)
    else localStorage.removeItem(REFRESH_KEY)
  }
  setUser(user: unknown) {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user))
    else localStorage.removeItem(USER_KEY)
  }
  getUser<T = unknown>(): T | null {
    try {
      const raw = localStorage.getItem(USER_KEY)
      return raw ? (JSON.parse(raw) as T) : null
    } catch {
      localStorage.removeItem(USER_KEY)
      return null
    }
  }
  clearStorage() {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_KEY)
    localStorage.removeItem(USER_KEY)
  }

  isAuthenticated(): boolean {
    return !!this.getToken()
  }

  private decodeToken(token: string): { exp?: number } | null {
    try {
      const payload = token.split('.')[1]
      return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    } catch {
      return null
    }
  }

  isTokenExpired(): boolean {
    const token = this.getToken()
    if (!token) return true
    const decoded = this.decodeToken(token)
    if (!decoded || !decoded.exp) return true
    return decoded.exp * 1000 < Date.now() + 10_000
  }

  // Core fetch wrapper with 401-refresh-retry
  async request<T = unknown>(
    path: string,
    options: RequestInit = {},
    isRetry = false,
  ): Promise<RawResponse<T>> {
    const url = `${this.apiUrl}${path}`
    const headers: Record<string, string> = {
      ...((options.headers as Record<string, string>) || {}),
    }

    const token = this.getToken()
    if (token && !headers.Authorization) {
      headers.Authorization = `Bearer ${token}`
    }
    if (options.body && !headers['Content-Type'] && typeof options.body === 'string') {
      headers['Content-Type'] = 'application/json'
    }

    let response: Response
    try {
      response = await fetch(url, { ...options, headers })
    } catch {
      return {
        ok: false,
        status: 0,
        data: { error: 'Network error. Please check your connection.' } as RawResponse<T>['data'],
      }
    }

    let data: RawResponse<T>['data']
    const text = await response.text()
    if (text) {
      try {
        data = JSON.parse(text)
      } catch {
        data = { error: 'Invalid server response' } as RawResponse<T>['data']
      }
    } else {
      data = {} as RawResponse<T>['data']
    }

    if (response.status === 401 && !isRetry && path !== `${this.authPath}/refresh-token`) {
      const refreshed = await this.tryRefresh()
      if (refreshed) {
        const retryHeaders = { ...headers, Authorization: `Bearer ${this.getToken()}` }
        return this.request<T>(path, { ...options, headers: retryHeaders }, true)
      }
      this.clearStorage()
    }

    return { ok: response.ok, status: response.status, data }
  }

  private async tryRefresh(): Promise<boolean> {
    if (this.refreshInFlight) return this.refreshInFlight
    const refreshToken = this.getRefreshToken()
    if (!refreshToken) return false

    this.refreshInFlight = (async () => {
      try {
        const response = await fetch(`${this.apiUrl}${this.authPath}/refresh-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        })
        if (!response.ok) return false
        const data = await response.json().catch(() => null)
        if (!data || !data.token) return false
        this.setToken(data.token)
        if (data.refreshToken) this.setRefreshToken(data.refreshToken)
        return true
      } catch {
        return false
      } finally {
        this.refreshInFlight = null
      }
    })()

    return this.refreshInFlight
  }

  // Convenience wrapper returning the {success,...} shape used across services
  async call<T = unknown>(path: string, options: RequestInit = {}): Promise<ApiResult<T>> {
    const { ok, data, status } = await this.request<T>(path, options)
    if (ok) return { success: true, data: data as T, status }
    return {
      success: false,
      error: data?.error || data?.message || 'Request failed',
      status,
    }
  }
}

export const apiClient = new ApiClient()
