import { Router } from 'express'
import { scrapeMeetList } from '../scrapers/meetList'
import { scrapeEventList } from '../scrapers/eventList'
import { scrapeResultTable } from '../scrapers/resultTable'
import { ok, err } from '../types'
import type { SwimmerResult } from '../types'

export const swimmerRouter = Router()

swimmerRouter.get('/results', async (req, res) => {
  const name = (req.query.name as string ?? '').trim().toLowerCase()
  const birthYear = parseInt(req.query.birthYear as string ?? '0', 10)

  if (!name) {
    res.status(400).json(err('name query param required'))
    return
  }

  try {
    const recentMeets = await scrapeMeetList('Recent')
    const meetsToSearch = recentMeets.slice(0, 5)
    const swimmerResults: SwimmerResult[] = []

    for (const meet of meetsToSearch) {
      const events = await scrapeEventList(meet.id, 'Recent')
      for (const event of events) {
        const rows = await scrapeResultTable(meet.id, event.id, 'Recent')
        for (const row of rows) {
          const nameMatch = row.name.toLowerCase().includes(name)
            || name.split(' ').every(part => row.name.toLowerCase().includes(part))
          const yearMatch = !birthYear || row.birthYear === birthYear
          if (nameMatch && yearMatch && row.timeMs > 0) {
            swimmerResults.push({
              meetId: meet.id,
              meetName: meet.name,
              meetDate: meet.startDate,
              eventId: event.id,
              eventName: event.name,
              course: meet.course,
              result: row,
            })
          }
        }
      }
    }

    res.json(ok(swimmerResults))
  } catch (e) {
    res.status(502).json(err(e instanceof Error ? e.message : 'Scrape failed'))
  }
})
