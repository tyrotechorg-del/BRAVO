import { useEffect, useState, useCallback } from 'react'
import { walletService, type Transaction, type EarningsData } from '../services/walletService'
import { paymentsService } from '../services/paymentsService'
import { subscriptionsService, type MySubscription } from '../services/subscriptionsService'
import { toast } from '../store/toastStore'
import { Spinner, EmptyState } from '../components/ui/common'
import { formatCurrency, formatDate } from '../lib/formatters'
import { MOBILE_MONEY } from '../lib/config'
import { useAuthStore } from '../store/authStore'

/* ----------------------------- Wallet ----------------------------- */
export function Wallet() {
  const [balance, setBalance] = useState(0)
  const [txns, setTxns] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [showDeposit, setShowDeposit] = useState(false)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('mtn')
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [b, t] = await Promise.all([walletService.getBalance(), walletService.getTransactions(1, 20)])
    if (b.success) setBalance(b.data?.balance || 0)
    if (t.success) {
      const d = t.data as { transactions?: Transaction[] } | Transaction[]
      setTxns(Array.isArray(d) ? d : d?.transactions || [])
    }
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const deposit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || parseFloat(amount) <= 0) return toast.show('Enter a valid amount', 'warning')
    if (!phone) return toast.show('Enter your mobile money number', 'warning')
    setBusy(true)
    const result = await walletService.deposit(parseFloat(amount), method, phone)
    if (!result.success) { setBusy(false); return toast.show(result.error || 'Deposit failed', 'error') }
    const ref = (result.data as { reference?: string })?.reference
    toast.show('Deposit initiated. Approve the prompt on your phone.', 'info')
    if (ref) {
      await paymentsService.pollStatus(ref, { onUpdate: (s) => { if (s === 'completed') toast.show('Deposit completed!', 'success') } })
    }
    setBusy(false); setShowDeposit(false); setAmount(''); setPhone(''); load()
  }

  return (
    <main className="max-w-[900px] mx-auto px-2 py-8">
      <h1 className="text-3xl font-bold mb-6 flex items-center gap-3"><i className="fas fa-wallet text-primary" /> Wallet</h1>
      <div className="bg-gradient-to-br from-primary to-primary-dark rounded-2xl p-8 mb-6">
        <p className="text-white/70 text-sm mb-1">Available Balance</p>
        <p className="text-4xl font-extrabold mb-4">{formatCurrency(balance)}</p>
        <button className="bg-white text-primary font-semibold px-5 py-2.5 rounded-lg border-none" onClick={() => setShowDeposit(!showDeposit)}>
          <i className="fas fa-plus mr-2" />Deposit Funds
        </button>
      </div>

      {showDeposit && (
        <form onSubmit={deposit} className="bg-[#1a1a1a] rounded-2xl p-6 mb-6 border border-[#2a2a2a]">
          <h3 className="font-semibold mb-4">Deposit via Mobile Money</h3>
          <div className="form-group"><label>Amount (Kwacha)</label><input type="number" min="1" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          <div className="form-group"><label>Provider</label><select value={method} onChange={(e) => setMethod(e.target.value)}>{Object.entries(MOBILE_MONEY).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}</select></div>
          <div className="form-group"><label>Phone Number</label><input type="tel" placeholder="0970000000" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          <button className="btn-primary" disabled={busy}>{busy ? 'Processing…' : 'Confirm Deposit'}</button>
        </form>
      )}

      <h2 className="text-lg font-semibold mb-3">Recent Transactions</h2>
      {loading ? <Spinner /> : txns.length === 0 ? <EmptyState icon="fa-receipt" title="No transactions yet" /> : (
        <div className="bg-[#1a1a1a] rounded-2xl border border-[#2a2a2a] divide-y divide-[#2a2a2a]">
          {txns.map((t) => (
            <div key={t._id} className="flex items-center justify-between p-4">
              <div><p className="font-medium text-sm capitalize">{t.type}</p><p className="text-xs text-[#b3b3b3]">{t.description || ''} · {t.createdAt ? formatDate(t.createdAt, 'relative') : ''}</p></div>
              <div className="text-right"><p className={`font-semibold ${['deposit', 'earning', 'refund'].includes(t.type) ? 'text-success' : 'text-white'}`}>{formatCurrency(t.amount)}</p>{t.status && <span className={`status-badge status-${t.status}`}>{t.status}</span>}</div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}

/* ----------------------------- Earnings (artist) ----------------------------- */
export function Earnings() {
  const user = useAuthStore((s) => s.user)
  const [data, setData] = useState<EarningsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ amount: '', method: 'mtn', phone: '' })
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const result = await walletService.getEarnings()
    if (result.success) setData(result.data as EarningsData)
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const withdraw = async (e: React.FormEvent) => {
    e.preventDefault()
    const amt = parseFloat(form.amount)
    if (!amt || amt < 50) return toast.show('Minimum withdrawal is K50', 'warning')
    if (!form.phone) return toast.show('Enter your account/phone number', 'warning')
    setBusy(true)
    const result = await walletService.withdraw(amt, form.method, { phoneNumber: form.phone })
    setBusy(false)
    if (!result.success) return toast.show(result.error || 'Withdrawal failed', 'error')
    toast.show('Withdrawal requested! Admin will process it shortly.', 'success')
    setForm({ amount: '', method: 'mtn', phone: '' }); load()
  }

  const stats = [
    { label: 'Total Earned', value: formatCurrency(data?.totalEarnings || 0), icon: 'fa-money-bill-wave', color: '#00c853' },
    { label: 'Available', value: formatCurrency(data?.availableBalance || 0), icon: 'fa-wallet', color: '#6c63ff' },
    { label: 'Pending', value: formatCurrency(data?.pendingBalance || 0), icon: 'fa-clock', color: '#ffc107' },
    { label: 'Total Plays', value: String(data?.totalPlays || 0), icon: 'fa-play', color: '#ff6584' },
  ]

  return (
    <main className="max-w-[1000px] mx-auto px-2 py-8">
      <h1 className="text-3xl font-bold mb-1 flex items-center gap-3"><i className="fas fa-chart-line text-primary" /> Earnings</h1>
      <p className="text-[#b3b3b3] mb-8">Track your revenue, {user?.username}.</p>
      {loading ? <Spinner /> : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {stats.map((s) => (
              <div key={s.label} className="bg-[#1a1a1a] rounded-2xl p-5 text-center border border-[#2a2a2a]">
                <i className={`fas ${s.icon} text-2xl mb-3 block`} style={{ color: s.color }} />
                <p className="text-xs text-[#b3b3b3] uppercase tracking-wider mb-1">{s.label}</p>
                <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <form onSubmit={withdraw} className="bg-[#1a1a1a] rounded-2xl p-6 border border-[#2a2a2a]">
              <h3 className="font-semibold mb-4 flex items-center gap-2"><i className="fas fa-money-bill text-primary" /> Request Withdrawal</h3>
              <div className="form-group"><label>Amount (K)</label><input type="number" min="50" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="Minimum K50" /></div>
              <div className="form-group"><label>Method</label><select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>{Object.entries(MOBILE_MONEY).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}<option value="bank_transfer">Bank Transfer</option></select></div>
              <div className="form-group"><label>Account / Phone</label><input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="0970000000" /></div>
              <button className="btn-primary w-full" disabled={busy}>{busy ? 'Submitting…' : 'Submit Request'}</button>
            </form>
            <div className="bg-[#1a1a1a] rounded-2xl p-6 border border-[#2a2a2a]">
              <h3 className="font-semibold mb-4 flex items-center gap-2"><i className="fas fa-history text-primary" /> Recent Transactions</h3>
              {data?.recentTransactions?.length ? (
                <div className="divide-y divide-[#2a2a2a]">
                  {data.recentTransactions.map((t) => (
                    <div key={t._id} className="flex justify-between py-3"><span className="text-sm capitalize">{t.type}</span><span className="text-sm font-semibold text-success">{formatCurrency(t.amount)}</span></div>
                  ))}
                </div>
              ) : <p className="text-[#b3b3b3] text-sm text-center py-8">No transactions yet.</p>}
            </div>
          </div>
        </>
      )}
    </main>
  )
}

/* ----------------------------- Subscription ----------------------------- */
export function Subscription() {
  const [plans, setPlans] = useState<{ id: string; name: string; price: number; features?: string[] }[]>([])
  const [mine, setMine] = useState<MySubscription | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const [p, m] = await Promise.all([subscriptionsService.getPlans(), subscriptionsService.getMySubscription()])
      if (p.success) {
        const d = p.data as { plans?: typeof plans } | typeof plans
        setPlans(Array.isArray(d) ? d : d?.plans || [])
      }
      if (m.success) setMine((m.data as { subscription?: MySubscription })?.subscription || (m.data as MySubscription))
      setLoading(false)
    })()
  }, [])

  const subscribe = async (planId: string) => {
    const phone = prompt('Enter your mobile money number:')
    if (!phone) return
    const result = await subscriptionsService.subscribe(planId, 'mtn', phone)
    toast.show(result.success ? 'Subscription initiated! Approve the prompt on your phone.' : result.error || 'Failed', result.success ? 'success' : 'error')
  }

  return (
    <main className="max-w-[1000px] mx-auto px-2 py-8">
      <h1 className="text-3xl font-bold mb-1 flex items-center gap-3"><i className="fas fa-crown text-warning" /> Subscription</h1>
      <p className="text-[#b3b3b3] mb-8">Upgrade for premium streaming and artist tools.</p>
      {mine?.status === 'active' && (
        <div className="bg-success/10 border border-success/30 rounded-xl p-4 mb-6 text-sm">
          <i className="fas fa-check-circle text-success mr-2" />You're on the <strong>{mine.planName || mine.plan?.name}</strong> plan. {mine.endDate && `Renews ${formatDate(mine.endDate, 'long')}.`}
        </div>
      )}
      {loading ? <Spinner /> : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {plans.length === 0 ? <EmptyState icon="fa-crown" title="No plans available" /> : plans.map((p) => (
            <div key={p.id} className="bg-[#1a1a1a] rounded-2xl p-6 border border-[#2a2a2a] hover:border-primary transition-colors">
              <h3 className="text-lg font-bold mb-1">{p.name}</h3>
              <p className="text-3xl font-extrabold text-primary mb-4">K{p.price}<span className="text-sm text-[#b3b3b3] font-normal">/mo</span></p>
              <ul className="space-y-2 mb-6 text-sm">{(p.features || []).map((f, i) => <li key={i} className="flex items-center gap-2"><i className="fas fa-check text-success" />{f}</li>)}</ul>
              <button className="btn-primary w-full" onClick={() => subscribe(p.id)}>Subscribe</button>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}

/* ----------------------------- Payment History ----------------------------- */
export function PaymentHistory() {
  const [items, setItems] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    paymentsService.getHistory(1, 30).then((r) => {
      if (r.success) {
        const d = r.data as { payments?: Transaction[]; history?: Transaction[] } | Transaction[]
        setItems(Array.isArray(d) ? d : d?.payments || d?.history || [])
      }
    }).finally(() => setLoading(false))
  }, [])
  return (
    <main className="max-w-[900px] mx-auto px-2 py-8">
      <h1 className="text-3xl font-bold mb-6 flex items-center gap-3"><i className="fas fa-receipt text-primary" /> Payment History</h1>
      {loading ? <Spinner /> : items.length === 0 ? <EmptyState icon="fa-receipt" title="No payments yet" /> : (
        <div className="bg-[#1a1a1a] rounded-2xl border border-[#2a2a2a] divide-y divide-[#2a2a2a]">
          {items.map((t) => (
            <div key={t._id} className="flex items-center justify-between p-4">
              <div><p className="font-medium text-sm capitalize">{t.type || t.description}</p><p className="text-xs text-[#b3b3b3]">{t.reference || ''} · {t.createdAt ? formatDate(t.createdAt, 'long') : ''}</p></div>
              <div className="text-right"><p className="font-semibold">{formatCurrency(t.amount)}</p>{t.status && <span className={`status-badge status-${t.status}`}>{t.status}</span>}</div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
