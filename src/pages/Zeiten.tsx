import { useContext, useState } from 'react'
import { Timer, Plus, Star, Trash2, ChevronDown, TrendingDown } from 'lucide-react'
import { StoreContext } from '../App'
import { Card } from '../components/Card'
import { Modal } from '../components/Modal'
import type { SwimTime } from '../types'
import { formatTime, parseTimeInput, formatDate, generateId, SWIM_EVENTS } from '../utils/format'

export function Zeiten() {
  const store = useContext(StoreContext)!
  const swimmer = store.swimmers[0]
  const [open, setOpen] = useState(false)
  const [filterEvent, setFilterEvent] = useState('alle')
  const [filterCourse, setFilterCourse] = useState<'alle' | 'LB' | 'KB'>('alle')
  const [form, setForm] = useState({
    event: SWIM_EVENTS[0],
    course: 'LB' as 'LB' | 'KB',
    timeInput: '',
    date: new Date().toISOString().split('T')[0],
    competition: '',
  })
  const [timeError, setTimeError] = useState('')

  const swimmerTimes = store.times.filter(t => t.swimmerId === swimmer?.id)
  const events = ['alle', ...Array.from(new Set(swimmerTimes.map(t => t.event))).sort()]

  const filtered = swimmerTimes
    .filter(t => filterEvent === 'alle' || t.event === filterEvent)
    .filter(t => filterCourse === 'alle' || t.course === filterCourse)
    .sort((a, b) => b.date.localeCompare(a.date))

  // Group by event for PB summary
  const pbMap = new Map<string, SwimTime>()
  swimmerTimes.filter(t => t.isPersonalBest).forEach(t => pbMap.set(`${t.event}-${t.course}`, t))

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const ms = parseTimeInput(form.timeInput)
    if (!ms) { setTimeError('Format: 1:03,42 oder 63,42'); return }
    setTimeError('')
    if (!swimmer) return
    store.addTime({
      id: generateId(),
      swimmerId: swimmer.id,
      event: form.event,
      course: form.course,
      timeMs: ms,
      date: form.date,
      competition: form.competition || undefined,
      isPersonalBest: false,
    })
    setOpen(false)
    setForm(f => ({ ...f, timeInput: '', competition: '' }))
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 pb-24">
      <div className="px-4 pt-14 pb-4 max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-white font-bold text-2xl">Zeiten</h1>
            <p className="text-slate-400 text-sm">{swimmerTimes.length} Einträge · {pbMap.size} Bestzeiten</p>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="w-10 h-10 bg-sky-500 rounded-xl flex items-center justify-center shadow-lg shadow-sky-500/30 active:scale-95 transition-transform"
          >
            <Plus size={20} className="text-white" />
          </button>
        </div>

        {/* PB summary strip */}
        {pbMap.size > 0 && (
          <div className="mb-5">
            <h2 className="text-slate-400 text-xs font-medium mb-2 flex items-center gap-1.5">
              <Star size={11} className="text-amber-400" /> Bestzeiten
            </h2>
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
              {Array.from(pbMap.values()).map(pb => (
                <div key={pb.id} className="flex-shrink-0 bg-slate-800/60 border border-amber-400/20 rounded-xl px-3 py-2 min-w-[120px]">
                  <p className="text-[10px] text-amber-400 font-medium flex items-center gap-1">
                    <Star size={8} /> PB
                  </p>
                  <p className="text-white font-mono font-bold text-sm mt-0.5">{formatTime(pb.timeMs)}</p>
                  <p className="text-slate-400 text-[10px] mt-0.5 leading-tight">{pb.event}</p>
                  <p className="text-slate-500 text-[10px]">{pb.course === 'LB' ? 'LB' : 'KB'}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="space-y-2 mb-4">
          <div className="flex gap-2 bg-slate-800/50 p-1 rounded-xl">
            {(['alle', 'LB', 'KB'] as const).map(c => (
              <button
                key={c}
                onClick={() => setFilterCourse(c)}
                className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  filterCourse === c ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {c === 'alle' ? 'Alle Bahnen' : c === 'LB' ? 'Langbahn' : 'Kurzbahn'}
              </button>
            ))}
          </div>
          {events.length > 1 && (
            <div className="relative">
              <select
                value={filterEvent}
                onChange={e => setFilterEvent(e.target.value)}
                className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl px-3 py-2.5 text-white text-sm focus:border-sky-500 outline-none appearance-none"
              >
                {events.map(ev => <option key={ev} value={ev}>{ev === 'alle' ? 'Alle Disziplinen' : ev}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          )}
        </div>

        {/* Times list */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <Timer size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Noch keine Zeiten eingetragen</p>
            <button onClick={() => setOpen(true)} className="mt-3 text-sky-400 text-sm">Jetzt eintragen</button>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((t) => {
              const pbKey = `${t.event}-${t.course}`
              const pb = pbMap.get(pbKey)
              const isPB = t.isPersonalBest
              const improvementMs = (!isPB && pb) ? t.timeMs - pb.timeMs : null
              return (
                <Card key={t.id} className={`flex items-center justify-between px-4 py-3 ${isPB ? 'border-amber-400/30' : ''}`}>
                  <div className="flex items-center gap-3">
                    {isPB ? (
                      <div className="w-7 h-7 bg-amber-400/15 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Star size={13} className="text-amber-400" />
                      </div>
                    ) : improvementMs && improvementMs > 0 ? (
                      <div className="w-7 h-7 bg-slate-700 rounded-lg flex items-center justify-center flex-shrink-0">
                        <TrendingDown size={13} className="text-slate-400" />
                      </div>
                    ) : null}
                    <div>
                      <p className="text-white text-sm font-medium">{t.event} · {t.course}</p>
                      <p className="text-slate-500 text-xs">{t.competition ?? formatDate(t.date)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className={`font-mono font-bold ${isPB ? 'text-amber-400' : 'text-white'}`}>
                        {formatTime(t.timeMs)}
                      </p>
                      {improvementMs && improvementMs > 0 && (
                        <p className="text-slate-500 text-[10px]">+{formatTime(improvementMs)}</p>
                      )}
                    </div>
                    <button onClick={() => store.removeTime(t.id)} className="text-slate-700 hover:text-rose-400 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Zeit eintragen">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-slate-400 text-xs mb-1">Disziplin *</label>
            <div className="relative">
              <select
                value={form.event}
                onChange={e => setForm(f => ({ ...f, event: e.target.value }))}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:border-sky-500 outline-none appearance-none"
              >
                {SWIM_EVENTS.map(ev => <option key={ev}>{ev}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="block text-slate-400 text-xs mb-1">Bahn</label>
            <div className="flex gap-2">
              {(['LB', 'KB'] as const).map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, course: c }))}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                    form.course === c ? 'bg-sky-500 text-white' : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  {c === 'LB' ? 'Langbahn' : 'Kurzbahn'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-slate-400 text-xs mb-1">Zeit * (Format: 1:03,42 oder 63,42)</label>
            <input
              required
              value={form.timeInput}
              onChange={e => { setForm(f => ({ ...f, timeInput: e.target.value })); setTimeError('') }}
              className={`w-full bg-slate-900 border rounded-xl px-3 py-2.5 text-white text-sm font-mono focus:border-sky-500 outline-none ${timeError ? 'border-rose-500' : 'border-slate-700'}`}
              placeholder="1:03,42"
            />
            {timeError && <p className="text-rose-400 text-xs mt-1">{timeError}</p>}
          </div>
          <div>
            <label className="block text-slate-400 text-xs mb-1">Datum *</label>
            <input
              type="date"
              required
              value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:border-sky-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-slate-400 text-xs mb-1">Wettkampf (optional)</label>
            <input
              value={form.competition}
              onChange={e => setForm(f => ({ ...f, competition: e.target.value }))}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:border-sky-500 outline-none"
              placeholder="z.B. Stadtmeisterschaften 2025"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-sky-500 hover:bg-sky-400 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            Eintragen
          </button>
        </form>
      </Modal>
    </div>
  )
}
