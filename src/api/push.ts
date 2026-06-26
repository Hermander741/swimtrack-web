import { BASE, getAccessToken } from './client'

export async function getVapidPublicKey(): Promise<string> {
  try {
    const res = await fetch(`${BASE}/api/push/vapid-public-key`)
    const body = await res.json() as { ok: boolean; data: string }
    return body.data ?? ''
  } catch {
    return ''
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
}

export async function subscribePush(): Promise<void> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
  const key = await getVapidPublicKey()
  if (!key) return
  const reg = await navigator.serviceWorker.ready
  const existing = await reg.pushManager.getSubscription()
  if (existing) return
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: key,
  })
  const p256dh = arrayBufferToBase64(sub.getKey('p256dh')!)
  const auth = arrayBufferToBase64(sub.getKey('auth')!)
  const token = getAccessToken()
  await fetch(`${BASE}/api/push/subscribe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: 'include',
    body: JSON.stringify({ endpoint: sub.endpoint, keys: { p256dh, auth } }),
  })
}

export async function unsubscribePush(): Promise<void> {
  if (!('serviceWorker' in navigator)) return
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return
  const token = getAccessToken()
  await fetch(`${BASE}/api/push/subscribe`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: 'include',
    body: JSON.stringify({ endpoint: sub.endpoint }),
  })
  await sub.unsubscribe()
}
