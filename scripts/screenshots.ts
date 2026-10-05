/**
 * Screenshots of every main screen, using DEMO MODE (fake data, no Supabase, no Docker).
 *
 *   npm run screenshots                     all screens → preview/screenshots/*.png + preview/index.html
 *   npm run screenshots -- --only=client    only screens whose file name contains "client"
 *   npm run screenshots -- --no-open        do not open the preview page afterwards
 *   BASE_URL=http://localhost:5173 npm run screenshots   reuse a running `npm run preview:demo`
 *
 * Each screen is captured full-page (dialogs and open menus: visible screen only) in light + dark, desktop (1440x900) + mobile (390x844):
 *   preview/screenshots/{role}-{screen}-{theme}-{device}.png
 * It also checks every shot for horizontal overflow, clipped elements and the right fonts,
 * and writes the results to preview/report.json.
 */
import { chromium, type Browser, type Page } from 'playwright'
import { createServer, type ViteDevServer } from 'vite'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

type Role = 'public' | 'client' | 'team' | 'admin' | 'pending'
type Theme = 'light' | 'dark'
type Device = 'desktop' | 'mobile'

interface Screen {
  role: Role
  screen: string
  title: string
  caption: string
  /** Demo user to sign in as (see src/demo/data.ts). Omit for logged-out pages. */
  as?: string
  path: string
  /** Extra steps after the page loads (fill a form, open a dialog...). */
  act?: (page: Page, device: Device) => Promise<void>
  /** Capture only the visible screen (dialogs and open menus cover the viewport, not the whole page). */
  viewportOnly?: boolean
}

const ROOT = process.cwd()
const OUT = path.join(ROOT, 'preview')
const SHOTS = path.join(OUT, 'screenshots')
const args = process.argv.slice(2)
const only = args.find((a) => a.startsWith('--only='))?.slice('--only='.length)
const noOpen = args.includes('--no-open') || Boolean(process.env.CI)

const VIEWPORTS: Record<Device, { width: number; height: number }> = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
}

const ACCESS_STEPS = [
  ['webflow', 'Webflow', 'Step 1: invite our email to the Webflow site. This is the only step that has to be done before the project can start.'],
  ['domain', 'Domain and DNS', 'Step 2: tell us where the domain is registered, so we can connect it on launch day.'],
  ['gtm', 'Google Tag Manager', 'Step 3: add our email to Tag Manager and paste the container ID (never a password).'],
  ['ga4', 'Google Analytics 4', 'Step 4: shown as "Already shared before" with a note saying who it was shared with and when.'],
  ['gsc', 'Google Search Console', 'Step 5: add our email as a Full user in Search Console.'],
  ['brand', 'Brand assets', 'Step 6: a link to the logo, fonts and brand guidelines.'],
] as const

