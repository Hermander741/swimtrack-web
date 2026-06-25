import { Router } from 'express'
import { scrapeResultTable } from '../scrapers/resultTable'
import { ok, err } from '../types'

export const resultsRouter = Router()

resultsRouter.get('/:meetId/results/:eventId', async (req, res) => {
  const { meetId, eventId } = req.params
  const urlStatus = (req.query.urlStatus as string) ?? 'Recent'
  try {
    const results = await scrapeResultTable(meetId, eventId, urlStatus)
    res.json(ok(results))
  } catch (e) {
    res.status(502).json(err(e instanceof Error ? e.message : 'Scrape failed'))
  }
})
