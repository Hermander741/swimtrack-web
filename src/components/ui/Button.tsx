import type { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  loading?: boolean
}

export function Button({ variant = 'primary', loading, children, className = '', ...props }: ButtonProps) {
  const base = 'inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95'
  const variants = {
    primary: 'bg-gradient-to-r from-teal-500 to-sky-500 text-white hover:from-teal-400 hover:to-sky-400 shadow-lg shadow-teal-500/25',
    secondary: 'glass text-white hover:bg-white/10',
    ghost: 'text-slate-400 hover:text-white hover:bg-white/5',
    danger: 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30',
  }
  return (
    <button className={`${base} ${variants[variant]} ${className}`} disabled={loading || props.disabled} {...props}>
      {loading ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" /> : null}
      {children}
    </button>
  )
}
