import { NavLink } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

interface Item {
  to: string
  icon: string
  label: string
  end?: boolean
}

function Section({ title, items }: { title: string; items: Item[] }) {
  return (
    <div className="mb-6">
      <h3 className="px-3 mb-2 text-[11px] uppercase tracking-wider text-[#666] font-semibold">{title}</h3>
      <ul className="flex flex-col gap-0.5 list-none">
        {items.map((it) => (
          <li key={it.to}>
            <NavLink
              to={it.to}
              end={it.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm no-underline transition-colors ${
                  isActive ? 'bg-primary/15 text-primary' : 'text-[#b3b3b3] hover:bg-[#1a1a1a] hover:text-white'
                }`
              }
            >
              <i className={`fas ${it.icon} w-4 text-center`} />
              {it.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function Sidebar() {
  const { user, isAuthenticated } = useAuthStore()
  const role = user?.role || 'listener'
  const authed = isAuthenticated()

  return (
    <aside className="w-[230px] shrink-0 hidden lg:block">
      <div className="sticky top-[76px] bg-[#0a0a0a] border border-[#2a2a2a] rounded-2xl p-3 max-h-[calc(100vh-180px)] overflow-y-auto">
        <Section title="Main" items={[
          { to: '/', icon: 'fa-home', label: 'Home', end: true },
          { to: '/browse', icon: 'fa-compass', label: 'Browse' },
          { to: '/trending', icon: 'fa-fire', label: 'Trending' },
          { to: '/search', icon: 'fa-search', label: 'Search' },
        ]} />

        {authed && (
          <Section title="Your Library" items={[
            { to: '/liked', icon: 'fa-heart', label: 'Liked Songs' },
            { to: '/recent', icon: 'fa-history', label: 'Recently Played' },
            { to: '/downloads', icon: 'fa-download', label: 'Downloads' },
            { to: '/playlists', icon: 'fa-list', label: 'Playlists' },
            { to: '/albums', icon: 'fa-compact-disc', label: 'Albums' },
            { to: '/videos', icon: 'fa-video', label: 'Videos' },
          ]} />
        )}

        {authed && (
          <Section title="Account" items={[
            { to: '/notifications', icon: 'fa-bell', label: 'Notifications' },
            { to: '/wallet', icon: 'fa-wallet', label: 'Wallet' },
            { to: '/subscription', icon: 'fa-crown', label: 'Subscription' },
            { to: '/payment-history', icon: 'fa-receipt', label: 'Payment History' },
          ]} />
        )}

        {(role === 'artist' || role === 'admin') && (
          <Section title="Artist Hub" items={[
            { to: '/artist-dashboard', icon: 'fa-chart-line', label: 'Dashboard' },
            { to: '/upload', icon: 'fa-upload', label: 'Upload' },
            { to: '/earnings', icon: 'fa-wallet', label: 'Earnings' },
            { to: '/artist/albums', icon: 'fa-compact-disc', label: 'My Albums' },
          ]} />
        )}

        {role === 'admin' && (
          <Section title="Admin" items={[
            { to: '/admin', icon: 'fa-chart-bar', label: 'Overview', end: true },
            { to: '/admin/users', icon: 'fa-users', label: 'Users' },
            { to: '/admin/settings', icon: 'fa-cog', label: 'System Settings' },
          ]} />
        )}

        <div className="pt-2 border-t border-[#2a2a2a]">
          {authed && <Section title="" items={[{ to: '/settings', icon: 'fa-cog', label: 'Settings' }]} />}
          {role === 'listener' && authed && <Section title="" items={[{ to: '/upgrade', icon: 'fa-crown', label: 'Become Artist' }]} />}
        </div>
      </div>
    </aside>
  )
}
