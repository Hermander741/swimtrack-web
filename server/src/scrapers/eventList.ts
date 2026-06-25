import * as cheerio from 'cheerio'
import { httpClient } from '../httpClient'
import { cache } from '../cache'
import type { MeetEvent } from '../types'

const TTL_MS = 10 * 60 * 1000

export function parseEventList($: cheerio.CheerioAPI): MeetEvent[] {
  const events: MeetEvent[] = []
  $('select#selectevent optgroup').each((_, group) => {
    const rawLabel = $(group).attr('label') ?? ''
    const session = rawLabel.replace(/<br>/gi, ' - ').replace(/&lt;br&gt;/gi, ' - ').trim()
    $(group).find('option').each((_, opt) => {
      const val = $(opt).attr('value') ?? ''
      const text = $(opt).text().trim()
      const match = text.match(/^(\d+)\s*-\s*(.+)$/)
      if (!match || !val) return
      events.push({ id: val, number: parseInt(match[1], 10), name: match[2].trim(), session })
    })
  })
  return events
}

export async function scrapeEventList(meetId: string, urlStatus: string): Promise<MeetEvent[]> {
  const key = `events:${meetId}`
  const cached = cache.get<MeetEvent[]>(key)
  if (cached) return cached

  const { data: html } = await httpClient.get<string>(`/de-AT/Meets/${urlStatus}/${meetId}/Results`)
  const $ = cheerio.load(html)
  const events = parseEventList($)
  cache.set(key, events, TTL_MS)
  return events
}
