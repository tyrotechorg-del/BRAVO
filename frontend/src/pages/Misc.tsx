import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

function Card({ title, desc, icon, to, color }: { title: string; desc: string; icon: string; to: string; color: string }) {
  return (
    <Link to={to} className="no-underline block bg-[#1a1a1a] rounded-2xl p-6 border border-[#2a2a2a] hover:border-primary hover:-translate-y-1 transition-all">
      <i className={`fas ${icon} text-3xl mb-4 block`} style={{ color }} />
      <h3 className="text-lg font-semibold mb-1 text-white">{title}</h3>
      <p className="text-sm text-[#b3b3b3]">{desc}</p>
    </Link>
  )
}

export function Dashboard() {
  const user = useAuthStore((s) => s.user)
  return (
    <main className="max-w-[1400px] mx-auto px-5 py-10">
      <h1 className="text-3xl font-bold mb-2">Your Dashboard</h1>
      <p className="text-[#b3b3b3] mb-10">Welcome back, {user?.username}!</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card title="Browse Music" desc="Discover new songs and artists" icon="fa-search" to="/browse" color="#6c63ff" />
        <Card title="Trending" desc="See what others are listening to" icon="fa-fire" to="/trending" color="#ffc107" />
        <Card title="Settings" desc="Manage your account" icon="fa-cog" to="/settings" color="#ff6584" />
      </div>
    </main>
  )
}



export function NotFound() {
  return (
    <main className="min-h-[70vh] flex items-center justify-center">
      <div className="text-center">
        <p className="text-7xl font-extrabold text-primary mb-4">404</p>
        <h1 className="text-2xl font-bold mb-3">Page not found</h1>
        <p className="text-[#b3b3b3] mb-8">The page you're looking for doesn't exist.</p>
        <Link to="/" className="btn-primary inline-block no-underline">Go Home</Link>
      </div>
    </main>
  )
}
