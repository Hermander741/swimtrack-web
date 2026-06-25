import { Router } from 'express'
import { scrapeLiveResults } from '../scrapers/liveResults'
import { ok, err } from '../types'

export const liveRouter = Router()

liveRouter.get('/:id/live', async (req, res) => {
  const { id } = req.params
  const urlStatus = (req.query.urlStatus as string) ?? 'Today-Upcoming'
  try {
    const result = await scrapeLiveResults(id, urlStatus)
    res.json(ok(result))
  } catch (e) {
    res.status(502).json(err(e instanceof Error ? e.message : 'Scrape failed'))
  }
})
