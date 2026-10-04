import { describe, expect, test } from 'vitest'
import { ctaUrl, escapeHtml, renderEmail } from './template'

describe('email template', () => {
  test('escapes HTML from user-provided text', () => {
    const { html } = renderEmail(
      { subject: 'Hi', heading: '<b>x</b>', body: 'Hello <script>alert(1)</script>', cta_label: null, cta_path: '/client' },
      { siteUrl: 'https://app.coherent.agency', accent: '#2f5bff', supportEmail: 'hello@coherent.agency' },
    )
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('https://app.coherent.agency/client')
  })

  test('links never leave the site', () => {
    expect(ctaUrl('https://app.coherent.agency/', '//evil.test')).toBe('https://app.coherent.agency/')
    expect(ctaUrl('https://app.coherent.agency', 'https://evil.test')).toBe('https://app.coherent.agency/')
    expect(ctaUrl('https://app.coherent.agency', '/team/projects/1')).toBe('https://app.coherent.agency/team/projects/1')
  })

  test('text version includes body lines and the link', () => {
    const { text } = renderEmail(
      { subject: 'Kickoff', heading: null, body: 'Start date: today\nDue date: soon', cta_label: 'Open', cta_path: '/client' },
      { siteUrl: 'https://x.test', accent: '#000', supportEmail: 's@x.test' },
    )
    expect(text).toContain('Start date: today')
    expect(text).toContain('Open: https://x.test/client')
    expect(escapeHtml(`"'`)).toBe('&quot;&#39;')
  })
})
