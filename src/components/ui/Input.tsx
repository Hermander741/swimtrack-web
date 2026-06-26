import { useState } from 'react'
import type { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
}

export function Input({ label, error, id, className = '', ...props }: InputProps) {
  const [focused, setFocused] = useState(false)
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-')
  const hasValue = Boolean(props.value || props.defaultValue)
  const floated = focused || hasValue

  return (
    <div className={`relative ${className}`}>
      <input
        id={inputId}
        className={`w-full glass rounded-xl px-4 pt-6 pb-2 text-white placeholder-transparent outline-none transition-all duration-200
          focus:ring-2 focus:ring-teal-500/50 ${error ? 'ring-2 ring-red-500/50' : ''}`}
        placeholder={label}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...props}
      />
      <label
        htmlFor={inputId}
        className={`absolute left-4 transition-all duration-200 pointer-events-none
          ${floated ? 'top-2 text-xs text-teal-400' : 'top-4 text-sm text-slate-400'}`}
      >
        {label}
      </label>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  )
}
