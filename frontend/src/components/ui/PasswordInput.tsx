import { useState } from 'react'

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
  minLength?: number
  autoComplete?: string
  id?: string
  name?: string
  className?: string
}

// Password field with a built-in show/hide eye toggle.
// Replaces the original DOM-scanning passwordToggle.js with a proper React component.
export default function PasswordInput({
  value,
  onChange,
  placeholder = '••••••••',
  required = false,
  minLength,
  autoComplete = 'current-password',
  id,
  name,
  className = '',
}: Props) {
  const [show, setShow] = useState(false)

  return (
    <div className="pw-reveal-wrap">
      <input
        type={show ? 'text' : 'password'}
        id={id}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        className={className}
      />
      <button
        type="button"
        className="pw-reveal-btn"
        aria-label={show ? 'Hide password' : 'Show password'}
        aria-pressed={show}
        title={show ? 'Hide password' : 'Show password'}
        onClick={() => setShow((s) => !s)}
        tabIndex={0}
      >
        <i className={`fas fa-eye${show ? '-slash' : ''}`} aria-hidden="true" />
      </button>
    </div>
  )
}
