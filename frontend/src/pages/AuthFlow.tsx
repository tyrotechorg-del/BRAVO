import { useState, useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { authService } from '../services/authService'
import { toast } from '../store/toastStore'
import PasswordInput from '../components/ui/PasswordInput'

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[calc(100vh-60px)] flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-md bg-[#1a1a1a] rounded-2xl p-10 shadow-lg2 animate-fade-in">{children}</div>
    </div>
  )
}

export function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (loading) return
    const v = email.trim()
    if (!v) return setError('Please enter your email address')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return setError('Please enter a valid email address')
    setLoading(true); setError('')
    const result = await authService.forgotPassword(v)
    setLoading(false)
    if (result.success) { setSubmitted(true); toast.show('If your account exists, a reset link has been sent.', 'success') }
    else setError(result.error || 'Something went wrong. Please try again.')
  }

  if (submitted) {
    return (
      <Shell>
        <div className="text-center">
          <i className="fas fa-envelope text-6xl text-primary mb-5 block" />
          <h2 className="text-2xl font-bold mb-3">Check Your Email</h2>
          <p className="text-[#b3b3b3] mb-2">If an account exists for <strong className="text-white">{email}</strong>, a password reset link has been sent.</p>
          <p className="text-[#888] text-sm mb-6">The link will expire in 1 hour.</p>
          <div className="flex gap-3 justify-center">
            <Link to="/login" className="btn-primary no-underline">Back to Login</Link>
            <button className="btn-outline" onClick={() => submit()} disabled={loading}>{loading ? 'Sending…' : 'Resend Email'}</button>
          </div>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <h2 className="text-2xl font-bold mb-2">Forgot Password</h2>
      <p className="text-[#b3b3b3] text-sm mb-6">Enter your email address and we'll send you a link to reset your password.</p>
      {error && <div className="mb-4 p-3 bg-danger/10 border border-danger/30 rounded-lg text-danger text-sm">{error}</div>}
      <form onSubmit={submit} className="space-y-4">
        <div className="form-group"><label>Email Address</label><input type="email" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
        <button type="submit" className="btn-primary w-full" disabled={loading}>{loading ? <><i className="fas fa-spinner fa-spin" /> Sending…</> : 'Send Reset Link'}</button>
      </form>
      <p className="text-center mt-5 text-sm"><Link to="/login" className="text-primary no-underline hover:underline">← Back to Login</Link></p>
    </Shell>
  )
}

export function ResetPassword() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [tokenInvalid, setTokenInvalid] = useState(false)

  const validate = (): string | null => {
    if (!password || password.length < 8) return 'Password must be at least 8 characters'
    if (!/[A-Z]/.test(password)) return 'Password must contain an uppercase letter'
    if (!/[0-9]/.test(password)) return 'Password must contain a number'
    if (!/[^A-Za-z0-9]/.test(password)) return 'Password must contain a special character'
    if (password !== confirm) return 'Passwords do not match'
    return null
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    const err = validate()
    if (err) return setError(err)
    setLoading(true); setError('')
    const result = await authService.resetPassword(token || '', password)
    setLoading(false)
    if (result.success) { setSuccess(true); toast.show('Password reset successfully', 'success') }
    else if (result.status === 429) setError('Too many attempts. Please wait and try again.')
    else if (result.status === 400 || result.error?.toLowerCase().includes('token')) setTokenInvalid(true)
    else setError(result.error || 'Failed to reset password')
  }

  if (success) {
    return (
      <Shell>
        <div className="text-center">
          <i className="fas fa-check-circle text-6xl text-success mb-5 block" />
          <h2 className="text-2xl font-bold mb-3">Password Reset Successful!</h2>
          <p className="text-[#b3b3b3] mb-6">You can now login with your new password.</p>
          <button className="btn-primary" onClick={() => navigate('/login')}>Go to Login</button>
        </div>
      </Shell>
    )
  }

  if (!token || tokenInvalid) {
    return (
      <Shell>
        <div className="text-center">
          <i className="fas fa-exclamation-triangle text-6xl text-warning mb-5 block" />
          <h2 className="text-2xl font-bold mb-3">Invalid or Expired Link</h2>
          <p className="text-[#b3b3b3] mb-6">This password reset link is invalid or has expired. Reset links are valid for 1 hour.</p>
          <div className="flex gap-3 justify-center">
            <Link to="/forgot-password" className="btn-primary no-underline">Request a New Link</Link>
            <Link to="/login" className="btn-outline no-underline">Back to Login</Link>
          </div>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <h2 className="text-2xl font-bold mb-2">Reset Password</h2>
      <p className="text-[#b3b3b3] text-sm mb-6">Enter your new password below.</p>
      {error && <div className="mb-4 p-3 bg-danger/10 border border-danger/30 rounded-lg text-danger text-sm">{error}</div>}
      <form onSubmit={submit} className="space-y-4">
        <div className="form-group"><label>New Password</label><PasswordInput value={password} onChange={setPassword} placeholder="Enter new password" autoComplete="new-password" minLength={8} required /><small>At least 8 characters with uppercase, number, and special character.</small></div>
        <div className="form-group"><label>Confirm Password</label><PasswordInput value={confirm} onChange={setConfirm} placeholder="Confirm new password" autoComplete="new-password" minLength={8} required /></div>
        <button type="submit" className="btn-primary w-full" disabled={loading}>{loading ? <><i className="fas fa-spinner fa-spin" /> Resetting…</> : 'Reset Password'}</button>
      </form>
      <p className="text-center mt-5 text-sm"><Link to="/login" className="text-primary no-underline hover:underline">← Back to Login</Link></p>
    </Shell>
  )
}

export function VerifyEmail() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [state, setState] = useState<'verifying' | 'success' | 'error'>('verifying')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!token) { setState('error'); setMessage('No verification token provided.'); return }
    authService.verifyEmail(token).then((result) => {
      if (result.success) { setState('success'); setMessage(result.message || 'Your email has been verified.') }
      else { setState('error'); setMessage(result.error || 'Verification failed or the link has expired.') }
    })
  }, [token])

  return (
    <Shell>
      <div className="text-center">
        {state === 'verifying' && <><i className="fas fa-spinner fa-spin text-6xl text-primary mb-5 block" /><h2 className="text-2xl font-bold mb-3">Verifying your email…</h2></>}
        {state === 'success' && <>
          <i className="fas fa-check-circle text-6xl text-success mb-5 block" />
          <h2 className="text-2xl font-bold mb-3">Email Verified!</h2>
          <p className="text-[#b3b3b3] mb-6">{message}</p>
          <button className="btn-primary" onClick={() => navigate('/login')}>Continue to Login</button>
        </>}
        {state === 'error' && <>
          <i className="fas fa-exclamation-triangle text-6xl text-warning mb-5 block" />
          <h2 className="text-2xl font-bold mb-3">Verification Failed</h2>
          <p className="text-[#b3b3b3] mb-6">{message}</p>
          <Link to="/login" className="btn-primary no-underline">Back to Login</Link>
        </>}
      </div>
    </Shell>
  )
}
