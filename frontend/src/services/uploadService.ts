import { API_BASE_URL } from '../lib/config'
import { apiClient } from './apiClient'

export interface UploadProgress {
  loaded: number
  total: number
  percent: number
}

export interface UploadResult {
  success: boolean
  data?: unknown
  error?: string
  status: number
  cancelled?: boolean
}

export interface UploadHandle {
  promise: Promise<UploadResult>
  abort: () => void
}

function uploadWithProgress(endpoint: string, formData: FormData, onProgress?: (p: UploadProgress) => void): UploadHandle {
  const url = `${API_BASE_URL}${endpoint}`
  const xhr = new XMLHttpRequest()
  let aborted = false

  const promise = new Promise<UploadResult>((resolve) => {
    xhr.open('POST', url, true)
    const token = apiClient.getToken()
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)

    if (onProgress && xhr.upload) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          onProgress({ loaded: e.loaded, total: e.total, percent: Math.round((e.loaded / e.total) * 100) })
        }
      })
    }

    xhr.addEventListener('load', () => {
      if (aborted) return
      const status = xhr.status
      let data: { error?: string; message?: string } = {}
      if (xhr.responseText) {
        try { data = JSON.parse(xhr.responseText) } catch { data = { error: 'Invalid server response' } }
      }
      if (status >= 200 && status < 300) return resolve({ success: true, data, status })

      let errorMsg = data.error || data.message
      if (status === 413) errorMsg = errorMsg || 'File too large. Please check the size limits and try again.'
      else if (status === 415) errorMsg = errorMsg || 'Unsupported file format.'
      else if (status === 429) errorMsg = errorMsg || 'Upload limit reached. Please try again later (10 uploads per hour).'
      else if (status === 403) errorMsg = errorMsg || "You don't have permission to upload. Check your subscription or verify your email."
      else if (status >= 500) errorMsg = errorMsg || 'Server error. Please try again later.'
      else errorMsg = errorMsg || 'Upload failed'

      resolve({ success: false, error: errorMsg, status })
    })

    xhr.addEventListener('error', () => { if (!aborted) resolve({ success: false, error: 'Network error. Please check your connection.', status: 0 }) })
    xhr.addEventListener('abort', () => { if (aborted) resolve({ success: false, error: 'Upload cancelled', cancelled: true, status: 0 }) })
    xhr.addEventListener('timeout', () => { if (!aborted) resolve({ success: false, error: 'Upload timed out.', status: 0 }) })

    xhr.send(formData)
  })

  return { promise, abort: () => { aborted = true; try { xhr.abort() } catch { /* noop */ } } }
}

export const uploadService = {
  uploadSong(formData: FormData, onProgress?: (p: UploadProgress) => void) {
    return uploadWithProgress('/songs/upload', formData, onProgress)
  },
  adminUploadSong(kind: 'song' | 'video', formData: FormData, onProgress?: (p: UploadProgress) => void) {
    const endpoint = kind === 'video' ? '/admin/upload-video' : '/admin/upload-song'
    return uploadWithProgress(endpoint, formData, onProgress)
  },
  adminUploadAlbum(formData: FormData, onProgress?: (p: UploadProgress) => void) {
    return uploadWithProgress('/admin/upload-album', formData, onProgress)
  },
}
