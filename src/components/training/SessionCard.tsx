import type { TrainingSession } from '../../types'

interface SessionCardProps {
  session: TrainingSession
  onClick: () => void
}

export function SessionCard({ session, onClick }: SessionCardProps) {
  const time = session.start_time.slice(0, 5)
  const color = session.is_external ? '#F97316' : (session.group_color ?? '#0EA5E9')

  return (
    <div
      className="glass rounded-2xl p-4 cursor-pointer active:scale-98 transition-transform duration-200 relative overflow-hidden"
      onClick={onClick}
    >
      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl" style={{ backgroundColor: color }} />
      <div className="pl-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-slate-400">{time} Uhr · {session.duration_min} min</span>
          {session.is_cancelled && (
            <span className="text-xs bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full">Abgesagt</span>
          )}
        </div>
        <p className={`font-semibold text-white ${session.is_cancelled ? 'line-through opacity-50' : ''}`}>{session.title}</p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {session.group_name && (
            <span className="text-xs px-2 py-0.5 rounded-full text-white/80" style={{ backgroundColor: color + '33' }}>
              {session.group_name}
            </span>
          )}
          {session.location && <span className="text-xs text-slate-400">{session.location}</span>}
        </div>
      </div>
    </div>
  )
}
