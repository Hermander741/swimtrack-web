import { useState, useEffect } from 'react'
import { Trophy, Timer, Award, Radio, ChevronDown, ChevronUp } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { PageShell } from '../components/layout/PageShell'
import { Card } from '../components/ui/Card'
import { Avatar } from '../components/ui/Avatar'
import { listBestzeiten, listEvents } from '../api/zeiten'
import { formatTime } from '../utils/format'
import type { SwimTimeEntry } from '../types'

type OuterTab = 'bestzeiten' | 'meine' | 'wettkampf' | 'live'
type BestzetenView = 'ranking' | 'mitglieder'

// ─── Bestzeiten-Tab ──────────────────────────────────────────────────────────

function BestzetenTab() {
  const { user } = useAuth()
  const [view, setView] = useState<BestzetenView>('ranking')
  const [allPbs, setAllPbs] = useState<SwimTimeEntry[]>([])
  const [events, setEvents] = useState<string[]>([])
  const [selectedEvent, setSelectedEvent] = useState('')
  const [selectedCourse, setSelectedCourse] = useState<'LB' | 'KB' | 'OW' | 'alle'>('alle')
  const [loading, setLoading] = useState(true)
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set())

  useEffect(() => {
    Promise.all([listBestzeiten(), listEvents()]).then(([pbRes, evRes]) => {
      if (pbRes.ok) setAllPbs(pbRes.data)
      if (evRes.ok) {
        setEvents(evRes.data)
        if (evRes.data.length) setSelectedEvent(evRes.data[0])
      }
    }).finally(() => setLoading(false))
  }, [])

  // Ranking-Ansicht: PBs für gewählte Disziplin + Bahn, sortiert nach Zeit
  const rankingRows = allPbs
    .filter(t => t.event === selectedEvent && (selectedCourse === 'alle' || t.course === selectedCourse))
    .sort((a, b) => a.time_ms - b.time_ms)

  // Mitglieder-Ansicht: eine Karte pro User mit allen PBs
  const userMap = new Map<string, { user_name: string; avatar_color: string; times: SwimTimeEntry[] }>()
  allPbs.forEach(t => {
    if (!userMap.has(t.user_id)) userMap.set(t.user_id, { user_name: t.user_name, avatar_color: t.avatar_color, times: [] })
    userMap.get(t.user_id)!.times.push(t)
  })
  const userList = Array.from(userMap.entries()).sort((a, b) =>
    a[1].user_name.localeCompare(b[1].user_name, 'de'),
  )

  if (loading) return (
    <p className="text-slate-500 text-sm text-center py-12 animate-pulse">
      Bestzeiten werden geladen…
    </p>
  )

  return (
    <div className="space-y-4">
      {/* View toggle */}
      <div className="flex bg-slate-800/50 p-1 rounded-xl">
        {(['ranking', 'mitglieder'] as const).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors capitalize ${
              view === v ? 'bg-teal-500 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {v === 'ranking' ? 'Ranking' : 'Mitglieder'}
          </button>
        ))}
      </div>

      {view === 'ranking' && (
        <>
          {/* Filter row */}
          <div className="flex gap-2">
            <select
              value={selectedEvent}
              onChange={e => setSelectedEvent(e.target.value)}
              className="flex-1 bg-slate-800/50 border border-slate-700/50 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-teal-500"
            >
              {events.map(ev => <option key={ev} value={ev}>{ev}</option>)}
            </select>
            <select
              value={selectedCourse}
              onChange={e => setSelectedCourse(e.target.value as typeof selectedCourse)}
              className="bg-slate-800/50 border border-slate-700/50 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-teal-500"
            >
              <option value="LB">LB</option>
              <option value="KB">KB</option>
              <option value="OW">OW</option>
              <option value="alle">Alle</option>
            </select>
          </div>

          {/* Ranking table */}
          {rankingRows.length === 0 ? (
            <p className="text-slate-600 text-sm text-center py-8">
              Keine Zeiten für diese Auswahl
            </p>
          ) : (
            <div className="space-y-1.5">
              {rankingRows.map((t, i) => (
                <Card
                  key={t.id}
                  className={`flex items-center gap-3 px-4 py-3 ${
                    t.user_id === user?.id ? 'border-teal-500/40 bg-teal-500/5' : ''
                  }`}
                >
                  <span className="text-slate-500 text-xs w-5 text-right font-mono">{i + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${
                      t.user_id === user?.id ? 'text-teal-300' : 'text-white'
                    }`}>
                      {t.user_name}
                    </p>
                    {t.competition && (
                      <p className="text-slate-600 text-xs truncate">{t.competition}</p>
                    )}
                    <p className="text-slate-600 text-xs">{t.date}</p>
                  </div>
                  <p className="font-mono text-white font-bold text-sm">{formatTime(t.time_ms)}</p>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {view === 'mitglieder' && (
        <div className="space-y-2">
          {userList.map(([uid, { user_name, avatar_color, times }]) => {
            const expanded = expandedUsers.has(uid)
            const toggle = () => setExpandedUsers(prev => {
              const next = new Set(prev)
              expanded ? next.delete(uid) : next.add(uid)
              return next
            })
            return (
              <Card key={uid} className="overflow-hidden">
                <button
                  onClick={toggle}
                  className="w-full flex items-center gap-3 px-4 py-3"
                >
                  <Avatar name={user_name} color={avatar_color} size="sm" />
                  <span className={`flex-1 text-left text-sm font-medium ${
                    uid === user?.id ? 'text-teal-300' : 'text-white'
                  }`}>
                    {user_name}
                  </span>
                  <span className="text-slate-500 text-xs">
                    {times.length} PB{times.length !== 1 ? 's' : ''}
                  </span>
                  {expanded
                    ? <ChevronUp size={14} className="text-slate-500" />
                    : <ChevronDown size={14} className="text-slate-500" />
                  }
                </button>
                {expanded && (
                  <div className="border-t border-white/5 divide-y divide-white/5">
                    {times
                      .slice()
                      .sort((a, b) => a.event.localeCompare(b.event, 'de'))
                      .map(t => (
                        <div key={t.id} className="flex items-center justify-between px-4 py-2">
                          <div>
                            <p className="text-white text-xs font-medium">{t.event}</p>
                            <p className="text-slate-600 text-[11px]">{t.course} · {t.date}</p>
                          </div>
                          <p className="font-mono text-teal-300 text-sm font-bold">
                            {formatTime(t.time_ms)}
                          </p>
                        </div>
                      ))
                    }
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Platzhalter für noch nicht implementierte Tabs ──────────────────────────

function MeineZeitenTab() {
  return <div className="text-slate-500 text-sm text-center py-12">Kommt bald</div>
}

function WettkampfTab() {
  return <div className="text-slate-500 text-sm text-center py-12">Kommt bald</div>
}

function LiveTab() {
  return <div className="text-slate-500 text-sm text-center py-12">Kommt bald</div>
}

// ─── Seite ───────────────────────────────────────────────────────────────────

const TABS: { id: OuterTab; label: string; icon: React.ReactNode }[] = [
  { id: 'bestzeiten', label: 'Bestzeiten', icon: <Trophy size={14} /> },
  { id: 'meine',      label: 'Meine Zeiten', icon: <Timer size={14} /> },
  { id: 'wettkampf',  label: 'Wettkämpfe',  icon: <Award size={14} /> },
  { id: 'live',       label: 'LIVE',         icon: <Radio size={14} /> },
]

export function Zeiten() {
  const [tab, setTab] = useState<OuterTab>('bestzeiten')

  return (
    <PageShell title="Zeiten">
      <div className="flex bg-slate-800/50 p-1 rounded-xl mb-4 overflow-x-auto scrollbar-none">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-medium rounded-lg transition-colors whitespace-nowrap px-2 ${
              tab === t.id ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {tab === 'bestzeiten' && <BestzetenTab />}
      {tab === 'meine'      && <MeineZeitenTab />}
      {tab === 'wettkampf'  && <WettkampfTab />}
      {tab === 'live'       && <LiveTab />}
    </PageShell>
  )
}
