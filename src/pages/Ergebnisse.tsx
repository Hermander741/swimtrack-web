import { useContext, useState, useEffect, useCallback } from 'react'
import { Trophy, Calendar, User, Wifi, RefreshCw, Download, Check, Radio } from 'lucide-react'
import { StoreContext, ApiConfigContext } from '../App'
import { Card } from '../components/Card'
import { SwimmerChip } from '../components/SwimmerChip'
import { useApi } from '../hooks/useApi'
import { generateId } from '../utils/format'
import type { MeetSummary, SwimmerResult } from '../types'

type Tab = 'meets' | 'swimmer' | 'live'

function normalizeEventName(raw: string): string {
  return raw
    .replace(/^\d+\s*-\s*/, '')
    .replace(/\s+(Damen|Herren|Mixed|gemischt|Frauen|Männer)$/i, '')
    .trim()
}

function StatusBadge({ meet }: { meet: MeetSummary }) {
  if (meet.hasLive) return (
    <span className="flex items-center gap-1 bg-emerald-400/20 text-emerald-300 text-[10px] font-medium px-2 py-0.5 rounded-full border border-emerald-400/30">
      <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" /> LIVE
    </span>
  )
  if (meet.status === 'recent') return (
    <span className="text-[10px] text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">Abgeschlossen</span>
  )
  return (
    <span className="text-[10px] text-sky-400 bg-sky-400/10 px-2 py-0.5 rounded-full">Geplant</span>
  )
}

function MeetCard({ meet, onAddToCalendar, alreadyInCalendar }: {
  meet: MeetSummary
  onAddToCalendar: (m: MeetSummary) => void
  alreadyInCalendar: boolean
}) {
  return (
    <Card className="px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <StatusBadge meet={meet} />
            <span className="text-[10px] text-slate-500">{meet.course}</span>
          </div>
          <p className="text-white text-sm font-medium leading-tight">{meet.name}</p>
          <p className="text-slate-500 text-xs mt-0.5">{meet.location}</p>
          <p className="text-slate-600 text-xs">{meet.startDate}{meet.startDate !== meet.endDate ? ` – ${meet.endDate}` : ''}</p>
        </div>
        <button
          onClick={() => onAddToCalendar(meet)}
          disabled={alreadyInCalendar}
          className={`flex-shrink-0 p-2 rounded-xl transition-colors ${alreadyInCalendar ? 'text-emerald-400 bg-emerald-400/10' : 'text-slate-400 hover:text-sky-400 hover:bg-sky-400/10'}`}
          title={alreadyInCalendar ? 'Bereits im Kalender' : 'In Kalender hinzufügen'}
        >
          {alreadyInCalendar ? <Check size={16} /> : <Calendar size={16} />}
        </button>
      </div>
    </Card>
  )
}

function WettkämpfeTab() {
  const store = useContext(StoreContext)!
  const api = useApi()
  const { openConfig } = useContext(ApiConfigContext)
  const [meets, setMeets] = useState<MeetSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!api.isConfigured) return
    setLoading(true)
    setError('')
    try {
      const data = await api.get<MeetSummary[]>('/api/meets?status=all')
      setMeets(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Laden')
    } finally {
      setLoading(false)
    }
  }, [api])

  useEffect(() => { load() }, [load])

  function addToCalendar(meet: MeetSummary) {
    const today = new Date().toISOString().split('T')[0]
    store.addCompetition({
      id: `myresults-${meet.id}`,
      name: meet.name,
      location: meet.location,
      startDate: meet.startDate,
      endDate: meet.endDate,
      course: meet.course,
      organizer: meet.organizer,
      status: meet.status === 'recent' ? 'past' : meet.startDate <= today ? 'ongoing' : 'upcoming',
    })
  }

  if (!api.isConfigured) {
    return (
      <div className="text-center py-16">
        <Wifi size={40} className="mx-auto mb-3 text-slate-700" />
        <p className="text-slate-400 text-sm mb-4">Kein Backend verbunden</p>
        <button onClick={openConfig} className="bg-sky-500 text-white px-4 py-2 rounded-xl text-sm font-medium">
          Backend verbinden
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-slate-500 text-xs">{meets.length} Wettkämpfe</p>
        <button onClick={load} disabled={loading} className="text-slate-500 hover:text-white p-1">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>
      {error && <p className="text-rose-400 text-sm text-center py-4">{error}</p>}
      {loading && !meets.length && (
        <p className="text-slate-500 text-sm text-center py-8 animate-pulse">Wettkämpfe werden geladen…</p>
      )}
      {meets.map(m => (
        <MeetCard
          key={m.id}
          meet={m}
          onAddToCalendar={addToCalendar}
          alreadyInCalendar={store.competitions.some(c => c.id === `myresults-${m.id}`)}
        />
      ))}
    </div>
  )
}

