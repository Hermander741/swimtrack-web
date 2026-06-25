import * as cheerio from 'cheerio'
import { httpClient } from '../httpClient'
import { cache } from '../cache'
import type { MeetSummary } from '../types'

const TTL_MS = 5 * 60 * 1000

export function parseDateRange(s: string): { startDate: string; endDate: string } {
  const clean = s.trim()
  // Cross-month: "30.06.-01.07.2026"
  const crossMonth = clean.match(/^(\d{2})\.(\d{2})\.-(\d{2})\.(\d{2})\.(\d{4})$/)
  if (crossMonth) {
    const [, d1, m1, d2, m2, yyyy] = crossMonth
    return { startDate: `${yyyy}-${m1}-${d1}`, endDate: `${yyyy}-${m2}-${d2}` }
  }
  // Same-month multi-day: "27.-28.06.2026"
  const sameMonth = clean.match(/^(\d{1,2})\.-(\d{2})\.(\d{2})\.(\d{4})$/)
  if (sameMonth) {
    const [, d1, d2, mm, yyyy] = sameMonth
    return {
      startDate: `${yyyy}-${mm}-${d1.padStart(2, '0')}`,
      endDate: `${yyyy}-${mm}-${d2}`,
    }
  }
  // Single day: "28.06.2026"
  const single = clean.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
  if (single) {
    const [, dd, mm, yyyy] = single
    return { startDate: `${yyyy}-${mm}-${dd}`, endDate: `${yyyy}-${mm}-${dd}` }
  }
  return { startDate: '', endDate: '' }
}

export function parseMeetRow(
  $: cheerio.CheerioAPI,
  row: cheerio.Cheerio<cheerio.Element>,
  status: MeetSummary['status'],
): MeetSummary | null {
  const link = row.find('a[href*="/Overview"]').first()
  const href = link.attr('href') ?? ''
  const idMatch = href.match(/\/(\d+)\/Overview/)
  if (!idMatch) return null

  const rawName = link.clone().children('i').remove().end().text().trim()
  const detailsBlack = row.find('.myresults_content_divtable_details_black').first().text().trim()
  const details = row.find('.myresults_content_divtable_details').first().text().trim()

  const parts = details.split(' - ')
  const organizer = parts[0]?.trim() ?? ''
  const location = parts[1]?.trim() ?? ''

  const dateText = (row.find('.hidden-xs.col-sm-2').text().trim()
    || row.find('.hidden-sm.hidden-md.hidden-lg').text().trim())
  const { startDate, endDate } = parseDateRange(dateText)

  const course: 'LB' | 'KB' = (detailsBlack.includes('25m') || detailsBlack.includes('SCM')) ? 'KB' : 'LB'

  const statusImg = row.find('img[src*="status_"]').attr('src') ?? ''
  const hasLive = !statusImg.includes('status_grey') && !statusImg.includes('status_green')

  return { id: idMatch[1], name: rawName, startDate, endDate, location, organizer, course, status, hasLive }
}

export async function scrapeMeetList(urlStatus: 'Today-Upcoming' | 'Recent'): Promise<MeetSummary[]> {
  const cacheKey = `meets:${urlStatus}`
  const cached = cache.get<MeetSummary[]>(cacheKey)
  if (cached) return cached

  const status: MeetSummary['status'] = urlStatus === 'Recent' ? 'recent' : 'upcoming'
  const { data: html } = await httpClient.get<string>(`/de-AT/Meets/${urlStatus}`)
  const $ = cheerio.load(html)

  const meets: MeetSummary[] = []
  $('.myresults_content_divtablerow').each((_, el) => {
    const row = $(el)
    if (row.hasClass('myresults_content_divtablerow_header')) return
    const meet = parseMeetRow($, row, status)
    if (meet && !meets.some(m => m.id === meet.id)) meets.push(meet)
  })

  cache.set(cacheKey, meets, TTL_MS)
  return meets
}
