import { useEffect, type ReactNode } from 'react'

interface Props {
  title: ReactNode
  children: ReactNode
  onClose: () => void
  footer?: ReactNode
  maxWidth?: string
}

export default function Modal({ title, children, onClose, footer, maxWidth = 'max-w-lg' }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/70 p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className={`w-full ${maxWidth} bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl shadow-lg2 max-h-[90vh] flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a]">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="btn-icon" aria-label="Close">
            <i className="fas fa-times" />
          </button>
        </div>
        <div className="px-6 py-5 overflow-y-auto">{children}</div>
        {footer && (
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-[#2a2a2a]">{footer}</div>
        )}
      </div>
    </div>
  )
}

interface ConfirmProps {
  message: ReactNode
  confirmLabel?: string
  confirmClass?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  message,
  confirmLabel = 'Confirm',
  confirmClass = 'btn-primary',
  onConfirm,
  onCancel,
}: ConfirmProps) {
  return (
    <Modal
      title="Confirm"
      onClose={onCancel}
      footer={
        <>
          <button className="btn-secondary" onClick={onCancel}>Cancel</button>
          <button className={confirmClass} onClick={onConfirm}>{confirmLabel}</button>
        </>
      }
    >
      <p className="text-sm text-[#ccc]">{message}</p>
    </Modal>
  )
}
