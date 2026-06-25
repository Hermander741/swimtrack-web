import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  onClick?: () => void
  glass?: boolean
}

export function Card({ children, className = '', onClick, glass }: CardProps) {
  const base = glass
    ? 'bg-white/5 backdrop-blur-md border border-white/10'
    : 'bg-slate-800/60 border border-slate-700/50'
  return (
    <div
      className={`rounded-2xl ${base} ${onClick ? 'cursor-pointer active:scale-[0.98] transition-transform' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  )
}

export function StatCard({
  label,
  value,
  sub,
  color = 'sky',
  icon,
}: {
  label: string
  value: string | number
  sub?: string
  color?: 'sky' | 'emerald' | 'violet' | 'amber' | 'rose'
  icon?: ReactNode
}) {
  const colors = {
    sky: 'text-sky-400 bg-sky-400/10',
    emerald: 'text-emerald-400 bg-emerald-400/10',
    violet: 'text-violet-400 bg-violet-400/10',
    amber: 'text-amber-400 bg-amber-400/10',
    rose: 'text-rose-400 bg-rose-400/10',
  }
  return (
    <Card className="p-4">
      <div className={`w-8 h-8 rounded-lg ${colors[color]} flex items-center justify-center mb-3`}>
        {icon}
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-xs text-slate-400 mt-0.5">{label}</div>
      {sub && <div className="text-[10px] text-slate-500 mt-0.5">{sub}</div>}
    </Card>
  )
}