const SCREENS: Screen[] = [
  // ------------------------------------------------------------------ public
  { role: 'public', screen: 'landing', title: 'Landing page', path: '/', caption: 'The first page anyone sees. Two big choices: "I\'m a client" or "I\'m on the Coherent team", plus a three-step "How it works".' },
  { role: 'public', screen: 'login-client', title: 'Client login', path: '/login?role=client', caption: 'Clients type their email and get a login link. No password. A link switches to the team login if they picked the wrong one.' },
  { role: 'public', screen: 'login-team', title: 'Team login', path: '/login?role=team', caption: 'Same login, worded for the Coherent team.' },
  { role: 'public', screen: 'signup-client', title: 'Client signup', path: '/signup?role=client', caption: 'New clients give their name, company and email. The company name is only a request: an admin links them to the right organization.' },
  { role: 'public', screen: 'signup-team', title: 'Team signup', path: '/signup?role=team', caption: 'Team members sign up with name and email. Unless an admin invited them, they wait for approval.' },
  {
    role: 'public', screen: 'check-email', title: '"Check your email" screen', path: '/login?role=client',
    caption: 'Shown after asking for a login link. The resend button unlocks after 30 seconds.',
    act: async (page) => {
      await page.fill('#login-email', 'maya@example.com')
      await page.click('button:has-text("Send me a login link")')
      await page.getByRole('heading', { name: 'Check your email' }).waitFor()
    },
  },
  {
    role: 'public', screen: 'unknown-email', title: 'Unknown email', path: '/login?role=client',
    caption: 'If nobody has an account with that email, we say so in plain words and offer "Create account" with the email already filled in.',
    act: async (page) => {
      await page.fill('#login-email', 'someone.new@example.com')
      await page.click('button:has-text("Send me a login link")')
      await page.getByTestId('not-found').waitFor()
    },
  },

  // ------------------------------------------------------------------ client
  { role: 'client', screen: 'dashboard', as: 'client-b', title: 'Client dashboard', path: '/client', caption: 'Each project as a card: current stage, progress and a due-date countdown. The spring campaign is due in 5 days, so its countdown is highlighted.' },
  { role: 'client', screen: 'project', as: 'client-b', title: 'Project page', path: '/client/projects/p-seo', caption: 'The stage timeline with the current stage highlighted, a plain-English "This week" summary, and the feed of updates from the team.' },
  ...ACCESS_STEPS.map(([key, name, caption], i) => ({
    role: 'client' as const, screen: `access-${i + 1}-${key}`, as: 'client-a', title: `Share access: ${name}`, path: `/client/projects/p-acme/access?step=${i}`, caption,
  })),
  {
    role: 'client', screen: 'access-lets-go-ready', as: 'client-a', title: "Let's Go, ready to press", path: '/client/projects/p-acme/access?step=0',
    caption: 'After the Webflow step is done, "Let\'s Go" unlocks. Other steps still pending show a gentle warning but do not block the start.',
    act: async (page) => {
      await page.fill('#field-webflow-value', 'acme-bakery-demo.webflow.io')
      await page.getByLabel("I've done this").check()
      await page.getByText('Saved').waitFor()
      await page.getByRole('navigation', { name: 'Access steps' }).getByRole('button', { name: 'Review' }).click()
      await page.getByRole('button', { name: "Let's Go" }).waitFor()
    },
  },
  { role: 'client', screen: 'qa', as: 'client-a', title: 'Review and feedback (QA)', path: '/client/projects/p-acme/qa', caption: 'Where clients leave comments on their site through Webvizio, with a four-step guide. The guide text lives in one editable file.' },
  {
    role: 'client', screen: 'notifications-open', as: 'client-b', title: 'Notifications open', path: '/client', viewportOnly: true,
    caption: 'The bell shows new updates, stage changes and due-date changes as they happen. The same messages also go out by email.',
    act: async (page) => {
      await page.locator('button[aria-label^="Notifications"]').click()
      await page.getByRole('link', { name: 'See all' }).waitFor()
    },
  },
  { role: 'client', screen: 'profile', as: 'client-a', title: 'Client profile', path: '/client/profile', caption: 'Clients edit their own name, photo, timezone and theme, plus their company name, logo, bio and billing email.' },
  { role: 'client', screen: 'no-org', as: 'new-client', title: 'New client, not set up yet', path: '/client', caption: 'What a brand-new client sees until an admin links them to their company. They can see nothing else.' },

  // ------------------------------------------------------------------ team
  { role: 'team', screen: 'my-projects', as: 'ashik', title: 'My projects', path: '/team', caption: 'A team member sees only the projects they are assigned to, with status, stage, due date and progress, and their open tasks.' },
  { role: 'team', screen: 'task-board', as: 'ashik', title: 'Task board', path: '/team/projects/p-seo', caption: 'To do, Doing and Done. Cards move with the arrow buttons or by dragging. Every card can be shared with the client.' },
  {
    role: 'team', screen: 'timer-switch', as: 'ashik', title: 'Time tracker: switch project', path: '/team', viewportOnly: true,
    caption: 'The timer in the top bar shows what is running. "Switch project" stops it and starts the next one at the same second, with an optional handoff note.',
    act: async (page) => {
      await page.getByRole('button', { name: 'Switch project' }).click()
      await page.getByRole('dialog').getByRole('button', { name: 'Switch now' }).waitFor()
      await page.fill('#timer-note', 'Header audit done, footer next.')
    },
  },
  {
    role: 'team', screen: 'submit-to-client', as: 'ashik', title: 'Submit to client', path: '/team/projects/p-seo', viewportOnly: true,
    caption: 'A short, friendly message that lands in the client\'s update feed and inbox. If the project needs approval, it goes to an admin first.',
    act: async (page) => {
      await page.getByRole('button', { name: 'Submit to client' }).first().click()
      await page.fill('#update-message', 'Technical audit findings are ready for your review')
    },
  },
  { role: 'team', screen: 'internal-notes', as: 'ashik', title: 'Internal notes', path: '/team/projects/p-seo?tab=notes', caption: 'Notes only the Coherent team can see. Clients never see them; the database enforces it.' },

  // ------------------------------------------------------------------ admin
  { role: 'admin', screen: 'workload', as: 'admin', title: 'Workload', path: '/admin', caption: 'Who is working right now, hours today and this week per person and per project. Auto-stopped timers are highlighted. Exports to CSV.' },
  { role: 'admin', screen: 'projects', as: 'admin', title: 'All projects', path: '/team', caption: 'Admins see every project and can create new ones from a template.' },
  { role: 'admin', screen: 'organizations', as: 'admin', title: 'Organizations', path: '/admin/orgs', caption: 'Client companies, with how many projects and people each has.' },
  { role: 'admin', screen: 'pending-team', as: 'admin', title: 'Pending team members', path: '/admin/users?tab=pending', caption: 'Team signups that were not invited wait here for an admin to approve or reject them.' },
  { role: 'admin', screen: 'new-clients', as: 'admin', title: 'New clients', path: '/admin/users?tab=clients', caption: 'New clients are linked to an existing organization, or a new one is created from the company name they typed.' },
  { role: 'admin', screen: 'invites', as: 'admin', title: 'Invites', path: '/admin/users?tab=invites', caption: 'Invite team members by email. When they sign up with that email they get their role automatically.' },
  { role: 'admin', screen: 'audit-log', as: 'admin', title: 'Audit log', path: '/admin/audit', caption: 'Every change to projects, access steps, due dates and client updates, with who did it and when.' },
  { role: 'admin', screen: 'approvals', as: 'admin', title: 'Update approvals', path: '/admin/approvals', caption: 'On projects that require approval, team updates wait here until an admin approves or rejects them.' },

  // ------------------------------------------------------------------ pending
  { role: 'pending', screen: 'waiting', as: 'pending', title: 'Waiting for approval', path: '/pending', caption: 'What an uninvited team signup sees until an admin approves them. They cannot open anything else.' },
]