function MeinSchwimmerTab() {
  const store = useContext(StoreContext)!
  const api = useApi()
  const { openConfig } = useContext(ApiConfigContext)
  const swimmer = store.activeSwimmer
  const [results, setResults] = useState<SwimmerResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [imported, setImported] = useState<Set<string>>(new Set())

  const searchName = swimmer?.myresultsName
    ?? swimmer?.name.toUpperCase()
    ?? ''

  const load = useCallback(async () => {
    if (!api.isConfigured || !swimmer) return
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({
        name: searchName,
        birthYear: swimmer.birthYear.toString(),
      })
      const data = await api.get<SwimmerResult[]>(`/api/swimmer/results?${params}`)
      setResults(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Laden')
    } finally {
      setLoading(false)
    }
  }, [api, swimmer, searchName])

  useEffect(() => { load() }, [load])

  function importResult(r: SwimmerResult) {
    if (!swimmer) return
    const eventName = normalizeEventName(r.eventName)
    const key = `${r.meetDate}-${r.eventId}`

    const isDuplicate = store.times.some(t =>
      t.swimmerId === swimmer.id &&
      t.event === eventName &&
      t.date === r.meetDate &&
      t.timeMs === r.result.timeMs,
    )
    if (isDuplicate) {
      setImported(prev => new Set([...prev, key]))
      return
    }

    store.addTime({
      id: generateId(),
      swimmerId: swimmer.id,
      event: eventName,
      course: r.course,
      timeMs: r.result.timeMs,
      date: r.meetDate,
      competition: r.meetName,
      isPersonalBest: false,
    })
    setImported(prev => new Set([...prev, key]))
  }

  function importAll() {
    results.forEach(r => importResult(r))
  }

  if (!api.isConfigured) {
    return (
      <div className="text-center py-16">
        <Wifi size={40} className="mx-auto mb-3 text-slate-700" />
        <p className="text-slate-400 text-sm mb-4">Kein Backend verbunden</p>
        <button onClick={openConfig} className="bg-sky-500 text-white px-4 py-2 rounded-xl text-sm font-medium">
          Backend verbinden
        </button>
      </div>
    )
  }

  if (!swimmer) {
    return (
      <div className="text-center py-16">
        <User size={40} className="mx-auto mb-3 text-slate-700" />
        <p className="text-slate-400 text-sm">Kein aktiver Schwimmer ausgewählt</p>
      </div>
    )
  }

  const notYetImported = results.filter(r => !imported.has(`${r.meetDate}-${r.eventId}`))

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-slate-500 text-xs">Suche: <span className="text-slate-300">{searchName}</span></p>
          <p className="text-slate-600 text-xs">Letzte 5 Wettkämpfe</p>
        </div>
        <div className="flex items-center gap-2">
          {results.length > 0 && notYetImported.length > 0 && (
            <button
              onClick={importAll}
              className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1"
            >
              <Download size={12} /> Alle ({notYetImported.length})
            </button>
          )}
          <button onClick={load} disabled={loading} className="text-slate-500 hover:text-white p-1">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {error && <p className="text-rose-400 text-sm text-center py-4">{error}</p>}

      {loading && !results.length && (
        <p className="text-slate-500 text-sm text-center py-8 animate-pulse">Ergebnisse werden gesucht…</p>
      )}

      {!loading && results.length === 0 && !error && (
        <div className="text-center py-12 text-slate-600">
          <User size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Keine Ergebnisse gefunden</p>
          <p className="text-xs mt-1 text-slate-700">
            {!swimmer.myresultsName ? 'Tipp: Hinterlege den myresults.eu-Namen im Schwimmer-Profil' : ''}
          </p>
        </div>
      )}

      {results.map(r => {
        const key = `${r.meetDate}-${r.eventId}`
        const isImported = imported.has(key)
        return (
          <Card key={key} className="px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium">{normalizeEventName(r.eventName)}</p>
                <p className="text-slate-500 text-xs">{r.meetName}</p>
                <p className="text-slate-600 text-xs">{r.meetDate} · Platz {r.result.rank}</p>
              </div>
              <div className="flex items-center gap-3">
                <p className="font-mono text-white font-bold text-sm">
                  {r.result.timeMs > 0 ? `${Math.floor(r.result.timeMs / 60000) > 0 ? `${Math.floor(r.result.timeMs / 60000)}:` : ''}${String(Math.floor((r.result.timeMs % 60000) / 1000)).padStart(2, '0')},${String(Math.floor((r.result.timeMs % 1000) / 10)).padStart(2, '0')}` : '—'}
                </p>
                <button
                  onClick={() => importResult(r)}
                  disabled={isImported}
                  className={`flex-shrink-0 p-2 rounded-xl transition-colors ${isImported ? 'text-emerald-400 bg-emerald-400/10' : 'text-slate-400 hover:text-sky-400 hover:bg-sky-400/10'}`}
                >
                  {isImported ? <Check size={15} /> : <Download size={15} />}
                </button>
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}

export function Ergebnisse() {
  const store = useContext(StoreContext)!
  const [tab, setTab] = useState<Tab>('meets')

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'meets', label: 'Wettkämpfe', icon: <Trophy size={14} /> },
    { id: 'swimmer', label: 'Mein Schwimmer', icon: <User size={14} /> },
    { id: 'live', label: 'LIVE', icon: <Radio size={14} /> },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 pb-24">
      <div className="px-4 pt-14 pb-4 max-w-lg mx-auto">
        {store.activeSwimmer && (
          <div className="mb-4">
            <SwimmerChip swimmer={store.activeSwimmer} swimmerCount={store.swimmers.length} mode="readonly" />
          </div>
        )}

        <div className="mb-6">
          <h1 className="text-white font-bold text-2xl">Ergebnisse</h1>
          <p className="text-slate-400 text-sm">myresults.eu · Österreichische Wettkämpfe</p>
        </div>

        {/* Tab bar */}
        <div className="flex bg-slate-800/50 p-1 rounded-xl mb-5">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg transition-colors ${
                tab === t.id ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {tab === 'meets' && <WettkämpfeTab />}
        {tab === 'swimmer' && <MeinSchwimmerTab />}
        {tab === 'live' && (
          <div className="text-center py-16 text-slate-600">
            <Radio size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">LIVE-Tab wird in Task 8 hinzugefügt</p>
          </div>
        )}
      </div>
    </div>
  )
}
