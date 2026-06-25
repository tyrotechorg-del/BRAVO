import { useState, useRef, useEffect } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { Avatar } from '../ui/common'

export default function Navbar() {
  const { user, logout, isAuthenticated } = useAuthStore()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (search.trim()) { navigate(`/search?q=${encodeURIComponent(search)}`); setSearch(''); setMobileOpen(false) }
  }

  const dashboard = user?.role === 'admin' ? '/admin' : user?.role === 'artist' ? '/artist-dashboard' : '/dashboard'
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `no-underline text-sm transition-colors ${isActive ? 'text-primary' : 'text-[#b3b3b3] hover:text-primary'}`
  const mobileLinkClass = ({ isActive }: { isActive: boolean }) =>
    `block px-4 py-3 no-underline text-sm rounded-lg transition-colors ${isActive ? 'bg-primary/15 text-primary' : 'text-[#b3b3b3] hover:bg-[#1a1a1a] hover:text-white'}`

  const closeMobile = () => setMobileOpen(false)

  return (
    <nav className="fixed top-0 left-0 right-0 bg-[rgba(5,5,5,0.95)] backdrop-blur border-b border-[#2a2a2a] z-[1000]">
      <div className="max-w-[1400px] mx-auto h-[60px] px-4 sm:px-6 flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2 text-xl font-bold text-primary no-underline shrink-0" onClick={closeMobile}>
          <img src="/images/bravo.png" alt="Bravo Music" className="w-8 h-8 rounded-lg object-cover" />
          <span className="hidden sm:inline">Bravo Music</span>
        </Link>

        {/* Desktop search */}
        <form onSubmit={onSearch} className="hidden sm:flex items-center bg-[#1a1a1a] rounded-full px-4 py-1.5 flex-1 max-w-[340px] border border-[#2a2a2a]">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search songs, artists..." className="flex-1 bg-transparent border-none text-white outline-none text-sm placeholder:text-[#b3b3b3] min-w-0" />
          <button type="submit" className="bg-transparent border-none text-[#b3b3b3] hover:text-white"><i className="fas fa-search" /></button>
        </form>

        <div className="hidden md:flex items-center gap-5 shrink-0">
          <NavLink to="/" end className={linkClass}>Home</NavLink>
          <NavLink to="/browse" className={linkClass}>Browse</NavLink>
          <NavLink to="/trending" className={linkClass}>Trending</NavLink>
        </div>

        {/* User dropdown (desktop) */}
        <div ref={ref} className="relative shrink-0 hidden md:block">
          <button onClick={() => setOpen(!open)} className="flex items-center gap-2 bg-transparent border-none text-white px-2 py-1">
            <Avatar src={user?.avatar} className="w-8 h-8 rounded-full object-cover" />
            <span className="text-sm hidden sm:inline">{user?.username || 'Guest'}</span>
            <i className="fas fa-chevron-down text-xs" />
          </button>
          {open && (
            <div className="absolute top-full right-0 mt-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl min-w-[180px] overflow-hidden animate-fade-in-down z-50">
              {isAuthenticated() ? (
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

        {/* Mobile hamburger */}
        <button className="md:hidden bg-transparent border-none text-white p-2" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Menu" aria-expanded={mobileOpen}>
          <span className={`hamburger ${mobileOpen ? 'open' : ''}`}>
            <span /><span /><span />
          </span>
        </button>
      </div>

      {/* Mobile slide-down menu */}
      <div className={`mobile-menu md:hidden border-t border-[#2a2a2a] ${mobileOpen ? 'open' : ''}`}>
        <div className="px-4 py-3 space-y-1">
          <form onSubmit={onSearch} className="flex items-center bg-[#1a1a1a] rounded-full px-4 py-2 border border-[#2a2a2a] mb-3 sm:hidden">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="flex-1 bg-transparent border-none text-white outline-none text-sm placeholder:text-[#b3b3b3] min-w-0" />
            <button type="submit" className="bg-transparent border-none text-[#b3b3b3]"><i className="fas fa-search" /></button>
          </form>

          <NavLink to="/" end className={mobileLinkClass} onClick={closeMobile}><i className="fas fa-home w-5" /> Home</NavLink>
          <NavLink to="/browse" className={mobileLinkClass} onClick={closeMobile}><i className="fas fa-compass w-5" /> Browse</NavLink>
          <NavLink to="/trending" className={mobileLinkClass} onClick={closeMobile}><i className="fas fa-fire w-5" /> Trending</NavLink>

          <hr className="border-[#2a2a2a] my-2" />

          {isAuthenticated() ? (
            <>
              <NavLink to={dashboard} className={mobileLinkClass} onClick={closeMobile}><i className="fas fa-tachometer-alt w-5" /> Dashboard</NavLink>
              <NavLink to="/library" className={mobileLinkClass} onClick={closeMobile}><i className="fas fa-heart w-5" /> Library</NavLink>
              <NavLink to="/settings" className={mobileLinkClass} onClick={closeMobile}><i className="fas fa-cog w-5" /> Settings</NavLink>
              <button onClick={() => { logout(); closeMobile(); navigate('/') }} className="block w-full text-left px-4 py-3 text-sm text-danger bg-transparent border-none rounded-lg hover:bg-[#1a1a1a]"><i className="fas fa-sign-out-alt w-5" /> Logout</button>
            </>
          ) : (
            <>
              <NavLink to="/login" className={mobileLinkClass} onClick={closeMobile}><i className="fas fa-sign-in-alt w-5" /> Login</NavLink>
              <NavLink to="/register" className={mobileLinkClass} onClick={closeMobile}><i className="fas fa-user-plus w-5" /> Sign Up</NavLink>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
