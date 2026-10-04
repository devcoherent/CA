import { chromium } from 'playwright'
import AxeBuilder from '@axe-core/playwright'
import { execSync } from 'node:child_process'
const BASE = process.env.BASE_URL ?? 'http://localhost:5173'
const q = (sql) => execSync(`psql -At postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "${sql}"`).toString().trim()
const P1 = q("select id from projects where name='Acme Bakery website'")
const P2 = q("select id from projects where name='Northwind SEO audit'")
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
const sets = {
  'maya@acmebakery.test': ['/client', `/client/projects/${P1}`, `/client/projects/${P1}/access`, `/client/projects/${P1}/access?step=6`, `/client/projects/${P1}/qa`, '/client/request', '/client/profile'],
  'ashik@coherent.test': ['/team', `/team/projects/${P2}`, `/team/projects/${P2}?tab=updates`, `/team/projects/${P2}?tab=notes`, `/team/projects/${P2}?tab=access`, `/team/projects/${P2}?tab=stages`, `/team/projects/${P2}?tab=settings`],
  'will@coherent.test': ['/admin', '/admin/users', '/admin/users?tab=clients', '/admin/users?tab=invites', '/admin/orgs', '/admin/projects/new', '/admin/templates', '/admin/audit', '/admin/requests', '/notifications'],
}
let total = 0
for (const theme of ['light', 'dark']) {
  for (const [email, paths] of Object.entries(sets)) {
    const ctx = await browser.newContext({ colorScheme: theme }); const page = await ctx.newPage()
    await page.goto(`${BASE}/login`); await page.locator('summary', { hasText: 'Developer login' }).click()
    await page.fill('#dev-email', email); await page.fill('#dev-password', 'Password123!'); await page.click('text=Log in with password')
    await page.waitForURL((u) => !u.pathname.startsWith('/login'))
    for (const p of paths) {
      await page.goto(BASE + p); await page.waitForLoadState('networkidle'); await page.waitForTimeout(300)
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
      for (const v of r.violations) { total++; console.log(`${theme} ${email.split('@')[0]} ${p}: [${v.impact}] ${v.id} — ${v.help} (${v.nodes.length}) e.g. ${v.nodes[0].target} ${v.nodes[0].failureSummary?.split('\n')[1] ?? ''}`) }
    }
    await ctx.close()
  }
}
await browser.close(); console.log(`violations: ${total}`)
process.exit(total ? 1 : 0)
