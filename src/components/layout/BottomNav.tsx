import { Link, useLocation } from 'react-router-dom'
import { Home, MessageCircle, Calendar, Timer, MoreHorizontal } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const TABS: { path: string; label: string; Icon: LucideIcon }[] = [
  { path: '/app', label: 'Home', Icon: Home },
  { path: '/chat', label: 'Chat', Icon: MessageCircle },
  { path: '/training', label: 'Training', Icon: Calendar },
  { path: '/zeiten', label: 'Zeiten', Icon: Timer },
  { path: '/mehr', label: 'Mehr', Icon: MoreHorizontal },
]

export function BottomNav() {
  const { pathname } = useLocation()
  return (
    <nav
      className="shrink-0 border-t border-white/8"
      style={{ background: 'rgba(5,13,26,0.92)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-center justify-around px-2 pt-1.5 pb-1">
        {TABS.map(({ path, label, Icon }) => {
          const active = pathname === path || (path !== '/app' && pathname.startsWith(path))
          return (
            <Link
              key={path}
              to={path}
              className="flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-all duration-200 min-w-0 relative"
            >
              <Icon
                size={22}
                strokeWidth={active ? 2.5 : 1.75}
                className={`transition-colors duration-200 ${active ? 'text-teal-400' : 'text-slate-500'}`}
              />
              <span className={`text-[10px] font-medium transition-colors duration-200 ${active ? 'text-teal-400' : 'text-slate-500'}`}>
                {label}
              </span>
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-teal-400" />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
