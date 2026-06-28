import { useState, useEffect } from 'react'
import { Trophy, Timer, Award, Radio, ChevronDown, ChevronUp, TrendingDown } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { PageShell } from '../components/layout/PageShell'
import { Card } from '../components/ui/Card'
import { Avatar } from '../components/ui/Avatar'
import { listBestzeiten, listEvents, listZeiten, createZeit, updateZeit, deleteZeit } from '../api/zeiten'
import { listUsers } from '../api/users'
import { formatTime, parseTimeInput } from '../utils/format'
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
  const { user, isTrainer } = useAuth()
  const [times, setTimes]       = useState<SwimTimeEntry[]>([])
  const [total, setTotal]       = useState(0)
  const [offset, setOffset]     = useState(0)
  const [events, setEvents]     = useState<string[]>([])
  const [filterEvent, setFilterEvent] = useState('')
  const [filterCourse, setFilterCourse] = useState('')
  const [targetUserId, setTargetUserId] = useState(user?.id ?? '')
  const [allUsers, setAllUsers] = useState<Array<{ id: string; name: string }>>([])
  const [loading, setLoading]   = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId]     = useState<string | null>(null)
  const [saving, setSaving]     = useState(false)
  const [form, setForm]         = useState({
    event: '', course: 'LB' as 'LB' | 'KB' | 'OW',
    timeInput: '', date: new Date().toISOString().split('T')[0], competition: '',
  })
  const [timeError, setTimeError] = useState('')
  const LIMIT = 100

  // Events + Users einmalig laden
  useEffect(() => {
    listEvents().then(res => {
      if (res.ok) {
        setEvents(res.data)
        setForm(f => ({ ...f, event: res.data[0] ?? '' }))
      }
    })
    if (isTrainer) {
      listUsers().then(res => { if (res.ok) setAllUsers(res.data) })
    }
  }, [isTrainer])

  // Zeiten laden / neu laden bei Filter-Änderung
  useEffect(() => {
    setOffset(0)
    setTimes([])
    load(0, true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetUserId, filterEvent, filterCourse])

  async function load(off: number, replace: boolean) {
    replace ? setLoading(true) : setLoadingMore(true)
    const res = await listZeiten({
      user_id: targetUserId || undefined,
      event:  filterEvent  || undefined,
      course: filterCourse || undefined,
      limit: LIMIT, offset: off,
    })
    if (res.ok) {
      setTimes(prev => replace ? res.data.items : [...prev, ...res.data.items])
      setTotal(res.data.total)
    }
    replace ? setLoading(false) : setLoadingMore(false)
  }

  function loadMore() {
    const newOffset = offset + LIMIT
    setOffset(newOffset)
    load(newOffset, false)
  }

  function startAdd() {
    setEditId(null)
    setForm({ event: events[0] ?? '', course: 'LB', timeInput: '', date: new Date().toISOString().split('T')[0], competition: '' })
    setTimeError('')
    setShowForm(true)
  }

  function startEdit(t: SwimTimeEntry) {
    setEditId(t.id)
    // formatTime gibt z.B. "1:03,42" zurück — direkt als Input-Wert verwenden
    setForm({ event: t.event, course: t.course, timeInput: formatTime(t.time_ms), date: t.date, competition: t.competition ?? '' })
    setTimeError('')
    setShowForm(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const ms = parseTimeInput(form.timeInput)
    if (!ms) { setTimeError('Format: 1:03,42 oder 63,42'); return }
    setTimeError('')
    setSaving(true)
    try {
      if (editId) {
        const res = await updateZeit(editId, {
          event: form.event, course: form.course, time_ms: ms,
          date: form.date, competition: form.competition || null,
        })
        if (res.ok) {
          setTimes(prev => prev.map(t => t.id === editId ? res.data : t))
          setShowForm(false); setEditId(null)
        }
      } else {
        const res = await createZeit({
          user_id: targetUserId !== user?.id ? targetUserId : undefined,
          event: form.event, course: form.course, time_ms: ms,
          date: form.date, competition: form.competition || undefined,
        })
        if (res.ok) {
          setTimes(prev => [res.data, ...prev])
          setTotal(t => t + 1)
          setShowForm(false)
        }
      }
    } finally { setSaving(false) }
  }

  async function handleDelete(id: string) {
    const res = await deleteZeit(id)
    if (res.ok) {
      setTimes(prev => prev.filter(t => t.id !== id))
      setTotal(t => t - 1)
    }
  }

  return (
    <div className="space-y-4">
      {/* Trainer: User-Selektor */}
      {isTrainer && allUsers.length > 0 && (
        <select
          value={targetUserId}
          onChange={e => setTargetUserId(e.target.value)}
          className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-teal-500"
        >
          {allUsers.map(u => (
            <option key={u.id} value={u.id}>{u.name}{u.id === user?.id ? ' (ich)' : ''}</option>
          ))}
        </select>
      )}

      {/* Filter-Zeile */}
      <div className="flex gap-2">
        <select
          value={filterEvent}
          onChange={e => setFilterEvent(e.target.value)}
          className="flex-1 bg-slate-800/50 border border-slate-700/50 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-teal-500"
        >
          <option value="">Alle Disziplinen</option>
          {events.map(ev => <option key={ev} value={ev}>{ev}</option>)}
        </select>
        <select
          value={filterCourse}
          onChange={e => setFilterCourse(e.target.value)}
          className="bg-slate-800/50 border border-slate-700/50 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-teal-500"
        >
          <option value="">Alle Bahnen</option>
          <option value="LB">LB</option>
          <option value="KB">KB</option>
          <option value="OW">OW</option>
        </select>
      </div>

      {/* Formular — Eintragen / Bearbeiten */}
      {showForm && (
        <Card className="p-4 space-y-3 border-teal-500/30">
          <p className="text-white text-sm font-medium">{editId ? 'Zeit bearbeiten' : 'Zeit eintragen'}</p>
          <form onSubmit={handleSubmit} className="space-y-3">
            <select
              value={form.event}
              onChange={e => setForm(f => ({ ...f, event: e.target.value }))}
              className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-teal-500"
            >
              {events.map(ev => <option key={ev} value={ev}>{ev}</option>)}
            </select>
            <div className="flex gap-2">
              <select
                value={form.course}
                onChange={e => setForm(f => ({ ...f, course: e.target.value as 'LB' | 'KB' | 'OW' }))}
                className="bg-slate-800/50 border border-slate-700/50 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-teal-500"
              >
                <option value="LB">LB</option>
                <option value="KB">KB</option>
                <option value="OW">OW</option>
              </select>
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="1:03,42 oder 63,42"
                  value={form.timeInput}
                  onChange={e => setForm(f => ({ ...f, timeInput: e.target.value }))}
                  className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-teal-500 font-mono"
                />
                {timeError && <p className="text-rose-400 text-xs mt-1">{timeError}</p>}
              </div>
            </div>
            <input
              type="date"
              value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-teal-500"
            />
            <input
              type="text"
              placeholder="Wettkampf (optional)"
              value={form.competition}
              onChange={e => setForm(f => ({ ...f, competition: e.target.value }))}
              className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-teal-500"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditId(null) }}
                className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-400 text-sm font-medium"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-teal-500 text-white text-sm font-medium disabled:opacity-50"
              >
                {saving ? 'Wird gespeichert…' : (editId ? 'Speichern' : 'Eintragen')}
              </button>
            </div>
          </form>
        </Card>
      )}

      {/* Zeitenliste */}
      {loading ? (
        <p className="text-slate-500 text-sm text-center py-12 animate-pulse">Zeiten werden geladen…</p>
      ) : times.length === 0 ? (
        <div className="text-center py-12">
          <TrendingDown size={36} className="mx-auto mb-3 text-slate-700" />
          <p className="text-slate-600 text-sm">Noch keine Zeiten eingetragen</p>
        </div>
      ) : (
        <div className="space-y-2">
          {times.map(t => (
            <Card key={t.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-white text-sm font-medium">{t.event}</p>
                  {t.is_pb && (
                    <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded-full">PB</span>
                  )}
                </div>
                <p className="text-slate-500 text-xs">{t.course} · {t.date}{t.competition ? ` · ${t.competition}` : ''}</p>
              </div>
              <p className="font-mono text-white font-bold text-sm">{formatTime(t.time_ms)}</p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => startEdit(t)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-sky-400 hover:bg-sky-400/10 transition-colors"
                  aria-label="Bearbeiten"
                >
                  ✏️
                </button>
                <button
                  onClick={() => handleDelete(t.id)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-400/10 transition-colors"
                  aria-label="Löschen"
                >
                  🗑
                </button>
              </div>
            </Card>
          ))}
          {times.length < total && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="w-full py-3 text-slate-400 hover:text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              {loadingMore ? 'Wird geladen…' : `${total - times.length} weitere laden`}
            </button>
          )}
        </div>
      )}

      {/* FAB */}
      {!showForm && (
        <div className="fixed bottom-24 right-4 z-40">
          <button
            onClick={startAdd}
            className="w-14 h-14 bg-teal-500 rounded-2xl flex items-center justify-center shadow-lg shadow-teal-500/30 active:scale-95 transition-transform text-white text-2xl font-light"
          >
            +
          </button>
        </div>
      )}
    </div>
  )
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
