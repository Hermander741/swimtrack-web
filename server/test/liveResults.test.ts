import { describe, it, expect, vi } from 'vitest'
import { parseLiveResponse } from '../src/scrapers/liveResults'

describe('liveResults scraper', () => {
  it('handles no-live-session response (status -1)', () => {
    const result = parseLiveResponse({ status: -1, title1: null, statustext: null })
    expect(result.status).toBe(-1)
    expect(result.results).toBeUndefined()
  })

  it('handles active live session (status 0)', () => {
    const raw = {
      status: 0,
      title1: '100m Freistil Damen',
      results: [
        { rank: '1', name: 'MUSTER Anna', year: '2010', club: 'SV Wien', time: '1:02.45', participantid: '999' },
      ],
    }
    const result = parseLiveResponse(raw)
    expect(result.status).toBe(0)
    expect(result.event).toBe('100m Freistil Damen')
    expect(result.results).toHaveLength(1)
    expect(result.results![0].timeMs).toBe(62450)
    expect(result.results![0].name).toBe('MUSTER Anna')
  })
})
