import { useState } from 'react'
import { Plus, Pencil, Trash2, X, Check } from 'lucide-react'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { createBlock, updateBlock, deleteBlock } from '../../api/training'
import type { TrainingBlock, BlockCategory } from '../../types'

const CATEGORIES: { value: BlockCategory; label: string }[] = [
  { value: 'aufwaermen', label: 'Aufwärmen' },
  { value: 'hauptset', label: 'Hauptset' },
  { value: 'abkuehlen', label: 'Abkühlen' },
  { value: 'kraft', label: 'Kraft' },
  { value: 'technik', label: 'Technik' },
  { value: 'sonstiges', label: 'Sonstiges' },
]

const CAT_COLORS: Record<BlockCategory, string> = {
  aufwaermen: 'bg-yellow-500/20 text-yellow-400',
  hauptset: 'bg-teal-500/20 text-teal-400',
  abkuehlen: 'bg-sky-500/20 text-sky-400',
  kraft: 'bg-purple-500/20 text-purple-400',
  technik: 'bg-pink-500/20 text-pink-400',
  sonstiges: 'bg-slate-500/20 text-slate-400',
}

interface BlockLibraryProps {
  blocks: TrainingBlock[]
  onChanged: (blocks: TrainingBlock[]) => void
}

const emptyForm = { name: '', category: 'hauptset' as BlockCategory, distance_m: '', stroke: '', reps: '', rest_s: '', description: '' }

export function BlockLibrary({ blocks, onChanged }: BlockLibraryProps) {
  const [filterCat, setFilterCat] = useState<BlockCategory | 'alle'>('alle')
  const [editId, setEditId] = useState<string | 'new' | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const filtered = filterCat === 'alle' ? blocks : blocks.filter(b => b.category === filterCat)

  function openNew() { setForm(emptyForm); setEditId('new'); setError('') }

  function openEdit(b: TrainingBlock) {
    setForm({
      name: b.name, category: b.category,
      distance_m: b.distance_m?.toString() ?? '',
      stroke: b.stroke ?? '', reps: b.reps?.toString() ?? '',
      rest_s: b.rest_s?.toString() ?? '', description: b.description ?? '',
    })
    setEditId(b.id); setError('')
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Name erforderlich'); return }
    setSaving(true); setError('')
    const payload = {
      name: form.name.trim(), category: form.category,
      distance_m: form.distance_m ? parseInt(form.distance_m, 10) : null,
      stroke: form.stroke || null, reps: form.reps ? parseInt(form.reps, 10) : null,
      rest_s: form.rest_s ? parseInt(form.rest_s, 10) : null, description: form.description || null,
    }
    const res = editId === 'new' ? await createBlock(payload) : await updateBlock(editId!, payload)
    setSaving(false)
    if (!res.ok) { setError(res.error); return }
    const updated = editId === 'new' ? [...blocks, res.data] : blocks.map(b => b.id === editId ? res.data : b)
    onChanged(updated)
    setEditId(null)
  }

  async function handleDelete(id: string) {
    if (!confirm('Baustein löschen?')) return
    const res = await deleteBlock(id)
    if (res.ok) onChanged(blocks.filter(b => b.id !== id))
  }

  if (editId !== null) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <button onClick={() => setEditId(null)} className="text-slate-400 hover:text-white p-1"><X size={18} /></button>
          <h3 className="text-white font-semibold text-sm">{editId === 'new' ? 'Neuer Baustein' : 'Baustein bearbeiten'}</h3>
        </div>
        <Input label="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} error={error} />
        <div>
          <p className="text-xs text-slate-500 mb-2">Kategorie</p>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(c => (
              <button key={c.value} onClick={() => setForm(f => ({ ...f, category: c.value }))}
                className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${form.category === c.value ? CAT_COLORS[c.value] : 'bg-white/5 text-slate-400'}`}>
                {c.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Distanz (m)" type="number" value={form.distance_m} onChange={e => setForm(f => ({ ...f, distance_m: e.target.value }))} />
          <Input label="Stil" value={form.stroke} onChange={e => setForm(f => ({ ...f, stroke: e.target.value }))} />
          <Input label="Wdh." type="number" value={form.reps} onChange={e => setForm(f => ({ ...f, reps: e.target.value }))} />
          <Input label="Pause (s)" type="number" value={form.rest_s} onChange={e => setForm(f => ({ ...f, rest_s: e.target.value }))} />
        </div>
        <Input label="Beschreibung" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        <Button onClick={handleSave} loading={saving} className="w-full">
          <Check size={16} className="mr-2" /> Speichern
        </Button>
      </div>
    )
  }

  return (
    <div>
      <div className="flex gap-1 mb-3 overflow-x-auto scrollbar-none -mx-1 px-1 pb-1">
        <button onClick={() => setFilterCat('alle')}
          className={`text-xs px-3 py-1 rounded-full whitespace-nowrap font-medium transition-colors ${filterCat === 'alle' ? 'bg-white/10 text-white' : 'text-slate-400'}`}>
          Alle
        </button>
        {CATEGORIES.map(c => (
          <button key={c.value} onClick={() => setFilterCat(c.value)}
            className={`text-xs px-3 py-1 rounded-full whitespace-nowrap font-medium transition-colors ${filterCat === c.value ? CAT_COLORS[c.value] : 'text-slate-400'}`}>
            {c.label}
          </button>
        ))}
      </div>
      <button onClick={openNew}
        className="w-full glass rounded-xl p-3 flex items-center gap-2 text-teal-400 hover:text-teal-300 transition-colors text-sm font-medium mb-3">
        <Plus size={16} /> Neuer Baustein
      </button>
      <div className="space-y-2">
        {filtered.map(b => (
          <div key={b.id} className="glass rounded-xl p-3 flex items-start gap-3">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 mt-0.5 ${CAT_COLORS[b.category]}`}>
              {CATEGORIES.find(c => c.value === b.category)?.label}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium text-sm">{b.name}</p>
              <p className="text-xs text-slate-400">
                {[b.distance_m && `${b.distance_m}m`, b.stroke, b.reps && `×${b.reps}`, b.rest_s && `${b.rest_s}s`].filter(Boolean).join(' · ')}
              </p>
            </div>
            <div className="flex gap-1">
              <button onClick={() => openEdit(b)} className="text-slate-500 hover:text-white p-1 transition-colors"><Pencil size={14} /></button>
              <button onClick={() => handleDelete(b.id)} className="text-slate-500 hover:text-red-400 p-1 transition-colors"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-sm text-slate-400 text-center py-6">Keine Bausteine</p>}
      </div>
    </div>
  )
}
