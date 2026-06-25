import { useState, useRef, useEffect } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { Avatar } from '../ui/common'

interface NavItem { to: string; icon: string; label: string; end?: boolean }

export default function Navbar() {
  const { user, logout, isAuthenticated } = useAuthStore()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  const authed = isAuthenticated()
  const role = user?.role || 'listener'

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Lock body scroll while the mobile sidebar is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (search.trim()) { navigate(`/search?q=${encodeURIComponent(search)}`); setSearch(''); setMobileOpen(false) }
  }

  const dashboard = role === 'admin' ? '/admin' : role === 'artist' ? '/artist-dashboard' : '/dashboard'
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `no-underline text-sm transition-colors ${isActive ? 'text-primary' : 'text-[#b3b3b3] hover:text-primary'}`
  const closeMobile = () => setMobileOpen(false)

  // ---- Mobile sidebar nav model (mirrors the desktop Sidebar) ----
  const sections: { title: string; show: boolean; items: NavItem[] }[] = [
    {
      title: 'Main', show: true, items: [
        { to: '/', icon: 'fa-home', label: 'Home', end: true },
        { to: '/browse', icon: 'fa-compass', label: 'Browse' },
        { to: '/trending', icon: 'fa-fire', label: 'Trending' },
        { to: '/search', icon: 'fa-search', label: 'Search' },
      ],
    },
    {
      title: 'Your Library', show: authed, items: [
        { to: '/liked', icon: 'fa-heart', label: 'Liked Songs' },
        { to: '/recent', icon: 'fa-history', label: 'Recently Played' },
        { to: '/downloads', icon: 'fa-download', label: 'Downloads' },
        { to: '/playlists', icon: 'fa-list', label: 'Playlists' },
        { to: '/albums', icon: 'fa-compact-disc', label: 'Albums' },
        { to: '/videos', icon: 'fa-video', label: 'Videos' },
      ],
    },
    {
      title: 'Account', show: authed, items: [
        { to: '/notifications', icon: 'fa-bell', label: 'Notifications' },
        { to: '/wallet', icon: 'fa-wallet', label: 'Wallet' },
        { to: '/subscription', icon: 'fa-crown', label: 'Subscription' },
        { to: '/payment-history', icon: 'fa-receipt', label: 'Payment History' },
      ],
    },
    {
      title: 'Artist Hub', show: role === 'artist' || role === 'admin', items: [
        { to: '/artist-dashboard', icon: 'fa-chart-line', label: 'Dashboard' },
        { to: '/upload', icon: 'fa-upload', label: 'Upload' },
        { to: '/earnings', icon: 'fa-wallet', label: 'Earnings' },
        { to: '/artist/albums', icon: 'fa-compact-disc', label: 'My Albums' },
      ],
    },
    {
      title: 'Admin', show: role === 'admin', items: [
        { to: '/admin', icon: 'fa-chart-bar', label: 'Overview', end: true },
        { to: '/admin/users', icon: 'fa-users', label: 'Users' },
        { to: '/admin/settings', icon: 'fa-cog', label: 'System Settings' },
      ],
    },
  ]

  const mobileLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm no-underline transition-colors ${
      isActive ? 'bg-primary/15 text-primary' : 'text-[#b3b3b3] hover:bg-[#1a1a1a] hover:text-white'
    }`

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 bg-[rgba(5,5,5,0.95)] backdrop-blur border-b border-[#2a2a2a] z-[1000]">
        <div className="max-w-[1400px] mx-auto h-[60px] px-4 sm:px-6 flex items-center gap-3">
          {/* Mobile hamburger (left) */}
          <button className="md:hidden bg-transparent border-none text-white p-1 shrink-0" onClick={() => setMobileOpen(true)} aria-label="Open menu" aria-expanded={mobileOpen}>
            <span className="hamburger"><span /><span /><span /></span>
          </button>

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 text-xl font-bold text-primary no-underline shrink-0" onClick={closeMobile}>
            <img src="/images/bravo.png" alt="Bravo Music" className="w-8 h-8 rounded-lg object-cover" />
            <span className="hidden sm:inline">Bravo Music</span>
          </Link>

          {/* Search — always visible (mobile too) */}
          <form onSubmit={onSearch} className="flex items-center bg-[#1a1a1a] rounded-full px-4 py-1.5 flex-1 max-w-[340px] border border-[#2a2a2a]">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="flex-1 bg-transparent border-none text-white outline-none text-sm placeholder:text-[#b3b3b3] min-w-0" />
            <button type="submit" className="bg-transparent border-none text-[#b3b3b3] hover:text-white"><i className="fas fa-search" /></button>
          </form>

          {/* Desktop quick links */}
          <div className="hidden md:flex items-center gap-5 shrink-0 ml-auto">
            <NavLink to="/" end className={linkClass}>Home</NavLink>
            <NavLink to="/browse" className={linkClass}>Browse</NavLink>
            <NavLink to="/trending" className={linkClass}>Trending</NavLink>
          </div>

          {/* Profile (right) — visible on all sizes */}
          <div ref={ref} className="relative shrink-0 ml-auto md:ml-0">
            <button onClick={() => setOpen(!open)} className="flex items-center gap-2 bg-transparent border-none text-white px-1 py-1">
              <Avatar src={user?.avatar} className="w-8 h-8 rounded-full object-cover" />
              <span className="text-sm hidden md:inline">{user?.username || 'Guest'}</span>
              <i className="fas fa-chevron-down text-xs hidden md:inline" />
            </button>
            {open && (
              <div className="absolute top-full right-0 mt-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl min-w-[180px] overflow-hidden animate-fade-in-down z-50">
                {authed ? (
                  <>
                    <Link to={dashboard} onClick={() => setOpen(false)} className="block px-4 py-2.5 text-sm text-white no-underline hover:bg-[#2a2a2a] hover:text-primary transition-colors"><i className="fas fa-tachometer-alt mr-2" />Dashboard</Link>
                    <Link to="/settings" onClick={() => setOpen(false)} className="block px-4 py-2.5 text-sm text-white no-underline hover:bg-[#2a2a2a] hover:text-primary transition-colors"><i className="fas fa-cog mr-2" />Settings</Link>
                    <hr className="border-[#2a2a2a]" />
                    <button onClick={() => { logout(); setOpen(false); navigate('/') }} className="block w-full text-left px-4 py-2.5 text-sm text-danger bg-transparent border-none hover:bg-[#2a2a2a] transition-colors"><i className="fas fa-sign-out-alt mr-2" />Logout</button>
                  </>
                ) : (
                  <>
                    <Link to="/login" onClick={() => setOpen(false)} className="block px-4 py-2.5 text-sm text-white no-underline hover:bg-[#2a2a2a] hover:text-primary transition-colors">Login</Link>
                    <Link to="/register" onClick={() => setOpen(false)} className="block px-4 py-2.5 text-sm text-white no-underline hover:bg-[#2a2a2a] hover:text-primary transition-colors">Sign Up</Link>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* ===== Mobile slide-in sidebar ===== */}
      {/* Overlay */}
      <div
        className={`md:hidden fixed inset-0 bg-black/60 z-[1100] transition-opacity duration-300 ${mobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={closeMobile}
        aria-hidden="true"
      />
      {/* Panel */}
      <aside
        className={`md:hidden fixed top-0 left-0 bottom-0 w-[280px] max-w-[82vw] bg-[#0a0a0a] border-r border-[#2a2a2a] z-[1200] flex flex-col transition-transform duration-300 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
        role="dialog"
        aria-label="Navigation menu"
      >
        {/* Sidebar header */}
        <div className="flex items-center justify-between h-[60px] px-4 border-b border-[#2a2a2a] shrink-0">
          <Link to="/" onClick={closeMobile} className="flex items-center gap-2 text-lg font-bold text-primary no-underline">
            <img src="/images/bravo.png" alt="" className="w-7 h-7 rounded-lg object-cover" />
            Bravo Music
          </Link>
          <button onClick={closeMobile} className="bg-transparent border-none text-[#b3b3b3] hover:text-white p-2" aria-label="Close menu"><i className="fas fa-times text-lg" /></button>
        </div>

        {/* User block */}
        {authed && (
          <div className="flex items-center gap-3 px-4 py-3 border-b border-[#2a2a2a] shrink-0">
            <Avatar src={user?.avatar} className="w-10 h-10 rounded-full object-cover" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">{user?.username}</p>
              <p className="text-xs text-[#b3b3b3] capitalize">{role}</p>
            </div>
          </div>
        )}

        {/* Scrollable nav */}
        <div className="flex-1 overflow-y-auto px-3 py-3">
          {sections.filter((s) => s.show).map((section) => (
            <div key={section.title} className="mb-5">
              <h3 className="px-3 mb-1.5 text-[11px] uppercase tracking-wider text-[#666] font-semibold">{section.title}</h3>
              <ul className="flex flex-col gap-0.5 list-none p-0 m-0">
                {section.items.map((it) => (
                  <li key={it.to}>
                    <NavLink to={it.to} end={it.end} className={mobileLinkClass} onClick={closeMobile}>
                      <i className={`fas ${it.icon} w-5 text-center`} />{it.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Settings / auth actions */}
          <div className="border-t border-[#2a2a2a] pt-3">
            {authed ? (
              <>
                <NavLink to="/settings" className={mobileLinkClass} onClick={closeMobile}><i className="fas fa-cog w-5 text-center" />Settings</NavLink>
                {role === 'listener' && (
                  <NavLink to="/upgrade" className={mobileLinkClass} onClick={closeMobile}><i className="fas fa-crown w-5 text-center" />Become Artist</NavLink>
                )}
                <button onClick={() => { logout(); closeMobile(); navigate('/') }} className="flex items-center gap-3 w-full text-left px-3 py-2.5 text-sm text-danger bg-transparent border-none rounded-lg hover:bg-[#1a1a1a]">
                  <i className="fas fa-sign-out-alt w-5 text-center" />Logout
                </button>
              </>
            ) : (
              <>
                <NavLink to="/login" className={mobileLinkClass} onClick={closeMobile}><i className="fas fa-sign-in-alt w-5 text-center" />Login</NavLink>
                <NavLink to="/register" className={mobileLinkClass} onClick={closeMobile}><i className="fas fa-user-plus w-5 text-center" />Sign Up</NavLink>
              </>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}
