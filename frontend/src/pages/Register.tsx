import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import PasswordInput from '../components/ui/PasswordInput'

export default function Register() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { register, isLoading, error, clearError } = useAuthStore()
  const [form, setForm] = useState({
    username: '',
    email: '',
    fullName: '',
    password: '',
    role: (params.get('role') === 'artist' ? 'artist' : 'listener') as 'listener' | 'artist',
  })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()
    const ok = await register(form)
    if (ok) {
      const user = useAuthStore.getState().user
      navigate(user?.role === 'artist' ? '/artist-dashboard' : '/')
    }
  }

  return (
    <div className="min-h-[calc(100vh-60px)] flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-md bg-[#1a1a1a] rounded-2xl p-10 shadow-lg2 animate-fade-in">
        <div className="text-center mb-8">
          <i className="fas fa-music text-4xl text-primary mb-3 block" />
          <h2 className="text-2xl font-bold">Create Account</h2>
        </div>
        {error && (
          <div className="mb-5 p-3 bg-danger/10 border border-danger/30 rounded-lg text-danger text-sm flex items-center gap-2">
            <i className="fas fa-exclamation-circle" />{error}
          </div>
        )}
        <form onSubmit={submit} className="space-y-4">
          <div className="form-group"><label>Username</label><input type="text" minLength={3} maxLength={30} pattern="[a-zA-Z0-9_.\-]+" placeholder="choose a username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required /><small>3-30 characters. Letters, numbers, dots, underscores, hyphens.</small></div>
          <div className="form-group"><label>Email</label><input type="email" placeholder="your@email.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
          <div className="form-group"><label>Full Name</label><input type="text" maxLength={100} placeholder="enter your full name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required /></div>
          <div className="form-group"><label>Password</label><PasswordInput value={form.password} onChange={(v) => setForm({ ...form, password: v })} placeholder="create a password" autoComplete="new-password" minLength={8} required /><small>At least 8 characters with uppercase, number, and special character.</small></div>
          <div className="form-group"><label>Account Type</label>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as 'listener' | 'artist' })}>
              <option value="listener">Listener — Enjoy music (no verification needed)</option>
              <option value="artist">Artist — Upload &amp; earn (email verification required)</option>
            </select>
          </div>
          <button type="submit" className="btn-primary w-full" disabled={isLoading}>{isLoading ? <><i className="fas fa-spinner fa-spin" /> Creating account…</> : 'Create Account'}</button>
        </form>
        <p className="text-center mt-5 text-sm text-[#b3b3b3]">Already have an account? <Link to="/login" className="text-primary no-underline hover:underline">Login</Link></p>
      </div>
    </div>
  )
}
