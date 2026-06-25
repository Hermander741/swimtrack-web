import { NavLink } from 'react-router-dom'
import { LayoutDashboard, CalendarDays, Timer, Trophy, FileText } from 'lucide-react'

const items = [
  { to: '/', label: 'Start', icon: LayoutDashboard },
  { to: '/kalender', label: 'Kalender', icon: CalendarDays },
  { to: '/zeiten', label: 'Zeiten', icon: Timer },
  { to: '/ergebnisse', label: 'Ergebnisse', icon: Trophy },
  { to: '/dokumente', label: 'Dokumente', icon: FileText },
]

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-lg border-t border-white/10 safe-bottom">
      <div className="max-w-lg mx-auto flex">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center gap-0.5 py-2.5 px-1 text-[10px] font-medium transition-colors ${
                isActive ? 'text-sky-400' : 'text-slate-500 hover:text-slate-300'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className={`relative ${isActive ? 'after:absolute after:-bottom-0.5 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:bg-sky-400 after:rounded-full' : ''}`}>
                  <Icon size={22} strokeWidth={isActive ? 2.2 : 1.8} />
                </span>
                {label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
