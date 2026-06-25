import { apiClient } from './apiClient'
import { API_ENDPOINTS } from '../lib/config'
import { authService } from './authService'

const BASE = API_ENDPOINTS.WALLET

function query(params: Record<string, unknown>): string {
  const q = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return
    q.append(k, String(v))
  })
  const s = q.toString()
  return s ? `?${s}` : ''
}

export const walletService = {
  getBalance() {
    return apiClient.call<{ balance: number; currency?: string }>(`${BASE}/balance`, { method: 'GET' })
  },
  getTransactions(page = 1, limit = 20, type: string | null = null) {
    const safePage = Math.max(1, Number(page) || 1)
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20))
    return apiClient.call(`${BASE}/transactions${query({ page: safePage, limit: safeLimit, type })}`, { method: 'GET' })
  },
  deposit(amount: number, method: string, phoneNumber: string, idempotencyKey: string | null = null) {
    const headers: Record<string, string> = {}
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey
    return apiClient.call(`${BASE}/deposit`, { method: 'POST', headers, body: JSON.stringify({ amount: Number(amount), method, phoneNumber }) })
  },
  withdraw(amount: number, method: string, accountDetails: Record<string, unknown>) {
    const user = authService.getUser()
    if (!user) return Promise.resolve({ success: false, error: 'Sign-in required', status: 401 } as const)
    if (user.role !== 'artist' && user.role !== 'admin') {
      return Promise.resolve({ success: false, error: 'Only artists can withdraw earnings', status: 403 } as const)
    }
    return apiClient.call(`${BASE}/withdraw`, { method: 'POST', body: JSON.stringify({ amount: Number(amount), method, accountDetails }) })
  },
  getEarnings() {
    return apiClient.call(`${BASE}/earnings`, { method: 'GET' })
  },
}

export interface WalletBalance { balance?: number; currency?: string }
export interface Transaction {
  _id: string
  type: string
  amount: number
  status?: string
  description?: string
  reference?: string
  createdAt?: string
}
export interface EarningsData {
  totalEarnings?: number
  availableBalance?: number
  pendingBalance?: number
  totalWithdrawn?: number
  totalPlays?: number
  monthlyEarnings?: { month: string; amount: number }[]
  recentTransactions?: Transaction[]
}
