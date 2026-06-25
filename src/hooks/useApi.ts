const STORAGE_KEY = 'swimtrack_api_url'

export function useApi() {
  function baseUrl(): string {
    return localStorage.getItem(STORAGE_KEY)
      ?? import.meta.env.VITE_API_URL
      ?? ''
  }

  const isConfigured = !!baseUrl()

  async function get<T>(path: string): Promise<T> {
    const url = `${baseUrl()}${path}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = (await res.json()) as { ok: boolean; data?: T; error?: string }
    if (!json.ok) throw new Error(json.error ?? 'API error')
    return json.data as T
  }

  function saveUrl(url: string) {
    const trimmed = url.trim().replace(/\/$/, '')
    localStorage.setItem(STORAGE_KEY, trimmed)
  }

  return { get, baseUrl, isConfigured, saveUrl }
}
