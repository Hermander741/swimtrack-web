import { useState } from 'react'
import { Plus, X, Check, ChevronUp, ChevronDown } from 'lucide-react'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { createSession } from '../../api/training'
import type { TrainingGroup, TrainingBlock, BlockCategory } from '../../types'

const CAT_COLORS: Record<BlockCategory, string> = {
  aufwaermen: 'bg-yellow-500/20 text-yellow-400',
  hauptset: 'bg-teal-500/20 text-teal-400',
  abkuehlen: 'bg-sky-500/20 text-sky-400',
  kraft: 'bg-purple-500/20 text-purple-400',
  technik: 'bg-pink-500/20 text-pink-400',
  sonstiges: 'bg-slate-500/20 text-slate-400',
}

interface SelectedBlock {
  block_id: string
  name: string
  category: BlockCategory
}

interface SessionEditorProps {
  groups: TrainingGroup[]
  blocks: TrainingBlock[]
  onSaved: () => void
  onClose: () => void
}

export function SessionEditor({ groups, blocks, onSaved, onClose }: SessionEditorProps) {
  const [title, setTitle] = useState('')
  const [groupId, setGroupId] = useState(groups[0]?.id ?? '')
  const [isExternal, setIsExternal] = useState(false)
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [startTime, setStartTime] = useState('18:00')
  const [durationMin, setDurationMin] = useState('90')
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [selectedBlocks, setSelectedBlocks] = useState<SelectedBlock[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function addBlock(b: TrainingBlock) {
    setSelectedBlocks(prev => [...prev, { block_id: b.id, name: b.name, category: b.category }])
  }

  function removeBlock(i: number) {
    setSelectedBlocks(prev => prev.filter((_, idx) => idx !== i))
  }

  function moveBlock(index: number, dir: -1 | 1) {
    setSelectedBlocks(prev => {
      const next = [...prev]
      const swap = index + dir
      if (swap < 0 || swap >= next.length) return prev
      ;[next[index], next[swap]] = [next[swap], next[index]]
      return next
    })
  }

  async function handleSave() {
    if (!title.trim()) { setError('Titel erforderlich'); return }
    if (!isExternal && !groupId) { setError('Gruppe erforderlich'); return }
    setSaving(true)
    setError('')
    const res = await createSession({
      group_id: isExternal ? undefined : groupId || undefined,
      title: title.trim(),
      date,
      start_time: startTime,
      duration_min: parseInt(durationMin, 10) || 90,
      location: location || undefined,
      notes: notes || undefined,
      is_external: isExternal,
      blocks: selectedBlocks.map(sb => {
        const b = blocks.find(bl => bl.id === sb.block_id)
        return {
          block_id: sb.block_id,
          name: sb.name,
          category: sb.category,
          distance_m: b?.distance_m ?? undefined,
          stroke: b?.stroke ?? undefined,
          reps: b?.reps ?? undefined,
          rest_s: b?.rest_s ?? undefined,
          description: b?.description ?? undefined,
        }
      }),
    })
    setSaving(false)
    if (!res.ok) { setError(res.error); return }
    onSaved()
    onClose()
  }

  const availableBlocks = blocks.filter(b => !selectedBlocks.find(sb => sb.block_id === b.id))

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
          <X size={18} />
        </button>
        <h3 className="text-white font-semibold text-sm">Neue Session</h3>
      </div>

      <Input label="Titel" value={title} onChange={e => setTitle(e.target.value)} error={error} />

      <div className="flex items-center gap-3">
        <button
          onClick={() => setIsExternal(false)}
          className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${!isExternal ? 'bg-teal-500/20 text-teal-400' : 'text-slate-400'}`}
        >
          Gruppentraining
        </button>
        <button
          onClick={() => setIsExternal(true)}
          className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${isExternal ? 'bg-orange-500/20 text-orange-400' : 'text-slate-400'}`}
        >
          Externer Termin
        </button>
      </div>

      {!isExternal && groups.length > 0 && (
        <div>
          <p className="text-xs text-slate-500 mb-2">Gruppe</p>
          <div className="flex flex-wrap gap-2">
            {groups.map(g => (
              <button
                key={g.id}
                onClick={() => setGroupId(g.id)}
                className="text-xs px-3 py-1 rounded-full font-medium transition-colors"
                style={groupId === g.id
                  ? { backgroundColor: g.color + '33', color: g.color }
                  : { backgroundColor: 'rgba(255,255,255,0.05)', color: '#94a3b8' }}
              >
                {g.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <Input label="Datum" type="date" value={date} onChange={e => setDate(e.target.value)} />

      <div className="grid grid-cols-2 gap-3">
        <Input label="Startzeit" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
        <Input label="Dauer (min)" type="number" value={durationMin} onChange={e => setDurationMin(e.target.value)} />
      </div>

      <Input label="Ort (optional)" value={location} onChange={e => setLocation(e.target.value)} />
      <Input label="Notizen (optional)" value={notes} onChange={e => setNotes(e.target.value)} />

      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Bausteine</p>
        {selectedBlocks.length > 0 && (
          <div className="glass rounded-xl mb-3 divide-y divide-white/5">
            {selectedBlocks.map((sb, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2">
                <div className="flex flex-col gap-0.5">
                  <button onClick={() => moveBlock(i, -1)} className="text-slate-500 hover:text-white p-0.5">
                    <ChevronUp size={12} />
                  </button>
                  <button onClick={() => moveBlock(i, 1)} className="text-slate-500 hover:text-white p-0.5">
                    <ChevronDown size={12} />
                  </button>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${CAT_COLORS[sb.category]}`}>
                  {sb.category.slice(0, 3)}
                </span>
                <span className="flex-1 text-sm text-white truncate">{sb.name}</span>
                <button onClick={() => removeBlock(i)} className="text-slate-500 hover:text-red-400 p-1">
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
        {availableBlocks.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {availableBlocks.map(b => (
              <button
                key={b.id}
                onClick={() => addBlock(b)}
                className={`text-xs px-3 py-1 rounded-full font-medium flex items-center gap-1 transition-colors ${CAT_COLORS[b.category]} opacity-70 hover:opacity-100`}
              >
                <Plus size={10} /> {b.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <Button onClick={handleSave} loading={saving} className="w-full">
        <Check size={16} className="mr-2" /> Session erstellen
      </Button>
    </div>
  )
}
