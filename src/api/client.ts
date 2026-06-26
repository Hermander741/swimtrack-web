const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

let accessToken: string | null = null

export function setAccessToken(t: string | null) { accessToken = t }
export function getAccessToken() { return accessToken }

async function tryRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/api/auth/refresh`, { method: 'POST', credentials: 'include' })
    if (!res.ok) return false
    const body = await res.json()
    accessToken = body.data.accessToken
    return true
  } catch {
    return false
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> ?? {}),
  }
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`

  let res = await fetch(`${BASE}${path}`, { ...options, headers, credentials: 'include' })

  if (res.status === 401 && accessToken) {
    const refreshed = await tryRefresh()
    if (refreshed) {
      headers['Authorization'] = `Bearer ${accessToken}`
      res = await fetch(`${BASE}${path}`, { ...options, headers, credentials: 'include' })
    }
  }

  const json = await res.json()
  return json
}
