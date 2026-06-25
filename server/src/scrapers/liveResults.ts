import { httpClient } from '../httpClient'
import { cache } from '../cache'
import { parseTimeMs } from './resultTable'
import type { LiveResult, SwimResult } from '../types'

const TTL_MS = 10 * 1000

interface RawLiveResult {
  status: number
  title1?: string | null
  statustext?: string | null
  results?: Array<{
    rank: string
    name: string
    year: string
    club: string
    time: string
    participantid: string
  }>
}

export function parseLiveResponse(raw: RawLiveResult): LiveResult {
  if (raw.status !== 0 || !raw.results) return { status: raw.status }
  const results: SwimResult[] = raw.results.map(r => ({
    rank: parseInt(r.rank, 10) || 0,
    name: r.name,
    birthYear: parseInt(r.year, 10) || 0,
    club: r.club,
    timeMs: parseTimeMs(r.time),
    participantId: r.participantid,
  }))
  return { status: raw.status, event: raw.title1 ?? undefined, results }
}

export async function scrapeLiveResults(meetId: string, urlStatus: string): Promise<LiveResult> {
  const key = `live:${meetId}`
  const cached = cache.get<LiveResult>(key)
  if (cached) return cached

  const path = `de-AT/Meets/${urlStatus}/${meetId}`
  const { data } = await httpClient.post<RawLiveResult>(
    '/ajax_liveresults.php',
    new URLSearchParams({ pathbase: '', path, language: 'de-AT', meet: meetId }).toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
  )
  const result = parseLiveResponse(data)
  cache.set(key, result, TTL_MS)
  return result
}
