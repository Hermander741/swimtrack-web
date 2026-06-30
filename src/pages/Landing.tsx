import { useNavigate } from 'react-router-dom'
import { BarChart2, Users, Bell, Calendar } from 'lucide-react'

const FEATURES = [
  { icon: BarChart2, title: 'Bestzeiten & Training',   desc: 'Zeiten erfassen, Trainingseinheiten planen und Fortschritt in Echtzeit verfolgen.' },
  { icon: Calendar,  title: 'Trainingsplanung',        desc: 'Gruppen, Termine und Trainingspläne verwalten – inklusive iCal-Export.' },
  { icon: Users,     title: 'Mitgliederverwaltung',    desc: 'Mitglieder, Rollen, Eltern-Kind-Verknüpfungen und Dokumente zentral verwalten.' },
  { icon: Bell,      title: 'Push-Benachrichtigungen', desc: 'Direkt auf dem Homescreen informiert – als installierbare PWA, auch offline.' },
]

export function Landing() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-[#080d1a] flex flex-col text-white">

      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <div className="bg-white rounded-xl px-3 py-1.5">
          <img src="/swimbase-logo.png" alt="SwimBase" className="h-7 object-contain" />
        </div>
        <button
          onClick={() => navigate('/login')}
          className="px-4 py-2 rounded-xl text-sm font-medium text-white border border-white/20 hover:bg-white/10 transition-colors"
        >
          Anmelden
        </button>
      </nav>

      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
        {/* Icon — cropped via CSS background to show only the large icon */}
        <div
          className="w-28 h-28 rounded-3xl mb-8 shadow-2xl shadow-blue-500/30 overflow-hidden"
          style={{
            backgroundImage: 'url(/swimbase-icon.png)',
            backgroundSize: '205px',
            backgroundPosition: '-9px -20px',
            backgroundRepeat: 'no-repeat',
          }}
        />

        <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">
          Die App für deinen<br />
          <span className="text-blue-400">Schwimmverein</span>
        </h1>
        <p className="text-slate-400 text-lg max-w-md mb-10 leading-relaxed">
          Training, Bestzeiten, Mitglieder und Vereinskommunikation – alles in einer modernen PWA, maßgeschneidert für euren Verein.
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => navigate('/login')}
            className="px-8 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-2xl text-base transition-colors shadow-lg shadow-blue-600/30"
          >
            Zur App →
          </button>
          <a
            href="mailto:info@swimbase.at"
            className="px-8 py-3.5 rounded-2xl text-base font-medium text-slate-300 border border-white/10 hover:bg-white/5 transition-colors"
          >
            Verein anmelden
          </a>
        </div>
      </div>

      {/* Features */}
      <div className="px-6 pb-20 max-w-2xl mx-auto w-full">
        <p className="text-center text-xs text-slate-600 uppercase tracking-widest font-medium mb-6">Was SwimBase bietet</p>
        <div className="grid sm:grid-cols-2 gap-3">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex gap-4 p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] transition-colors">
              <div className="w-9 h-9 rounded-xl bg-blue-600/15 flex items-center justify-center shrink-0 mt-0.5">
                <Icon size={16} className="text-blue-400" />
              </div>
              <div>
                <p className="text-white font-medium text-sm mb-1">{title}</p>
                <p className="text-slate-400 text-xs leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/5 py-5 px-6 flex items-center justify-between">
        <div className="bg-white rounded-lg px-2 py-1">
          <img src="/swimbase-logo.png" alt="SwimBase" className="h-5 object-contain opacity-70" />
        </div>
        <p className="text-slate-700 text-xs">© {new Date().getFullYear()} SwimBase</p>
      </footer>
    </div>
  )
}
