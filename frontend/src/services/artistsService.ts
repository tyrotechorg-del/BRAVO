import { apiClient } from './apiClient'
import { API_BASE_URL, API_ENDPOINTS } from '../lib/config'
import type { ApiResult, ArtistProfile, Song } from '../types'

export interface ArtistDashboardData {
  artist?: ArtistProfile
  totalPlays?: number
  totalSongs?: number
  totalAlbums?: number
  followers?: number
  monthlyListeners?: number
  earnings?: number
  recentSongs?: Song[]
  topSongs?: Song[]
}


const BASE = API_ENDPOINTS.ARTISTS

async function publicGet<T>(path: string): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${API_BASE_URL}${BASE}${path}`)
    const data = await res.json().catch(() => null)
    if (!res.ok) return { success: false, error: data?.error || 'Request failed', status: res.status }
    return { success: true, data, status: res.status }
  } catch {
    return { success: false, error: 'Network error', status: 0 }
  }
}

export const artistsService = {
  getById(artistId: string): Promise<ApiResult<ArtistProfile | { artist: ArtistProfile }>> {
    return publicGet(`/${encodeURIComponent(artistId)}`)
  },
  getList(page = 1, limit = 20) {
    return publicGet<{ artists: ArtistProfile[]; totalPages?: number }>(`?page=${page}&limit=${limit}`)
  },
  async getTrending(): Promise<ArtistProfile[]> {
    const result = await publicGet<ArtistProfile[] | { data: ArtistProfile[] }>('/trending')
    if (!result.success) return []
    const d = result.data
    return Array.isArray(d) ? d : (d && 'data' in d ? d.data : []) || []
  },
  getDashboard() {
    return apiClient.call<ArtistDashboardData>(`${BASE}/dashboard`, { method: 'GET' })
  },
  getAnalytics() {
    return apiClient.call(`${BASE}/analytics`, { method: 'GET' })
  },
  getEarnings() {
    return apiClient.call(`${BASE}/earnings`, { method: 'GET' })
  },
  updateProfile(data: Record<string, unknown>) {
    return apiClient.call(`${BASE}/profile`, { method: 'PUT', body: JSON.stringify(data) })
  },
  getMySongs(): Promise<ApiResult<Song[] | { songs: Song[] }>> {
    return apiClient.call(`${BASE}/songs`, { method: 'GET' })
  },
  getMyAlbums() {
    return apiClient.call(`${BASE}/albums`, { method: 'GET' })
  },
  requestWithdrawal(amount: number, method: string, accountDetails: Record<string, unknown>) {
    return apiClient.call(`${BASE}/withdraw`, { method: 'POST', body: JSON.stringify({ amount, method, accountDetails }) })
  },
  getWithdrawals() {
    return apiClient.call(`${BASE}/withdrawals`, { method: 'GET' })
  },
  purchaseCredits(packageId: string, paymentMethod = 'wallet', phoneNumber: string | null = null) {
    const body: Record<string, unknown> = { packageId, paymentMethod }
    if (phoneNumber) body.phoneNumber = phoneNumber
    return apiClient.call(`${BASE}/purchase-credits`, { method: 'POST', body: JSON.stringify(body) })
  },
  getSubscription() {
    return apiClient.call(`${BASE}/subscription`, { method: 'GET' })
  },
}
