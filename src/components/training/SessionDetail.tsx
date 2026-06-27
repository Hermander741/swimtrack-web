import { format, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'
import { X } from 'lucide-react'
import type { TrainingSession } from '../../types'
import { BlockItem } from './BlockItem'

interface SessionDetailProps {
  session: TrainingSession
  onClose: () => void
}

export function SessionDetail({ session, onClose }: SessionDetailProps) {
  const dateStr = format(parseISO(session.date), 'EEEE, d. MMMM yyyy', { locale: de })
  const time = session.start_time.slice(0, 5)
  const color = session.is_external ? '#F97316' : (session.group_color ?? '#0EA5E9')

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full glass rounded-t-3xl pb-8 safe-bottom animate-in slide-in-from-bottom max-h-[85dvh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-4 pb-2 flex-shrink-0">
          <div className="w-10 h-1 bg-white/20 rounded-full mx-auto" />
          <button onClick={onClose} className="absolute right-4 top-4 p-2 text-slate-400 hover:text-white"><X size={20} /></button>
        </div>
        <div className="overflow-y-auto scrollbar-none px-6 pb-4">
          {session.is_cancelled && (
            <div className="mb-4 bg-red-500/20 border border-red-500/30 rounded-xl px-4 py-2 text-red-400 text-sm text-center">
              Diese Einheit wurde abgesagt
            </div>
          )}
          <div className="flex items-start gap-3 mb-4">
            <div className="w-3 h-3 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: color }} />
            <div>
              <h2 className={`text-xl font-bold text-white ${session.is_cancelled ? 'line-through opacity-60' : ''}`}>
                {session.title}
              </h2>
              {session.group_name && <p className="text-sm text-slate-400 mt-0.5">{session.group_name}</p>}
            </div>
          </div>
          <div className="space-y-2 mb-4 text-sm text-slate-300">
            <div className="flex gap-3"><span className="text-slate-500 w-14 flex-shrink-0">Datum</span><span>{dateStr}</span></div>
            <div className="flex gap-3"><span className="text-slate-500 w-14 flex-shrink-0">Zeit</span><span>{time} Uhr · {session.duration_min} min</span></div>
            {session.location && <div className="flex gap-3"><span className="text-slate-500 w-14 flex-shrink-0">Ort</span><span>{session.location}</span></div>}
          </div>
          {session.blocks && session.blocks.length > 0 && (
            <div className="mb-4">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Trainingsinhalt</h3>
              <div className="glass rounded-xl px-4">
                {session.blocks.map(b => <BlockItem key={b.position} block={b} />)}
              </div>
            </div>
          )}
          {session.notes && (
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Notizen</h3>
              <p className="text-sm text-slate-300">{session.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
