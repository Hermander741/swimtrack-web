import { describe, it, expect } from 'vitest'
import { parseResultTable, parseTimeMs } from '../src/scrapers/resultTable'
import * as cheerio from 'cheerio'

const HTML = `
<div id="starts_content">
  <div class="row myresults_content_divtablerow myresults_content_divtablerow_header">
    <div class="col-xs-12 myresults_content_divtablecol">Jahrgang 2021</div>
  </div>
  <div class="row myresults_content_divtablerow myresults_content_divtablerow_odd">
    <div class="col-xs-1"><span class="msecm-place msecm-place-gold">1.</span></div>
    <div class="col-xs-11 col-sm-4">
      <a href="/de-AT/Meets/Recent/2391/Participant/332838">DOLGOPOLOVA Kristina<i class="fa fa-angle-double-right"></i></a>
      <span class="myresults_content_divtable_details">2021 W</span>
    </div>
    <div class="hidden-xs col-sm-4"><a href="/de-AT/Meets/Recent/2391/Club/7519">VIENNA AQUATIC SC<i></i></a></div>
    <div class="hidden-xs col-sm-2 col-md-1 text-right myresults_content_divtable_right">39.76</div>
    <div class="hidden-xs hidden-sm col-md-1 text-right myresults_content_divtable_right myresults_content_divtable_points">542</div>
    <div class="col-xs-12 hidden-sm hidden-md hidden-lg text-right myresults_content_divtable_right">39.76</div>
  </div>
  <div class="row myresults_content_divtablerow myresults_content_divtablerow_even">
    <div class="col-xs-1"><span class="msecm-place msecm-place-silver">2.</span></div>
    <div class="col-xs-11 col-sm-4">
      <a href="/de-AT/Meets/Recent/2391/Participant/332829">MUSTERMANN Max<i></i></a>
      <span class="myresults_content_divtable_details">2010 M</span>
    </div>
    <div class="hidden-xs col-sm-4"><a href="/de-AT/Meets/Recent/2391/Club/100">SV WIEN<i></i></a></div>
    <div class="hidden-xs col-sm-2 col-md-1 text-right myresults_content_divtable_right">1:03.42</div>
  </div>
</div>`

describe('resultTable scraper', () => {
  it('parseTimeMs: seconds only', () => {
    expect(parseTimeMs('39.76')).toBe(39760)
  })

  it('parseTimeMs: minutes and seconds', () => {
    expect(parseTimeMs('1:03.42')).toBe(63420)
  })

  it('parseTimeMs: DNS/DSQ returns 0', () => {
    expect(parseTimeMs('DNS')).toBe(0)
    expect(parseTimeMs('DSQ')).toBe(0)
  })

  it('parses result table rows', () => {
    const $ = cheerio.load(HTML)
    const results = parseResultTable($)
    expect(results).toHaveLength(2)
    expect(results[0]).toEqual({
      rank: 1,
      name: 'DOLGOPOLOVA Kristina',
      birthYear: 2021,
      club: 'VIENNA AQUATIC SC',
      timeMs: 39760,
      participantId: '332838',
    })
    expect(results[1].rank).toBe(2)
    expect(results[1].name).toBe('MUSTERMANN Max')
    expect(results[1].timeMs).toBe(63420)
    expect(results[1].birthYear).toBe(2010)
  })
})
