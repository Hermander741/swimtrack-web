import { Router } from 'express'
import { scrapeMeetList } from '../scrapers/meetList'
import { ok, err, MeetSummary } from '../types'

export const meetsRouter = Router()

meetsRouter.get('/', async (req, res) => {
  const status = (req.query.status as string) ?? 'all'
  try {
    const meets: MeetSummary[] = []
    if (status === 'upcoming' || status === 'all') {
      meets.push(...await scrapeMeetList('Today-Upcoming'))
    }
    if (status === 'recent' || status === 'all') {
      meets.push(...await scrapeMeetList('Recent'))
    }
    res.json(ok(meets))
  } catch (e) {
    res.status(502).json(err(e instanceof Error ? e.message : 'Scrape failed'))
  }
})
