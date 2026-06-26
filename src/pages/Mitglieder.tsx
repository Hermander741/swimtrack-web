import { useState, useEffect } from 'react'
import { PageShell } from '../components/layout/PageShell'
import { Card } from '../components/ui/Card'
import { Avatar } from '../components/ui/Avatar'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { useAuth } from '../hooks/useAuth'
import { listUsers, changeRole, deleteUser } from '../api/users'
import { apiRequest } from '../api/client'
import type { User, Role } from '../types'

const ROLES: Role[] = ['admin', 'trainer', 'eltern', 'mitglied']
const ROLE_LABELS: Record<Role, string> = { admin: 'Admin', trainer: 'Trainer', eltern: 'Eltern', mitglied: 'Mitglied' }

export function Mitglieder() {
  const { isTrainer, isAdmin, user: currentUser } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<Role>('mitglied')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)

  useEffect(() => {
    listUsers().then(res => {
      if (res.ok) setUsers(res.data)
      setLoading(false)
    })
  }, [])

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviteError('')
    setInviteLoading(true)
    const res = await apiRequest('/api/invitations', {
      method: 'POST',
      body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
    })
    setInviteLoading(false)
    if (res.ok) {
      setInviteSuccess(true)
      setInviteEmail('')
      setTimeout(() => { setShowInvite(false); setInviteSuccess(false) }, 1500)
    } else {
      setInviteError((res as { ok: false; error: string }).error)
    }
  }

  async function handleRoleChange(userId: string, role: Role) {
    const res = await changeRole(userId, role)
    if (res.ok) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u))
      setSelectedUser(null)
    }
  }

  async function handleDelete(userId: string) {
    if (!window.confirm('Mitglied wirklich entfernen?')) return
    const res = await deleteUser(userId)
    if (res.ok) {
      setUsers(prev => prev.filter(u => u.id !== userId))
      setSelectedUser(null)
    }
  }

  return (
    <PageShell
      title="Mitglieder"
      fab={isTrainer ? (
        <button
          onClick={() => setShowInvite(true)}
          className="w-14 h-14 bg-gradient-to-r from-teal-500 to-sky-500 rounded-full flex items-center justify-center text-2xl text-white shadow-lg shadow-teal-500/30 active:scale-95 transition-transform"
        >
          +
        </button>
      ) : undefined}
    >
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {users.map(u => (
            <Card key={u.id} onClick={isAdmin ? () => setSelectedUser(u) : undefined}>
              <div className="flex items-center gap-3">
                <Avatar name={u.name} color={u.avatar_color} />
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{u.name}</p>
                  <p className="text-slate-400 text-sm truncate">{u.email}</p>
                </div>
                <Badge role={u.role} />
              </div>
            </Card>
          ))}
          {users.length === 0 && (
            <p className="text-slate-400 text-center py-8">Keine Mitglieder gefunden</p>
          )}
        </div>
      )}

      <Modal open={showInvite} onClose={() => setShowInvite(false)} title="Mitglied einladen">
        {inviteSuccess ? (
          <p className="text-center text-teal-400 py-4">✓ Einladung gesendet!</p>
        ) : (
          <form onSubmit={handleInvite} className="space-y-4">
            <Input label="E-Mail" type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} required />
            <div>
              <label className="block text-xs text-slate-400 mb-2">Rolle</label>
              <div className="grid grid-cols-2 gap-2">
                {ROLES.filter(r => !(!isAdmin && r === 'admin')).map(r => (
                  <button
                    key={r} type="button"
                    onClick={() => setInviteRole(r)}
                    className={`px-3 py-2 rounded-xl text-sm font-medium transition-all border
                      ${inviteRole === r ? 'bg-teal-500/20 text-teal-400 border-teal-500/50' : 'glass text-slate-400 border-white/5'}`}
                  >
                    {ROLE_LABELS[r]}
                  </button>
                ))}
              </div>
            </div>
            {inviteError && <p className="text-sm text-red-400">{inviteError}</p>}
            <Button type="submit" loading={inviteLoading} className="w-full">Einladung senden</Button>
          </form>
        )}
      </Modal>

      {selectedUser && isAdmin && (
        <Modal open={true} onClose={() => setSelectedUser(null)} title={selectedUser.name}>
          <div className="space-y-3">
            <p className="text-slate-400 text-sm mb-4">Rolle ändern:</p>
            {ROLES.map(r => (
              <button
                key={r}
                onClick={() => handleRoleChange(selectedUser.id, r)}
                className={`w-full px-4 py-3 rounded-xl text-sm font-medium transition-all text-left border
                  ${selectedUser.role === r ? 'bg-teal-500/20 text-teal-400 border-teal-500/50' : 'glass text-white border-white/5'}`}
              >
                {ROLE_LABELS[r]}
              </button>
            ))}
            {selectedUser.id !== currentUser?.id && (
              <Button
                variant="danger"
                className="w-full mt-4"
                onClick={() => handleDelete(selectedUser.id)}
              >
                Mitglied entfernen
              </Button>
            )}
          </div>
        </Modal>
      )}
    </PageShell>
  )
}
