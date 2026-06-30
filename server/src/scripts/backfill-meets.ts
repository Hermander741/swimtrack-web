/**
 * One-off backfill script — scrapes historical meet results from myresults.eu
 * Run with: npx ts-node src/scripts/backfill-meets.ts [startId] [endId]
 *
 * Design principles:
 *  - Random 3–6 s delay between every HTTP request (polite scraping)
 *  - Skips meet IDs already present in meet_results (resumable)
 *  - Continues on any per-event error — never aborts the whole run
 *  - Writes a progress log to /tmp/backfill-meets.log
 */

import 'dotenv/config'
import * as fs from 'fs'
import * as cheerio from 'cheerio'
import { pool } from '../db/pool'
import { httpClient } from '../httpClient'
import { parseEventList } from '../scrapers/eventList'
import { parseResultTable } from '../scrapers/resultTable'
import { parseDateRange } from '../scrapers/meetList'

const LOG_FILE = '/tmp/backfill-meets.log'
const URL_STATUS = 'Archive'

function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}`
  console.log(line)
  fs.appendFileSync(LOG_FILE, line + '\n')
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function jitter(minMs: number, maxMs: number) {
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs
}

async function getScrapedMeetIds(): Promise<Set<string>> {
  const { rows } = await pool.query('SELECT DISTINCT meet_id FROM meet_results')
  return new Set(rows.map((r: { meet_id: string }) => r.meet_id))
}

async function getMeetMeta(meetId: string): Promise<{ name: string; date: string; course: 'LB' | 'KB' } | null> {
  const { data: html } = await httpClient.get<string>(`/de-AT/Meets/${URL_STATUS}/${meetId}/Overview`)
  const $ = cheerio.load(html)

  // Detect if meet actually exists (empty page has no meet title)
  const title = $('h1, .myresults_content_h1').first().text().trim()
  if (!title) return null

  const dateText = $('.myresults_content_divtable_details_black').first().text().trim()
  const { startDate } = parseDateRange(dateText)
  const course: 'LB' | 'KB' = (html.includes('25m') || html.includes('SCM')) ? 'KB' : 'LB'

  return { name: title, date: startDate, course }
}

async function scrapeAndStoreMeet(meetId: string) {
  // Fetch events page
  const { data: eventsHtml } = await httpClient.get<string>(
    `/de-AT/Meets/${URL_STATUS}/${meetId}/Results`,
  )
  const $ = cheerio.load(eventsHtml)
  const events = parseEventList($)

  if (!events.length) {
    log(`  meet ${meetId}: no events found, skipping`)
    return 0
  }

  // Extract meet name + date from page
  const meetNameEl = $('h1, .myresults_content_h1').first().text().trim()
    || $('title').text().split('|')[0].trim()
  const dateBlack = $('.myresults_content_divtable_details_black').first().text().trim()
  const { startDate } = parseDateRange(dateBlack)
  const course: 'LB' | 'KB' = (eventsHtml.includes('25m') || eventsHtml.includes('SCM')) ? 'KB' : 'LB'

  let totalRows = 0

  for (const event of events) {
    await sleep(jitter(3000, 6000))
    try {
      const { data: resultsHtml } = await httpClient.post<string>(
        `/de-AT/Meets/${URL_STATUS}/${meetId}/Results/${event.id}`,
        new URLSearchParams({ selectevent: event.id }).toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      )
      const $r = cheerio.load(resultsHtml)
      const results = parseResultTable($r)

      if (!results.length) continue

      for (const r of results) {
        await pool.query(
          `INSERT INTO meet_results (meet_id, event_name, course, swimmer_name, birth_year, club, time_ms, meet_date, meet_name)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (meet_id, event_name, swimmer_name) DO NOTHING`,
          [
            meetId,
            event.name,
            course,
            r.name,
            r.birthYear || null,
            r.club || null,
            r.timeMs || null,
            startDate || null,
            meetNameEl || null,
          ],
        )
      }
      totalRows += results.length
      log(`    event "${event.name}": ${results.length} results stored`)
    } catch (e) {
      log(`    event "${event.name}" ERROR: ${e instanceof Error ? e.message : e}`)
    }
  }

  return totalRows
}

async function main() {
  const startId = parseInt(process.argv[2] ?? '1400', 10)
  const endId = parseInt(process.argv[3] ?? '2400', 10)

  log(`=== Backfill start: IDs ${startId}–${endId} ===`)

  const alreadyDone = await getScrapedMeetIds()
  log(`Already in DB: ${alreadyDone.size} meets, skipping those`)

  let meetsDone = 0
  let meetsSkipped = 0
  let meetsEmpty = 0
  let totalResults = 0

  for (let id = startId; id <= endId; id++) {
    const meetId = String(id)

    if (alreadyDone.has(meetId)) {
      meetsSkipped++
      continue
    }

    await sleep(jitter(2000, 4000))

    try {
      log(`Meet ${meetId} (${id - startId + 1}/${endId - startId + 1})…`)
      const rows = await scrapeAndStoreMeet(meetId)
      if (rows === 0) {
        meetsEmpty++
        log(`  Meet ${meetId}: empty/no data`)
      } else {
        meetsDone++
        totalResults += rows
        log(`  Meet ${meetId}: ${rows} results stored ✓`)
      }
    } catch (e) {
      log(`  Meet ${meetId} FAILED: ${e instanceof Error ? e.message : e}`)
    }
  }

  log(`=== Done: ${meetsDone} meets scraped, ${meetsSkipped} skipped (already in DB), ${meetsEmpty} empty, ${totalResults} results total ===`)
  await pool.end()
}

main().catch(e => { log(`FATAL: ${e}`); process.exit(1) })
