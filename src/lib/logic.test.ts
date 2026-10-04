import { describe, expect, test } from 'vitest'
import { kickoffState } from './kickoff'
import { countdownText, formatClock, formatDuration } from './format'
import { friendlyError } from './errors'
import { toCsv } from './csv'
import { looksLikeSecret } from '@/content/accessSteps'
import type { AccessKey, AccessStatus } from './types'

const steps = (o: Partial<Record<AccessKey, AccessStatus>>) =>
  (['webflow', 'domain_dns', 'gtm', 'ga4', 'gsc', 'brand_assets'] as AccessKey[]).map((key) => ({ key, status: o[key] ?? 'pending' }))

describe("Let's Go rule", () => {
  test('blocked while Webflow is pending', () => {
    const s = kickoffState(steps({ domain_dns: 'provided', gtm: 'provided' }))
    expect(s.canStart).toBe(false)
    expect(s.blockedBy).toBe('webflow')
  })
  test('allowed (with warning) when only other steps are pending', () => {
    const s = kickoffState(steps({ webflow: 'provided' }))
    expect(s.canStart).toBe(true)
    expect(s.pendingKeys).toEqual(['domain_dns', 'gtm', 'ga4', 'gsc', 'brand_assets'])
    expect(s.allDone).toBe(false)
  })
  test('skipped and verified count as done', () => {
    const s = kickoffState(steps({ webflow: 'verified', domain_dns: 'skipped', gtm: 'provided', ga4: 'provided', gsc: 'provided', brand_assets: 'provided' }))
    expect(s).toMatchObject({ canStart: true, allDone: true, pendingKeys: [] })
  })
  test('projects without a Webflow step are never blocked', () => {
    expect(kickoffState([{ key: 'gsc', status: 'pending' }]).canStart).toBe(true)
  })
})

describe('formatting', () => {
  const now = new Date(2026, 9, 4, 15, 0)
  test('countdown', () => {
    expect(countdownText('2026-10-04', now)).toBe('Due today')
    expect(countdownText('2026-10-05', now)).toBe('Due tomorrow')
    expect(countdownText('2026-10-16', now)).toBe('Due in 12 days')
    expect(countdownText('2026-10-01', now)).toBe('3 days overdue')
    expect(countdownText(null, now)).toBe('Due date to be confirmed')
  })
  test('durations', () => {
    expect(formatDuration(2 * 3600_000 + 5 * 60_000)).toBe('2h 05m')
    expect(formatClock(3661_000)).toBe('01:01:01')
  })
})

describe('secret detection', () => {
  test.each(['password: hunter2', 'pwd=abc', 'api_key: 123', 'sk_live_abcdefghijklmnop', 'Ab3dEf6hIj9kLm2nOp5qRs8tUv1wXy4zAb7c'])('flags %s', (v) => {
    expect(looksLikeSecret(v)).toBe(true)
  })
  test.each(['GTM-ABC1234', '345678901', 'example.com', 'https://drive.google.com/drive/folders/abc', 'acme-bakery.webflow.io', ''])('allows %s', (v) => {
    expect(looksLikeSecret(v)).toBe(false)
  })
})

describe('friendly errors', () => {
  test('never shows raw codes', () => {
    expect(friendlyError({ status: 429, message: 'email rate limit exceeded' })).toMatch(/Too many emails/)
    expect(friendlyError({ code: '42501', message: 'new row violates row-level security policy' })).toMatch(/permission/)
    expect(friendlyError({ code: 'P0001', hint: 'webflow_pending', message: 'Please share Webflow access first.' })).toBe('Please share Webflow access first.')
    expect(friendlyError({ code: 'XX000', message: 'internal' })).toBe('Something went wrong. Please try again.')
    expect(friendlyError(new TypeError('Failed to fetch'))).toMatch(/could not reach the server/)
  })
})

describe('CSV export', () => {
  test('escapes quotes, commas and spreadsheet formulas', () => {
    const csv = toCsv([{ a: 'x,y', b: 'say "hi"', c: '=SUM(1)' }], ['a', 'b', 'c'])
    expect(csv).toBe('a,b,c\n"x,y","say ""hi""",\'=SUM(1)')
  })
})
