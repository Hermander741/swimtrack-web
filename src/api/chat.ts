import { apiRequest, getAccessToken, BASE } from './client'
import type { Channel, Message, PinnedMessage } from '../types'

export function listChannels() {
  return apiRequest<Channel[]>('/api/chat/channels')
}

export function createChannel(data: { name: string; description?: string; min_role?: string }) {
  return apiRequest<Channel>('/api/chat/channels', { method: 'POST', body: JSON.stringify(data) })
}

export function updateChannel(id: string, data: { name?: string; description?: string; min_role?: string }) {
  return apiRequest<Channel>(`/api/chat/channels/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
}

export function deleteChannel(id: string) {
  return apiRequest<null>(`/api/chat/channels/${id}`, { method: 'DELETE' })
}

export function uploadChannelAvatar(channelId: string, file: File) {
  const form = new FormData()
  form.append('avatar', file)
  return apiRequest<Channel>(`/api/chat/channels/${channelId}/avatar`, { method: 'POST', body: form })
}

export function addMember(channelId: string, userId: string) {
  return apiRequest<null>(`/api/chat/channels/${channelId}/members`, {
    method: 'POST', body: JSON.stringify({ userId }),
  })
}

export function removeMember(channelId: string, userId: string) {
  return apiRequest<null>(`/api/chat/channels/${channelId}/members/${userId}`, { method: 'DELETE' })
}

export function listMessages(channelId: string, before?: string, limit = 50) {
  const params = new URLSearchParams({ limit: String(limit) })
  if (before) params.set('before', before)
  return apiRequest<Message[]>(`/api/chat/channels/${channelId}/messages?${params}`)
}

export function listPins(channelId: string) {
  return apiRequest<PinnedMessage[]>(`/api/chat/channels/${channelId}/pins`)
}

export function pinMessage(channelId: string, messageId: string) {
  return apiRequest<PinnedMessage>(`/api/chat/channels/${channelId}/pins`, {
    method: 'POST', body: JSON.stringify({ messageId }),
  })
}

export function unpinMessage(channelId: string, pinId: string) {
  return apiRequest<null>(`/api/chat/channels/${channelId}/pins/${pinId}`, { method: 'DELETE' })
}

export async function uploadAttachment(
  channelId: string,
  file: File,
): Promise<{ ok: true; data: { attachmentId: string } } | { ok: false; error: string }> {
  const form = new FormData()
  form.append('file', file)
  const token = getAccessToken()
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  try {
    const res = await fetch(`${BASE}/api/chat/channels/${channelId}/attachments`, {
      method: 'POST', headers, body: form, credentials: 'include',
    })
    return await res.json()
  } catch {
    return { ok: false, error: 'Upload fehlgeschlagen' }
  }
}

export async function downloadAttachment(attachmentId: string): Promise<string> {
  const token = getAccessToken()
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${BASE}/api/chat/attachments/${attachmentId}/file`, {
    headers, credentials: 'include',
  })
  const blob = await res.blob()
  return URL.createObjectURL(blob)
}

export function attachmentFileUrl(attachmentId: string) {
  return `${BASE}/api/chat/attachments/${attachmentId}/file`
}
