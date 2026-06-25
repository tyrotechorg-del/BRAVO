import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import PasswordInput from '../components/ui/PasswordInput'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, isLoading, error, clearError } = useAuthStore()
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/'
  const [form, setForm] = useState({ email: '', password: '' })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()
    if (!form.email.trim() || !form.password) return
    const ok = await login(form.email.trim(), form.password)
    if (ok) {
      const user = useAuthStore.getState().user
      if (user?.role === 'admin') navigate('/admin')
      else if (user?.role === 'artist') navigate('/artist-dashboard')
      else navigate(from)
    }
  }

  return (
    <div className="min-h-[calc(100vh-60px)] flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-md bg-[#1a1a1a] rounded-2xl p-10 shadow-lg2 animate-fade-in">
        <div className="text-center mb-8">
          <i className="fas fa-music text-4xl text-primary mb-3 block" />
          <h2 className="text-2xl font-bold">Login to Bravo Music</h2>
        </div>
        {error && (
          <div className="mb-5 p-3 bg-danger/10 border border-danger/30 rounded-lg text-danger text-sm flex items-center gap-2">
            <i className="fas fa-exclamation-circle" />{error}
          </div>
        )}
        <form onSubmit={submit} className="space-y-5">
          <div className="form-group"><label>Email</label><input type="email" autoComplete="email" placeholder="your@email.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
          <div className="form-group">
            <div className="flex items-center justify-between mb-2">
              <label className="mb-0">Password</label>
              <Link to="/forgot-password" className="text-xs text-primary no-underline hover:underline">Forgot Password?</Link>
            </div>
            <PasswordInput value={form.password} onChange={(v) => setForm({ ...form, password: v })} autoComplete="current-password" required />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={isLoading}>{isLoading ? <><i className="fas fa-spinner fa-spin" /> Logging in…</> : 'Login'}</button>
        </form>
        <p className="text-center mt-5 text-sm text-[#b3b3b3]">Don't have an account? <Link to="/register" className="text-primary no-underline hover:underline">Register</Link></p>
      </div>
    </div>
  )
}
