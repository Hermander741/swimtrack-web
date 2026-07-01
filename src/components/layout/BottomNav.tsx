import { Link, useLocation } from 'react-router-dom'

const TABS = [
  { path: '/app', label: 'Home', icon: '🏠' },
  { path: '/chat', label: 'Chat', icon: '💬' },
  { path: '/training', label: 'Training', icon: '📅' },
  { path: '/zeiten', label: 'Zeiten', icon: '⏱' },
  { path: '/mehr', label: 'Mehr', icon: '···' },
]

export function BottomNav() {
  const { pathname } = useLocation()
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 glass border-t border-white/8"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-center justify-around px-2 pt-2 pb-0">
        {TABS.map(tab => {
          const active = pathname === tab.path || (tab.path !== '/app' && pathname.startsWith(tab.path))
          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={`flex flex-col items-center gap-1 px-3 py-1 rounded-xl transition-all duration-200 min-w-0
                ${active ? 'text-teal-400' : 'text-slate-400'}`}
            >
              <span className="text-xl leading-none">{tab.icon}</span>
              <span className="text-[10px] font-medium">{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
