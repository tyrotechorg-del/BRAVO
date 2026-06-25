export function formatNumber(num: number): string {
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1) + 'B'
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M'
  if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K'
  return String(num || 0)
}

export function formatCurrency(amount: number, currency = 'ZMW'): string {
  try {
    return new Intl.NumberFormat('en-ZM', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
  } catch {
    return `K${Number(amount || 0).toFixed(2)}`
  }
}

export function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export function formatDate(date: string | Date, format: 'short' | 'long' | 'full' | 'relative' = 'short'): string {
  const d = new Date(date)
  switch (format) {
    case 'long':
      return d.toLocaleDateString('en-ZM', { year: 'numeric', month: 'long', day: 'numeric' })
    case 'full':
      return d.toLocaleDateString('en-ZM', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    case 'relative': {
      const diff = Date.now() - d.getTime()
      const sec = Math.floor(diff / 1000)
      const min = Math.floor(sec / 60)
      const hr = Math.floor(min / 60)
      const day = Math.floor(hr / 24)
      const wk = Math.floor(day / 7)
      const mo = Math.floor(day / 30)
      const yr = Math.floor(day / 365)
      if (yr > 0) return `${yr} year${yr > 1 ? 's' : ''} ago`
      if (mo > 0) return `${mo} month${mo > 1 ? 's' : ''} ago`
      if (wk > 0) return `${wk} week${wk > 1 ? 's' : ''} ago`
      if (day > 0) return `${day} day${day > 1 ? 's' : ''} ago`
      if (hr > 0) return `${hr} hour${hr > 1 ? 's' : ''} ago`
      if (min > 0) return `${min} minute${min > 1 ? 's' : ''} ago`
      return 'Just now'
    }
    default:
      return d.toLocaleDateString('en-ZM')
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function truncate(text: string, maxLength = 100, suffix = '...'): string {
  if (!text || text.length <= maxLength) return text
  return text.substring(0, maxLength) + suffix
}

export function getInitials(name?: string): string {
  if (!name) return ''
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().substring(0, 2)
}
