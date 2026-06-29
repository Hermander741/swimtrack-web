import { useState, useEffect } from 'react'
import { Trophy, Timer, Award, Radio, ChevronDown, ChevronUp, TrendingDown, Pencil, Trash2, RefreshCw, Download, Check, User as UserIcon } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { PageShell } from '../components/layout/PageShell'
import { Card } from '../components/ui/Card'
import { Avatar } from '../components/ui/Avatar'
import { listBestzeiten, listEvents, listZeiten, createZeit, updateZeit, deleteZeit, syncMyresults, fetchExternalBestzeiten } from '../api/zeiten'
import { listUsers } from '../api/users'
import { formatTime, parseTimeInput } from '../utils/format'
import type { SwimTimeEntry, MeetSummary, LiveResult, SwimResult } from '../types'
import { apiRequest } from '../api/client'

type OuterTab = 'bestzeiten' | 'meine' | 'wettkampf' | 'live'
type BestzetenView = 'ranking' | 'mitglieder' | 'vergleich'

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
        {(['ranking', 'mitglieder', 'vergleich'] as const).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${
              view === v ? 'bg-teal-500 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {v === 'ranking' ? 'Ranking' : v === 'mitglieder' ? 'Mitglieder' : 'Vergleich'}
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

      {view === 'vergleich' && <VergleichView allPbs={allPbs} events={events} />}
    </div>
  )
}

interface ExternalSwimmer {
  id: string
  name: string
  times: { event: string; course: string; time_ms: number; meet_date?: string; meet_name?: string }[]
}

interface TimeDetail {
  time_ms: number
  date?: string
  competition?: string
}

