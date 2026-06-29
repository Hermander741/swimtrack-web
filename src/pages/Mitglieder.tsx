import { useState, useEffect, useRef } from 'react'
import { FileText, Upload, Check, X, Trash2, UserPlus, UserMinus } from 'lucide-react'
import { PageShell } from '../components/layout/PageShell'
import { Card } from '../components/ui/Card'
import { Avatar } from '../components/ui/Avatar'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { useAuth } from '../hooks/useAuth'
import { listUsers, changeRole, deleteUser } from '../api/users'
import { apiRequest, getAccessToken } from '../api/client'
import {
  listMemberDocs, uploadMemberDoc, approveMemberDoc, deleteMemberDoc, memberDocFileUrl,
  addParentChild, removeParentChild, listMemberParents, listMemberChildren,
} from '../api/members'
import type { MemberDoc, DocCategory } from '../api/members'
import type { User, Role } from '../types'

const ROLES: Role[] = ['admin', 'trainer', 'eltern', 'mitglied']
const ROLE_LABELS: Record<Role, string> = { admin: 'Admin', trainer: 'Trainer', eltern: 'Eltern', mitglied: 'Mitglied' }
const CAT_LABELS: Record<DocCategory, string> = { anmeldung: 'Anmeldung', sportattest: 'Sportattest', meldezettel: 'Meldezettel', sonstiges: 'Sonstiges' }
const CATEGORIES: DocCategory[] = ['anmeldung', 'sportattest', 'meldezettel', 'sonstiges']
const STATUS_COLORS: Record<string, string> = { pending: 'text-yellow-400', approved: 'text-teal-400', rejected: 'text-red-400' }
const STATUS_LABELS: Record<string, string> = { pending: 'Ausstehend', approved: 'Freigegeben', rejected: 'Abgelehnt' }

