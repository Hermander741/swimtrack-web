import { describe, it, expect, vi } from 'vitest'
import { Cache } from '../src/cache'

describe('Cache', () => {
  it('returns undefined for missing keys', () => {
    const c = new Cache()
    expect(c.get('x')).toBeUndefined()
  })

  it('returns value within TTL', () => {
    const c = new Cache()
    c.set('k', 42, 5000)
    expect(c.get<number>('k')).toBe(42)
  })

  it('returns undefined after TTL expires', () => {
    vi.useFakeTimers()
    const c = new Cache()
    c.set('k', 42, 1000)
    vi.advanceTimersByTime(1001)
    expect(c.get('k')).toBeUndefined()
    vi.useRealTimers()
  })
})
