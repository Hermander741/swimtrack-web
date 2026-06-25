import { useContext, useState } from 'react'
import { Plus, Check, Pencil, Trash2 } from 'lucide-react'
import { Modal } from './Modal'
import { SwimmerFormModal } from './SwimmerFormModal'
import { StoreContext } from '../App'
import type { Swimmer } from '../types'

interface SwimmerSelectorModalProps {
  open: boolean
  onClose: () => void
}

export function SwimmerSelectorModal({ open, onClose }: SwimmerSelectorModalProps) {
  const store = useContext(StoreContext)!
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Swimmer | null>(null)

  function handleSelect(id: string) {
    store.setActiveSwimmerId(id)
    onClose()
  }

  function handleEdit(s: Swimmer, e: React.MouseEvent) {
    e.stopPropagation()
    setEditTarget(s)
    setFormOpen(true)
  }

  function handleDelete(s: Swimmer, e: React.MouseEvent) {
    e.stopPropagation()
    if (store.swimmers.length <= 1) return
    store.removeSwimmer(s.id)
  }

  function handleFormClose() {
    setFormOpen(false)
    setEditTarget(null)
  }

  const canDelete = store.swimmers.length > 1

  return (
    <>
      <Modal open={open} onClose={onClose} title="Schwimmer wechseln">
        <div className="space-y-1 mb-4">
          {store.swimmers.map(s => {
            const initials = s.name.split(' ').filter(Boolean).map(n => n[0]).join('')
            const isActive = store.activeSwimmer?.id === s.id
            return (
              <div
                key={s.id}
                role="button"
                tabIndex={0}
                onClick={() => handleSelect(s.id)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelect(s.id) } }}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-colors text-left cursor-pointer ${isActive ? 'bg-sky-500/10' : 'hover:bg-slate-700/50'}`}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                  style={{ backgroundColor: s.avatarColor }}
                >
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm">{s.name}</p>
                  <p className="text-slate-400 text-xs">{s.club} · {s.birthYear}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {isActive && <Check size={15} className="text-sky-400 mr-1" />}
                  <button
                    onClick={e => handleEdit(s, e)}
                    className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                    title="Bearbeiten"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={e => handleDelete(s, e)}
                    disabled={!canDelete}
                    className={`p-1.5 rounded-lg transition-colors ${canDelete ? 'text-slate-500 hover:text-rose-400 hover:bg-slate-700' : 'text-slate-700 cursor-not-allowed'}`}
                    title={canDelete ? 'Löschen' : 'Letzter Schwimmer kann nicht gelöscht werden'}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
        <button
          onClick={() => { setEditTarget(null); setFormOpen(true) }}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-slate-600 text-slate-400 hover:border-sky-500 hover:text-sky-400 transition-colors text-sm"
        >
          <Plus size={16} />
          Schwimmer hinzufügen
        </button>
      </Modal>
      <SwimmerFormModal open={formOpen} onClose={handleFormClose} swimmer={editTarget} />
    </>
  )
}