type DetailTab = 'dokumente' | 'rolle' | 'eltern'

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
  const [detailTab, setDetailTab] = useState<DetailTab>('dokumente')

  // Documents
  const [docs, setDocs] = useState<MemberDoc[]>([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [uploadCategory, setUploadCategory] = useState<DocCategory>('sonstiges')
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Parent-child
  const [parents, setParents] = useState<{ id: string; name: string; email: string }[]>([])
  const [children, setChildren] = useState<{ id: string; name: string; email: string }[]>([])
  const [addingParent, setAddingParent] = useState(false)
  const [addingChild, setAddingChild] = useState(false)
  const [linkUserId, setLinkUserId] = useState('')

  useEffect(() => {
    listUsers().then(res => {
      if (res.ok) setUsers(res.data)
      setLoading(false)
    })
  }, [])

  async function openMember(u: User) {
    setSelectedUser(u)
    setDetailTab('dokumente')
    setDocsLoading(true)
    const [docsRes, parentsRes, childrenRes] = await Promise.all([
      listMemberDocs(u.id),
      listMemberParents(u.id),
      listMemberChildren(u.id),
    ])
    if (docsRes.ok) setDocs(docsRes.data)
    if (parentsRes.ok) setParents(parentsRes.data)
    if (childrenRes.ok) setChildren(childrenRes.data)
    setDocsLoading(false)
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !selectedUser) return
    setUploading(true)
    await uploadMemberDoc(selectedUser.id, file, uploadCategory)
    const res = await listMemberDocs(selectedUser.id)
    if (res.ok) setDocs(res.data)
    setUploading(false)
  }

  async function handleApprove(docId: string, action: 'approve' | 'reject') {
    if (!selectedUser) return
    await approveMemberDoc(selectedUser.id, docId, action)
    const res = await listMemberDocs(selectedUser.id)
    if (res.ok) setDocs(res.data)
  }

  async function handleDeleteDoc(docId: string) {
    if (!selectedUser) return
    await deleteMemberDoc(selectedUser.id, docId)
    setDocs(prev => prev.filter(d => d.id !== docId))
  }

  async function openDoc(doc: MemberDoc) {
    if (!selectedUser) return
    const token = getAccessToken()
    const r = await fetch(memberDocFileUrl(selectedUser.id, doc.id), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!r.ok) return
    const blob = await r.blob()
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  async function handleAddLink(type: 'parent' | 'child') {
    if (!selectedUser || !linkUserId) return
    const parentId = type === 'parent' ? linkUserId : selectedUser.id
    const childId = type === 'parent' ? selectedUser.id : linkUserId
    await addParentChild(parentId, childId)
    const [parentsRes, childrenRes] = await Promise.all([listMemberParents(selectedUser.id), listMemberChildren(selectedUser.id)])
    if (parentsRes.ok) setParents(parentsRes.data)
    if (childrenRes.ok) setChildren(childrenRes.data)
    setLinkUserId(''); setAddingParent(false); setAddingChild(false)
  }

  async function handleRemoveLink(type: 'parent' | 'child', otherId: string) {
    if (!selectedUser) return
    const parentId = type === 'parent' ? otherId : selectedUser.id
    const childId = type === 'parent' ? selectedUser.id : otherId
    await removeParentChild(parentId, childId)
    if (type === 'parent') setParents(prev => prev.filter(p => p.id !== otherId))
    else setChildren(prev => prev.filter(c => c.id !== otherId))
  }

  async function handleRoleChange(role: Role) {
    if (!selectedUser) return
    const res = await changeRole(selectedUser.id, role)
    if (res.ok) {
      setUsers(prev => prev.map(u => u.id === selectedUser.id ? { ...u, role } : u))
      setSelectedUser(prev => prev ? { ...prev, role } : null)
    }
  }

  async function handleDelete() {
    if (!selectedUser) return
    if (!window.confirm('Mitglied wirklich entfernen?')) return
    const res = await deleteUser(selectedUser.id)
    if (res.ok) { setUsers(prev => prev.filter(u => u.id !== selectedUser.id)); setSelectedUser(null) }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviteError(''); setInviteLoading(true)
    const res = await apiRequest('/api/invitations', { method: 'POST', body: JSON.stringify({ email: inviteEmail, role: inviteRole }) })
    setInviteLoading(false)
    if (res.ok) { setInviteSuccess(true); setInviteEmail(''); setTimeout(() => { setShowInvite(false); setInviteSuccess(false) }, 1500) }
    else setInviteError((res as { ok: false; error: string }).error)
  }

  const otherUsers = users.filter(u => u.id !== selectedUser?.id)

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
            <Card key={u.id} onClick={() => openMember(u)}>
              <div className="flex items-center gap-3">
                <Avatar name={u.name} color={u.avatar_color} imageUrl={u.avatar_url} />
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{u.name}</p>
                  <p className="text-slate-400 text-sm truncate">{u.email}</p>
                </div>
                <Badge role={u.role} />
              </div>
            </Card>
          ))}
          {users.length === 0 && <p className="text-slate-400 text-center py-8">Keine Mitglieder gefunden</p>}
        </div>
      )}

      {/* Member Detail Modal */}
      {selectedUser && (
        <Modal open={true} onClose={() => setSelectedUser(null)} title={selectedUser.name}>
          {/* Tabs */}
          <div className="flex gap-1 mb-4 -mx-1">
            {(['dokumente', 'rolle', 'eltern'] as DetailTab[]).map(tab => (
              <button key={tab} onClick={() => setDetailTab(tab)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize
                  ${detailTab === tab ? 'bg-teal-500/20 text-teal-400' : 'text-slate-400 hover:text-white'}`}>
                {tab === 'dokumente' ? 'Dokumente' : tab === 'rolle' ? 'Rolle' : 'Eltern/Kinder'}
              </button>
            ))}
          </div>

          {/* Documents Tab */}
          {detailTab === 'dokumente' && (
            <div className="space-y-3">
              {/* Upload */}
              {(isTrainer || isAdmin) && (
                <div className="flex gap-2">
                  <select value={uploadCategory} onChange={e => setUploadCategory(e.target.value as DocCategory)}
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500/50">
                    {CATEGORIES.map(c => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
                  </select>
                  <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={handleFileUpload} />
                  <button onClick={() => fileRef.current?.click()} disabled={uploading}
                    className="flex items-center gap-1.5 px-3 py-2 bg-teal-500/20 text-teal-400 rounded-xl text-sm font-medium disabled:opacity-50">
                    <Upload size={14} />{uploading ? 'Lade…' : 'PDF'}
                  </button>
                </div>
              )}

              {docsLoading ? (
                <div className="flex justify-center py-4"><div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>
              ) : docs.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-4">Keine Dokumente</p>
              ) : (
                <div className="space-y-2">
                  {docs.map(doc => (
                    <div key={doc.id} className="flex items-center gap-2 p-3 rounded-xl bg-white/5 border border-white/10">
                      <FileText size={16} className="text-teal-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <button onClick={() => openDoc(doc)} className="text-white text-sm font-medium truncate hover:text-teal-400 text-left w-full">
                          {doc.original_name}
                        </button>
                        <p className="text-slate-500 text-xs">{CAT_LABELS[doc.category]} · <span className={STATUS_COLORS[doc.status]}>{STATUS_LABELS[doc.status]}</span></p>
                      </div>
                      {(isTrainer || isAdmin) && doc.status === 'pending' && (
                        <div className="flex gap-1">
                          <button onClick={() => handleApprove(doc.id, 'approve')} className="p-1.5 rounded-lg bg-teal-500/20 text-teal-400 hover:bg-teal-500/30"><Check size={14} /></button>
                          <button onClick={() => handleApprove(doc.id, 'reject')} className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30"><X size={14} /></button>
                        </div>
                      )}
                      {(isTrainer || isAdmin) && (
                        <button onClick={() => handleDeleteDoc(doc.id)} className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Role Tab */}
          {detailTab === 'rolle' && (isTrainer || isAdmin) && (
            <div className="space-y-2">
              {ROLES.filter(r => isAdmin || r !== 'admin').map(r => (
                <button key={r} onClick={() => handleRoleChange(r)}
                  className={`w-full px-4 py-3 rounded-xl text-sm font-medium text-left border transition-all
                    ${selectedUser.role === r ? 'bg-teal-500/20 text-teal-400 border-teal-500/50' : 'glass text-white border-white/5'}`}>
                  {ROLE_LABELS[r]}
                </button>
              ))}
              {selectedUser.id !== currentUser?.id && (
                <Button variant="danger" className="w-full mt-2" onClick={handleDelete}>Mitglied entfernen</Button>
              )}
            </div>
          )}

          {/* Parents/Children Tab */}
          {detailTab === 'eltern' && (isTrainer || isAdmin) && (
            <div className="space-y-4">
              {/* Parents */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Eltern</p>
                  <button onClick={() => { setAddingParent(true); setAddingChild(false); setLinkUserId('') }}
                    className="text-teal-400 hover:text-teal-300"><UserPlus size={15} /></button>
                </div>
                {addingParent && (
                  <div className="flex gap-2 mb-2">
                    <select value={linkUserId} onChange={e => setLinkUserId(e.target.value)}
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500/50">
                      <option value="">Elternteil wählen…</option>
                      {otherUsers.filter(u => u.role === 'eltern' || u.role === 'admin').map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                    <button onClick={() => handleAddLink('parent')} disabled={!linkUserId} className="px-3 py-2 bg-teal-500/20 text-teal-400 rounded-xl text-sm disabled:opacity-50">OK</button>
                  </div>
                )}
                {parents.length === 0 ? <p className="text-slate-500 text-sm">Keine Eltern verknüpft</p> : (
                  <div className="space-y-1">
                    {parents.map(p => (
                      <div key={p.id} className="flex items-center justify-between py-1.5">
                        <span className="text-white text-sm">{p.name}</span>
                        <button onClick={() => handleRemoveLink('parent', p.id)} className="text-slate-500 hover:text-red-400"><UserMinus size={14} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Children */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Kinder</p>
                  <button onClick={() => { setAddingChild(true); setAddingParent(false); setLinkUserId('') }}
                    className="text-teal-400 hover:text-teal-300"><UserPlus size={15} /></button>
                </div>
                {addingChild && (
                  <div className="flex gap-2 mb-2">
                    <select value={linkUserId} onChange={e => setLinkUserId(e.target.value)}
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500/50">
                      <option value="">Kind wählen…</option>
                      {otherUsers.filter(u => u.role === 'mitglied').map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                    <button onClick={() => handleAddLink('child')} disabled={!linkUserId} className="px-3 py-2 bg-teal-500/20 text-teal-400 rounded-xl text-sm disabled:opacity-50">OK</button>
                  </div>
                )}
                {children.length === 0 ? <p className="text-slate-500 text-sm">Keine Kinder verknüpft</p> : (
                  <div className="space-y-1">
                    {children.map(c => (
                      <div key={c.id} className="flex items-center justify-between py-1.5">
                        <span className="text-white text-sm">{c.name}</span>
                        <button onClick={() => handleRemoveLink('child', c.id)} className="text-slate-500 hover:text-red-400"><UserMinus size={14} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* Invite Modal */}
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
                  <button key={r} type="button" onClick={() => setInviteRole(r)}
                    className={`px-3 py-2 rounded-xl text-sm font-medium transition-all border
                      ${inviteRole === r ? 'bg-teal-500/20 text-teal-400 border-teal-500/50' : 'glass text-slate-400 border-white/5'}`}>
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
    </PageShell>
  )
}
