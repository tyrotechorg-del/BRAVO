import { useState, useEffect, useRef } from 'react'
import { useAuthStore } from '../store/authStore'
import { userService } from '../services/userService'
import { authService } from '../services/authService'
import { toast } from '../store/toastStore'
import { validators } from '../lib/validators'
import { resolveImageUrl, APP_CONFIG } from '../lib/config'
import { Avatar } from '../components/ui/common'
import PasswordInput from '../components/ui/PasswordInput'
import { useConfirm } from '../hooks/useConfirm'

type Tab = 'profile' | 'preferences' | 'security'

export default function Settings() {
  const { user, refreshUser, logout } = useAuthStore()
  const { confirm, confirmDialog } = useConfirm()
  const [tab, setTab] = useState<Tab>('profile')

  // Profile
  const [profile, setProfile] = useState({ username: '', email: '', fullName: '', bio: '' })
  const [savingProfile, setSavingProfile] = useState(false)

  // Preferences
  const [prefs, setPrefs] = useState({ emailNotifications: true, pushNotifications: true, newFollower: true, newComment: true, marketing: false })
  const [savingPrefs, setSavingPrefs] = useState(false)

  // Security
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' })
  const [savingPw, setSavingPw] = useState(false)

  // Avatar
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  const pickAvatar = async (file: File | null) => {
    if (!file) return
    if (!file.type.startsWith('image/')) return toast.show('Please choose an image file', 'warning')
    if (file.size > APP_CONFIG.MAX_IMAGE_SIZE_MB * 1024 * 1024) return toast.show(`Image must be ${APP_CONFIG.MAX_IMAGE_SIZE_MB}MB or smaller`, 'warning')
    setAvatarPreview(URL.createObjectURL(file))
    setUploadingAvatar(true)
    const r = await userService.updateAvatar(file)
    setUploadingAvatar(false)
    if (!r.success) { setAvatarPreview(null); return toast.show(r.error || 'Failed to upload picture', 'error') }
    toast.show('Profile picture updated', 'success')
    refreshUser()
  }

  useEffect(() => {
    setProfile({ username: user?.username || '', email: user?.email || '', fullName: user?.fullName || '', bio: '' })
    userService.getProfile().then((r) => {
      if (r.success) {
        const u = (r.data && 'user' in r.data ? r.data.user : r.data) as typeof user & { bio?: string }
        if (u) setProfile((p) => ({ ...p, username: u.username || p.username, email: u.email || p.email, fullName: u.fullName || p.fullName, bio: u.bio || '' }))
      }
    })
  }, [user])

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validators.username(profile.username)) return toast.show('Username must be 3-30 chars (letters, numbers, . _ -)', 'warning')
    if (!validators.email(profile.email)) return toast.show('Enter a valid email', 'warning')
    setSavingProfile(true)
    const r = await userService.updateProfile(profile)
    setSavingProfile(false)
    if (!r.success) return toast.show(r.error || 'Failed to update profile', 'error')
    toast.show('Profile updated', 'success')
    refreshUser()
  }

  const savePrefs = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingPrefs(true)
    const r = await userService.updatePreferences(prefs)
    setSavingPrefs(false)
    toast.show(r.success ? 'Preferences saved' : r.error || 'Failed to save', r.success ? 'success' : 'error')
  }

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pw.current) return toast.show('Enter your current password', 'warning')
    if (!validators.password(pw.next)) return toast.show('New password needs 8+ chars, an uppercase letter, a number, and a special character', 'warning')
    if (pw.next !== pw.confirm) return toast.show('Passwords do not match', 'warning')
    setSavingPw(true)
    const r = await userService.changePassword(pw.current, pw.next)
    setSavingPw(false)
    if (!r.success) return toast.show(r.error || 'Failed to change password', 'error')
    toast.show('Password changed', 'success')
    setPw({ current: '', next: '', confirm: '' })
  }

  const deleteAccount = () => {
    confirm({
      message: 'Delete your account permanently? This cannot be undone.',
      confirmLabel: 'Delete Account',
      confirmClass: 'btn-danger',
      onConfirm: async () => {
        const password = window.prompt('Confirm your password to delete your account:')
        if (!password) return
        const r = await userService.deleteAccount(password)
        if (!r.success) return toast.show(r.error || 'Failed to delete account', 'error')
        toast.show('Account deleted', 'info')
        logout()
        window.location.href = '/'
      },
    })
  }

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'profile', label: 'Profile', icon: 'fa-user' },
    { id: 'preferences', label: 'Preferences', icon: 'fa-sliders-h' },
    { id: 'security', label: 'Security', icon: 'fa-lock' },
  ]

  return (
    <main className="max-w-[760px] mx-auto px-2 py-8">
      <h1 className="text-3xl font-bold mb-6 flex items-center gap-3"><i className="fas fa-cog text-primary" /> Settings</h1>

      <div className="flex gap-1 border-b border-[#2a2a2a] mb-6 overflow-x-auto">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab === t.id ? 'text-primary border-primary' : 'text-[#b3b3b3] border-transparent hover:text-white'}`}>
            <i className={`fas ${t.icon} mr-2`} />{t.label}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <form onSubmit={saveProfile} className="bg-[#1a1a1a] rounded-2xl p-6 border border-[#2a2a2a]">
          <div className="flex items-center gap-5 mb-6 pb-6 border-b border-[#2a2a2a]">
            <div className="relative">
              <Avatar src={avatarPreview || resolveImageUrl(user?.avatar)} className="w-20 h-20 rounded-full object-cover" />
              {uploadingAvatar && <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center"><i className="fas fa-spinner fa-spin text-white" /></div>}
            </div>
            <div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickAvatar(e.target.files?.[0] || null)} />
              <button type="button" className="btn-outline btn-sm" onClick={() => fileRef.current?.click()} disabled={uploadingAvatar}>
                <i className="fas fa-camera" /> {uploadingAvatar ? 'Uploading…' : 'Change Picture'}
              </button>
              <p className="text-xs text-[#888] mt-2">JPG or PNG, up to {APP_CONFIG.MAX_IMAGE_SIZE_MB}MB.</p>
            </div>
          </div>
          <div className="form-group"><label>Username</label><input value={profile.username} onChange={(e) => setProfile({ ...profile, username: e.target.value })} /></div>
          <div className="form-group"><label>Email</label><input type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} /></div>
          <div className="form-group"><label>Full Name</label><input value={profile.fullName} onChange={(e) => setProfile({ ...profile, fullName: e.target.value })} /></div>
          <div className="form-group"><label>Bio</label><textarea rows={3} value={profile.bio} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} placeholder="Tell others about yourself..." /></div>
          <button className="btn-primary" disabled={savingProfile}>{savingProfile ? 'Saving…' : 'Save Changes'}</button>
        </form>
      )}

      {tab === 'preferences' && (
        <form onSubmit={savePrefs} className="bg-[#1a1a1a] rounded-2xl p-6 border border-[#2a2a2a] space-y-4">
          {([
            ['emailNotifications', 'Email notifications'],
            ['pushNotifications', 'Push notifications'],
            ['newFollower', 'New follower alerts'],
            ['newComment', 'Comments on my songs'],
            ['marketing', 'Marketing & promotions'],
          ] as [keyof typeof prefs, string][]).map(([key, label]) => (
            <label key={key} className="flex items-center justify-between py-2 border-b border-[#2a2a2a] cursor-pointer">
              <span className="text-sm">{label}</span>
              <input type="checkbox" className="accent-primary w-4 h-4" checked={prefs[key]} onChange={(e) => setPrefs({ ...prefs, [key]: e.target.checked })} />
            </label>
          ))}
          <button className="btn-primary" disabled={savingPrefs}>{savingPrefs ? 'Saving…' : 'Save Preferences'}</button>
        </form>
      )}

      {tab === 'security' && (
        <>
          <form onSubmit={changePassword} className="bg-[#1a1a1a] rounded-2xl p-6 border border-[#2a2a2a] mb-6">
            <h3 className="font-semibold mb-4">Change Password</h3>
            <div className="form-group"><label>Current Password</label><PasswordInput value={pw.current} onChange={(v) => setPw({ ...pw, current: v })} autoComplete="current-password" required /></div>
            <div className="form-group"><label>New Password</label><PasswordInput value={pw.next} onChange={(v) => setPw({ ...pw, next: v })} placeholder="Enter new password" autoComplete="new-password" minLength={8} required /><small>At least 8 characters with uppercase, number, and special character.</small></div>
            <div className="form-group"><label>Confirm New Password</label><PasswordInput value={pw.confirm} onChange={(v) => setPw({ ...pw, confirm: v })} placeholder="Confirm new password" autoComplete="new-password" minLength={8} required /></div>
            <button className="btn-primary" disabled={savingPw}>{savingPw ? 'Updating…' : 'Update Password'}</button>
          </form>

          <div className="bg-[#1a1a1a] rounded-2xl p-6 border border-danger/30">
            <h3 className="font-semibold mb-2 text-danger">Danger Zone</h3>
            <p className="text-sm text-[#b3b3b3] mb-4">Permanently delete your account and all associated data.</p>
            <button type="button" className="btn-danger" onClick={deleteAccount}><i className="fas fa-trash" /> Delete Account</button>
          </div>
        </>
      )}
      {confirmDialog}
    </main>
  )
}
