import { format, addDays, isSameDay } from 'date-fns'
import { de } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { TrainingSession } from '../../types'

interface WeekViewProps {
  weekStart: Date
  sessions: TrainingSession[]
  onSessionClick: (session: TrainingSession) => void
  onPrevWeek: () => void
  onNextWeek: () => void
  onToday: () => void
}

const DOW = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

export function WeekView({ weekStart, sessions, onSessionClick, onPrevWeek, onNextWeek, onToday }: WeekViewProps) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const today = new Date()

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button onClick={onPrevWeek} className="p-2 text-slate-400 hover:text-white transition-colors">
          <ChevronLeft size={20} />
        </button>
        <button onClick={onToday} className="text-sm text-teal-400 font-medium">
          {format(weekStart, 'MMMM yyyy', { locale: de })}
        </button>
        <button onClick={onNextWeek} className="p-2 text-slate-400 hover:text-white transition-colors">
          <ChevronRight size={20} />
        </button>
      </div>
      <div className="overflow-x-auto scrollbar-none -mx-4 px-4">
        <div className="grid grid-cols-7 gap-1.5 min-w-[500px]">
          {days.map((day, i) => {
            const isToday = isSameDay(day, today)
            const daySessions = sessions.filter(s => {
              const d = new Date(s.date + 'T00:00:00')
              return isSameDay(d, day)
            })
            return (
              <div key={i} className="flex flex-col gap-1">
                <div className={`text-center pb-1.5 border-b ${isToday ? 'border-teal-500' : 'border-white/10'}`}>
                  <p className="text-xs text-slate-500">{DOW[i]}</p>
                  <p className={`text-sm font-semibold ${isToday ? 'text-teal-400' : 'text-white'}`}>{format(day, 'd')}</p>
                </div>
                <div className="flex flex-col gap-1 min-h-[80px]">
                  {daySessions.map(s => {
                    const color = s.is_external ? '#F97316' : (s.group_color ?? '#0EA5E9')
                    return (
                      <button
                        key={s.id}
                        onClick={() => onSessionClick(s)}
                        className={`text-left text-xs px-1.5 py-1 rounded-md font-medium transition-opacity w-full ${s.is_cancelled ? 'opacity-40 line-through' : ''}`}
                        style={{ backgroundColor: color + '33', color }}
                      >
                        <span className="block leading-tight">{s.start_time.slice(0, 5)}</span>
                        <span className="block leading-tight truncate">{s.title}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
