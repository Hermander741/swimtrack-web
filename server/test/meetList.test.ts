import { describe, it, expect } from 'vitest'
import { parseMeetRow, parseDateRange } from '../src/scrapers/meetList'
import * as cheerio from 'cheerio'

const ROW_HTML = `
<div class="row myresults_content_divtablerow myresults_content_divtablerow_odd">
  <div class="col-xs-10 col-sm-6 col-md-6 col-lg-7">
    <a href="/de-AT/Meets/Today-Upcoming/2365/Overview">Finalwettkämpfe<i class="fa fa-angle-double-right"></i></a>
    <span class="myresults_content_divtable_details_black">50m (LCM), Hallenbad</span>
    <span class="myresults_content_divtable_details">ÖSV - BSFZ Südstadt</span>
    <div class="hidden-sm hidden-md hidden-lg">27.-28.06.2026</div>
  </div>
  <div class="hidden-xs col-sm-2">27.-28.06.2026</div>
  <div class="col-xs-1"><img src="/images/status_grey.png"></div>
</div>`

const ROW_HTML_LIVE = `
<div class="row myresults_content_divtablerow myresults_content_divtablerow_odd">
  <div class="col-xs-10 col-sm-6 col-md-6 col-lg-7">
    <a href="/de-AT/Meets/Today-Upcoming/2366/Overview">Sommermeisterschaften<i class="fa fa-angle-double-right"></i></a>
    <span class="myresults_content_divtable_details_black">50m (LCM), Hallenbad</span>
    <span class="myresults_content_divtable_details">ÖSV - BSFZ Nordwest</span>
    <div class="hidden-sm hidden-md hidden-lg">29.-30.06.2026</div>
  </div>
  <div class="hidden-xs col-sm-2">29.-30.06.2026</div>
  <div class="col-xs-1"><img src="/images/status_orange.png"></div>
</div>`

describe('meetList scraper', () => {
  it('parseDateRange: single day', () => {
    expect(parseDateRange('28.06.2026')).toEqual({ startDate: '2026-06-28', endDate: '2026-06-28' })
  })

  it('parseDateRange: multi-day', () => {
    expect(parseDateRange('27.-28.06.2026')).toEqual({ startDate: '2026-06-27', endDate: '2026-06-28' })
  })

  it('parseDateRange: multi-day cross-month', () => {
    expect(parseDateRange('30.06.-01.07.2026')).toEqual({ startDate: '2026-06-30', endDate: '2026-07-01' })
  })

  it('parseMeetRow: extracts meet data from HTML row', () => {
    const $ = cheerio.load(ROW_HTML)
    const row = $('.myresults_content_divtablerow').first()
    const meet = parseMeetRow($, row, 'upcoming')
    expect(meet).not.toBeNull()
    expect(meet!.id).toBe('2365')
    expect(meet!.name).toBe('Finalwettkämpfe')
    expect(meet!.startDate).toBe('2026-06-27')
    expect(meet!.endDate).toBe('2026-06-28')
    expect(meet!.location).toBe('BSFZ Südstadt')
    expect(meet!.organizer).toBe('ÖSV')
    expect(meet!.course).toBe('LB')
    expect(meet!.status).toBe('upcoming')
    expect(meet!.hasLive).toBe(false)
  })

  it('parseMeetRow: hasLive true when status is orange', () => {
    const $ = cheerio.load(ROW_HTML_LIVE)
    const row = $('.myresults_content_divtablerow').first()
    const meet = parseMeetRow($, row, 'upcoming')
    expect(meet).not.toBeNull()
    expect(meet!.hasLive).toBe(true)
  })
})
