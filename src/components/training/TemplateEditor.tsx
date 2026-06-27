import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { Plus, Pencil, Trash2, X, Check, Play, ChevronUp, ChevronDown } from 'lucide-react'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { createTemplate, updateTemplate, deleteTemplate, generateSessions } from '../../api/training'
import type { TrainingGroup, TrainingBlock, TrainingTemplate, BlockCategory } from '../../types'

const DOW_LABELS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag']
const CAT_COLORS: Record<BlockCategory, string> = {
  aufwaermen: 'bg-yellow-500/20 text-yellow-400', hauptset: 'bg-teal-500/20 text-teal-400',
  abkuehlen: 'bg-sky-500/20 text-sky-400', kraft: 'bg-purple-500/20 text-purple-400',
  technik: 'bg-pink-500/20 text-pink-400', sonstiges: 'bg-slate-500/20 text-slate-400',
}

interface TemplateEditorProps {
  groups: TrainingGroup[]
  blocks: TrainingBlock[]
  templates: TrainingTemplate[]
  onChanged: (templates: TrainingTemplate[]) => void
  onSessionsGenerated: () => void
}

interface SelectedBlock { block_id: string; override_note: string }

const emptyForm = { group_id: '', day_of_week: 1, start_time: '18:00', duration_min: '90', location: '', title: '' }

