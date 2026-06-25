import { useToastStore } from '../../store/toastStore'

const ICONS: Record<string, string> = {
  success: 'fa-check-circle',
  error: 'fa-exclamation-circle',
  info: 'fa-info-circle',
  warning: 'fa-exclamation-triangle',
}
const COLORS: Record<string, string> = {
  success: 'text-success border-l-success',
  error: 'text-danger border-l-danger',
  info: 'text-primary border-l-primary',
  warning: 'text-warning border-l-warning',
}

export default function ToastContainer() {
  const { toasts, remove } = useToastStore()
  return (
    <div className="fixed bottom-5 right-5 z-[10000] flex flex-col gap-2">
      {toasts.map((t) => {
        const [colorText, colorBorder] = (COLORS[t.type] || COLORS.info).split(' ')
        return (
          <div
            key={t.id}
            onClick={() => remove(t.id)}
            className={`flex items-center gap-3 bg-[#1a1a1a] rounded-lg px-4 py-3 shadow-lg2 border-l-4 ${colorBorder} animate-slide-in-right min-w-[280px] max-w-[380px] cursor-pointer`}
          >
            <i className={`fas ${ICONS[t.type] || ICONS.info} text-lg ${colorText}`} />
            <span className="text-sm text-white flex-1">{t.message}</span>
            <i className="fas fa-times text-xs text-[#b3b3b3]" />
          </div>
        )
      })}
    </div>
  )
}
