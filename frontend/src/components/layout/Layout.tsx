import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'
import Sidebar from './Sidebar'
import AdminSidebar from './AdminSidebar'
import Footer from './Footer'

// NOTE: AudioPlayer and ToastContainer are mounted ONCE in App (above the
// router) so the audio element persists across navigation and the song does
// not restart when the route/layout changes.

// Plain layout — full-width pages (auth, detail, 404). Includes footer.
export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0a] text-white">
      <Navbar />
      <main className="flex-1 pt-[60px] pb-[76px]">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}

// App layout with the left library/account sidebar + footer
export function AppLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0a] text-white">
      <Navbar />
      <div className="flex-1 pt-[76px] max-w-[1400px] w-full mx-auto px-4">
        <div className="flex gap-6">
          <Sidebar />
          <div className="flex-1 min-w-0 pb-[76px]"><Outlet /></div>
        </div>
      </div>
      <Footer />
    </div>
  )
}

// Admin layout with admin sidebar (no marketing footer)
export function AdminLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0a] text-white">
      <Navbar />
      <div className="flex-1 pt-[76px] pb-[76px] max-w-[1400px] w-full mx-auto px-4">
        <div className="flex gap-6">
          <AdminSidebar />
          <div className="flex-1 min-w-0"><Outlet /></div>
        </div>
      </div>
    </div>
  )
}
