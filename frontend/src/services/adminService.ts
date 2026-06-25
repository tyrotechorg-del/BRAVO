import { apiClient } from './apiClient'
import type {
  ApiResult,
  PlatformAnalytics,
  SystemSettings,
  User,
  UserDetails,
  ArtistProfile,
  Song,
  Album,
  VideoItem,
  Withdrawal,
  Report,
  ReportedComment,
} from '../types'

const BASE = '/admin'

function buildQuery(params: Record<string, unknown>): string {
  const q = new URLSearchParams()
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    q.append(key, String(value))
  })
  const str = q.toString()
  return str ? `?${str}` : ''
}

function req<T = unknown>(path: string, options: RequestInit = {}): Promise<ApiResult<T>> {
  return apiClient.call<T>(`${BASE}${path}`, options)
}

export const adminService = {
  // Users
  getAllUsers(page = 1, limit = 20, role: string | null = null, search: string | null = null) {
    return req<{ users: User[]; totalPages: number }>(`/users${buildQuery({ page, limit, role, search })}`, { method: 'GET' })
  },
  getUserDetails(userId: string) {
    if (!userId) return Promise.resolve({ success: false, error: 'User ID required', status: 0 } as ApiResult<UserDetails>)
    return req<UserDetails>(`/users/${encodeURIComponent(userId)}`, { method: 'GET' })
  },
  updateUserStatus(userId: string, isActive: boolean, role: string | null = null) {
    const body: Record<string, unknown> = { isActive }
    if (role) body.role = role
    return req(`/users/${encodeURIComponent(userId)}/status`, { method: 'PUT', body: JSON.stringify(body) })
  },
  deleteUser(userId: string) {
    return req(`/users/${encodeURIComponent(userId)}`, { method: 'DELETE' })
  },

  // Artists
  getAllArtistsForAdmin(search = '', verified: boolean | null = null) {
    return req<ArtistProfile[] | { artists: ArtistProfile[] }>(`/artists/list${buildQuery({ search, verified })}`, { method: 'GET' })
  },
  verifyArtist(artistId: string) {
    return req(`/artists/${encodeURIComponent(artistId)}/verify`, { method: 'POST' })
  },
  unverifyArtist(artistId: string) {
    return req(`/artists/${encodeURIComponent(artistId)}/unverify`, { method: 'POST' })
  },
  featureArtist(artistId: string, featured = true) {
    return req(`/artists/${encodeURIComponent(artistId)}/feature`, { method: 'POST', body: JSON.stringify({ featured }) })
  },

  // Songs
  getAllSongs(page = 1, limit = 50, status: string | null = null) {
    return req<{ songs: Song[] } | Song[]>(`/songs${buildQuery({ page, limit, status })}`, { method: 'GET' })
  },
  getAllSongsForAdmin(filters: Record<string, unknown> = {}) {
    return req<{ songs: Song[]; totalPages: number }>(`/songs/all${buildQuery(filters)}`, { method: 'GET' })
  },
  getPendingSongs() {
    return req<Song[] | { songs: Song[] }>('/songs/pending', { method: 'GET' })
  },
  approveSong(songId: string) {
    return req(`/songs/${encodeURIComponent(songId)}/approve`, { method: 'POST' })
  },
  rejectSong(songId: string, reason: string) {
    return req(`/songs/${encodeURIComponent(songId)}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason || 'Content guidelines violation' }),
    })
  },
  deleteSong(songId: string) {
    return req(`/songs/${encodeURIComponent(songId)}`, { method: 'DELETE' })
  },
  bulkAction(songIds: string[], action: string, data: unknown = null) {
    if (!Array.isArray(songIds) || songIds.length === 0)
      return Promise.resolve({ success: false, error: 'No songs selected', status: 0 } as ApiResult)
    if (songIds.length > 500)
      return Promise.resolve({ success: false, error: 'Cannot process more than 500 at once', status: 0 } as ApiResult)
    return req('/songs/bulk-action', { method: 'POST', body: JSON.stringify({ songIds, action, data }) })
  },

  // Albums
  getAllAlbums(page = 1, limit = 50) {
    return req<Album[] | { albums: Album[] }>(`/albums${buildQuery({ page, limit })}`, { method: 'GET' })
  },
  deleteAlbum(albumId: string) {
    return req(`/albums/${encodeURIComponent(albumId)}`, { method: 'DELETE' })
  },

  // Videos
  getAllVideos(page = 1, limit = 50, status: string | null = null) {
    return req<{ videos?: VideoItem[]; songs?: VideoItem[] } | VideoItem[]>(`/videos${buildQuery({ page, limit, status })}`, { method: 'GET' })
  },
  approveVideo(videoId: string) {
    return req(`/videos/${encodeURIComponent(videoId)}/approve`, { method: 'POST' })
  },
  rejectVideo(videoId: string, reason: string) {
    return req(`/videos/${encodeURIComponent(videoId)}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason || 'Content guidelines violation' }),
    })
  },
  deleteVideo(videoId: string) {
    return req(`/videos/${encodeURIComponent(videoId)}`, { method: 'DELETE' })
  },

  // Analytics
  getPlatformAnalytics(period: string | null = null) {
    return req<PlatformAnalytics>(`/analytics${buildQuery({ period })}`, { method: 'GET' })
  },
  getRevenueAnalytics(period: string | null = null) {
    return req(`/analytics/revenue${buildQuery({ period })}`, { method: 'GET' })
  },

  // Withdrawals
  getWithdrawals(status: string | null = null, page = 1, limit = 50) {
    return req<Withdrawal[] | { withdrawals: Withdrawal[] }>(`/withdrawals${buildQuery({ status, page, limit })}`, { method: 'GET' })
  },
  processWithdrawal(withdrawalId: string, action: string, transactionReference: string | null = null, notes: string | null = null) {
    const valid = ['approve', 'reject', 'complete', 'fail']
    if (!valid.includes(action)) return Promise.resolve({ success: false, error: 'Invalid action', status: 0 } as ApiResult)
    const body: Record<string, unknown> = { action }
    if (transactionReference) body.transactionReference = transactionReference
    if (notes) body.notes = notes
    return req(`/withdrawals/${encodeURIComponent(withdrawalId)}/process`, { method: 'POST', body: JSON.stringify(body) })
  },

  // Reports
  getReports(status: string | null = null, page = 1, limit = 50) {
    return req<Report[] | { reports: Report[] }>(`/reports${buildQuery({ status, page, limit })}`, { method: 'GET' })
  },
  resolveReport(reportId: string, action: string, adminNotes = '') {
    return req(`/reports/${encodeURIComponent(reportId)}/resolve`, { method: 'POST', body: JSON.stringify({ action, adminNotes }) })
  },

  // Comments
  getReportedComments(page = 1, limit = 50) {
    return req<ReportedComment[] | { comments: ReportedComment[] }>(`/comments/reported${buildQuery({ page, limit })}`, { method: 'GET' })
  },
  deleteComment(commentId: string) {
    return req(`/comments/${encodeURIComponent(commentId)}`, { method: 'DELETE' })
  },
  dismissCommentReport(commentId: string) {
    return req(`/comments/${encodeURIComponent(commentId)}/dismiss`, { method: 'POST' })
  },

  // Settings
  getSystemSettings() {
    return req<SystemSettings | { settings: SystemSettings }>('/settings', { method: 'GET' })
  },
  updateSystemSettings(settings: SystemSettings) {
    return req<SystemSettings | { settings: SystemSettings }>('/settings', { method: 'PUT', body: JSON.stringify(settings) })
  },

  // Backup + uploads
  triggerBackup() {
    return req('/backup', { method: 'POST' })
  },
  adminUploadSong(formData: FormData) {
    return req('/upload-song', { method: 'POST', body: formData })
  },
  adminUploadVideo(formData: FormData) {
    return req('/upload-video', { method: 'POST', body: formData })
  },
  adminUploadAlbum(formData: FormData) {
    return req('/upload-album', { method: 'POST', body: formData })
  },
  dismissReport(reportId: string, adminNotes = '') {
    return this.resolveReport(reportId, 'dismiss', adminNotes)
  },
  getAllArtists() {
    return req('/artists', { method: 'GET' })
  },
  getSongStatistics() {
    return req('/songs/statistics', { method: 'GET' })
  },

}
