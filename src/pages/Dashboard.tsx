import { useContext, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, Timer, Trophy, FileText, Zap, TrendingUp, Star, ChevronRight } from 'lucide-react'
import { StoreContext } from '../App'
import { Card, StatCard } from '../components/Card'
import { formatTime, formatDate, daysUntil } from '../utils/format'
import { SwimmerChip } from '../components/SwimmerChip'
import { SwimmerFormModal } from '../components/SwimmerFormModal'

export function Dashboard() {
  const store = useContext(StoreContext)!
  const navigate = useNavigate()

  const swimmer = store.activeSwimmer
  const [onboardingOpen, setOnboardingOpen] = useState(false)
  const upcomingComps = store.competitions
    .filter(c => c.status === 'upcoming' || c.status === 'ongoing')
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .slice(0, 3)
  const pbs = store.getPersonalBests(swimmer?.id ?? '')
  const nextComp = upcomingComps[0]
  const recentTimes = [...store.times]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 pb-24">
      {/* Hero header */}
      <div className="relative overflow-hidden px-4 pt-14 pb-8">
        <div className="absolute inset-0 bg-gradient-to-br from-sky-600/20 via-transparent to-violet-600/10 pointer-events-none" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-lg mx-auto relative">
          <div className="flex items-center gap-3 mb-6">
            {swimmer ? (
              <SwimmerChip
                swimmer={swimmer}
                swimmerCount={store.swimmers.length}
                mode="interactive"
              />
            ) : (
              <div>
                <p className="text-slate-400 text-xs">Willkommen bei</p>
                <h1 className="text-white font-bold text-xl">SwimTrack Austria</h1>
                <button
                  onClick={() => setOnboardingOpen(true)}
                  className="mt-2 text-sky-400 text-sm flex items-center gap-1.5"
                >
                  + Ersten Schwimmer anlegen
                </button>
              </div>
            )}
            <div className="ml-auto">
              <div className="w-8 h-8 bg-sky-500/20 border border-sky-500/30 rounded-xl flex items-center justify-center">
                <Zap size={16} className="text-sky-400" />
              </div>
            </div>
          </div>

          {/* Next competition hero card */}
          {nextComp && (
            <div
              className="relative overflow-hidden rounded-2xl p-5 cursor-pointer active:scale-[0.98] transition-transform"
              onClick={() => navigate('/kalender')}
              style={{ background: 'linear-gradient(135deg, #0369a1 0%, #1d4ed8 50%, #7c3aed 100%)' }}
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full blur-xl" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-1">
                  {nextComp.status === 'ongoing' ? (
                    <span className="flex items-center gap-1 bg-emerald-400/20 text-emerald-300 text-[10px] font-medium px-2 py-0.5 rounded-full border border-emerald-400/30">
                      <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                      LÄUFT GERADE
                    </span>
                  ) : (
                    <span className="text-sky-200/70 text-[10px] font-medium uppercase tracking-wider">
                      Nächster Wettkampf
                    </span>
                  )}
                </div>
                <h2 className="text-white font-bold text-lg leading-tight mt-1">{nextComp.name}</h2>
                <p className="text-sky-200/80 text-sm mt-0.5">{nextComp.location}</p>
                <div className="flex items-center justify-between mt-4">
                  <div>
                    <p className="text-sky-100 text-sm font-medium">{formatDate(nextComp.startDate)}</p>
                    <p className="text-sky-200/60 text-xs">{nextComp.course === 'LB' ? 'Langbahn' : 'Kurzbahn'}</p>
                  </div>
                  {nextComp.status === 'upcoming' && (
                    <div className="text-right">
                      <p className="text-2xl font-black text-white">{daysUntil(nextComp.startDate)}</p>
                      <p className="text-sky-200/70 text-xs">Tage</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <SwimmerFormModal open={onboardingOpen} onClose={() => setOnboardingOpen(false)} />

      <div className="px-4 max-w-lg mx-auto space-y-6">
        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="Bestzeiten"
            value={pbs.length}
            sub="persönliche Rekorde"
            color="sky"
            icon={<Star size={16} />}
          />
          <StatCard
            label="Wettkämpfe"
            value={store.competitions.filter(c => c.status === 'upcoming').length}
            sub="geplant"
            color="violet"
            icon={<CalendarDays size={16} />}
          />
          <StatCard
            label="Zeiten"
            value={store.times.filter(t => t.swimmerId === swimmer?.id).length}
            sub="eingetragen"
            color="emerald"
            icon={<Timer size={16} />}
          />
          <StatCard
            label="Dokumente"
            value={store.pdfs.length}
            sub="gespeichert"
            color="amber"
            icon={<FileText size={16} />}
          />
        </div>

        {/* Personal bests preview */}
        {pbs.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-white font-semibold flex items-center gap-2">
                <TrendingUp size={16} className="text-emerald-400" />
                Bestzeiten
              </h2>
              <button onClick={() => navigate('/zeiten')} className="text-sky-400 text-xs flex items-center gap-0.5">
                Alle <ChevronRight size={14} />
              </button>
            </div>
            <Card className="divide-y divide-slate-700/50 overflow-hidden">
              {pbs.slice(0, 4).map(pb => (
                <div key={pb.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-white text-sm font-medium">{pb.event}</p>
                    <p className="text-slate-500 text-xs">{pb.course === 'LB' ? 'Langbahn' : 'Kurzbahn'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-emerald-400 font-mono font-bold text-base">{formatTime(pb.timeMs)}</p>
                    <p className="text-slate-500 text-xs">{formatDate(pb.date)}</p>
                  </div>
                </div>
              ))}
            </Card>
          </section>
        )}

        {/* Recent times */}
        {recentTimes.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-white font-semibold flex items-center gap-2">
                <Timer size={16} className="text-sky-400" />
                Letzte Einträge
              </h2>
              <button onClick={() => navigate('/zeiten')} className="text-sky-400 text-xs flex items-center gap-0.5">
                Alle <ChevronRight size={14} />
              </button>
            </div>
            <div className="space-y-2">
              {recentTimes.map(t => (
                <Card key={t.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    {t.isPersonalBest && (
                      <div className="w-6 h-6 bg-amber-400/20 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Star size={12} className="text-amber-400" />
                      </div>
                    )}
                    <div>
                      <p className="text-white text-sm font-medium">{t.event}</p>
                      <p className="text-slate-500 text-xs">{t.competition ?? formatDate(t.date)}</p>
                    </div>
                  </div>
                  <p className="text-white font-mono font-semibold">{formatTime(t.timeMs)}</p>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Quick actions */}
        <section>
          <h2 className="text-white font-semibold mb-3">Schnellzugriff</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Zeit eintragen', icon: Timer, color: 'sky', to: '/zeiten' },
              { label: 'Ergebnisse live', icon: Trophy, color: 'emerald', to: '/ergebnisse' },
              { label: 'Kalender', icon: CalendarDays, color: 'violet', to: '/kalender' },
              { label: 'PDF Import', icon: FileText, color: 'amber', to: '/dokumente' },
            ].map(({ label, icon: Icon, color, to }) => (
              <Card
                key={label}
                onClick={() => navigate(to)}
                className={`p-4 flex items-center gap-3 border-${color}-500/20 hover:bg-${color}-500/5 transition-colors`}
                glass
              >
                <div className={`w-9 h-9 rounded-xl bg-${color}-400/15 flex items-center justify-center flex-shrink-0`}>
                  <Icon size={18} className={`text-${color}-400`} />
                </div>
                <span className="text-white text-sm font-medium leading-tight">{label}</span>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
