import { apiClient } from './apiClient'
import { API_ENDPOINTS } from '../lib/config'
import type { ApiResult, NotificationItem } from '../types'

const BASE = API_ENDPOINTS.NOTIFICATIONS

function query(params: Record<string, unknown>): string {
  const q = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return
    q.append(k, String(v))
  })
  const s = q.toString()
  return s ? `?${s}` : ''
}

export const notificationsService = {
  getAll(page = 1, limit = 20, unreadOnly = false): Promise<ApiResult<{ notifications: NotificationItem[]; totalPages?: number; unreadCount?: number }>> {
    const safePage = Math.max(1, Number(page) || 1)
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20))
    return apiClient.call(`${BASE}/${query({ page: safePage, limit: safeLimit, unreadOnly: unreadOnly || undefined })}`, { method: 'GET' })
  },
  getUnreadCount(): Promise<ApiResult<{ count: number }>> {
    return apiClient.call(`${BASE}/unread-count`, { method: 'GET' })
  },
  markAsRead(id: string) {
    return apiClient.call(`${BASE}/${encodeURIComponent(id)}/read`, { method: 'POST' })
  },
  markAllAsRead() {
    return apiClient.call(`${BASE}/read-all`, { method: 'POST' })
  },
  delete(id: string) {
    return apiClient.call(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' })
  },
  getSettings() {
    return apiClient.call(`${BASE}/settings`, { method: 'GET' })
  },
  updateSettings(settings: Record<string, unknown>) {
    return apiClient.call(`${BASE}/settings`, { method: 'PUT', body: JSON.stringify(settings) })
  },
}