function VergleichView({ allPbs, events }: { allPbs: SwimTimeEntry[]; events: string[] }) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [selCourse, setSelCourse] = useState<'LB' | 'KB' | 'OW'>('LB')
  const [externals, setExternals] = useState<ExternalSwimmer[]>([])
  const [extInput, setExtInput] = useState('')
  const [extLoading, setExtLoading] = useState(false)
  const [extError, setExtError] = useState('')

  const userMap = new Map<string, { name: string; color: string; imageUrl?: string; isExternal?: boolean }>()
  allPbs.forEach(t => {
    if (!userMap.has(t.user_id)) userMap.set(t.user_id, { name: t.user_name, color: t.avatar_color, imageUrl: t.avatar_url })
  })
  externals.forEach(e => {
    userMap.set(e.id, { name: e.name, color: '#64748b', isExternal: true })
  })
  const allUsers = Array.from(userMap.entries()).sort((a, b) => a[1].name.localeCompare(b[1].name, 'de'))

  const toggle = (id: string) =>
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const selected = selectedIds.filter(id => userMap.has(id))

  async function addExternal(e: React.FormEvent) {
    e.preventDefault()
    const name = extInput.trim()
    if (!name) return
    const key = `ext:${name.toLowerCase()}`
    if (userMap.has(key)) { toggle(key); setExtInput(''); return }
    setExtError(''); setExtLoading(true)
    const res = await fetchExternalBestzeiten(name)
    setExtLoading(false)
    if (!res.ok) { setExtError(res.error); return }
    if (res.data.length === 0) { setExtError('Keine Zeiten gefunden'); return }
    setExternals(prev => [...prev.filter(x => x.id !== key), { id: key, name, times: res.data }])
    setSelectedIds(prev => [...prev.filter(x => x !== key), key])
    setExtInput('')
  }

  function getDetail(id: string, ev: string, course: string): TimeDetail | null {
    if (id.startsWith('ext:')) {
      const ext = externals.find(x => x.id === id)
      const t = ext?.times.find(t => t.event === ev && t.course === course)
      if (!t) return null
      return { time_ms: t.time_ms, date: t.meet_date, competition: t.meet_name }
    }
    const pb = allPbs.find(t => t.user_id === id && t.event === ev && t.course === course)
    if (!pb) return null
    return { time_ms: pb.time_ms, date: pb.date, competition: pb.competition ?? undefined }
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs text-slate-500 mb-2">Mitglieder</p>
        <div className="flex flex-wrap gap-2">
          {allUsers.filter(([, u]) => !u.isExternal).map(([id, u]) => (
            <button
              key={id}
              onClick={() => toggle(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                selectedIds.includes(id) ? 'text-white' : 'bg-white/5 text-slate-400 hover:text-white'
              }`}
              style={selectedIds.includes(id) ? { backgroundColor: u.color } : undefined}
            >
              <Avatar name={u.name} color={u.color} imageUrl={u.imageUrl} size="sm" />
              {u.name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs text-slate-500 mb-2">Externer Schwimmer (myresults-Name)</p>
        <form onSubmit={addExternal} className="flex gap-2">
          <input
            value={extInput}
            onChange={e => setExtInput(e.target.value)}
            placeholder="z.B. URBAN Herman"
            className="flex-1 bg-slate-800/50 border border-slate-700/50 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-teal-500 placeholder-slate-600"
          />
          <button
            type="submit"
            disabled={extLoading || !extInput.trim()}
            className="px-3 py-2 bg-teal-500 text-white rounded-xl text-xs font-medium disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap"
          >
            {extLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <UserIcon size={14} />}
            {extLoading ? 'Suche…' : 'Hinzufügen'}
          </button>
        </form>
        {extError && <p className="text-red-400 text-xs mt-1">{extError}</p>}
        {externals.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {externals.map(ext => (
              <button
                key={ext.id}
                onClick={() => toggle(ext.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                  selectedIds.includes(ext.id)
                    ? 'bg-slate-500 text-white border-slate-400'
                    : 'bg-white/5 text-slate-400 hover:text-white border-slate-700/50'
                }`}
              >
                <UserIcon size={12} />
                {ext.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {selected.length > 0 && (
        <>
          <div className="flex gap-2">
            {(['LB', 'KB', 'OW'] as const).map(c => (
              <button key={c} onClick={() => setSelCourse(c)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${selCourse === c ? 'bg-teal-500 text-white' : 'bg-white/5 text-slate-400 hover:text-white'}`}>
                {c}
              </button>
            ))}
          </div>
          <VergleichTabelle
            events={events}
            selected={selected}
            selCourse={selCourse}
            userMap={userMap}
            getDetail={getDetail}
          />
        </>
      )}

      {selected.length === 0 && (
        <p className="text-slate-600 text-sm text-center py-8">Wähle Schwimmer zum Vergleichen</p>
      )}
    </div>
  )
}

function VergleichTabelle({
  events, selected, selCourse, userMap, getDetail,
}: {
  events: string[]
  selected: string[]
  selCourse: string
  userMap: Map<string, { name: string; color: string; imageUrl?: string; isExternal?: boolean }>
  getDetail: (id: string, ev: string, course: string) => TimeDetail | null
}) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  function fmtDate(d?: string) {
    if (!d) return ''
    return new Date(d).toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: '2-digit' })
  }

  const rows = events.flatMap(ev => {
    const details = selected.map(id => getDetail(id, ev, selCourse))
    if (details.every(d => d === null)) return []
    const times = details.filter((d): d is TimeDetail => d !== null).map(d => d.time_ms)
    const fastest = Math.min(...times)
    return [{ ev, details, fastest }]
  })

  return (
    <div className="space-y-1">
      {/* Header */}
      <div className="flex items-center px-1 pb-1 border-b border-white/10">
        <div className="flex-1 text-xs text-slate-500 font-medium">Disziplin</div>
        {selected.map(id => (
          <div key={id} className="w-16 text-center text-xs text-slate-400 font-medium truncate px-1">
            {userMap.get(id)!.name.split(' ')[0]}
          </div>
        ))}
        <div className="w-5" />
      </div>

      {rows.map(({ ev, details, fastest }) => {
        const isOpen = expandedRow === ev
        return (
          <div key={ev}>
            <button
              className="w-full flex items-center px-1 py-2.5 rounded-lg active:bg-white/5 transition-colors"
              onClick={() => setExpandedRow(isOpen ? null : ev)}
            >
              <div className="flex-1 text-left text-xs text-slate-300 font-medium">{ev}</div>
              {details.map((d, i) => (
                <div key={i} className={`w-16 text-center text-xs font-mono font-bold px-1 ${
                  d && d.time_ms === fastest ? 'text-teal-400' : 'text-white'
                }`}>
                  {d ? formatTime(d.time_ms) : <span className="text-slate-700">—</span>}
                </div>
              ))}
              <div className="w-5 text-slate-600 text-xs">{isOpen ? '▲' : '▼'}</div>
            </button>

            {isOpen && (
              <div className="mx-1 mb-2 rounded-xl bg-white/5 divide-y divide-white/5 overflow-hidden">
                {details.map((d, i) => {
                  const u = userMap.get(selected[i])!
                  return (
                    <div key={i} className="flex items-start gap-3 px-3 py-2.5">
                      <Avatar name={u.name} color={u.color} imageUrl={u.imageUrl} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-400 font-medium truncate">{u.name}</p>
                        {d ? (
                          <>
                            <p className={`text-sm font-mono font-bold ${d.time_ms === fastest ? 'text-teal-400' : 'text-white'}`}>
                              {formatTime(d.time_ms)}
                            </p>
                            <p className="text-xs text-slate-500 truncate">
                              {[d.competition, fmtDate(d.date)].filter(Boolean).join(' · ')}
                            </p>
                          </>
                        ) : (
                          <p className="text-xs text-slate-700">Keine Zeit</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
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
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
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
          {times.map(t => {
            const isOpen = expandedId === t.id
            const isConfirming = confirmDeleteId === t.id
            return (
              <Card key={t.id} className="overflow-hidden">
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-white/5 transition-colors"
                  onClick={() => { setExpandedId(isOpen ? null : t.id); setConfirmDeleteId(null) }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-white text-sm font-medium">{t.event}</p>
                      {t.is_pb && (
                        <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded-full">PB</span>
                      )}
                    </div>
                    <p className="text-slate-500 text-xs">{t.course} · {t.date}{t.competition ? ` · ${t.competition}` : ''}</p>
                  </div>
                  <p className="font-mono text-white font-bold text-sm shrink-0">{formatTime(t.time_ms)}</p>
                  <span className="text-slate-600 text-xs shrink-0">{isOpen ? '▲' : '▼'}</span>
                </button>

                {isOpen && (
                  <div className="border-t border-white/5">
                    {isConfirming ? (
                      <div className="flex gap-2 px-4 py-3">
                        <p className="flex-1 text-sm text-slate-300 self-center">Wirklich löschen?</p>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-4 py-2 rounded-xl text-sm text-slate-400 bg-white/5"
                        >Abbrechen</button>
                        <button
                          onClick={() => { handleDelete(t.id); setExpandedId(null); setConfirmDeleteId(null) }}
                          className="px-4 py-2 rounded-xl text-sm text-white bg-rose-500/80 font-medium"
                        >Löschen</button>
                      </div>
                    ) : (
                      <div className="flex gap-2 px-4 py-3">
                        <button
                          onClick={() => { startEdit(t); setExpandedId(null) }}
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-sky-500/10 text-sky-400 text-sm font-medium active:bg-sky-500/20"
                        >
                          <Pencil size={16} /> Bearbeiten
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(t.id)}
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-rose-500/10 text-rose-400 text-sm font-medium active:bg-rose-500/20"
                        >
                          <Trash2 size={16} /> Löschen
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            )
          })}
          {times.length < total && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="w-full py-3 text-slate-400 hover:text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              {loadingMore ? 'Wird geladen…' : 'Mehr laden'}
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

// ─── Wettkämpfe + LIVE Tabs ──────────────────────────────────────────────────

function normalizeEventName(raw: string): string {
  return raw
    .replace(/^\d+\s*-\s*/, '')
    .replace(/\s+MASTERS$/i, '')
    .replace(/\s+(Damen|Herren|Mixed|gemischt|Frauen|Männer)$/i, '')
    .trim()
}

type WettkämpfeSubTab = 'meets' | 'swimmer'

function WettkampfTab() {
  const [subTab, setSubTab] = useState<WettkämpfeSubTab>('meets')
  return (
    <div className="space-y-4">
      <div className="flex bg-slate-800/50 p-1 rounded-xl">
        {(['meets', 'swimmer'] as const).map(t => (
          <button
            key={t}
            onClick={() => setSubTab(t)}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${
              subTab === t ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {t === 'meets' ? 'Wettkämpfe' : 'Mein Schwimmer'}
          </button>
        ))}
      </div>
      {subTab === 'meets'   && <WettkämpfeInner />}
      {subTab === 'swimmer' && <MeinSchwimmerInner />}
    </div>
  )
}

function WettkämpfeInner() {
  const [meets, setMeets]   = useState<MeetSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')

  const load = async () => {
    setLoading(true); setError('')
    const res = await apiRequest<MeetSummary[]>('/api/meets?status=all')
    if (res.ok) setMeets(res.data)
    else setError(res.error)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

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
        <Card key={m.id} className="px-4 py-3">
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
                  {m.status === 'recent' ? 'Abgeschlossen' : m.status === 'today' ? 'Heute' : 'Geplant'}
                </span>
                <span className="text-[10px] text-slate-500">{m.course}</span>
              </div>
              <p className="text-white text-sm font-medium leading-tight">{m.name}</p>
              <p className="text-slate-500 text-xs mt-0.5">{m.location}</p>
              <p className="text-slate-600 text-xs">{m.startDate}{m.startDate !== m.endDate ? ` – ${m.endDate}` : ''}</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

function MeinSchwimmerInner() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [result, setResult]   = useState<{ imported: number; total_found: number; meets_searched: number } | null>(null)

  if (!user?.myresults_name) {
    return (
      <div className="text-center py-12">
        <UserIcon size={36} className="mx-auto mb-3 text-slate-700" />
        <p className="text-slate-500 text-sm">Hinterlege deinen myresults.eu-Namen im Profil</p>
        <p className="text-slate-600 text-xs mt-1">Format: NACHNAME Vorname</p>
      </div>
    )
  }

  async function handleSync() {
    setLoading(true); setError(''); setResult(null)
    const res = await syncMyresults()
    if (res.ok) setResult(res.data)
    else setError(res.error)
    setLoading(false)
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div>
          <p className="text-white text-sm font-medium">Wettkampfzeiten importieren</p>
          <p className="text-slate-500 text-xs mt-1">
            Sucht alle Ergebnisse für <span className="text-slate-300">{user.myresults_name}</span> auf
            myresults.eu und speichert neue Zeiten automatisch.
          </p>
        </div>
        <button
          onClick={handleSync}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-white text-sm font-medium transition-colors"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Wird synchronisiert…' : 'Jetzt synchronisieren'}
        </button>
        {error && <p className="text-rose-400 text-xs">{error}</p>}
        {result && !loading && (
          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 space-y-1">
            <p className="text-emerald-400 text-sm font-medium flex items-center gap-2">
              <Check size={14} /> Synchronisierung abgeschlossen
            </p>
            <p className="text-slate-400 text-xs">
              {result.imported} neue Zeiten importiert · {result.total_found} gefunden · {result.meets_searched} Wettkämpfe durchsucht
            </p>
            {result.imported > 0 && (
              <p className="text-slate-500 text-xs">Die neuen Zeiten sind jetzt im Tab "Meine Zeiten" sichtbar.</p>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}

function LiveTab() {
  const { user } = useAuth()
  const [meets, setMeets]               = useState<MeetSummary[]>([])
  const [selectedMeetId, setSelectedMeetId] = useState('')
  const [liveData, setLiveData]         = useState<LiveResult | null>(null)
  const [loading, setLoading]           = useState(false)
  const [lastUpdated, setLastUpdated]   = useState<Date | null>(null)
  const [savedIds, setSavedIds]         = useState<Set<string>>(new Set())

  useEffect(() => {
    apiRequest<MeetSummary[]>('/api/meets?status=upcoming').then(res => {
      if (!res.ok) return
      const liveMeets = res.data.filter(m => m.hasLive || m.status === 'today' || m.status === 'upcoming')
      setMeets(liveMeets)
      if (liveMeets.length && !selectedMeetId) setSelectedMeetId(liveMeets[0].id)
    })
  }, [])

  const fetchLive = async () => {
    if (!selectedMeetId) return
    const res = await apiRequest<LiveResult>(`/api/meets/${selectedMeetId}/live?urlStatus=Today-Upcoming`)
    if (res.ok) { setLiveData(res.data); setLastUpdated(new Date()) }
  }

  useEffect(() => {
    if (!selectedMeetId) return
    setLoading(true)
    fetchLive().finally(() => setLoading(false))
    const interval = setInterval(fetchLive, 10000)
    return () => clearInterval(interval)
  }, [selectedMeetId])

  async function saveTime(result: SwimResult) {
    if (!user || !liveData?.event) return
    const eventName = normalizeEventName(liveData.event)
    const today = new Date().toISOString().split('T')[0]
    const res = await createZeit({
      event: eventName,
      course: meets.find(m => m.id === selectedMeetId)?.course ?? 'LB',
      time_ms: result.timeMs,
      date: today,
      competition: meets.find(m => m.id === selectedMeetId)?.name,
    })
    if (res.ok) setSavedIds(prev => new Set([...prev, result.participantId]))
  }

  return (
    <div className="space-y-4">
      {meets.length > 0 && (
        <select
          value={selectedMeetId}
          onChange={e => { setSelectedMeetId(e.target.value); setSavedIds(new Set()) }}
          className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-sky-500"
        >
          {meets.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      )}

      <div className="flex items-center justify-between">
        <div>
          {liveData?.status === 0 ? (
            <span className="flex items-center gap-1 text-emerald-400 text-xs font-medium">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" /> LIVE
            </span>
          ) : (
            <span className="text-slate-600 text-xs">Kein LIVE-Stream aktiv</span>
          )}
        </div>
        {lastUpdated && (
          <p className="text-slate-700 text-[10px]">
            Aktualisiert {lastUpdated.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>
        )}
      </div>

      {liveData?.status === 0 && liveData.event && (
        <div>
          <h3 className="text-slate-300 text-sm font-medium mb-2">{liveData.event}</h3>
          <div className="space-y-1.5">
            {(liveData.results ?? []).map(r => {
              const isMe = user && (
                r.name.toLowerCase().includes(user.name.toLowerCase().split(' ')[0])
                || (user.myresults_name && r.name.toLowerCase().includes(user.myresults_name.toLowerCase().split(' ')[0]))
              )
              return (
                <Card key={r.participantId} className={`flex items-center gap-3 px-4 py-2.5 ${isMe ? 'border-sky-500/40 bg-sky-500/5' : ''}`}>
                  <span className="text-slate-500 text-xs w-5 text-right">{r.rank}.</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${isMe ? 'text-sky-300' : 'text-white'}`}>{r.name}</p>
                    <p className="text-slate-600 text-xs">{r.club}</p>
                  </div>
                  <p className="font-mono text-white text-sm">{r.timeMs > 0 ? formatTime(r.timeMs) : '—'}</p>
                  {isMe && r.timeMs > 0 && (
                    <button
                      onClick={() => saveTime(r)}
                      disabled={savedIds.has(r.participantId)}
                      className={`p-1.5 rounded-lg transition-colors ${savedIds.has(r.participantId) ? 'text-emerald-400 bg-emerald-400/10' : 'text-slate-400 hover:text-sky-400 hover:bg-sky-400/10'}`}
                    >
                      {savedIds.has(r.participantId) ? <Check size={13} /> : <Download size={13} />}
                    </button>
                  )}
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {loading && !liveData && (
        <p className="text-slate-500 text-sm text-center py-8 animate-pulse">LIVE-Daten werden geladen…</p>
      )}
    </div>
  )
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
