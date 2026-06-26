import { BASE, apiRequest } from './client'
import type { Document } from '../types'

export const listDocuments = (category?: string) =>
  apiRequest<Document[]>(`/api/documents${category ? `?category=${category}` : ''}`)

export async function uploadDocument(name: string, category: string, file: File) {
  const form = new FormData()
  form.append('name', name)
  form.append('category', category)
  form.append('file', file)
  return apiRequest<Document>('/api/documents', { method: 'POST', body: form })
}

export function documentFileUrl(id: string) {
  return `${BASE}/api/documents/${id}/file`
}

export const deleteDocument = (id: string) =>
  apiRequest(`/api/documents/${id}`, { method: 'DELETE' })
