import { useEffect, useState, useCallback } from 'react'
import { adminService } from '../../services/adminService'
import { toast } from '../../store/toastStore'
import { GENRES } from '../../lib/config'
import { Spinner } from '../../components/ui/common'
import type { SystemSettings } from '../../types'

const DEFAULTS: Required<SystemSettings> = {
  platformName: 'Bravo Music',
  platformUrl: '',
  contactEmail: '',
  platformCommission: 10,
  minWithdrawalAmount: 50,
  maxUploadSize: 20,
  subscriptionPrice: 30,
  maintenanceMode: false,
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Required<SystemSettings>>(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [backing, setBacking] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const result = await adminService.getSystemSettings()
    if (!result.success) {
      setLoadError(result.error || 'unknown error')
      setSettings(DEFAULTS)
    } else {
      setLoadError('')
      const data = result.data
      const s = (data && 'settings' in data ? data.settings : data) as SystemSettings
      setSettings({ ...DEFAULTS, ...s })
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const set = <K extends keyof SystemSettings>(key: K, val: SystemSettings[K]) =>
    setSettings((prev) => ({ ...prev, [key]: val }))

  const save = async () => {
    const s = settings
    if (!s.platformName.trim()) return toast.show('Platform name required', 'warning')
    if (s.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.contactEmail)) return toast.show('Invalid contact email', 'warning')
    if (s.platformUrl && !/^https?:\/\//i.test(s.platformUrl)) return toast.show('Platform URL must start with http(s)://', 'warning')
    if (s.platformCommission < 0 || s.platformCommission > 50) return toast.show('Commission must be between 0 and 50', 'warning')
    if (s.minWithdrawalAmount < 10) return toast.show('Min withdrawal must be at least 10', 'warning')
    if (s.maxUploadSize < 5 || s.maxUploadSize > 500) return toast.show('Max upload size must be between 5 and 500 MB', 'warning')
    if (s.subscriptionPrice < 0) return toast.show('Subscription price must be non-negative', 'warning')

    setSaving(true)
    const result = await adminService.updateSystemSettings(s)
    setSaving(false)
    if (!result.success) return toast.show(result.error || 'Save failed', 'error')
    const data = result.data
    const returned = (data && 'settings' in data ? data.settings : data) as SystemSettings
    setSettings({ ...DEFAULTS, ...returned })
    toast.show('Settings saved', 'success')
  }

  const triggerBackup = async () => {
    setBacking(true)
    const result = await adminService.triggerBackup()
    setBacking(false)
    toast.show(result.success ? 'Backup triggered' : result.error || 'Backup failed', result.success ? 'success' : 'error')
  }

  if (loading) return <Spinner />

  return (
    <div>
      <div className="page-header">
        <h1><i className="fas fa-cog" /> System Settings</h1>
        <p>Configure platform-wide settings and limits.</p>
      </div>

      {loadError && (
        <div className="bg-warning/10 p-3 rounded-lg mb-4 text-sm">
          <i className="fas fa-exclamation-triangle text-warning mr-2" />
          Could not load settings from server ({loadError}). Showing defaults.
        </div>
      )}

      <div className="grid gap-4">
        <div className="settings-card">
          <h3><i className="fas fa-globe" /> General</h3>
          <div className="form-group"><label>Platform Name</label><input type="text" maxLength={100} value={settings.platformName} onChange={(e) => set('platformName', e.target.value)} /></div>
          <div className="form-group"><label>Platform URL</label><input type="url" maxLength={200} value={settings.platformUrl} onChange={(e) => set('platformUrl', e.target.value)} /></div>
          <div className="form-group"><label>Contact Email</label><input type="email" maxLength={200} value={settings.contactEmail} onChange={(e) => set('contactEmail', e.target.value)} /></div>
        </div>

        <div className="settings-card">
          <h3><i className="fas fa-chart-line" /> Financial</h3>
          <div className="form-group"><label>Platform Commission (%)</label><input type="number" step={0.5} min={0} max={50} value={settings.platformCommission} onChange={(e) => set('platformCommission', parseFloat(e.target.value) || 0)} /><small>Percent taken from each artist sale / withdrawal.</small></div>
          <div className="form-group"><label>Minimum Withdrawal (Kwacha)</label><input type="number" step={10} min={10} value={settings.minWithdrawalAmount} onChange={(e) => set('minWithdrawalAmount', parseFloat(e.target.value) || 0)} /></div>
          <div className="form-group"><label>Max Upload Size (MB)</label><input type="number" step={5} min={5} max={500} value={settings.maxUploadSize} onChange={(e) => set('maxUploadSize', parseInt(e.target.value) || 0)} /></div>
          <div className="form-group"><label>Premium Subscription Price (Kwacha / month)</label><input type="number" step={1} min={0} value={settings.subscriptionPrice} onChange={(e) => set('subscriptionPrice', parseFloat(e.target.value) || 0)} /></div>
        </div>

        <div className="settings-card">
          <h3><i className="fas fa-music" /> Content</h3>
          <div className="form-group">
            <label>Allowed Genres</label>
            <div className="flex gap-1.5 flex-wrap">{GENRES.map((g) => <span key={g} className="badge">{g}</span>)}</div>
            <small>Genres are defined in the canonical list and cannot be edited from here.</small>
          </div>
        </div>

        <div className="settings-card">
          <h3><i className="fas fa-tools" /> Maintenance</h3>
          <div className="form-group">
            <label className="checkbox-label"><input type="checkbox" checked={settings.maintenanceMode} onChange={(e) => set('maintenanceMode', e.target.checked)} /> Enable Maintenance Mode</label>
            <small>When enabled, only admins can access the site.</small>
          </div>
          <button type="button" className="btn-outline" onClick={triggerBackup} disabled={backing}><i className="fas fa-database" /> {backing ? 'Backing up…' : 'Trigger Backup'}</button>
        </div>
      </div>

      <div className="flex gap-2 mt-6">
        <button className="btn-primary" onClick={save} disabled={saving}><i className="fas fa-save" /> {saving ? 'Saving…' : 'Save All Settings'}</button>
        <button className="btn-outline" onClick={load}><i className="fas fa-sync-alt" /> Reload from Server</button>
      </div>
    </div>
  )
}
