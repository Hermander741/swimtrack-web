import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import type { Channel, MinRole } from '../../types'
import { createChannel, updateChannel } from '../../api/chat'
import { useAuth } from '../../hooks/useAuth'

const ROLE_OPTIONS: { value: MinRole; label: string }[] = [
  { value: 'mitglied', label: 'Alle Mitglieder' },
  { value: 'eltern', label: 'Eltern + Trainer + Admin' },
  { value: 'trainer', label: 'Trainer + Admin' },
  { value: 'admin', label: 'Nur Admin' },
]

interface Props {
  onClose: () => void
  onCreated: (ch: Channel) => void
  existing?: Channel
}

export function CreateChannelModal({ onClose, onCreated, existing }: Props) {
  const { isAdmin } = useAuth()
  const [name, setName] = useState(existing?.name ?? '')
  const [description, setDescription] = useState(existing?.description ?? '')
  const [minRole, setMinRole] = useState<MinRole>(existing?.min_role ?? 'mitglied')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Name erforderlich'); return }
    setLoading(true)
    setError('')
    const res = existing
      ? await updateChannel(existing.id, { name: name.trim(), description: description.trim() || undefined, min_role: minRole })
      : await createChannel({ name: name.trim(), description: description.trim() || undefined, min_role: minRole })
    setLoading(false)
    if (res.ok) {
      onCreated(res.data)
    } else {
      setError(res.error)
    }
  }

  return (
    <Modal open onClose={onClose} title={existing ? 'Channel bearbeiten' : 'Channel erstellen'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Name"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="#allgemein"
        />
        <Input
          label="Beschreibung (optional)"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Worum geht es hier?"
        />
        <div className="space-y-1">
          <label className="text-slate-400 text-sm">Sichtbar für</label>
          <select
            value={minRole}
            onChange={e => setMinRole(e.target.value as MinRole)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-teal-500/50"
          >
            {ROLE_OPTIONS.filter(o => isAdmin || o.value !== 'admin').map(o => (
              <option key={o.value} value={o.value} className="bg-slate-900">{o.label}</option>
            ))}
          </select>
        </div>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <div className="flex gap-3">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Abbrechen</Button>
          <Button type="submit" className="flex-1" disabled={loading}>
            {loading ? '…' : (existing ? 'Speichern' : 'Erstellen')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
