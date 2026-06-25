import { NavLink } from 'react-router-dom'

const ADMIN_LINKS: { to: string; icon: string; label: string; end?: boolean }[] = [
  { to: '/admin', icon: 'fa-chart-line', label: 'Dashboard', end: true },
  { to: '/admin/users', icon: 'fa-users', label: 'Users' },
  { to: '/admin/artists', icon: 'fa-user', label: 'Artists' },
  { to: '/admin/all-songs', icon: 'fa-headphones', label: 'All Songs' },
  { to: '/admin/pending', icon: 'fa-clock', label: 'Pending Songs' },
  { to: '/admin/albums', icon: 'fa-compact-disc', label: 'Albums' },
  { to: '/admin/videos', icon: 'fa-video', label: 'Videos' },
  { to: '/admin/withdrawals', icon: 'fa-money-bill-wave', label: 'Withdrawals' },
  { to: '/admin/reports', icon: 'fa-flag', label: 'Reports' },
  { to: '/admin/comments', icon: 'fa-comment', label: 'Comments' },
  { to: '/admin/settings', icon: 'fa-cog', label: 'Settings' },
]

export default function AdminSidebar() {
  return (
    <aside className="w-[230px] shrink-0 hidden lg:block">
      <div className="sticky top-[76px] bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-3">
        <p className="px-3 py-2 text-xs uppercase tracking-wider text-[#888] font-semibold">Admin</p>
        <nav className="flex flex-col gap-0.5">
          {ADMIN_LINKS.map(({ to, icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm no-underline transition-colors ${
                  isActive ? 'bg-primary text-white' : 'text-[#b3b3b3] hover:bg-[#2a2a2a] hover:text-white'
                }`
              }
            >
              <i className={`fas ${icon} w-4 text-center`} />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
    </aside>
  )
}
