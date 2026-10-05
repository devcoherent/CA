// Screenshot gallery of the running app: every main screen per role, light + dark, plus phone width.
// Usage: npm run preview:local   (terminal 1, starts backend + app with seed data)
//        npm run preview:gallery (terminal 2) → open preview/index.html
// Env: BASE_URL (default http://localhost:5173), CHROMIUM_PATH (optional), DB_URL (default local Supabase).
// Read-only except: starts a timer for Ashik so the header shows a running timer.
import { chromium } from 'playwright'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.BASE_URL ?? 'http://localhost:5173'
const DB_URL = process.env.DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const OUT = path.resolve('preview')
const SHOTS = path.join(OUT, 'shots')
fs.rmSync(OUT, { recursive: true, force: true })
fs.mkdirSync(SHOTS, { recursive: true })

const sql = (q) => execSync(`psql -At "${DB_URL}" -c "${q}"`).toString().trim()
const P1 = sql("select id from projects where name='Acme Bakery website'")
const P2 = sql("select id from projects where name='Northwind SEO audit'")
const ORG1 = sql("select id from organizations where name='Acme Bakery'")
if (!P1 || !P2) throw new Error('Seed data not found. Run `npm run preview:local` (or `supabase db reset`) first.')

/** Screens to capture. `as` = seeded login (null = logged out). `prep` runs after navigation. */
const SECTIONS = [
  {
    id: 'public', title: 'Public pages', who: 'Anyone', login: null,
    intro: 'What a visitor sees before logging in. The role choice only changes wording; the database decides the real role.',
    screens: [
      { key: 'landing', title: 'Landing page', path: '/', note: 'Two clear choices, a three-step "How it works", support email in the footer.' },
      { key: 'login', title: 'Client login', path: '/login?role=client', note: 'Magic link only. A wrong role is one click away ("Not a client? Team login").' },
      { key: 'signup', title: 'Client signup', path: '/signup?role=client', note: 'Name, company and email. Only name and company are sent as metadata.' },
      {
        key: 'notfound', title: 'Unknown email', path: '/login?role=client', note: 'A friendly "We could not find an account" with a Create account button.',
        prep: async (page) => {
          await page.fill('#login-email', 'someone-new@example.com')
          await page.click('text=Send me a login link')
          await page.getByTestId('not-found').waitFor()
        },
      },
    ],
  },
  {
    id: 'client', title: 'Client portal', who: 'maya@acmebakery.test / leo@northwind.test',
    intro: 'Simple, friendly screens. Clients never see internal notes, hours or other clients.',
    screens: [
      { key: 'client-home', as: 'maya@acmebakery.test', title: 'Dashboard', path: '/client', note: 'Project card with stage, progress, due-date countdown and the next step.' },
      { key: 'client-project', as: 'leo@northwind.test', title: 'Project page', path: `/client/projects/${P2}`, note: 'Stage timeline with the current stage highlighted, "This week" summary and the update feed.' },
      { key: 'client-access', as: 'maya@acmebakery.test', title: 'Share access', path: `/client/projects/${P1}/access`, note: 'One step per screen, autosave, "Never share passwords here". Let\'s Go stays locked until Webflow is shared.' },
      { key: 'client-access-review', as: 'maya@acmebakery.test', title: 'Access review', path: `/client/projects/${P1}/access?step=6`, note: 'Every step with its status, then the Let\'s Go kickoff panel.' },
      { key: 'client-qa', as: 'maya@acmebakery.test', title: 'Review and feedback', path: `/client/projects/${P1}/qa`, note: 'Link to Webvizio plus a four-step guide (editable in src/content/qaGuide.ts).' },
      { key: 'client-request', as: 'maya@acmebakery.test', title: 'Ask for something', path: '/client/request', note: 'Request or bug report. Admins get a notification.' },
      { key: 'client-profile', as: 'maya@acmebakery.test', title: 'Profile and company', path: '/client/profile', note: 'Photo, name, timezone, theme, plus company logo, bio and billing email.' },
      { key: 'client-new', as: 'newclient@freshco.test', title: 'New client, not linked yet', path: '/client', note: 'What a fresh signup sees until an admin links them to an organization.' },
      { key: 'pending', as: 'pending@coherent.test', title: 'Pending team signup', path: '/pending', note: 'Uninvited team signups wait here and can read nothing.' },
    ],
  },
  {
    id: 'team', title: 'Team tools', who: 'ashik@coherent.test (assigned to both projects)',
    intro: 'Denser screens for daily work. The timer in the top bar is running here.',
    screens: [
      { key: 'team-home', as: 'ashik@coherent.test', title: 'My projects', path: '/team', note: 'Only assigned projects, with status, stage, due date, progress and my open tasks.' },
      { key: 'team-board', as: 'ashik@coherent.test', title: 'Task board', path: `/team/projects/${P2}`, note: 'To do, Doing, Done. Move with arrows or drag; "Submit to client" on every card.' },
      {
        key: 'team-submit', as: 'ashik@coherent.test', title: 'Submit to client', path: `/team/projects/${P2}`, viewportOnly: true,
        note: 'A short client-friendly message that lands in the client\'s feed and inbox.',
        prep: async (page) => {
          await page.getByRole('button', { name: 'Submit to client' }).first().click()
          await page.fill('#update-message', 'Technical audit findings are ready for your review')
        },
      },
      { key: 'team-updates', as: 'ashik@coherent.test', title: 'Client updates', path: `/team/projects/${P2}?tab=updates`, note: 'Everything shared with the client, with approval status.' },
      { key: 'team-notes', as: 'ashik@coherent.test', title: 'Internal notes', path: `/team/projects/${P2}?tab=notes`, note: 'Team-only notes. Clients never see them (enforced in the database).' },
      { key: 'team-access', as: 'ashik@coherent.test', title: 'Access steps', path: `/team/projects/${P2}?tab=access`, note: 'What the client shared. Team can mark a step verified.' },
      { key: 'team-stages', as: 'ashik@coherent.test', title: 'Stages', path: `/team/projects/${P2}?tab=stages`, note: 'Finish the current stage and start the next; the client is notified.' },
    ],
  },
  {
    id: 'admin', title: 'Admin', who: 'will@coherent.test',
    intro: 'Everything the team sees on all projects, plus people, workload and the audit trail.',
    screens: [
      { key: 'admin-workload', as: 'will@coherent.test', title: 'Workload', path: '/admin', note: 'Who is working now, hours today, this week and per project. Auto-stopped entries are highlighted. CSV export.' },
      { key: 'admin-pending', as: 'will@coherent.test', title: 'Pending team members', path: '/admin/users?tab=pending', note: 'Approve or reject uninvited team signups.' },
      { key: 'admin-clients', as: 'will@coherent.test', title: 'New clients', path: '/admin/users?tab=clients', note: 'Link a new client to an organization, or create one from the company name they typed.' },
      { key: 'admin-invites', as: 'will@coherent.test', title: 'Invites', path: '/admin/users?tab=invites', note: 'Invited emails get their role automatically when they sign up.' },
      { key: 'admin-org', as: 'will@coherent.test', title: 'Organization', path: `/admin/orgs/${ORG1}`, note: 'Edit a client\'s company and people on their behalf.' },
      { key: 'admin-newproject', as: 'will@coherent.test', title: 'New project', path: '/admin/projects/new', note: 'Pick a template; stages, tasks and access steps are created for you.' },
      { key: 'admin-settings', as: 'will@coherent.test', title: 'Project settings', path: `/team/projects/${P1}?tab=settings`, note: 'Dates, links, the "require admin approval" switch and team assignment.' },
      { key: 'admin-templates', as: 'will@coherent.test', title: 'Templates', path: '/admin/templates', note: 'Default stages, tasks and access steps for each project type.' },
      { key: 'admin-audit', as: 'will@coherent.test', title: 'Audit log', path: '/admin/audit', note: 'Every change to projects, access steps, due dates and updates, with filters.' },
    ],
  },
  {
    id: 'phone', title: 'On a phone', who: '375 px wide', mobile: true,
    intro: 'Same screens at phone width. Everything stacks; nothing scrolls sideways.',
    screens: [
      { key: 'm-landing', title: 'Landing', path: '/' },
      { key: 'm-client-home', as: 'maya@acmebakery.test', title: 'Dashboard', path: '/client' },
      { key: 'm-client-project', as: 'leo@northwind.test', title: 'Project page', path: `/client/projects/${P2}` },
      { key: 'm-client-access', as: 'maya@acmebakery.test', title: 'Share access', path: `/client/projects/${P1}/access` },
    ],
  },
]