// ---------------------------------------------------------------------------- helpers
async function startServer(): Promise<{ url: string; server?: ViteDevServer }> {
  if (process.env.BASE_URL) return { url: process.env.BASE_URL.replace(/\/$/, '') }
  const server = await createServer({ mode: 'demo', logLevel: 'error', server: { port: 5199, strictPort: false, open: false } })
  await server.listen()
  const url = (server.resolvedUrls?.local[0] ?? 'http://localhost:5199/').replace(/\/$/, '')
  return { url, server }
}

async function launch(): Promise<Browser> {
  try {
    return await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
  } catch (e) {
    console.error('\nCould not start Chromium. Install it once with:  npm run screenshots:install\n')
    throw e
  }
}

async function waitReady(page: Page) {
  await page.waitForFunction(
    () => Boolean(document.querySelector('#main')) && !document.querySelector('[aria-busy="true"], .skeleton'),
    null,
    { timeout: 20_000 },
  )
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(300)
}

interface Audit {
  overflowX: boolean
  headingFont: string
  bodyFont: string
  loadedFonts: string[]
  clipped: string[]
}

async function audit(page: Page): Promise<Audit> {
  return page.evaluate(() => {
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0
    }
    const heading = [...document.querySelectorAll('h1, h2')].find(visible)
    const clipped = [...document.querySelectorAll('#main *')]
      .filter((el) => {
        const cs = getComputedStyle(el)
        if (!visible(el) || cs.textOverflow === 'ellipsis' || el.closest('.sr-only, .overflow-x-auto, [role="tablist"], nav')) return false
        return ['hidden', 'clip'].includes(cs.overflowX) && el.scrollWidth > el.clientWidth + 2
      })
      .slice(0, 5)
      .map((el) => `${el.tagName.toLowerCase()}.${String((el as HTMLElement).className).split(' ').slice(0, 3).join('.')}`)
    return {
      overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
      headingFont: heading ? getComputedStyle(heading).fontFamily : '',
      bodyFont: getComputedStyle(document.body).fontFamily,
      loadedFonts: [...new Set([...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/"/g, '')))],
      clipped,
    }
  })
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function openFile(file: string) {
  const cmd = process.platform === 'darwin' ? ['open', [file]] : process.platform === 'win32' ? ['cmd', ['/c', 'start', '""', file]] : ['xdg-open', [file]]
  try {
    const child = spawn(cmd[0] as string, cmd[1] as string[], { detached: true, stdio: 'ignore' })
    child.on('error', () => console.log(`Open it yourself: ${file}`))
    child.unref()
  } catch {
    console.log(`Open it yourself: ${file}`)
  }
}

// ---------------------------------------------------------------------------- main
const selected = SCREENS.filter((s) => !only || `${s.role}-${s.screen}`.includes(only))
if (!selected.length) {
  console.error(`No screens match --only=${only}`)
  process.exit(1)
}
fs.mkdirSync(SHOTS, { recursive: true })
if (!only) for (const f of fs.readdirSync(SHOTS)) fs.rmSync(path.join(SHOTS, f))

const { url: BASE, server } = await startServer()
const browser = await launch()
const jobs = selected.flatMap((s) => (['light', 'dark'] as Theme[]).flatMap((theme) => (['desktop', 'mobile'] as Device[]).map((device) => ({ s, theme, device }))))
const report: Record<string, Audit & { errors: string[] }> = {}
let done = 0

async function capture({ s, theme, device }: (typeof jobs)[number]) {
  const name = `${s.role}-${s.screen}-${theme}-${device}`
  const ctx = await browser.newContext({ viewport: VIEWPORTS[device], colorScheme: theme, reducedMotion: 'reduce', deviceScaleFactor: 1 })
  // Hide the floating Demo panel in screenshots. (Plain strings: tsx adds a `__name` helper to
  // functions, which does not exist inside the browser page, so we define a no-op for it too.)
  await ctx.addInitScript({ content: "window.__name = function (f) { return f }; try { sessionStorage.setItem('coherent.demo.hideUi', '1') } catch (e) {}" })
  const page = await ctx.newPage()
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  try {
    const sep = s.path.includes('?') ? '&' : '?'
    await page.goto(`${BASE}${s.path}${sep}demo=${s.as ?? 'signed-out'}`)
    await waitReady(page)
    if (s.act) {
      await s.act(page, device)
      await page.waitForTimeout(350)
    }
    report[name] = { ...(await audit(page)), errors }
    await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: !s.viewportOnly })
  } catch (e) {
    report[name] = { overflowX: false, headingFont: '', bodyFont: '', loadedFonts: [], clipped: [], errors: [...errors, `capture failed: ${(e as Error).message.split('\n')[0]}`] }
  } finally {
    await ctx.close()
    done++
    if (process.stdout.isTTY) process.stdout.write(`\r  ${done}/${jobs.length} screenshots`)
    else if (done % 34 === 0 || done === jobs.length) console.log(`  ${done}/${jobs.length} screenshots`)
  }
}

console.log(`Capturing ${jobs.length} screenshots from ${BASE} (demo mode)…`)
const queue = [...jobs]
await Promise.all(Array.from({ length: 4 }, async () => {
  while (queue.length) await capture(queue.shift()!)
}))
console.log('')
await browser.close()
await server?.close()

// ---------------------------------------------------------------------------- report
const existingReport = only && fs.existsSync(path.join(OUT, 'report.json')) ? JSON.parse(fs.readFileSync(path.join(OUT, 'report.json'), 'utf8')) : {}
const fullReport = { ...existingReport, ...report }
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(fullReport, null, 2))
const issues: string[] = []
for (const [name, r] of Object.entries(report)) {
  if (r.errors.length) issues.push(`${name}: ${r.errors.join(' | ')}`)
  if (r.overflowX) issues.push(`${name}: page scrolls sideways`)
  if (r.clipped.length) issues.push(`${name}: clipped content in ${r.clipped.join(', ')}`)
  if (r.headingFont && !/DM Sans/.test(r.headingFont)) issues.push(`${name}: heading font is ${r.headingFont}`)
  if (r.bodyFont && !/Inter/.test(r.bodyFont)) issues.push(`${name}: body font is ${r.bodyFont}`)
  if (r.loadedFonts.length && !(r.loadedFonts.some((f) => f.includes('DM Sans')) && r.loadedFonts.some((f) => f.includes('Inter'))))
    issues.push(`${name}: fonts actually loaded: ${r.loadedFonts.join(', ')}`)
}

