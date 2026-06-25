import { useState, useEffect, useContext } from 'react'
import { Modal } from './Modal'
import { StoreContext } from '../App'
import { AVATAR_COLORS, generateId } from '../utils/format'
import type { Swimmer } from '../types'

interface SwimmerFormModalProps {
  open: boolean
  onClose: () => void
  swimmer?: Swimmer | null
}

export function SwimmerFormModal({ open, onClose, swimmer }: SwimmerFormModalProps) {
  const store = useContext(StoreContext)!
  const isEdit = !!swimmer
  const [form, setForm] = useState({
    name: '',
    birthYear: '',
    club: '',
    avatarColor: AVATAR_COLORS[0],
  })

  useEffect(() => {
    setForm({
      name: swimmer?.name ?? '',
      birthYear: swimmer?.birthYear?.toString() ?? '',
      club: swimmer?.club ?? '',
      avatarColor: swimmer?.avatarColor ?? AVATAR_COLORS[0],
    })
  }, [swimmer])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const year = parseInt(form.birthYear)
    if (isEdit) {
      store.updateSwimmer({ ...swimmer!, name: form.name, birthYear: year, club: form.club, avatarColor: form.avatarColor })
    } else {
      store.addSwimmer({ id: generateId(), name: form.name, birthYear: year, club: form.club, avatarColor: form.avatarColor })
    }
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Schwimmer bearbeiten' : 'Schwimmer hinzufügen'}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-slate-400 text-xs mb-1">Name *</label>
          <input
            required
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:border-sky-500 outline-none"
            placeholder="z.B. Max Muster"
          />
        </div>
        <div>
          <label className="block text-slate-400 text-xs mb-1">Geburtsjahr *</label>
          <input
            required
            type="number"
            min={1950}
            max={new Date().getFullYear()}
            value={form.birthYear}
            onChange={e => setForm(f => ({ ...f, birthYear: e.target.value }))}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:border-sky-500 outline-none"
            placeholder="z.B. 2012"
          />
        </div>
        <div>
          <label className="block text-slate-400 text-xs mb-1">Verein *</label>
          <input
            required
            value={form.club}
            onChange={e => setForm(f => ({ ...f, club: e.target.value }))}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:border-sky-500 outline-none"
            placeholder="z.B. SV Wien"
          />
        </div>
        <div>
          <label className="block text-slate-400 text-xs mb-2">Farbe</label>
          <div className="flex gap-2 flex-wrap">
            {AVATAR_COLORS.map(color => (
              <button
                key={color}
                type="button"
                onClick={() => setForm(f => ({ ...f, avatarColor: color }))}
                className={`w-8 h-8 rounded-full transition-all ${form.avatarColor === color ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-800 scale-110' : 'opacity-60 hover:opacity-100'}`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>
        <button
          type="submit"
          className="w-full bg-sky-500 hover:bg-sky-400 text-white font-semibold py-3 rounded-xl transition-colors"
        >
          {isEdit ? 'Speichern' : 'Hinzufügen'}
        </button>
      </form>
    </Modal>
  )
}
