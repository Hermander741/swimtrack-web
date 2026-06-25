import { useState } from 'react'
import { Trophy, ExternalLink, Search, ChevronRight } from 'lucide-react'
import { Card } from '../components/Card'

const QUICK_LINKS = [
  { label: 'Live-Ergebnisse', url: 'https://www.myresults.eu/de/events', desc: 'Aktuelle Wettkampfergebnisse' },
  { label: 'ÖSV Ergebnisdienst', url: 'https://www.oesv.or.at/ergebnisse', desc: 'Österreichischer Schwimmverband' },
  { label: 'Sportunion Ergebnisse', url: 'https://www.sportunion.at/schwimmen', desc: 'Sportunion Österreich' },
  { label: 'Swim Rankings Austria', url: 'https://www.swimrankings.net/index.php?page=athleteList&nationId=AUT', desc: 'Nationale Ranglisten' },
]

export function Ergebnisse() {
  const [activeUrl, setActiveUrl] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  if (activeUrl) {
    return (
      <div className="fixed inset-0 bg-slate-950 flex flex-col">
        <div className="flex items-center gap-3 px-4 py-3 bg-slate-900 border-b border-slate-800 safe-top">
          <button
            onClick={() => setActiveUrl(null)}
            className="text-sky-400 font-medium text-sm flex items-center gap-1"
          >
            ← Zurück
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-slate-400 text-xs truncate">{activeUrl}</p>
          </div>
          <a href={activeUrl} target="_blank" rel="noopener noreferrer" className="text-slate-400">
            <ExternalLink size={16} />
          </a>
        </div>
        <iframe
          src={activeUrl}
          className="flex-1 w-full border-0"
          title="Ergebnisse"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 pb-24">
      <div className="px-4 pt-14 pb-4 max-w-lg mx-auto">
        <div className="mb-6">
          <h1 className="text-white font-bold text-2xl">Live-Ergebnisse</h1>
          <p className="text-slate-400 text-sm">Wettkampfergebnisse in Echtzeit</p>
        </div>

        {/* myresults.eu hero */}
        <div
          onClick={() => setActiveUrl('https://www.myresults.eu/de/events')}
          className="relative overflow-hidden rounded-2xl p-5 mb-5 cursor-pointer active:scale-[0.98] transition-transform"
          style={{ background: 'linear-gradient(135deg, #0f766e 0%, #0369a1 100%)' }}
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
          <div className="relative flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="flex items-center gap-1 bg-emerald-400/20 text-emerald-300 text-[10px] font-medium px-2 py-0.5 rounded-full border border-emerald-400/30">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                  LIVE
                </span>
              </div>
              <h2 className="text-white font-bold text-xl">myresults.eu</h2>
              <p className="text-teal-200/80 text-sm mt-0.5">Österreichische Schwimmergebnisse</p>
            </div>
            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
              <Trophy size={24} className="text-white" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-4 text-teal-200/60 text-xs">
            Öffnen <ChevronRight size={12} />
          </div>
        </div>

        {/* Quick links */}
        <h2 className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-3">Weitere Quellen</h2>
        <div className="space-y-2 mb-6">
          {QUICK_LINKS.map(link => (
            <Card
              key={link.url}
              onClick={() => setActiveUrl(link.url)}
              className="flex items-center justify-between px-4 py-3.5"
            >
              <div>
                <p className="text-white text-sm font-medium">{link.label}</p>
                <p className="text-slate-500 text-xs">{link.desc}</p>
              </div>
              <ChevronRight size={16} className="text-slate-600" />
            </Card>
          ))}
        </div>

        {/* Custom URL */}
        <h2 className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-3">URL öffnen</h2>
        <Card className="p-4">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && searchQuery) setActiveUrl(searchQuery) }}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-3 py-2 text-white text-sm focus:border-sky-500 outline-none"
                placeholder="https://..."
              />
            </div>
            <button
              onClick={() => searchQuery && setActiveUrl(searchQuery)}
              className="bg-sky-500 text-white px-3 rounded-xl text-sm font-medium"
            >
              Los
            </button>
          </div>
        </Card>

        <div className="mt-6 p-4 bg-slate-800/40 rounded-xl border border-slate-700/50">
          <p className="text-slate-400 text-xs leading-relaxed">
            <span className="text-slate-300 font-medium">Hinweis:</span> Externe Websites werden in einer eingebetteten Ansicht geöffnet.
            Für die beste Erfahrung empfehlen wir myresults.eu — die offizielle Plattform für österreichische Schwimmwettkämpfe.
          </p>
        </div>
      </div>
    </div>
  )
}
