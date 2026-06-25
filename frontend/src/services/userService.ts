import { apiClient } from './apiClient'
import { API_ENDPOINTS } from '../lib/config'
import type { ApiResult, User, Song } from '../types'

const BASE = API_ENDPOINTS.USERS

export const userService = {
  getProfile(): Promise<ApiResult<{ user: User } | User>> {
    return apiClient.call(`${BASE}/profile`, { method: 'GET' })
  },
  getPublicProfile(userId: string) {
    return apiClient.call(`${BASE}/${encodeURIComponent(userId)}`, { method: 'GET' })
  },
  updateProfile(data: Record<string, unknown>) {
    return apiClient.call(`${BASE}/profile`, { method: 'PUT', body: JSON.stringify(data) })
  },
  updateAvatar(file: File) {
    const fd = new FormData()
    fd.append('avatar', file)
    return apiClient.call(`${BASE}/profile/avatar`, { method: 'POST', body: fd })
  },
  deleteAccount(password: string) {
    return apiClient.call(`${BASE}/account`, { method: 'DELETE', body: JSON.stringify({ password }) })
  },
  changePassword(currentPassword: string, newPassword: string) {
    return apiClient.call('/auth/update-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) })
  },
  getFollowers() {
    return apiClient.call(`${BASE}/followers`, { method: 'GET' })
  },
  getFollowing() {
    return apiClient.call(`${BASE}/following`, { method: 'GET' })
  },
  followUser(userId: string) {
    return apiClient.call(`${BASE}/follow/${encodeURIComponent(userId)}`, { method: 'POST' })
  },
  unfollowUser(userId: string) {
    return apiClient.call(`${BASE}/unfollow/${encodeURIComponent(userId)}`, { method: 'DELETE' })
  },
  getLikedSongs(): Promise<ApiResult<Song[] | { songs: Song[] }>> {
    return apiClient.call(`${BASE}/liked`, { method: 'GET' })
  },
  getListenHistory(): Promise<ApiResult<Song[] | { songs: Song[]; history: Song[] }>> {
    return apiClient.call(`${BASE}/history`, { method: 'GET' })
  },
  getNotificationSettings() {
    return apiClient.call(`/notifications/settings`, { method: 'GET' })
  },
  updateNotificationSettings(settings: Record<string, unknown>) {
    return apiClient.call(`/notifications/settings`, { method: 'PUT', body: JSON.stringify(settings) })
  },
  updatePreferences(preferences: Record<string, unknown>) {
    return apiClient.call(`${BASE}/profile`, { method: 'PUT', body: JSON.stringify({ preferences }) })
  },
  // NOTE: there is no dedicated upgrade-to-artist endpoint on the backend yet.
  // The artist profile is created via the artist routes / admin role change.
  // This calls the artist profile endpoint; if your backend exposes a
  // different path, point VITE there. Left in place so the Upgrade page works
  // once the backend route exists.
  upgradeToArtist(data: Record<string, unknown>) {
    return apiClient.call(`/artists/profile`, { method: 'PUT', body: JSON.stringify(data) })
  },
}