export function TemplateEditor({ groups, blocks, templates, onChanged, onSessionsGenerated }: TemplateEditorProps) {
  const { user } = useAuth()
  const [editId, setEditId] = useState<string | 'new' | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [selectedBlocks, setSelectedBlocks] = useState<SelectedBlock[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [generateId, setGenerateId] = useState<string | null>(null)
  const [genFrom, setGenFrom] = useState('')
  const [genTo, setGenTo] = useState('')
  const [genLoading, setGenLoading] = useState(false)
  const [genResult, setGenResult] = useState<string | null>(null)

  function openNew() {
    setForm({ ...emptyForm, group_id: groups[0]?.id ?? '' })
    setSelectedBlocks([]); setEditId('new'); setError('')
  }

  function openEdit(t: TrainingTemplate) {
    setForm({
      group_id: t.group_id, day_of_week: t.day_of_week, start_time: t.start_time.slice(0, 5),
      duration_min: t.duration_min.toString(), location: t.location ?? '', title: t.title,
    })
    setSelectedBlocks(t.blocks.map(b => ({ block_id: b.block_id, override_note: b.override_note ?? '' })))
    setEditId(t.id); setError('')
  }

  function addBlock(blockId: string) {
    if (selectedBlocks.find(b => b.block_id === blockId)) return
    setSelectedBlocks(prev => [...prev, { block_id: blockId, override_note: '' }])
  }

  function removeBlock(blockId: string) {
    setSelectedBlocks(prev => prev.filter(b => b.block_id !== blockId))
  }

  function moveBlock(index: number, dir: -1 | 1) {
    setSelectedBlocks(prev => {
      const next = [...prev]; const swap = index + dir
      if (swap < 0 || swap >= next.length) return prev
      ;[next[index], next[swap]] = [next[swap], next[index]]
      return next
    })
  }

  async function handleSave() {
    if (!form.title.trim()) { setError('Titel erforderlich'); return }
    if (!form.group_id) { setError('Gruppe erforderlich'); return }
    setSaving(true); setError('')
    const blockIds = selectedBlocks.map(b => ({ block_id: b.block_id, override_note: b.override_note || undefined }))
    const sharedPayload = {
      day_of_week: form.day_of_week, start_time: form.start_time,
      duration_min: parseInt(form.duration_min, 10) || 90,
      location: form.location || undefined, title: form.title.trim(),
      block_ids: blockIds,
    }
    const res = editId === 'new'
      ? await createTemplate({ group_id: form.group_id, ...sharedPayload })
      : await updateTemplate(editId!, sharedPayload)
    setSaving(false)
    if (!res.ok) { setError(res.error); return }
    const updated = editId === 'new' ? [...templates, res.data] : templates.map(t => t.id === editId ? res.data : t)
    onChanged(updated); setEditId(null)
  }

  async function handleDelete(id: string) {
    if (!confirm('Template löschen?')) return
    const res = await deleteTemplate(id)
    if (res.ok) onChanged(templates.filter(t => t.id !== id))
  }

  async function handleGenerate(templateId: string) {
    if (!genFrom || !genTo) { setGenResult('Bitte von/bis Datum angeben'); return }
    setGenLoading(true); setGenResult(null)
    const res = await generateSessions(templateId, genFrom, genTo)
    setGenLoading(false)
    if (!res.ok) { setGenResult(`Fehler: ${res.error}`); return }
    setGenResult(`✓ ${res.data.created} Session(s) erstellt`)
    onSessionsGenerated()
    if (res.data.created > 0) setGenerateId(null)
  }

  if (editId !== null) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <button onClick={() => setEditId(null)} className="text-slate-400 hover:text-white p-1"><X size={18} /></button>
          <h3 className="text-white font-semibold text-sm">{editId === 'new' ? 'Neues Template' : 'Template bearbeiten'}</h3>
        </div>
        <Input label="Titel" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} error={error} />
        <div>
          <p className="text-xs text-slate-500 mb-2">Gruppe</p>
          <div className="flex flex-wrap gap-2">
            {groups.map(g => (
              <button key={g.id} onClick={() => setForm(f => ({ ...f, group_id: g.id }))}
                className="text-xs px-3 py-1 rounded-full font-medium transition-colors"
                style={form.group_id === g.id ? { backgroundColor: g.color + '33', color: g.color } : { backgroundColor: 'rgba(255,255,255,0.05)', color: '#94a3b8' }}>
                {g.name}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-2">Wochentag</p>
          <div className="flex flex-wrap gap-2">
            {DOW_LABELS.map((label, i) => (
              <button key={i} onClick={() => setForm(f => ({ ...f, day_of_week: i }))}
                className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${form.day_of_week === i ? 'bg-teal-500/20 text-teal-400' : 'bg-white/5 text-slate-400'}`}>
                {label.slice(0, 2)}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Startzeit" type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} />
          <Input label="Dauer (min)" type="number" value={form.duration_min} onChange={e => setForm(f => ({ ...f, duration_min: e.target.value }))} />
        </div>
        <Input label="Ort (optional)" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Bausteine</p>
          {selectedBlocks.length > 0 && (
            <div className="glass rounded-xl mb-3 divide-y divide-white/5">
              {selectedBlocks.map((sb, i) => {
                const b = blocks.find(bl => bl.id === sb.block_id)
                if (!b) return null
                return (
                  <div key={sb.block_id} className="flex items-center gap-2 px-3 py-2">
                    <div className="flex flex-col gap-0.5">
                      <button onClick={() => moveBlock(i, -1)} className="text-slate-500 hover:text-white p-0.5"><ChevronUp size={12} /></button>
                      <button onClick={() => moveBlock(i, 1)} className="text-slate-500 hover:text-white p-0.5"><ChevronDown size={12} /></button>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${CAT_COLORS[b.category]}`}>{b.category.slice(0, 3)}</span>
                    <span className="flex-1 text-sm text-white truncate">{b.name}</span>
                    <button onClick={() => removeBlock(sb.block_id)} className="text-slate-500 hover:text-red-400 p-1"><X size={14} /></button>
                  </div>
                )
              })}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {blocks.filter(b => !selectedBlocks.find(sb => sb.block_id === b.id)).map(b => (
              <button key={b.id} onClick={() => addBlock(b.id)}
                className={`text-xs px-3 py-1 rounded-full font-medium flex items-center gap-1 transition-colors ${CAT_COLORS[b.category]} opacity-70 hover:opacity-100`}>
                <Plus size={10} /> {b.name}
              </button>
            ))}
          </div>
        </div>
        <Button onClick={handleSave} loading={saving} className="w-full">
          <Check size={16} className="mr-2" /> Speichern
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <button onClick={openNew}
        className="w-full glass rounded-xl p-3 flex items-center gap-2 text-teal-400 hover:text-teal-300 transition-colors text-sm font-medium">
        <Plus size={16} /> Neues Template
      </button>
      {templates.map(t => {
        const group = groups.find(g => g.id === t.group_id)
        const isGenerating = generateId === t.id
        return (
          <div key={t.id} className="glass rounded-xl p-3">
            <div className="flex items-start gap-2">
              {group && <div className="w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0" style={{ backgroundColor: group.color }} />}
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium text-sm">{t.title}</p>
                <p className="text-xs text-slate-400">{DOW_LABELS[t.day_of_week]}, {t.start_time.slice(0, 5)} Uhr · {t.duration_min} min</p>
                {group && <p className="text-xs text-slate-500">{group.name}</p>}
              </div>
              <div className="flex gap-1">
                <button onClick={() => { setGenerateId(isGenerating ? null : t.id); setGenResult(null) }}
                  className="text-slate-500 hover:text-teal-400 p-1 transition-colors" title="Sessions generieren">
                  <Play size={14} />
                </button>
                <button onClick={() => openEdit(t)} className="text-slate-500 hover:text-white p-1 transition-colors"><Pencil size={14} /></button>
                {user?.role === 'admin' && (
                  <button onClick={() => handleDelete(t.id)} className="text-slate-500 hover:text-red-400 p-1 transition-colors"><Trash2 size={14} /></button>
                )}
              </div>
            </div>
            {isGenerating && (
              <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <Input label="Von" type="date" value={genFrom} onChange={e => setGenFrom(e.target.value)} />
                  <Input label="Bis" type="date" value={genTo} onChange={e => setGenTo(e.target.value)} />
                </div>
                <Button onClick={() => handleGenerate(t.id)} loading={genLoading} className="w-full" variant="secondary">
                  Sessions generieren
                </Button>
                {genResult && <p className="text-xs text-center text-teal-400">{genResult}</p>}
              </div>
            )}
          </div>
        )
      })}
      {templates.length === 0 && <p className="text-sm text-slate-400 text-center py-6">Keine Templates</p>}
    </div>
  )
}
