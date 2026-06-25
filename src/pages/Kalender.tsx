import { useContext, useState } from 'react'
import { CalendarDays, MapPin, Plus, Trash2, CheckCircle2, Clock, ChevronDown } from 'lucide-react'
import { StoreContext } from '../App'
import { Card } from '../components/Card'
import { Modal } from '../components/Modal'
import type { Competition } from '../types'
import { formatDate, generateId, daysUntil } from '../utils/format'

const EMPTY: Omit<Competition, 'id' | 'status'> = {
  name: '',
  location: '',
  startDate: new Date().toISOString().split('T')[0],
  endDate: new Date().toISOString().split('T')[0],
  course: 'LB',
  organizer: '',
  registered: false,
}

function statusLabel(c: Competition) {
  if (c.status === 'ongoing') return { text: 'Läuft', cls: 'bg-emerald-400/20 text-emerald-300 border-emerald-400/30' }
  if (c.status === 'past') return { text: 'Vergangen', cls: 'bg-slate-700 text-slate-400 border-slate-600' }
  const d = daysUntil(c.startDate)
  return { text: `in ${d} Tagen`, cls: 'bg-sky-400/15 text-sky-300 border-sky-400/20' }
}

export function Kalender() {
  const store = useContext(StoreContext)!
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ ...EMPTY })
  const [filter, setFilter] = useState<'alle' | 'upcoming' | 'past'>('upcoming')

  const filtered = store.competitions
    .filter(c => filter === 'alle' ? true : filter === 'upcoming' ? c.status !== 'past' : c.status === 'past')
    .sort((a, b) => {
      if (filter === 'past') return b.startDate.localeCompare(a.startDate)
      return a.startDate.localeCompare(b.startDate)
    })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const today = new Date().toISOString().split('T')[0]
    const status: Competition['status'] =
      form.startDate > today ? 'upcoming'
      : form.endDate >= today ? 'ongoing'
      : 'past'
    store.addCompetition({ ...form, id: generateId(), status })
    setOpen(false)
    setForm({ ...EMPTY })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 pb-24">
      <div className="px-4 pt-14 pb-4 max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-white font-bold text-2xl">Wettkampfkalender</h1>
            <p className="text-slate-400 text-sm">{store.competitions.length} Wettkämpfe</p>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="w-10 h-10 bg-sky-500 rounded-xl flex items-center justify-center shadow-lg shadow-sky-500/30 active:scale-95 transition-transform"
          >
            <Plus size={20} className="text-white" />
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-5 bg-slate-800/50 p-1 rounded-xl">
          {(['upcoming', 'past', 'alle'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                filter === f ? 'bg-sky-500 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              {f === 'upcoming' ? 'Kommend' : f === 'past' ? 'Vergangen' : 'Alle'}
            </button>
          ))}
        </div>

        {/* Competition list */}
        <div className="space-y-3">
          {filtered.length === 0 && (
            <div className="text-center py-16 text-slate-500">
              <CalendarDays size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Keine Wettkämpfe gefunden</p>
            </div>
          )}
          {filtered.map(comp => {
            const { text, cls } = statusLabel(comp)
            return (
              <Card key={comp.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${cls}`}>{text}</span>
                      <span className="text-[10px] text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">
                        {comp.course === 'LB' ? 'Langbahn' : 'Kurzbahn'}
                      </span>
                      {comp.registered && (
                        <span className="text-[10px] text-emerald-400 flex items-center gap-0.5">
                          <CheckCircle2 size={10} /> Angemeldet
                        </span>
                      )}
                    </div>
                    <h3 className="text-white font-semibold leading-tight">{comp.name}</h3>
                    <div className="flex items-center gap-1 mt-1.5 text-slate-400 text-xs">
                      <MapPin size={11} />
                      {comp.location}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5 text-slate-400 text-xs">
                      <Clock size={11} />
                      {formatDate(comp.startDate)}
                      {comp.endDate !== comp.startDate && ` – ${formatDate(comp.endDate)}`}
                    </div>
                    {comp.organizer && (
                      <p className="text-slate-500 text-xs mt-0.5">{comp.organizer}</p>
                    )}
                  </div>
                  <button
                    onClick={() => store.removeCompetition(comp.id)}
                    className="text-slate-600 hover:text-rose-400 transition-colors p-1 flex-shrink-0"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </Card>
            )
          })}
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Wettkampf hinzufügen">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-slate-400 text-xs mb-1">Wettkampfname *</label>
            <input
              required
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:border-sky-500 outline-none"
              placeholder="z.B. Wiener Stadtmeisterschaften"
            />
          </div>
          <div>
            <label className="block text-slate-400 text-xs mb-1">Ort *</label>
            <input
              required
              value={form.location}
              onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:border-sky-500 outline-none"
              placeholder="z.B. Stadionbad Wien"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 text-xs mb-1">Von *</label>
              <input
                type="date"
                required
                value={form.startDate}
                onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:border-sky-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-xs mb-1">Bis *</label>
              <input
                type="date"
                required
                value={form.endDate}
                onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:border-sky-500 outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-slate-400 text-xs mb-1">Bahn</label>
            <div className="relative">
              <select
                value={form.course}
                onChange={e => setForm(f => ({ ...f, course: e.target.value as 'LB' | 'KB' }))}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:border-sky-500 outline-none appearance-none"
              >
                <option value="LB">Langbahn (50m)</option>
                <option value="KB">Kurzbahn (25m)</option>
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="block text-slate-400 text-xs mb-1">Veranstalter</label>
            <input
              value={form.organizer}
              onChange={e => setForm(f => ({ ...f, organizer: e.target.value }))}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:border-sky-500 outline-none"
              placeholder="optional"
            />
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => setForm(f => ({ ...f, registered: !f.registered }))}
              className={`w-10 h-6 rounded-full transition-colors relative ${form.registered ? 'bg-emerald-500' : 'bg-slate-700'}`}
            >
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.registered ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </div>
            <span className="text-white text-sm">Angemeldet</span>
          </label>
          <button
            type="submit"
            className="w-full bg-sky-500 hover:bg-sky-400 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            Hinzufügen
          </button>
        </form>
      </Modal>
    </div>
  )
}
