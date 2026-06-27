import { apiRequest, BASE } from './client'
import type {
  TrainingGroup, TrainingGroupMember, TrainingBlock,
  TrainingTemplate, TrainingSession, ICalToken,
} from '../types'

export const listGroups = () => apiRequest<TrainingGroup[]>('/api/training/groups')

export const createGroup = (data: { name: string; description?: string; color?: string; channel_id?: string }) =>
  apiRequest<TrainingGroup>('/api/training/groups', { method: 'POST', body: JSON.stringify(data) })

export const updateGroup = (id: string, data: { name?: string; description?: string; color?: string; channel_id?: string | null }) =>
  apiRequest<TrainingGroup>(`/api/training/groups/${id}`, { method: 'PATCH', body: JSON.stringify(data) })

export const deleteGroup = (id: string) =>
  apiRequest<null>(`/api/training/groups/${id}`, { method: 'DELETE' })

export const listGroupMembers = (id: string) =>
  apiRequest<TrainingGroupMember[]>(`/api/training/groups/${id}/members`)

export const addGroupMember = (id: string, userId: string) =>
  apiRequest<null>(`/api/training/groups/${id}/members`, { method: 'POST', body: JSON.stringify({ userId }) })

export const removeGroupMember = (id: string, userId: string) =>
  apiRequest<null>(`/api/training/groups/${id}/members/${userId}`, { method: 'DELETE' })

export const listBlocks = () => apiRequest<TrainingBlock[]>('/api/training/blocks')

export const createBlock = (data: Omit<TrainingBlock, 'id' | 'created_by' | 'created_at'>) =>
  apiRequest<TrainingBlock>('/api/training/blocks', { method: 'POST', body: JSON.stringify(data) })

export const updateBlock = (id: string, data: Partial<Omit<TrainingBlock, 'id' | 'created_by' | 'created_at'>>) =>
  apiRequest<TrainingBlock>(`/api/training/blocks/${id}`, { method: 'PATCH', body: JSON.stringify(data) })

export const deleteBlock = (id: string) =>
  apiRequest<null>(`/api/training/blocks/${id}`, { method: 'DELETE' })

export const listTemplates = () => apiRequest<TrainingTemplate[]>('/api/training/templates')

export const createTemplate = (data: {
  group_id: string; day_of_week: number; start_time: string
  duration_min?: number; location?: string; title: string
  block_ids?: Array<{ block_id: string; override_note?: string }>
}) => apiRequest<TrainingTemplate>('/api/training/templates', { method: 'POST', body: JSON.stringify(data) })

export const updateTemplate = (id: string, data: {
  day_of_week?: number; start_time?: string; duration_min?: number
  location?: string | null; title?: string; is_active?: boolean
  block_ids?: Array<{ block_id: string; override_note?: string }>
}) => apiRequest<TrainingTemplate>(`/api/training/templates/${id}`, { method: 'PATCH', body: JSON.stringify(data) })

export const deleteTemplate = (id: string) =>
  apiRequest<null>(`/api/training/templates/${id}`, { method: 'DELETE' })

export const generateSessions = (id: string, from: string, to: string) =>
  apiRequest<{ created: number }>(`/api/training/templates/${id}/generate`, {
    method: 'POST', body: JSON.stringify({ from, to }),
  })

export const listSessions = (from: string, to: string) =>
  apiRequest<TrainingSession[]>(`/api/training/sessions?from=${from}&to=${to}`)

export const createSession = (data: {
  group_id?: string; title: string; date: string; start_time: string
  duration_min?: number; location?: string; notes?: string; is_external?: boolean
  blocks?: Array<{ block_id?: string; name: string; category: string; distance_m?: number; stroke?: string; reps?: number; rest_s?: number; description?: string; override_note?: string }>
}) => apiRequest<TrainingSession>('/api/training/sessions', { method: 'POST', body: JSON.stringify(data) })

export const updateSession = (id: string, data: {
  title?: string; date?: string; start_time?: string; duration_min?: number
  location?: string | null; notes?: string | null; is_cancelled?: boolean
}) => apiRequest<TrainingSession>(`/api/training/sessions/${id}`, { method: 'PATCH', body: JSON.stringify(data) })

export const deleteSession = (id: string) =>
  apiRequest<null>(`/api/training/sessions/${id}`, { method: 'DELETE' })

export const getICalToken = () => apiRequest<ICalToken>('/api/training/ical-token')

export const regenerateICalToken = () =>
  apiRequest<ICalToken>('/api/training/ical-token/regenerate', { method: 'POST' })

export const icalUrl = (token: string) => `${BASE}/api/training/sessions/ical?token=${token}`