// ---------------------------------------------------------------------------- preview page
const ROLES: { id: Role; title: string; intro: string }[] = [
  { id: 'public', title: 'Public', intro: 'Pages anyone can open: the landing page, login and signup.' },
  { id: 'client', title: 'Client', intro: 'The client portal. Calm, simple screens with plain-English labels.' },
  { id: 'team', title: 'Team', intro: 'Daily tools for the Coherent team. Denser, built for speed.' },
  { id: 'admin', title: 'Admin', intro: 'Everything the team sees, plus people, workload and the audit trail.' },
  { id: 'pending', title: 'Pending user', intro: 'Someone who signed up as team without an invite.' },
]

const allShots = fs.readdirSync(SHOTS).filter((f) => f.endsWith('.png'))
const card = (s: Screen) => {
  const variants = (['light', 'dark'] as Theme[]).flatMap((theme) =>
    (['desktop', 'mobile'] as Device[]).map((device) => ({ theme, device, file: `${s.role}-${s.screen}-${theme}-${device}.png` })),
  ).filter((v) => allShots.includes(v.file))
  if (!variants.length) return ''
  return `
      <article class="screen">
        <h3>${esc(s.title)}</h3>
        <p class="caption">${esc(s.caption)}</p>
        <div class="shots">${variants
          .map(
            (v) => `
          <a class="shot ${v.device}" data-theme="${v.theme}" data-device="${v.device}" href="screenshots/${v.file}" target="_blank" rel="noopener">
            <img loading="lazy" src="screenshots/${v.file}" alt="${esc(s.title)}, ${v.theme} theme, ${v.device}">
            <span class="tag">${v.theme} · ${v.device}</span>
          </a>`,
          )
          .join('')}
        </div>
      </article>`
}

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Coherent App Preview</title>
<style>
  :root {
    --bg: #ffffff; --surface: #f6f7f9; --text: #0f1419; --muted: #5b6670; --border: #e3e6ea; --accent: #2f5bff; --accent-text: #ffffff;
    --display: 'DM Sans Variable', 'DM Sans', ui-sans-serif, system-ui, sans-serif;
    --body: 'Inter Variable', 'Inter', ui-sans-serif, system-ui, sans-serif;
    color-scheme: light;
  }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
    --bg: #0d1014; --surface: #151a20; --text: #eef1f4; --muted: #9aa5b1; --border: #252c34; --accent: #6f8cff; --accent-text: #0d1014; color-scheme: dark; } }
  :root[data-theme="dark"] { --bg: #0d1014; --surface: #151a20; --text: #eef1f4; --muted: #9aa5b1; --border: #252c34; --accent: #6f8cff; --accent-text: #0d1014; color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text); font: 15px/1.6 var(--body); }
  .wrap { max-width: 1320px; margin: 0 auto; padding-inline: 20px; }
  h1, h2, h3 { font-family: var(--display); letter-spacing: -0.01em; text-wrap: balance; margin: 0; }
  header.top { padding-block: 40px 20px; display: grid; gap: 10px; }
  header.top h1 { font-size: clamp(28px, 4vw, 40px); }
  header.top p { margin: 0; color: var(--muted); max-width: 70ch; }
  .bar { position: sticky; top: 0; z-index: 2; background: var(--bg); border-block: 1px solid var(--border); }
  .bar .wrap { display: flex; flex-wrap: wrap; gap: 10px 22px; align-items: center; padding-block: 10px; }
  .filter { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--muted); }
  .seg { display: inline-flex; padding: 3px; gap: 2px; border: 1px solid var(--border); border-radius: 999px; background: var(--surface); }
  .seg button { border: 0; background: none; color: var(--muted); font: 500 13px/1 var(--body); padding: 7px 12px; border-radius: 999px; cursor: pointer; }
  .seg button[aria-pressed="true"] { background: var(--accent); color: var(--accent-text); }
  .seg button:focus-visible, a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  nav.jump { margin-left: auto; display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 13px; }
  nav.jump a { color: var(--muted); text-decoration: none; }
  nav.jump a:hover { color: var(--text); }
  section.role { padding-block: 36px 8px; }
  section.role > h2 { font-size: 26px; }
  section.role > p { margin: 4px 0 20px; color: var(--muted); }
  .screen { padding-block: 18px 26px; border-top: 1px solid var(--border); }
  .screen h3 { font-size: 18px; }
  .caption { margin: 4px 0 14px; color: var(--muted); max-width: 75ch; }
  .shots { display: flex; flex-wrap: wrap; gap: 14px; align-items: flex-start; }
  .shot { position: relative; display: block; border: 1px solid var(--border); border-radius: 10px; overflow: hidden; background: var(--surface); }
  .shot.desktop { width: min(560px, 100%); }
  .shot.mobile { width: min(200px, 46%); }
  .shot img { display: block; width: 100%; height: auto; max-height: 520px; object-fit: cover; object-position: top; }
  .shot.mobile img { max-height: 430px; }
  .shot .tag { position: absolute; left: 8px; bottom: 8px; font-size: 11px; padding: 2px 8px; border-radius: 999px; background: var(--bg); color: var(--text); border: 1px solid var(--border); }
  .shot[hidden] { display: none; }
  .empty { color: var(--muted); }
  footer { padding-block: 30px 50px; color: var(--muted); font-size: 13px; border-top: 1px solid var(--border); margin-top: 30px; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.9em; }