// Give Ashik a running timer so the team screens show it.
sql("delete from time_entries where ended_at is null and user_id = (select id from profiles where email='ashik@coherent.test')")
sql(`insert into time_entries (user_id, project_id, started_at) select id, '${P2}', now() - interval '1 hour 23 minutes' from profiles where email='ashik@coherent.test'`)

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
const problems = []
const contexts = new Map()

async function pageFor(email, theme, mobile) {
  const k = `${email}|${theme}|${mobile}`
  if (contexts.has(k)) return contexts.get(k)
  const ctx = await browser.newContext({
    viewport: mobile ? { width: 375, height: 812 } : { width: 1280, height: 860 },
    deviceScaleFactor: mobile ? 2 : 1,
    colorScheme: theme,
  })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => problems.push(`${email ?? 'public'}: ${e.message}`))
  if (email) {
    await page.goto(`${BASE}/login`)
    await page.locator('summary', { hasText: 'Developer login' }).click()
    await page.fill('#dev-email', email)
    await page.fill('#dev-password', 'Password123!')
    await page.click('text=Log in with password')
    await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 15000 })
  }
  contexts.set(k, page)
  return page
}

let count = 0
for (const section of SECTIONS) {
  for (const s of section.screens) {
    for (const theme of ['light', 'dark']) {
      const page = await pageFor(s.as ?? null, theme, Boolean(section.mobile))
      await page.goto(BASE + s.path)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(500)
      if (s.prep) await s.prep(page)
      await page.waitForTimeout(250)
      const file = `${s.key}-${theme}.jpg`
      await page.screenshot({
        path: path.join(SHOTS, file),
        type: 'jpeg',
        quality: 80,
        fullPage: !s.viewportOnly,
      })
      count++
      process.stdout.write(`\r${count} screenshots`)
    }
  }
}
await browser.close()
console.log('')

