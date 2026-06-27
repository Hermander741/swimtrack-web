import { useState, useEffect } from 'react'
import { UserPlus, UserMinus, Trash2 } from 'lucide-react'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { Avatar } from '../ui/Avatar'
import {
  createGroup, updateGroup, deleteGroup,
  listGroupMembers, addGroupMember, removeGroupMember,
} from '../../api/training'
import { listUsers } from '../../api/users'
import type { TrainingGroup, TrainingGroupMember, User } from '../../types'

const COLORS = ['#0EA5E9','#14B8A6','#8B5CF6','#F59E0B','#EF4444','#10B981','#EC4899','#F97316']

interface GroupEditorProps {
  group: TrainingGroup | null
  onSaved: () => void
  onDeleted?: () => void
}

export function GroupEditor({ group, onSaved, onDeleted }: GroupEditorProps) {
  const [name, setName] = useState(group?.name ?? '')
  const [description, setDescription] = useState(group?.description ?? '')
  const [color, setColor] = useState(group?.color ?? '#0EA5E9')
  const [members, setMembers] = useState<TrainingGroupMember[]>([])
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (group) {
      listGroupMembers(group.id).then(r => { if (r.ok) setMembers(r.data) })
    }
    listUsers().then(r => { if (r.ok) setAllUsers(r.data) })
  }, [group?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave() {
    if (!name.trim()) { setError('Name erforderlich'); return }
    setSaving(true); setError('')
    const res = group
      ? await updateGroup(group.id, { name, description: description || undefined, color })
      : await createGroup({ name, description: description || undefined, color })
    setSaving(false)
    if (!res.ok) { setError(res.error); return }
    onSaved()
  }

  async function handleDelete() {
    if (!group) return
    if (!confirm(`Gruppe "${group.name}" wirklich löschen?`)) return
    const res = await deleteGroup(group.id)
    if (res.ok) onDeleted?.()
  }

  async function handleAddMember(userId: string) {
    if (!group) return
    const res = await addGroupMember(group.id, userId)
    if (res.ok) {
      const r = await listGroupMembers(group.id)
      if (r.ok) setMembers(r.data)
    }
  }

  async function handleRemoveMember(userId: string) {
    if (!group) return
    const res = await removeGroupMember(group.id, userId)
    if (res.ok) setMembers(prev => prev.filter(m => m.user_id !== userId))
  }

  const nonMembers = allUsers.filter(u => !members.find(m => m.user_id === u.id))

  return (
    <div className="space-y-4">
      <Input label="Name" value={name} onChange={e => setName(e.target.value)} error={error} />
      <Input label="Beschreibung (optional)" value={description} onChange={e => setDescription(e.target.value)} />
      <div>
        <p className="text-xs text-slate-500 mb-2">Gruppenfarbe</p>
        <div className="flex gap-2 flex-wrap">
          {COLORS.map(c => (
            <button
              key={c}
              className={`w-8 h-8 rounded-full transition-transform ${color === c ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-ocean-950' : ''}`}
              style={{ backgroundColor: c }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
      </div>
      <Button onClick={handleSave} loading={saving} className="w-full">
        {group ? 'Speichern' : 'Gruppe erstellen'}
      </Button>
      {group && (
        <>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Mitglieder ({members.length})
            </p>
            <div className="space-y-2">
              {members.map(m => (
                <div key={m.user_id} className="flex items-center gap-3">
                  <Avatar name={m.name} color={m.avatar_color} size="sm" />
                  <span className="flex-1 text-sm text-white">{m.name}</span>
                  <button onClick={() => handleRemoveMember(m.user_id)} className="text-slate-500 hover:text-red-400 p-1 transition-colors">
                    <UserMinus size={16} />
                  </button>
                </div>
              ))}
            </div>
            {nonMembers.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-slate-500 mb-2">Hinzufügen</p>
                <div className="space-y-2">
                  {nonMembers.map(u => (
                    <div key={u.id} className="flex items-center gap-3">
                      <Avatar name={u.name} color={u.avatar_color} size="sm" />
                      <span className="flex-1 text-sm text-white">{u.name}</span>
                      <button onClick={() => handleAddMember(u.id)} className="text-slate-500 hover:text-teal-400 p-1 transition-colors">
                        <UserPlus size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <Button variant="danger" onClick={handleDelete} className="w-full">
            <Trash2 size={16} className="mr-2" /> Gruppe löschen
          </Button>
        </>
      )}
    </div>
  )
}
