import { apiRequest } from './client'
import type { SwimTimeEntry, ZeitenListResponse } from '../types'

export const listEvents = () =>
  apiRequest<string[]>('/api/zeiten/events')

export const listBestzeiten = () =>
  apiRequest<SwimTimeEntry[]>('/api/zeiten/bestzeiten')

export const listZeiten = (params: {
  user_id?: string; event?: string; course?: string; limit?: number; offset?: number
}) => {
  const q = new URLSearchParams()
  if (params.user_id) q.set('user_id', params.user_id)
  if (params.event)   q.set('event',   params.event)
  if (params.course)  q.set('course',  params.course)
  q.set('limit',  String(params.limit  ?? 100))
  q.set('offset', String(params.offset ?? 0))
  return apiRequest<ZeitenListResponse>(`/api/zeiten?${q}`)
}

export const createZeit = (data: {
  user_id?: string; event: string; course: 'LB' | 'KB' | 'OW'
  time_ms: number; date: string; competition?: string
}) => apiRequest<SwimTimeEntry>('/api/zeiten', { method: 'POST', body: JSON.stringify(data) })

export const updateZeit = (id: string, data: {
  event?: string; course?: 'LB' | 'KB' | 'OW'; time_ms?: number
  date?: string; competition?: string | null
}) => apiRequest<SwimTimeEntry>(`/api/zeiten/${id}`, { method: 'PATCH', body: JSON.stringify(data) })

export const deleteZeit = (id: string) =>
  apiRequest<null>(`/api/zeiten/${id}`, { method: 'DELETE' })

export const syncMyresults = () =>
  apiRequest<{ imported: number; total_found: number; meets_searched: number }>(
    '/api/zeiten/myresults-sync', { method: 'POST' },
  )

export const fetchExternalBestzeiten = (myresults_name: string) =>
  apiRequest<{ event: string; course: string; time_ms: number }[]>(
    '/api/zeiten/external-bestzeiten', { method: 'POST', body: JSON.stringify({ myresults_name }) },
  )
