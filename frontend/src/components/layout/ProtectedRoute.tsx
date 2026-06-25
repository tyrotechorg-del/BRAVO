import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuthStore } from '../../store/authStore'
import type { Role } from '../../types'

interface Props {
  children: ReactNode
  requiredRole?: Role
}

export default function ProtectedRoute({ children, requiredRole }: Props) {
  const { user, isAuthenticated } = useAuthStore()
  const location = useLocation()

  if (!isAuthenticated()) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  // Admins can access artist routes too (mirrors original dashboard role logic)
  if (requiredRole && user?.role !== requiredRole) {
    if (requiredRole === 'artist' && user?.role === 'admin') {
      return <>{children}</>
    }
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}
