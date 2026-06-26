import { apiRequest } from './client'
import type { User, Role } from '../types'

export const listUsers = () => apiRequest<User[]>('/api/users')

export const updateMe = (data: { name?: string; password?: string; avatar_color?: string }) =>
  apiRequest<User>('/api/users/me', { method: 'PATCH', body: JSON.stringify(data) })

export const changeRole = (id: string, role: Role) =>
  apiRequest<User>(`/api/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) })

export const deleteUser = (id: string) =>
  apiRequest(`/api/users/${id}`, { method: 'DELETE' })
