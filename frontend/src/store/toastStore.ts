import { create } from 'zustand'
import type { ToastItem, ToastType } from '../types'

interface ToastStore {
  toasts: ToastItem[]
  show: (message: string, type?: ToastType, duration?: number) => void
  remove: (id: string) => void
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  show: (message, type = 'info', duration = 4000) => {
    const id = Date.now().toString() + Math.random().toString(36).slice(2)
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }))
    window.setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
    }, duration)
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

// Imperative helper so non-component code can fire toasts (mirrors Toast.show?.())
export const toast = {
  show: (message: string, type: ToastType = 'info', duration = 4000) =>
    useToastStore.getState().show(message, type, duration),
}