// ---------------------------------------------------------------------------
// Gallery page. Written without <html>/<head>/<body> so it can also be published
// as a claude.ai Artifact; browsers open it fine as a local file too.
// ---------------------------------------------------------------------------
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const shortPath = (p) => p.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, (m) => `${m.slice(0, 4)}…`)

const figure = (s, mobile) => `
      <figure class="shot${mobile ? ' shot--phone' : ''}">
        <button class="frame" type="button" data-key="${s.key}" aria-label="Open ${esc(s.title)} full size">
          <span class="bar" aria-hidden="true"><span class="dots"><i></i><i></i><i></i></span><span class="url">${esc(shortPath(s.path))}</span></span>
          <img loading="lazy" alt="${esc(s.title)} screen" data-key="${s.key}" src="shots/${s.key}-light.jpg">
        </button>
        <figcaption><strong>${esc(s.title)}</strong>${s.note ? `<span>${esc(s.note)}</span>` : ''}</figcaption>
      </figure>`

const sectionHtml = (sec) => `
  <section id="${sec.id}" aria-labelledby="${sec.id}-h">
    <header class="sec-head">
      <h2 id="${sec.id}-h">${esc(sec.title)}</h2>
      <p>${esc(sec.intro)}</p>
      <p class="who">${sec.mobile ? '' : 'Logged in as '}<code>${esc(sec.who)}</code></p>
    </header>
    <div class="grid${sec.mobile ? ' grid--phone' : ''}">${sec.screens.map((s) => figure(s, sec.mobile)).join('')}
    </div>
  </section>`

