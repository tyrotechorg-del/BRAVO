export type Role = 'listener' | 'artist' | 'admin'

export interface User {
  _id: string
  username: string
  email: string
  fullName?: string
  role: Role
  avatar?: string
  isActive?: boolean
  isVerified?: boolean
  createdAt?: string
}

export interface ArtistProfile {
  bio?: string
  _id: string
  stageName?: string
  displayName?: string
  avatar?: string
  verified?: boolean
  featured?: boolean
  genres?: string[]
  monthlyListeners?: number
  totalRevenue?: number
  songCount?: number
  totalSongs?: number
  userId?: string | { _id?: string; username?: string; email?: string; avatar?: string }
  user?: { username?: string; email?: string }
}

export interface Song {
  _id: string
  title: string
  coverArt?: string
  audioFile?: string
  genre?: string
  status?: 'pending' | 'approved' | 'rejected' | 'featured'
  playCount?: number
  likeCount?: number
  isVideo?: boolean
  isPremium?: boolean
  price?: number
  artist?: { _id?: string; stageName?: string } | string
  createdAt?: string
}

export interface Album {
  _id: string
  title: string
  coverArt?: string
  genre?: string
  type?: 'album' | 'ep' | 'single'
  status?: 'published' | 'draft'
  isPremium?: boolean
  price?: number
  releaseDate?: string
  artist?: { _id?: string; stageName?: string; name?: string } | string
  songs?: (Song | string)[]
}

export interface VideoItem extends Song {
  isVideo?: true
}

export interface Withdrawal {
  _id: string
  amount: number
  method: string
  status: 'pending' | 'approved' | 'rejected' | 'completed' | 'failed'
  user?: { username?: string; email?: string }
  accountDetails?: Record<string, unknown>
  transactionReference?: string
  notes?: string
  createdAt?: string
  processedAt?: string
}

export interface Report {
  _id: string
  type?: string
  reason?: string
  description?: string
  status?: 'pending' | 'resolved'
  contentId?: string
  reporter?: { username?: string; email?: string }
  reportedUser?: { username?: string; email?: string }
  adminNotes?: string
  createdAt?: string
}

export interface ReportedComment {
  _id: string
  content?: string
  flaggedReason?: string
  reportReason?: string
  flaggedAt?: string
  reportedAt?: string
  createdAt?: string
  user?: { username?: string }
  song?: { _id?: string; title?: string }
}

export interface PlatformAnalytics {
  overview?: {
    totalUsers?: number
    totalArtists?: number
    totalSongs?: number
    totalAlbums?: number
    totalRevenue?: number
    platformCommission?: number
    growth?: { newUsersLast30Days?: number; newSongsLast30Days?: number }
  }
  growth?: { newUsersLast30Days?: number; newSongsLast30Days?: number }
}

export interface SystemSettings {
  platformName?: string
  platformUrl?: string
  contactEmail?: string
  platformCommission?: number
  minWithdrawalAmount?: number
  maxUploadSize?: number
  subscriptionPrice?: number
  maintenanceMode?: boolean
}

export interface UserDetails {
  user?: User
  stats?: { totalSongs?: number; totalStreams?: number; totalSpent?: number }
  artistProfile?: ArtistProfile
}

export interface Playlist {
  _id: string
  name: string
  description?: string
  coverArt?: string
  isPublic?: boolean
  songs?: (Song | string)[]
  songCount?: number
  user?: { _id?: string; username?: string }
  createdAt?: string
}

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface ToastItem {
  id: string
  message: string
  type: ToastType
}

// Standard API response wrapper used across all services
export interface ApiResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
  status?: number
  message?: string
}

export interface Playlist {
  _id: string
  name: string
  description?: string
  coverArt?: string
  isPublic?: boolean
  songs?: (Song | string)[]
  user?: { _id?: string; username?: string }
  createdAt?: string
}

export interface NotificationItem {
  _id: string
  type?: string
  title?: string
  message?: string
  read?: boolean
  link?: string
  createdAt?: string
}

export interface WalletBalance {
  balance: number
  currency?: string
}

export interface Transaction {
  _id: string
  type: string
  amount: number
  status?: string
  description?: string
  reference?: string
  createdAt?: string
}

export interface SubscriptionPlan {
  _id?: string
  id?: string
  name: string
  price: number
  interval?: string
  features?: string[]
}
