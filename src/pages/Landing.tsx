import { useNavigate } from 'react-router-dom'
import { Waves, BarChart2, Users, Bell } from 'lucide-react'

const FEATURES = [
  { icon: BarChart2, title: 'Bestzeiten & Training', desc: 'Zeiten erfassen, Trainingseinheiten planen und Fortschritt verfolgen.' },
  { icon: Users,     title: 'Mitgliederverwaltung', desc: 'Mitglieder, Rollen und Dokumente einfach und sicher verwalten.' },
  { icon: Bell,      title: 'Push-Benachrichtigungen', desc: 'Immer informiert – direkt auf dem Homescreen, auch offline.' },
]

export function Landing() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-ocean-950 flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-5 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Waves size={24} className="text-teal-400" />
          <span className="text-white font-bold text-xl tracking-tight">SwimBase</span>
        </div>
        <button
          onClick={() => navigate('/login')}
          className="px-4 py-2 rounded-xl text-sm font-medium text-teal-400 border border-teal-500/30 hover:bg-teal-500/10 transition-colors"
        >
          Anmelden
        </button>
      </nav>

      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center">
        <div className="w-20 h-20 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center mb-8">
          <Waves size={40} className="text-teal-400" />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">
          Die Plattform für<br />
          <span className="text-teal-400">Schwimmvereine</span>
        </h1>
        <p className="text-slate-400 text-lg max-w-md mb-10">
          Mitglieder, Training, Bestzeiten und Kommunikation – alles in einer App, maßgeschneidert für euren Verein.
        </p>
        <button
          onClick={() => navigate('/login')}
          className="px-8 py-3.5 bg-teal-500 hover:bg-teal-400 text-white font-semibold rounded-2xl text-base transition-colors shadow-lg shadow-teal-500/20"
        >
          Zur App
        </button>
      </div>

      {/* Features */}
      <div className="px-6 pb-20 max-w-2xl mx-auto w-full">
        <div className="grid gap-4">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex gap-4 p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
              <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center shrink-0">
                <Icon size={18} className="text-teal-400" />
              </div>
              <div>
                <p className="text-white font-medium text-sm mb-0.5">{title}</p>
                <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/5 py-5 text-center">
        <p className="text-slate-600 text-xs">© {new Date().getFullYear()} SwimBase · swimbase.at</p>
      </footer>
    </div>
  )
}
