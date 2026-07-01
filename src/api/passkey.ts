import { startRegistration, startAuthentication } from '@simplewebauthn/browser'
import { apiRequest, setAccessToken } from './client'
import type { User } from '../types'

export async function registerPasskey(): Promise<{ ok: boolean; error?: string }> {
  try {
    const beginRes = await apiRequest<Record<string, unknown>>('/api/passkey/register/begin', { method: 'POST' })
    if (!beginRes.ok) return { ok: false, error: beginRes.error }

    const attResp = await startRegistration({ optionsJSON: beginRes.data as never })

    const completeRes = await apiRequest('/api/passkey/register/complete', {
      method: 'POST',
      body: JSON.stringify(attResp),
    })
    if (!completeRes.ok) return { ok: false, error: completeRes.error }
    return { ok: true }
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'NotAllowedError') return { ok: false, error: 'Abgebrochen' }
    return { ok: false, error: 'Passkey konnte nicht erstellt werden' }
  }
}

export async function loginWithPasskey(): Promise<{ ok: boolean; user?: User; accessToken?: string; error?: string }> {
  try {
    const beginRes = await apiRequest<Record<string, unknown>>('/api/passkey/login/begin', { method: 'POST' })
    if (!beginRes.ok) return { ok: false, error: beginRes.error }

    const assertResp = await startAuthentication({ optionsJSON: beginRes.data as never })

    const completeRes = await apiRequest<{ accessToken: string; user: User }>('/api/passkey/login/complete', {
      method: 'POST',
      body: JSON.stringify(assertResp),
    })
    if (!completeRes.ok) return { ok: false, error: completeRes.error }
    setAccessToken(completeRes.data.accessToken)
    return { ok: true, user: completeRes.data.user, accessToken: completeRes.data.accessToken }
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'NotAllowedError') return { ok: false, error: 'Abgebrochen' }
    return { ok: false, error: 'Passkey-Anmeldung fehlgeschlagen' }
  }
}

export async function listPasskeys() {
  return apiRequest<{ id: string; device_type: string; backed_up: boolean; created_at: string }[]>('/api/passkey')
}

export async function deletePasskey(id: string) {
  return apiRequest(`/api/passkey/${id}`, { method: 'DELETE' })
}
