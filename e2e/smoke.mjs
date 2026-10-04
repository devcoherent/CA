import { chromium } from 'playwright'
import { execSync } from 'node:child_process'
import fs from 'node:fs'

const BASE = process.env.BASE_URL ?? 'http://localhost:5173'
const OUT = process.env.OUT || 'e2e/screenshots'
fs.mkdirSync(OUT, { recursive: true })
const q = (sql) => execSync(`psql -At postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "${sql}"`).toString().trim()
const P1 = q("select id from projects where name='Acme Bakery website'")
const P2 = q("select id from projects where name='Northwind SEO audit'")
const ORG1 = q("select id from organizations where name='Acme Bakery'")

const problems = []
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})

async function session(name, email, pages, { viewport = { width: 1280, height: 900 } } = {}) {
  for (const theme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport, colorScheme: theme })
    const page = await ctx.newPage()
    page.on('console', (m) => m.type() === 'error' && problems.push(`[${name}/${theme}] console: ${m.text()}`))
    page.on('pageerror', (e) => problems.push(`[${name}/${theme}] pageerror: ${e.message}`))
    if (email) {
      await page.goto(`${BASE}/login`)
      await page.locator('summary', { hasText: 'Developer login' }).click()
      await page.fill('#dev-email', email)
      await page.fill('#dev-password', 'Password123!')
      await page.click('text=Log in with password')
      await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 10000 })
    }
    for (const [label, path, expect] of pages) {
      await page.goto(BASE + path)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(400)
      const theme_attr = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
      const bodyText = await page.locator('body').innerText()
      if (/Something went wrong|could not reach the server|do not have permission/i.test(bodyText)) problems.push(`[${name}/${theme}] ${label}: error text visible`)
      await page.screenshot({ path: `${OUT}/${name}-${label}-${theme}.png`, fullPage: true })
      const want = expect ?? new URL(BASE + path).pathname
      const got = new URL(page.url()).pathname
      if (got !== want) problems.push(`[${name}/${theme}] ${label}: expected ${want}, ended on ${got}`)
      console.log(`ok ${name} ${theme} ${label} ${page.url().replace(BASE, '')} bg=${theme_attr}`)
    }
    await ctx.close()
  }
}

const only = process.env.ONLY
const run = (n) => !only || only.split(',').includes(n)

if (run('public')) await session('public', null, [['landing', '/'], ['login-client', '/login?role=client'], ['login-team', '/login?role=team'], ['signup-client', '/signup?role=client'], ['signup-team', '/signup?role=team']])
if (run('public-mobile')) await session('mobile', null, [['landing', '/'], ['login', '/login?role=client']], { viewport: { width: 375, height: 800 } })
if (run('client')) await session('client', 'maya@acmebakery.test', [
  ['home', '/client'], ['project', `/client/projects/${P1}`], ['access', `/client/projects/${P1}/access`], ['access-review', `/client/projects/${P1}/access?step=6`],
  ['qa', `/client/projects/${P1}/qa`], ['request', '/client/request'], ['profile', '/client/profile'], ['notifications', '/notifications'],
  ['try-team', '/team', '/client'], ['try-admin', '/admin', '/client'], ['other-project', `/client/projects/${P2}`],
])
if (run('client2')) await session('client2', 'leo@northwind.test', [['project', `/client/projects/${P2}`]])
if (run('client-mobile')) await session('client-mobile', 'maya@acmebakery.test', [['home', '/client'], ['project', `/client/projects/${P1}`], ['access', `/client/projects/${P1}/access`]], { viewport: { width: 375, height: 800 } })
if (run('newclient')) await session('newclient', 'newclient@freshco.test', [['home', '/client']])
if (run('pending')) await session('pending', 'pending@coherent.test', [['pending', '/pending'], ['try-team', '/team', '/pending'], ['landing', '/', '/pending']])
if (run('team')) await session('team', 'sadman@coherent.test', [
  ['home', '/team'], ['board', `/team/projects/${P1}`], ['updates', `/team/projects/${P1}?tab=updates`], ['notes', `/team/projects/${P1}?tab=notes`],
  ['access', `/team/projects/${P1}?tab=access`], ['stages', `/team/projects/${P1}?tab=stages`], ['settings', `/team/projects/${P1}?tab=settings`],
  ['unassigned', `/team/projects/${P2}`], ['try-admin', '/admin', '/team'], ['try-client', '/client', '/team'], ['profile', '/profile'], ['landing', '/', '/team'], ['login', '/login', '/team'], ['signup', '/signup', '/team'],
])
if (run('admin')) await session('admin', 'will@coherent.test', [
  ['projects', '/team'], ['workload', '/admin'], ['people', '/admin/users'], ['pending', '/admin/users?tab=pending'], ['clients', '/admin/users?tab=clients'],
  ['invites', '/admin/users?tab=invites'], ['orgs', '/admin/orgs'], ['org', `/admin/orgs/${ORG1}`], ['newproject', '/admin/projects/new'],
  ['approvals', '/admin/approvals'], ['requests', '/admin/requests'], ['templates', '/admin/templates'], ['audit', '/admin/audit'],
  ['p2-time', `/team/projects/${P2}?tab=time`], ['p2-access', `/team/projects/${P2}?tab=access`],
])
await browser.close()
console.log('\nPROBLEMS:', problems.length ? '\n' + [...new Set(problems)].join('\n') : 'none')
process.exit(problems.length ? 1 : 0)
