import { apiClient } from './apiClient'
import { API_BASE_URL, API_ENDPOINTS } from '../lib/config'
import type { ApiResult } from '../types'

const BASE = API_ENDPOINTS.PAYMENTS

function query(params: Record<string, unknown>): string {
  const q = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return
    q.append(k, String(v))
  })
  const s = q.toString()
  return s ? `?${s}` : ''
}

function generateIdempotencyKey(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
  return `idem_${hex}`
}

interface PollOptions {
  onUpdate?: (status: string | undefined, data?: unknown) => void
  timeoutMs?: number
  initialIntervalMs?: number
  maxIntervalMs?: number
  signal?: AbortSignal
}

export const paymentsService = {
  initiatePayment(amount: number, type: string, method: string, phoneNumber: string, metadata: Record<string, unknown> = {}, idempotencyKey: string | null = null) {
    const key = idempotencyKey || generateIdempotencyKey()
    return apiClient.call(`${BASE}/initiate`, {
      method: 'POST',
      headers: { 'Idempotency-Key': key },
      body: JSON.stringify({ amount: Number(amount), type, method, phoneNumber, metadata, idempotencyKey: key }),
    })
  },
  getPaymentStatus(reference: string) {
    if (!reference) return Promise.resolve({ success: false, error: 'Reference required', status: 0 } as ApiResult)
    return apiClient.call(`${BASE}/status/${encodeURIComponent(reference)}`, { method: 'GET' })
  },
  async pollStatus(reference: string, opts: PollOptions = {}) {
    const onUpdate = opts.onUpdate ?? (() => {})
    const timeoutMs = opts.timeoutMs ?? 90_000
    let intervalMs = opts.initialIntervalMs ?? 2_000
    const maxIntervalMs = opts.maxIntervalMs ?? 8_000
    const signal = opts.signal
    const startedAt = Date.now()
    const terminal = new Set(['completed', 'failed', 'cancelled', 'refunded'])

    while (Date.now() - startedAt < timeoutMs) {
      if (signal?.aborted) return { success: false, error: 'Cancelled', terminal: 'cancelled' as const }
      await new Promise((r) => setTimeout(r, intervalMs))
      if (signal?.aborted) return { success: false, error: 'Cancelled', terminal: 'cancelled' as const }

      const result = await this.getPaymentStatus(reference)
      if (!result.success) {
        if ((result.status ?? 0) >= 400 && (result.status ?? 0) < 500) return { ...result, terminal: 'failed' as const }
      } else {
        const data = result.data as { payment?: { status?: string }; status?: string } | undefined
        const status = data?.payment?.status || data?.status
        try { onUpdate(status, result.data) } catch { /* noop */ }
        if (status && terminal.has(status)) return { ...result, terminal: status }
      }
      intervalMs = Math.min(intervalMs * 1.5, maxIntervalMs)
    }
    return { success: false, error: 'Payment confirmation timed out', terminal: 'timeout' as const }
  },
  getHistory(page = 1, limit = 20, type: string | null = null) {
    const safePage = Math.max(1, Number(page) || 1)
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20))
    return apiClient.call(`${BASE}/history${query({ page: safePage, limit: safeLimit, type })}`, { method: 'GET' })
  },
  async getMethods() {
    try {
      const res = await fetch(`${API_BASE_URL}${BASE}/methods`)
      const data = await res.json()
      if (res.ok) return { success: true, data, status: res.status }
      return { success: false, error: data?.error || 'Failed to fetch methods', status: res.status }
    } catch {
      return { success: false, error: 'Network error', status: 0 }
    }
  },
  refund(paymentId: string, reason: string | null = null) {
    return apiClient.call(`${BASE}/refund/${encodeURIComponent(paymentId)}`, { method: 'POST', body: reason ? JSON.stringify({ reason }) : undefined })
  },
}

export interface PaymentMethod { id: string; name: string; type?: string; enabled?: boolean }