</style>
</head>
<body>
<div class="wrap">
  <header class="top">
    <h1>Coherent Agency App preview</h1>
    <p>Every main screen, captured in demo mode with fake data (no real clients). Click any image to open it full size.
      Generated ${esc(new Date().toISOString().slice(0, 16).replace('T', ' '))} UTC · ${allShots.length} screenshots.</p>
  </header>
</div>
<div class="bar">
  <div class="wrap">
    <div class="filter"><span id="l-theme">Theme</span>
      <div class="seg" role="group" aria-labelledby="l-theme" data-filter="theme">
        <button type="button" data-value="all" aria-pressed="false">Both</button>
        <button type="button" data-value="light" aria-pressed="true">Light</button>
        <button type="button" data-value="dark" aria-pressed="false">Dark</button>
      </div>
    </div>
    <div class="filter"><span id="l-device">Device</span>
      <div class="seg" role="group" aria-labelledby="l-device" data-filter="device">
        <button type="button" data-value="all" aria-pressed="true">Both</button>
        <button type="button" data-value="desktop" aria-pressed="false">Desktop</button>
        <button type="button" data-value="mobile" aria-pressed="false">Mobile</button>
      </div>
    </div>
    <nav class="jump" aria-label="Roles">${ROLES.map((r) => `<a href="#${r.id}">${r.title}</a>`).join('')}</nav>
  </div>