const generated = new Date().toISOString().slice(0, 16).replace('T', ' ')
const html = `<title>Coherent Portal Preview</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,500;9..40,600;9..40,700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap">
<style>
  /* Layout: a review board. Sticky toolbar (screen theme + jump links), then one section per role,
     each a two-column grid of browser-framed screenshots; phone shots sit four across. Uses the app's own tokens. */
  :root {
    --bg: #ffffff; --surface: #f6f7f9; --frame: #eceff3; --text: #0f1419; --muted: #5b6670;
    --border: #e3e6ea; --accent: #2f5bff; --accent-text: #ffffff; --shadow: 0 1px 2px rgba(15,20,25,.06), 0 8px 24px rgba(15,20,25,.06);
    --font-display: 'DM Sans', ui-sans-serif, system-ui, sans-serif;
    --font-body: 'Inter', ui-sans-serif, system-ui, sans-serif;
    --font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
    color-scheme: light;
  }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
    --bg: #0d1014; --surface: #151a20; --frame: #1c232b; --text: #eef1f4; --muted: #9aa5b1;
    --border: #252c34; --accent: #6f8cff; --accent-text: #0d1014; --shadow: 0 1px 2px rgba(0,0,0,.3), 0 8px 24px rgba(0,0,0,.35); color-scheme: dark; } }
  :root[data-theme="dark"] {
    --bg: #0d1014; --surface: #151a20; --frame: #1c232b; --text: #eef1f4; --muted: #9aa5b1;
    --border: #252c34; --accent: #6f8cff; --accent-text: #0d1014; --shadow: 0 1px 2px rgba(0,0,0,.3), 0 8px 24px rgba(0,0,0,.35); color-scheme: dark; }

  * { box-sizing: border-box; }
  body { background: var(--bg); color: var(--text); font: 15px/1.6 var(--font-body); margin: 0; }
  .wrap { max-width: 1240px; margin: 0 auto; padding-inline: clamp(16px, 4vw, 40px); }
  h1, h2 { font-family: var(--font-display); letter-spacing: -0.015em; text-wrap: balance; margin: 0; }
  code { font-family: var(--font-mono); font-size: .82em; }
  a { color: var(--accent); }

  .intro { padding-block: 48px 28px; display: grid; gap: 14px; max-width: 70ch; }
  .eyebrow { font: 600 12px/1 var(--font-body); letter-spacing: .08em; text-transform: uppercase; color: var(--muted); margin: 0; }
  h1 { font-size: clamp(30px, 4.2vw, 44px); line-height: 1.1; font-weight: 700; }
  .intro p { margin: 0; color: var(--muted); }
  .meta { display: flex; flex-wrap: wrap; gap: 8px 18px; font-size: 13px; color: var(--muted); }
  .meta b { color: var(--text); font-weight: 600; }

  .toolbar { position: sticky; top: env(safe-area-inset-top, 0px); z-index: 5; background: color-mix(in srgb, var(--bg) 92%, transparent);
    backdrop-filter: blur(8px); border-block: 1px solid var(--border); }
  .toolbar .wrap { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 20px; padding-block: 10px; }
  .seg { display: inline-flex; border: 1px solid var(--border); border-radius: 999px; padding: 3px; background: var(--surface); }
  .seg button { font: 500 13px/1 var(--font-body); color: var(--muted); background: none; border: 0; border-radius: 999px; padding: 8px 14px; cursor: pointer; }
  .seg button[aria-pressed="true"] { background: var(--accent); color: var(--accent-text); }
  .seg-label { font-size: 13px; color: var(--muted); }
  nav.jump { display: flex; flex-wrap: wrap; gap: 4px 14px; margin-left: auto; font-size: 13px; }
  nav.jump a { color: var(--muted); text-decoration: none; padding: 4px 0; }
  nav.jump a:hover { color: var(--text); }

  section { padding-block: 44px 8px; }
  .sec-head { display: grid; gap: 6px; margin-bottom: 24px; max-width: 72ch; }
  .sec-head h2 { font-size: 26px; font-weight: 600; }
  .sec-head p { margin: 0; color: var(--muted); }
  .sec-head .who code { color: var(--text); background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 2px 6px; }

  .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 28px 24px; }
  .grid--phone { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  @media (max-width: 860px) { .grid { grid-template-columns: minmax(0, 1fr); } .grid--phone { grid-template-columns: repeat(2, minmax(0, 1fr)); } }

  .shot { margin: 0; display: grid; gap: 10px; min-width: 0; }
  .frame { display: block; width: 100%; padding: 0; border: 1px solid var(--border); border-radius: 12px; overflow: hidden;
    background: var(--frame); box-shadow: var(--shadow); cursor: zoom-in; text-align: left; transition: transform .15s ease, border-color .15s ease; }
  .frame:hover { transform: translateY(-2px); border-color: color-mix(in srgb, var(--accent) 45%, var(--border)); }
  .frame:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
  .bar { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-bottom: 1px solid var(--border); }
  .dots { display: inline-flex; gap: 5px; } .dots i { width: 8px; height: 8px; border-radius: 50%; background: var(--border); }
  .url { font: 12px/1 var(--font-mono); color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
  .frame img { display: block; width: 100%; height: 420px; object-fit: cover; object-position: top; background: var(--surface); }
  .shot--phone .frame { border-radius: 22px; }
  .shot--phone .bar { justify-content: center; } .shot--phone .dots { display: none; }
  .shot--phone .frame img { height: 560px; }
  figcaption { display: grid; gap: 2px; font-size: 14px; }
  figcaption strong { font-family: var(--font-display); font-weight: 600; font-size: 16px; }
  figcaption span { color: var(--muted); }

  footer.page { margin-top: 56px; border-top: 1px solid var(--border); padding-block: 24px 40px; color: var(--muted); font-size: 13px; }
  footer.page code { color: var(--text); }

  dialog { border: 0; padding: 0; width: min(1320px, 96vw); max-height: 92vh; background: var(--bg); color: var(--text); border-radius: 14px; box-shadow: 0 30px 80px rgba(0,0,0,.45); }
  dialog::backdrop { background: rgba(8, 10, 14, .7); }
  .lb-head { position: sticky; top: 0; display: flex; align-items: center; gap: 12px; padding: 10px 14px; background: var(--surface); border-bottom: 1px solid var(--border); }
  .lb-head strong { font-family: var(--font-display); }
  .lb-head button { margin-left: auto; font: 500 13px/1 var(--font-body); background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 8px; padding: 8px 12px; cursor: pointer; }
  .lb-body { overflow: auto; max-height: calc(92vh - 50px); }
  .lb-body img { display: block; width: 100%; height: auto; }
  .lb-body.phone { display: flex; justify-content: center; background: var(--surface); padding-block: 16px; }
  .lb-body.phone img { width: min(400px, 100%); border-radius: 18px; }
  @media (prefers-reduced-motion: reduce) { .frame { transition: none; } .frame:hover { transform: none; } }
</style>

<div class="wrap">
  <header class="intro">
    <p class="eyebrow">app.coherent.agency · local preview</p>
    <h1>Coherent Agency App</h1>
    <p>Every main screen of the client portal and the team dashboard, captured from the running app with the seed data
      (Acme Bakery's Webflow build and Northwind's SEO audit). Click any screen to see it full size.</p>
    <div class="meta"><span><b>${SECTIONS.reduce((n, s) => n + s.screens.length, 0)}</b> screens</span><span><b>2</b> themes</span><span>Captured ${generated} UTC</span></div>
  </header>
</div>

<div class="toolbar">
  <div class="wrap">
    <span class="seg-label" id="seg-label">Screens in</span>
    <div class="seg" role="group" aria-labelledby="seg-label">
      <button type="button" id="btn-light" data-theme-choice="light" aria-pressed="true">Light</button>
      <button type="button" id="btn-dark" data-theme-choice="dark" aria-pressed="false">Dark</button>
    </div>
    <nav class="jump" aria-label="Sections">${SECTIONS.map((s) => `<a href="#${s.id}">${esc(s.title)}</a>`).join('')}</nav>
  </div>
</div>

<main class="wrap">${SECTIONS.map(sectionHtml).join('')}
  <footer class="page">
    Generated by <code>npm run preview:gallery</code>. Run the app yourself with <code>npm run preview:local</code>;
    every seeded user's password is <code>Password123!</code>. Brand colors and logo are placeholders until set in <code>src/styles/brand.ts</code>.
  </footer>
</main>

<dialog id="lightbox" aria-labelledby="lb-title">
  <div class="lb-head"><strong id="lb-title"></strong><span class="url" id="lb-url"></span><button type="button" id="lb-close">Close</button></div>
  <div class="lb-body" id="lb-body"><img id="lb-img" alt=""></div>
</dialog>

<script>
  (function () {
    var KEY = 'coherent-preview-theme';
    var current;
    function pageIsDark() {
      var t = document.documentElement.getAttribute('data-theme');
      if (t) return t === 'dark';
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    function setTheme(theme) {
      current = theme;
      document.querySelectorAll('img[data-key]').forEach(function (img) { img.src = 'shots/' + img.dataset.key + '-' + theme + '.jpg'; });
      document.querySelectorAll('[data-theme-choice]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.themeChoice === theme)); });
      try { localStorage.setItem(KEY, theme); } catch (e) {}
    }
    var saved = null;
    try { saved = localStorage.getItem(KEY); } catch (e) {}
    setTheme(saved === 'light' || saved === 'dark' ? saved : (pageIsDark() ? 'dark' : 'light'));
    document.querySelectorAll('[data-theme-choice]').forEach(function (b) {
      b.addEventListener('click', function () { setTheme(b.dataset.themeChoice); });
    });

    var dlg = document.getElementById('lightbox');
    var body = document.getElementById('lb-body');
    document.querySelectorAll('button.frame').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var fig = btn.closest('figure');
        document.getElementById('lb-title').textContent = fig.querySelector('figcaption strong').textContent;
        document.getElementById('lb-url').textContent = btn.querySelector('.url').textContent;
        var img = document.getElementById('lb-img');
        img.src = 'shots/' + btn.dataset.key + '-' + current + '.jpg';
        img.alt = fig.querySelector('figcaption strong').textContent + ' screen, full size';
        body.className = 'lb-body' + (fig.classList.contains('shot--phone') ? ' phone' : '');
        body.scrollTop = 0;
        if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
      });
    });
    document.getElementById('lb-close').addEventListener('click', function () { dlg.close(); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
  })();
</script>
`
fs.writeFileSync(path.join(OUT, 'index.html'), html)
const size = fs.readdirSync(SHOTS).reduce((n, f) => n + fs.statSync(path.join(SHOTS, f)).size, 0)
console.log(`Gallery: ${path.relative(process.cwd(), path.join(OUT, 'index.html'))} (${count} screenshots, ${(size / 1e6).toFixed(1)} MB)`)
if (problems.length) {
  console.log('Page errors:\n' + problems.join('\n'))
  process.exit(1)
}
