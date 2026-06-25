import { apiClient } from './apiClient'
import { API_BASE_URL, API_ENDPOINTS } from '../lib/config'

const BASE = API_ENDPOINTS.SUBSCRIPTIONS

export const subscriptionsService = {
  async getPlans() {
    try {
      const res = await fetch(`${API_BASE_URL}${BASE}/plans`)
      const data = await res.json()
      if (res.ok) return { success: true, data, status: res.status }
      return { success: false, error: data?.error || 'Request failed', status: res.status }
    } catch {
      return { success: false, error: 'Network error', status: 0 }
    }
  },
  subscribe(planId: string, paymentMethod: string, phoneNumber: string, idempotencyKey: string | null = null) {
    const headers: Record<string, string> = {}
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey
    return apiClient.call(`${BASE}/subscribe`, { method: 'POST', headers, body: JSON.stringify({ planId, paymentMethod, phoneNumber, idempotencyKey }) })
  },
  getMySubscription() {
    return apiClient.call(`${BASE}/my-subscription`, { method: 'GET' })
  },
  cancelSubscription() {
    return apiClient.call(`${BASE}/cancel`, { method: 'POST' })
  },
  renewSubscription(autoRenew = false) {
    return apiClient.call(`${BASE}/renew`, { method: 'POST', body: JSON.stringify({ autoRenew: !!autoRenew }) })
  },
  getHistory(page = 1, limit = 20) {
    const safePage = Math.max(1, Number(page) || 1)
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20))
    return apiClient.call(`${BASE}/history?page=${safePage}&limit=${safeLimit}`, { method: 'GET' })
  },
}

export interface MySubscription {
  _id?: string
  plan?: { _id?: string; id?: string; name: string; price: number }
  planName?: string
  status?: string
  startDate?: string
  endDate?: string
  autoRenew?: boolean
}
