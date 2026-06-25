import { describe, it, expect } from 'vitest'
import { parseEventList } from '../src/scrapers/eventList'
import * as cheerio from 'cheerio'

const HTML = `
<select id="selectevent">
  <optgroup label="Samstag 27.06.2026&lt;br&gt;1. Abschnitt - Einschwimmen 13:00, Beginn 14:00">
    <option selected value="84203">1 - 100m Schmetterling Damen</option>
    <option value="84204">2 - 100m Schmetterling Herren</option>
  </optgroup>
  <optgroup label="Sonntag 28.06.2026&lt;br&gt;2. Abschnitt">
    <option value="84205">3 - 100m Rücken Damen</option>
  </optgroup>
</select>`

describe('eventList scraper', () => {
  it('parses events from select element', () => {
    const $ = cheerio.load(HTML)
    const events = parseEventList($)
    expect(events).toHaveLength(3)
    expect(events[0]).toEqual({
      id: '84203',
      number: 1,
      name: '100m Schmetterling Damen',
      session: 'Samstag 27.06.2026 - 1. Abschnitt - Einschwimmen 13:00, Beginn 14:00',
    })
    expect(events[1].id).toBe('84204')
    expect(events[2].id).toBe('84205')
  })
})
