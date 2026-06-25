export const validators = {
  email(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim())
  },
  username(username: string): boolean {
    return /^[a-zA-Z0-9_.-]{3,30}$/.test(String(username || ''))
  },
  // At least 8 chars, one uppercase, one number, one special char
  password(password: string): boolean {
    const p = String(password || '')
    return p.length >= 8 && /[A-Z]/.test(p) && /[0-9]/.test(p) && /[^a-zA-Z0-9]/.test(p)
  },
  // Zambian phone: 09XXXXXXXX or +2609XXXXXXXX
  zambianPhone(phone: string): boolean {
    const p = String(phone || '').replace(/\s+/g, '')
    return /^(?:\+?260|0)?9[5-7]\d{7}$/.test(p)
  },
  required(value: unknown): boolean {
    return value !== null && value !== undefined && String(value).trim().length > 0
  },
  minLength(value: string, min: number): boolean {
    return String(value || '').length >= min
  },
  positiveNumber(value: unknown): boolean {
    const n = Number(value)
    return Number.isFinite(n) && n > 0
  },
}
