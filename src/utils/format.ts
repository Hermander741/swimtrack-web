export function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const centiseconds = Math.floor((ms % 1000) / 10)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes > 0) {
    return `${minutes}:${String(seconds).padStart(2, '0')},${String(centiseconds).padStart(2, '0')}`
  }
  return `${seconds},${String(centiseconds).padStart(2, '0')}`
}

export function parseTimeInput(input: string): number | null {
  // Accepts: "1:03,42" or "63,42" or "63.42"
  const normalized = input.replace('.', ',').trim()
  const match = normalized.match(/^(?:(\d+):)?(\d{1,2}),(\d{2})$/)
  if (!match) return null
  const [, min, sec, cs] = match
  const minutes = min ? parseInt(min) : 0
  const seconds = parseInt(sec)
  const centiseconds = parseInt(cs)
  return (minutes * 60 + seconds) * 1000 + centiseconds * 10
}

export function formatDate(iso: string, opts?: Intl.DateTimeFormatOptions): string {
  return new Date(iso).toLocaleDateString('de-AT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...opts,
  })
}

export function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('de-AT', { day: '2-digit', month: 'short' })
}

export function daysUntil(iso: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(iso)
  target.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / 86400000)
}

export function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export const AVATAR_COLORS = [
  '#0ea5e9', '#6366f1', '#ec4899', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6',
]

export const SWIM_EVENTS = [
  '50m Freistil', '100m Freistil', '200m Freistil', '400m Freistil', '800m Freistil', '1500m Freistil',
  '50m Rücken', '100m Rücken', '200m Rücken',
  '50m Brust', '100m Brust', '200m Brust',
  '50m Schmetterling', '100m Schmetterling', '200m Schmetterling',
  '100m Lagen', '200m Lagen', '400m Lagen',
]
