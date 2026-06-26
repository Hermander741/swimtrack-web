import type { Role } from '../../types'

const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  trainer: 'Trainer',
  eltern: 'Eltern',
  mitglied: 'Mitglied',
}

const ROLE_COLORS: Record<Role, string> = {
  admin: 'bg-red-500/20 text-red-400 border-red-500/30',
  trainer: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
  eltern: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
  mitglied: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
}

export function Badge({ role }: { role: Role }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${ROLE_COLORS[role]}`}>
      {ROLE_LABELS[role]}
    </span>
  )
}
