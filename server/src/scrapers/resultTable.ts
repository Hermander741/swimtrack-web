import * as cheerio from 'cheerio'
import { httpClient } from '../httpClient'
import { cache } from '../cache'
import type { SwimResult } from '../types'

const TTL_MS = 2 * 60 * 1000

export function parseTimeMs(s: string): number {
  const clean = s.trim()
  if (!clean || ['DNS', 'DSQ', 'DNF', 'DQ', '---'].some(x => clean.toUpperCase().includes(x))) return 0
  const parts = clean.split(':')
  if (parts.length === 2) {
    return Math.round((parseInt(parts[0], 10) * 60 + parseFloat(parts[1])) * 1000)
  }
  return Math.round(parseFloat(clean) * 1000)
}

export function parseResultTable($: cheerio.CheerioAPI): SwimResult[] {
  const results: SwimResult[] = []
  $('#starts_content .myresults_content_divtablerow').each((_, el) => {
    const row = $(el)
    if (row.hasClass('myresults_content_divtablerow_header')) return

    const placeEl = row.find('.msecm-place').first()
    if (!placeEl.length) return
    const rank = parseInt(placeEl.text().replace('.', '').trim(), 10)
    if (isNaN(rank)) return

    const participantLink = row.find('a[href*="/Participant/"]').first()
    const href = participantLink.attr('href') ?? ''
    const pidMatch = href.match(/\/Participant\/(\d+)/)
    if (!pidMatch) return

    const name = participantLink.clone().children('i').remove().end().text().trim()
    const details = row.find('.myresults_content_divtable_details').first().text().trim()
    const birthYear = parseInt(details.split(' ')[0], 10) || 0

    const clubLink = row.find('a[href*="/Club/"]').first()
    const club = clubLink.clone().children('i').remove().end().text().trim()

    const timeEl = row.find('.myresults_content_divtable_right').filter((_, e) => {
      return $(e).hasClass('hidden-xs')
    }).last()
    const timeMs = parseTimeMs(timeEl.text().trim())

    results.push({ rank, name, birthYear, club, timeMs, participantId: pidMatch[1] })
  })
  return results
}

export async function scrapeResultTable(
  meetId: string, eventId: string, urlStatus: string,
): Promise<SwimResult[]> {
  const key = `results:${meetId}:${eventId}`
  const cached = cache.get<SwimResult[]>(key)
  if (cached) return cached

  const { data: html } = await httpClient.post<string>(
    `/de-AT/Meets/${urlStatus}/${meetId}/Results/${eventId}`,
    null,
    { headers: { Referer: `https://myresults.eu/de-AT/Meets/${urlStatus}/${meetId}/Results` } },
  )
  const $ = cheerio.load(html)
  const results = parseResultTable($)
  cache.set(key, results, TTL_MS)
  return results
}
