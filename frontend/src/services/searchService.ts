import { API_BASE_URL, API_ENDPOINTS } from '../lib/config'
import type { ApiResult, Song, ArtistProfile, Album, Playlist } from '../types'

const BASE = API_ENDPOINTS.SEARCH

export interface SearchResults {
  songs?: Song[]
  artists?: ArtistProfile[]
  albums?: Album[]
  playlists?: Playlist[]
}

function normalize(query: string): string {
  const q = String(query || '').trim()
  return q.length > 100 ? q.slice(0, 100) : q
}

async function publicGet<T>(path: string, query: string, extra: Record<string, string> = {}): Promise<ApiResult<T>> {
  const q = normalize(query)
  if (q.length < 2) return { success: false, error: 'Type at least 2 characters', status: 0 }
  const params = new URLSearchParams({ q, ...extra })
  try {
    const res = await fetch(`${API_BASE_URL}${BASE}${path}?${params.toString()}`)
    const data = await res.json().catch(() => null)
    if (res.status === 429) return { success: false, error: 'Too many searches. Please slow down.', status: 429 }
    if (!res.ok) return { success: false, error: data?.error || 'Search failed', status: res.status }
    return { success: true, data, status: res.status }
  } catch {
    return { success: false, error: 'Network error', status: 0 }
  }
}

export const searchService = {
  searchAll(query: string, limit = 5): Promise<ApiResult<SearchResults>> {
    return publicGet('/all', query, { limit: String(limit) })
  },
  searchSongs(query: string, page = 1, limit = 20): Promise<ApiResult<{ songs: Song[]; totalPages?: number }>> {
    return publicGet('/songs', query, { page: String(page), limit: String(limit) })
  },
  searchArtists(query: string, page = 1, limit = 20): Promise<ApiResult<{ artists: ArtistProfile[] }>> {
    return publicGet('/artists', query, { page: String(page), limit: String(limit) })
  },
  searchAlbums(query: string, page = 1, limit = 20): Promise<ApiResult<{ albums: Album[] }>> {
    return publicGet('/albums', query, { page: String(page), limit: String(limit) })
  },
  searchPlaylists(query: string, page = 1, limit = 20): Promise<ApiResult<{ playlists: Playlist[] }>> {
    return publicGet('/playlists', query, { page: String(page), limit: String(limit) })
  },
  getSuggestions(query: string, limit = 8) {
    return publicGet('/suggestions', query, { limit: String(limit) })
  },
}
