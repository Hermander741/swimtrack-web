import { format, parseISO, startOfDay, endOfWeek, addDays, isAfter, isBefore } from 'date-fns'
import { de } from 'date-fns/locale'
import type { TrainingSession } from '../../types'
import { SessionCard } from './SessionCard'

interface ListViewProps {
  sessions: TrainingSession[]
  onSelect: (session: TrainingSession) => void
}

export function ListView({ sessions, onSelect }: ListViewProps) {
  const now = new Date()
  const todayStart = startOfDay(now)
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 })
  const nextWeekEnd = addDays(weekEnd, 7)

  const upcoming = sessions.filter(s => !isBefore(parseISO(s.date), todayStart))
  const thisWeek = upcoming.filter(s => !isAfter(parseISO(s.date), weekEnd))
  const nextWeek = upcoming.filter(s => isAfter(parseISO(s.date), weekEnd) && !isAfter(parseISO(s.date), nextWeekEnd))
  const later = upcoming.filter(s => isAfter(parseISO(s.date), nextWeekEnd))

  function Section({ title, items }: { title: string; items: TrainingSession[] }) {
    if (!items.length) return null
    return (
      <div className="mb-6">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">{title}</h3>
        <div className="space-y-3">
          {items.map(s => (
            <div key={s.id}>
              <p className="text-xs text-slate-500 mb-1.5 ml-1">
                {format(parseISO(s.date), 'EEEE, d. MMMM', { locale: de })}
              </p>
              <SessionCard session={s} onClick={() => onSelect(s)} />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!upcoming.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-5xl mb-4">📅</p>
        <p className="text-slate-400 text-sm">Keine Einheiten geplant</p>
      </div>
    )
  }

  return (
    <div>
      <Section title="Diese Woche" items={thisWeek} />
      <Section title="Nächste Woche" items={nextWeek} />
      <Section title="Später" items={later} />
    </div>
  )
}