</div>
<main class="wrap">${ROLES.map(
  (r) => `
  <section class="role" id="${r.id}">
    <h2>${r.title}</h2>
    <p>${esc(r.intro)}</p>${SCREENS.filter((s) => s.role === r.id).map(card).join('')}
  </section>`,
).join('')}
  <footer>Re-create this page with <code>npm run screenshots</code>. Only one area? <code>npm run screenshots -- --only=client-access</code>.
    Brand colors and logo are placeholders until they are set in <code>src/styles/brand.ts</code>.</footer>
</main>
<script>
  (function () {
    var state = { theme: 'light', device: 'all' };
    function apply() {
      document.querySelectorAll('.shot').forEach(function (el) {
        var okT = state.theme === 'all' || el.dataset.theme === state.theme;
        var okD = state.device === 'all' || el.dataset.device === state.device;
        el.hidden = !(okT && okD);
      });
    }
    document.querySelectorAll('.seg').forEach(function (seg) {
      seg.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        state[seg.dataset.filter] = b.dataset.value;
        seg.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        apply();
      });
    });
    apply();
  })();
</script>
</body>
</html>
`
fs.writeFileSync(path.join(OUT, 'index.html'), html)

console.log(`\nSaved ${Object.keys(report).length} screenshots to preview/screenshots/`)
console.log(`Preview page: ${path.join(OUT, 'index.html')}`)
if (issues.length) {
  console.log(`\nAutomatic checks found ${issues.length} issue(s):\n  - ${issues.join('\n  - ')}`)
} else {
  console.log('Automatic checks: no sideways scrolling, no clipped content, DM Sans headings and Inter body text on every shot, no page errors.')
}
if (!noOpen) openFile(path.join(OUT, 'index.html'))
process.exit(Object.values(report).some((r) => r.errors.some((e) => e.startsWith('capture failed'))) ? 1 : 0)
