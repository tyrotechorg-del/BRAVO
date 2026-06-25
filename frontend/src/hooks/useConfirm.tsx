import { useState, useCallback } from 'react'
import { ConfirmModal } from '../components/ui/Modal'

interface ConfirmOptions {
  message: string
  confirmLabel?: string
  confirmClass?: string
  onConfirm: () => void
}

export function useConfirm() {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null)

  const confirm = useCallback((options: ConfirmOptions) => setOpts(options), [])

  const dialog = opts ? (
    <ConfirmModal
      message={opts.message}
      confirmLabel={opts.confirmLabel}
      confirmClass={opts.confirmClass}
      onConfirm={() => {
        opts.onConfirm()
        setOpts(null)
      }}
      onCancel={() => setOpts(null)}
    />
  ) : null

  return { confirm, confirmDialog: dialog }
}
