import BravoLoader from './BravoLoader'
import { resolveImageUrl } from '../../lib/config'

interface SpinnerProps {
  className?: string
  /** Use the plain small spinner instead of the branded loader (for tight spaces). */
  plain?: boolean
  label?: string
}
export function Spinner({ className = '', plain = false, label }: SpinnerProps) {
  if (plain) {
    return (
      <div className={`loading-container ${className}`}>
        <div className="spinner" />
      </div>
    )
  }
  return <BravoLoader label={label || 'Tuning in'} />
}

interface EmptyStateProps {
  icon?: string
  title: string
  message?: string
}
export function EmptyState({ icon = 'fa-inbox', title, message }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <i className={`fas ${icon}`} />
      <h3>{title}</h3>
      {message && <p>{message}</p>}
    </div>
  )
}

interface PaginationProps {
  page: number
  totalPages: number
  onChange: (page: number) => void
}
export function Pagination({ page, totalPages, onChange }: PaginationProps) {
  if (totalPages <= 1) return null
  return (
    <div className="pagination-controls">
      <button className="page-btn" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        <i className="fas fa-chevron-left" /> Previous
      </button>
      <span className="page-info">Page {page} of {totalPages}</span>
      <button className="page-btn" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
        Next <i className="fas fa-chevron-right" />
      </button>
    </div>
  )
}

interface AvatarProps {
  src?: string | null
  alt?: string
  className?: string
}
export function Avatar({ src, alt = '', className = '' }: AvatarProps) {
  const fallback = '/images/bravo.png'
  // Resolve relative backend paths (e.g. /uploads/images/avatars/x.jpg) to the
  // static host. Absolute URLs and the fallback pass through unchanged.
  const resolved = src ? resolveImageUrl(src) : fallback
  return (
    <img
      src={resolved}
      alt={alt}
      className={className}
      onError={(e) => {
        const t = e.target as HTMLImageElement
        if (t.src !== fallback) t.src = fallback
      }}
    />
  )
}
