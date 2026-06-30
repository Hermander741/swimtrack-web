import { apiRequest, BASE } from './client'
import { getAccessToken } from './client'

export type DocCategory = 'anmeldung' | 'sportattest' | 'meldezettel' | 'sonstiges'
export type DocStatus = 'pending' | 'approved' | 'rejected'

export interface MemberDoc {
  id: string
  user_id: string
  filename: string
  original_name: string
  category: DocCategory
  status: DocStatus
  uploaded_by: string | null
  uploader_name: string | null
  approved_by: string | null
  approver_name: string | null
  approved_at: string | null
  valid_until: string | null
  created_at: string
}

export interface ValidityRule {
  category: DocCategory
  validity_days: number
  reminder_days: number[]
}

export interface ParentChildLink {
  parent_id: string
  child_id: string
  parent_name: string
  child_name: string
}

export interface ChildUser {
  id: string
  name: string
  avatar_color: string | null
  avatar_url: string | null
}

export const listMemberDocs = (userId: string) =>
  apiRequest<MemberDoc[]>(`/api/members/${userId}/documents`)

export const uploadMemberDoc = async (userId: string, file: File, category: DocCategory) => {
  const token = getAccessToken()
  const form = new FormData()
  form.append('file', file)
  form.append('category', category)
  const res = await fetch(`${BASE}/api/members/${userId}/documents`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
    credentials: 'include',
  })
  return res.json()
}

export const approveMemberDoc = (userId: string, docId: string, action: 'approve' | 'reject') =>
  apiRequest<{ id: string; status: DocStatus }>(`/api/members/${userId}/documents/${docId}/approve`, {
    method: 'PATCH', body: JSON.stringify({ action }),
  })

export const deleteMemberDoc = (userId: string, docId: string) =>
  apiRequest<null>(`/api/members/${userId}/documents/${docId}`, { method: 'DELETE' })

export const memberDocFileUrl = (userId: string, docId: string) =>
  `${BASE}/api/members/${userId}/documents/${docId}/file`

export const listParentChild = () =>
  apiRequest<ParentChildLink[]>('/api/members/parent-child')

export const addParentChild = (parentId: string, childId: string) =>
  apiRequest<null>('/api/members/parent-child', { method: 'POST', body: JSON.stringify({ parentId, childId }) })

export const removeParentChild = (parentId: string, childId: string) =>
  apiRequest<null>('/api/members/parent-child', { method: 'DELETE', body: JSON.stringify({ parentId, childId }) })

export const listMyChildren = () =>
  apiRequest<ChildUser[]>('/api/members/my-children')

export const listValidityRules = () =>
  apiRequest<ValidityRule[]>('/api/members/validity-rules')

export const upsertValidityRule = (category: DocCategory, validity_days: number, reminder_days: number[]) =>
  apiRequest<ValidityRule>(`/api/members/validity-rules/${category}`, {
    method: 'PATCH', body: JSON.stringify({ validity_days, reminder_days }),
  })

export const deleteValidityRule = (category: DocCategory) =>
  apiRequest<null>(`/api/members/validity-rules/${category}`, { method: 'DELETE' })

export const listMemberParents = (userId: string) =>
  apiRequest<{ id: string; name: string; email: string }[]>(`/api/members/${userId}/parents`)

export const listMemberChildren = (userId: string) =>
  apiRequest<{ id: string; name: string; email: string }[]>(`/api/members/${userId}/children`)
