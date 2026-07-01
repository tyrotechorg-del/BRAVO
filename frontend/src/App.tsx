import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import Layout, { AppLayout, AdminLayout } from './components/layout/Layout'
import AudioPlayer from './components/layout/AudioPlayer'
import ToastContainer from './components/ui/Toast'
import ProtectedRoute from './components/layout/ProtectedRoute'
import { useAuthStore } from './store/authStore'
import { apiClient } from './services/apiClient'
import { socketService } from './services/socketService'

import Home from './pages/Home'
import Browse from './pages/Browse'
import Trending from './pages/Trending'
import Login from './pages/Login'
import Register from './pages/Register'
import { NotFound } from './pages/Misc'
import { Terms, Privacy, ArtistResources, Promotion } from './pages/Legal'
import ArtistDashboard from './pages/ArtistDashboard'
import Settings from './pages/Settings'
import { ForgotPassword, ResetPassword, VerifyEmail } from './pages/AuthFlow'
import { ListenerDashboard, LikedPage, RecentPage } from './pages/Library'
import { SongDetail, ArtistProfilePage } from './pages/Content'
import { AlbumView, AlbumsPage, Videos } from './pages/Albums'
import { Search, Playlists, PlaylistDetail, Downloads, Notifications, Upgrade, ArtistAlbums } from './pages/Discovery'
import Upload from './pages/Upload'
import { Wallet, Earnings, Subscription, PaymentHistory } from './pages/Finance'

import AdminDashboard from './pages/admin/AdminDashboard'
import AdminUsersPage from './pages/admin/AdminUsersPage'
import AdminArtistsPage from './pages/admin/AdminArtistsPage'
import AdminAllSongsPage from './pages/admin/AdminAllSongsPage'
import AdminSongsPage from './pages/admin/AdminSongsPage'
import AdminAlbumsPage from './pages/admin/AdminAlbumsPage'
import AdminVideosPage from './pages/admin/AdminVideosPage'
import AdminWithdrawalsPage from './pages/admin/AdminWithdrawalsPage'
import AdminReportsPage from './pages/admin/AdminReportsPage'
import AdminCommentsPage from './pages/admin/AdminCommentsPage'
import AdminSettingsPage from './pages/admin/AdminSettingsPage'

export default function App() {
  const user = useAuthStore((s) => s.user)

  useEffect(() => {
    const token = apiClient.getToken()
    if (user && token && !socketService.isConnected()) socketService.connect(token)
  }, [user])

  const isAuth = !!user

  return (
    <>
      <Routes>
      <Route element={<Layout />}>
        <Route path="/login" element={isAuth ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/register" element={isAuth ? <Navigate to="/" replace /> : <Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />
        <Route path="/verify-email/:token" element={<VerifyEmail />} />
        <Route path="/song/:id" element={<SongDetail />} />
        <Route path="/artist/:id" element={<ArtistProfilePage />} />
        <Route path="/album/:id" element={<AlbumView />} />
        <Route path="/upgrade" element={<ProtectedRoute><Upgrade /></ProtectedRoute>} />
        <Route path="/upload" element={<ProtectedRoute requiredRole="artist"><Upload /></ProtectedRoute>} />
      </Route>

      <Route element={<AppLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/browse" element={<Browse />} />
        <Route path="/trending" element={<Trending />} />
        <Route path="/search" element={<Search />} />
        <Route path="/albums" element={<AlbumsPage />} />
        <Route path="/videos" element={<Videos />} />

        <Route path="/dashboard" element={<ProtectedRoute><ListenerDashboard /></ProtectedRoute>} />
        <Route path="/library" element={<ProtectedRoute><ListenerDashboard /></ProtectedRoute>} />
        <Route path="/liked" element={<ProtectedRoute><LikedPage /></ProtectedRoute>} />
        <Route path="/recent" element={<ProtectedRoute><RecentPage /></ProtectedRoute>} />
        <Route path="/playlists" element={<ProtectedRoute><Playlists /></ProtectedRoute>} />
        <Route path="/playlist/:id" element={<ProtectedRoute><PlaylistDetail /></ProtectedRoute>} />
        <Route path="/downloads" element={<ProtectedRoute><Downloads /></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />

        <Route path="/wallet" element={<ProtectedRoute><Wallet /></ProtectedRoute>} />
        <Route path="/subscription" element={<ProtectedRoute><Subscription /></ProtectedRoute>} />
        <Route path="/payment-history" element={<ProtectedRoute><PaymentHistory /></ProtectedRoute>} />

        <Route path="/artist-dashboard" element={<ProtectedRoute requiredRole="artist"><ArtistDashboard /></ProtectedRoute>} />
        <Route path="/earnings" element={<ProtectedRoute requiredRole="artist"><Earnings /></ProtectedRoute>} />
        <Route path="/artist/albums" element={<ProtectedRoute requiredRole="artist"><ArtistAlbums /></ProtectedRoute>} />
      </Route>

      <Route element={<ProtectedRoute requiredRole="admin"><AdminLayout /></ProtectedRoute>}>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/users" element={<AdminUsersPage />} />
        <Route path="/admin/artists" element={<AdminArtistsPage />} />
        <Route path="/admin/all-songs" element={<AdminAllSongsPage />} />
        <Route path="/admin/pending" element={<AdminSongsPage />} />
        <Route path="/admin/albums" element={<AdminAlbumsPage />} />
        <Route path="/admin/videos" element={<AdminVideosPage />} />
        <Route path="/admin/withdrawals" element={<AdminWithdrawalsPage />} />
        <Route path="/admin/reports" element={<AdminReportsPage />} />
        <Route path="/admin/comments" element={<AdminCommentsPage />} />
        <Route path="/admin/settings" element={<AdminSettingsPage />} />
      </Route>

      <Route element={<Layout />}>
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/artist-resources" element={<ArtistResources />} />
        <Route path="/promotion" element={<Promotion />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>

      {/* Mounted once so audio + toasts persist across navigation */}
      <AudioPlayer />
      <ToastContainer />
    </>
  )
}
