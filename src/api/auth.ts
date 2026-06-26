import { apiRequest, setAccessToken, BASE } from './client'
import type { User } from '../types'

export async function login(email: string, password: string) {
  const result = await apiRequest<{ accessToken: string; user: User }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  if (result.ok) setAccessToken(result.data.accessToken)
  return result
}

export async function logout() {
  await apiRequest('/api/auth/logout', { method: 'POST' })
  setAccessToken(null)
}

export async function me() {
  return apiRequest<User>('/api/auth/me')
}

export async function refreshToken() {
  const res = await fetch(`${BASE}/api/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  })
  if (!res.ok) return null
  const body = await res.json()
  setAccessToken(body.data.accessToken)
  return body.data.accessToken as string
}
