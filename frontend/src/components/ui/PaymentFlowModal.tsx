import { useState, useRef } from 'react'
import Modal from './Modal'
import { paymentsService } from '../../services/paymentsService'
import { validators } from '../../lib/validators'

type Step = 'confirm' | 'polling' | 'success' | 'failure'

export interface PaymentRequest {
  title: string
  summary: string
  amount: number
  type: string
  metadata?: Record<string, unknown>
}

interface Props {
  request: PaymentRequest
  onClose: () => void
  onSuccess?: (data: unknown) => void
  onFailure?: (message: string) => void
}

const METHODS = [
  { value: 'mtn_money', label: 'MTN Mobile Money' },
  { value: 'airtel_money', label: 'Airtel Money' },
  { value: 'zamtel_kwacha', label: 'Zamtel Kwacha' },
]

export default function PaymentFlowModal({ request, onClose, onSuccess, onFailure }: Props) {
  const [step, setStep] = useState<Step>('confirm')
  const [method, setMethod] = useState('mtn_money')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [statusMsg, setStatusMsg] = useState('')
  const [resultMsg, setResultMsg] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  const submit = async () => {
    setError('')
    if (!validators.zambianPhone(phone)) return setError('Enter a valid Zambian mobile number')
    if (!method) return setError('Select a payment method')

    setStep('polling')
    setStatusMsg('')
    const init = await paymentsService.initiatePayment(request.amount, request.type, method, phone, request.metadata || {})
    if (!init.success) {
      setStep('confirm')
      setError(init.error || 'Failed to start payment')
      return
    }
    const data = (init.data || {}) as { reference?: string; paymentReference?: string; payment?: { reference?: string } }
    const reference = data.reference || data.paymentReference || data.payment?.reference
    if (!reference) {
      setStep('failure'); setResultMsg('No payment reference returned.'); onFailure?.('No reference')
      return
    }

    abortRef.current = new AbortController()
    const poll = await paymentsService.pollStatus(reference, {
      signal: abortRef.current.signal,
      onUpdate: (s) => setStatusMsg(s ? `Status: ${s}` : ''),
    })

    if (poll.terminal === 'completed') {
      setStep('success'); setResultMsg('Your transaction has been completed.'); onSuccess?.(poll)
    } else if (poll.terminal === 'cancelled') {
      onClose()
    } else {
      setStep('failure')
      setResultMsg(poll.error || 'The transaction could not be completed.')
      onFailure?.(poll.error || 'Payment failed')
    }
  }

  const cancel = () => {
    abortRef.current?.abort()
    onClose()
  }

  const footer =
    step === 'confirm' ? (
      <>
        <button className="btn-secondary" onClick={cancel}>Cancel</button>
        <button className="btn-primary" onClick={submit}>Confirm Payment</button>
      </>
    ) : step === 'polling' ? (
      <button className="btn-secondary" onClick={cancel}>Cancel</button>
    ) : (
      <button className="btn-primary" onClick={onClose}>Done</button>
    )

  return (
    <Modal title={request.title} onClose={step === 'polling' ? cancel : onClose} footer={footer}>
      {step === 'confirm' && (
        <div>
          <p className="text-sm text-[#ccc] mb-2">{request.summary}</p>
          {request.amount > 0 && <p className="text-sm mb-4"><strong>Amount:</strong> K{request.amount.toFixed(2)}</p>}
          <div className="form-group"><label>Payment Method *</label>
            <select value={method} onChange={(e) => setMethod(e.target.value)}>{METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select>
          </div>
          <div className="form-group"><label>Phone Number *</label>
            <input type="tel" maxLength={13} placeholder="0977 123 456" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <small>Format: 097/096/095/077/076/075 + 7 digits.</small>
          </div>
          {error && <p className="text-danger text-sm mt-2">{error}</p>}
        </div>
      )}

      {step === 'polling' && (
        <div className="text-center py-6">
          <div className="spinner mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-1">Check your phone</h3>
          <p className="text-sm text-[#ccc]">A payment request has been sent. Approve it on your phone to complete the transaction.</p>
          <p className="text-xs text-[#888] mt-4">This usually takes 30–60 seconds. Don't close this window.</p>
          {statusMsg && <p className="text-sm mt-3 text-primary">{statusMsg}</p>}
        </div>
      )}

      {step === 'success' && (
        <div className="text-center py-6">
          <i className="fas fa-check-circle text-5xl text-success mb-3" />
          <h3 className="text-lg font-semibold mb-1">Payment successful</h3>
          <p className="text-sm text-[#ccc]">{resultMsg}</p>
        </div>
      )}

      {step === 'failure' && (
        <div className="text-center py-6">
          <i className="fas fa-times-circle text-5xl text-danger mb-3" />
          <h3 className="text-lg font-semibold mb-1">Payment failed</h3>
          <p className="text-sm text-[#ccc]">{resultMsg}</p>
        </div>
      )}
    </Modal>
  )
}
