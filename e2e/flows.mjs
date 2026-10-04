import { chromium } from 'playwright'
import { execSync } from 'node:child_process'

const BASE = process.env.BASE_URL ?? 'http://localhost:5173'
const MAILPIT = 'http://127.0.0.1:54324'
const q = (sql) => execSync(`psql -At postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "${sql.replace(/"/g, '\\"')}"`).toString().trim()
const P1 = q("select id from projects where name='Acme Bakery website'")
const P2 = q("select id from projects where name='Northwind SEO audit'")
let failures = 0
const visible = (loc) => loc.first().waitFor({ timeout: 8000 }).then(() => true, () => false)
const check = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) failures++ }

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
const errors = []
async function login(email) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(`${email}: ${e.message}`))
  await page.goto(`${BASE}/login`)
  await page.locator('summary', { hasText: 'Developer login' }).click()
  await page.fill('#dev-email', email)
  await page.fill('#dev-password', 'Password123!')
  await page.click('text=Log in with password')
  await page.waitForURL((u) => !u.pathname.startsWith('/login'))
  return page
}
async function magicLink(email) {
  for (let i = 0; i < 20; i++) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent('to:' + email)}`).then((r) => r.json())
    if (res.messages?.length) {
      const msg = await fetch(`${MAILPIT}/api/v1/message/${res.messages[0].ID}`).then((r) => r.json())
      const m = msg.Text.match(/https?:\/\/\S+verify\S+/) || msg.HTML.match(/href="([^"]+verify[^"]+)"/)
      return (m[1] ?? m[0]).replace(/&amp;/g, '&')
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error('no email for ' + email)
}

// --- Landing → login role
{
  const ctx = await browser.newContext(); const page = await ctx.newPage()
  await page.goto(BASE)
  await page.getByTestId('role-card-team').click()
  await page.waitForURL(/\/login\?role=team/)
  check(await visible(page.getByRole('heading', { name: 'Team login' })), 'landing team card → Team login')
  await page.goto(BASE)
  await page.getByTestId('role-card-client').waitFor()
  let focused = null
  for (let i = 0; i < 8 && focused !== 'role-card-client'; i++) {
    await page.keyboard.press('Tab')
    focused = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'))
  }
  await page.keyboard.press('Enter'); await page.waitForURL(/\/login\?role=/)
  check(focused === 'role-card-client' && page.url().includes('role=client'), `client card reachable by keyboard (focused=${focused})`)
  // unknown email
  await page.fill('#login-email', 'nobody-here@unknown.test')
  await page.click('text=Send me a login link')
  await page.getByTestId('not-found').waitFor()
  check(await visible(page.getByText('We could not find an account for this email.')), 'unknown email → friendly not-found message')
  await page.getByRole('link', { name: 'Create account' }).first().click()
  await page.waitForURL(/\/signup/)
  check((await page.inputValue('#email')) === 'nobody-here@unknown.test', 'Create account pre-fills the email on signup')
  await ctx.close()
}

// --- Client signup via real magic link
const newClient = `flow-client-${Date.now()}@client.test`
{
  const ctx = await browser.newContext(); const page = await ctx.newPage()
  await page.goto(`${BASE}/signup?role=client`)
  await page.fill('#fullName', 'Flow Client'); await page.fill('#company', 'Flow Co'); await page.fill('#email', newClient)
  await page.click('button:has-text("Create account")')
  await page.getByRole('heading', { name: 'Check your email' }).waitFor()
  check(await visible(page.getByText(/You can resend in \d+s/)), 'check-email screen with resend cooldown')
  const link = await magicLink(newClient)
  await page.goto(link)
  await page.waitForURL(/\/client$/, { timeout: 15000 })
  check(await visible(page.getByText('The Coherent team is setting up your project')), 'new client lands on welcome empty state')
  check(q(`select role||'/'||status||'/'||coalesce(org_id::text,'null') from profiles where email='${newClient}'`) === 'client/approved/null', 'client profile: role client, org_id NULL')
  for (const p of ['/', '/login', '/signup']) { await page.goto(BASE + p); await page.waitForURL(/\/client$/) }
  check(true, 'signed-in client redirected away from /, /login, /signup')
  await ctx.close()
}

// --- Team signup (not invited) → pending
const newTeam = `flow-team-${Date.now()}@coherent.test`
{
  const ctx = await browser.newContext(); const page = await ctx.newPage()
  await page.goto(`${BASE}/signup?role=team`)
  check(!(await page.locator('#company').count()), 'team signup has no company field')
  await page.fill('#fullName', 'Flow Team'); await page.fill('#email', newTeam)
  await page.click('button:has-text("Create account")')
  await page.getByRole('heading', { name: 'Check your email' }).waitFor()
  await page.goto(await magicLink(newTeam))
  await page.waitForURL(/\/pending$/, { timeout: 15000 })
  check(await visible(page.getByText('Your account is waiting for approval')), 'non-invited team signup → /pending')
  await page.goto(`${BASE}/team`); await page.waitForURL(/\/pending$/)
  check(true, 'pending user cannot open /team')
  await ctx.close()
}

// --- Admin approves the pending member and links the new client
{
  const admin = await login('will@coherent.test')
  await admin.goto(`${BASE}/admin/users?tab=pending`)
  const row = admin.locator('li', { hasText: newTeam })
  await row.getByRole('button', { name: 'Approve as team' }).click()
  await admin.getByText(/is now on the team/).waitFor()
  check(q(`select role||'/'||status from profiles where email='${newTeam}'`) === 'team/approved', 'admin approved pending team member')
  await admin.goto(`${BASE}/admin/users?tab=clients`)
  const crow = admin.locator('li', { hasText: newClient })
  await crow.locator('select').selectOption({ label: 'Link to Acme Bakery' })
  await crow.getByRole('button', { name: 'Link' }).click()
  await admin.getByText(/is linked/).waitFor()
  check(q(`select o.name from profiles p join organizations o on o.id=p.org_id where p.email='${newClient}'`) === 'Acme Bakery', 'admin linked new client to Acme Bakery')
  check(Number(q(`select count(*) from email_outbox where to_email='${newClient}' and kind='client_linked'`)) === 1, 'linked client gets an email queued')
  await admin.context().close()
}

// --- Realtime bell + Let's Go
{
  const sadman = await login('sadman@coherent.test')
  await sadman.goto(`${BASE}/team`)
  await sadman.waitForTimeout(1500) // let the realtime channel subscribe
  const before = await sadman.locator('button[aria-label^="Notifications"]').getAttribute('aria-label')

  const maya = await login('maya@acmebakery.test')
  await maya.goto(`${BASE}/client/projects/${P1}/access`)
  check(await maya.getByRole('button', { name: "Let's Go" }).isDisabled(), "Let's Go disabled while Webflow is pending")
  await maya.fill('#field-webflow-value', 'acme-bakery.webflow.io')
  await maya.getByLabel("I've done this").check()
  await maya.getByText('Saved').waitFor()
  await maya.reload()
  check((await maya.inputValue('#field-webflow-value')) === 'acme-bakery.webflow.io', 'autosave persisted after reload')
  // secret guard
  await maya.goto(`${BASE}/client/projects/${P1}/access?step=2`)
  await maya.fill('#field-gtm-value', 'password: hunter2')
  await maya.getByText(/looks like a password/).first().waitFor()
  check(q(`select coalesce(value_text,'') from access_steps where project_id='${P1}' and key='gtm'`) === '', 'password-looking value is never saved')
  await maya.fill('#field-gtm-value', '')
  // skipped requires note
  await maya.goto(`${BASE}/client/projects/${P1}/access?step=4`)
  await maya.getByLabel('Already shared before').check()
  await maya.waitForTimeout(1200)
  check(q(`select status from access_steps where project_id='${P1}' and key='gsc'`) === 'pending', 'skipped without note is not saved yet')
  await maya.fill('#note-gsc', 'Sent to Ashik on Monday')
  await maya.getByText('Saved').waitFor()
  check(q(`select status||'/'||provided_by from access_steps where project_id='${P1}' and key='gsc'`) === 'skipped/client', 'skipped with note saved, provided_by=client')

  const go = maya.getByRole('button', { name: "Let's Go" })
  check(await go.isEnabled(), "Let's Go enabled once Webflow is provided (others pending → warning)")
  check(await visible(maya.getByText('Some steps are still not done')), 'pending steps warning shown')
  await go.click()
  await maya.getByRole('dialog').getByText('These steps are still not done').waitFor()
  await maya.getByRole('button', { name: 'Yes, start the project' }).click()
  await maya.getByTestId('kickoff-done').waitFor()
  check(q(`select status from projects where id='${P1}'`) === 'kickoff_confirmed', 'project status = kickoff_confirmed')

  await sadman.waitForTimeout(2500)
  const after = await sadman.locator('button[aria-label^="Notifications"]').getAttribute('aria-label')
  check(before !== after && /unread/.test(after), `team bell updated in realtime (${before} → ${after})`)
  await sadman.locator('button[aria-label^="Notifications"]').click()
  check(await visible(sadman.getByText(/is ready to start Acme Bakery website/).first()), 'kickoff notification visible in bell dropdown')

  // --- client feed shows "Project started"
  await maya.goto(`${BASE}/client/projects/${P1}`)
  check(await visible(maya.getByText('Project started')), 'timeline shows "Project started"')
  await maya.context().close(); await sadman.context().close()
}

// --- Timer: start, switch (no gap), stop + submit to client
{
  const ashik = await login('ashik@coherent.test')
  await ashik.goto(`${BASE}/team`)
  await ashik.getByRole('button', { name: 'Start timer' }).first().click()
  await ashik.locator('#timer-project').selectOption({ label: 'Acme Bakery website' })
  await ashik.getByRole('dialog').getByRole('button', { name: 'Start' }).click()
  await ashik.getByLabel('Time tracker').waitFor()
  await ashik.waitForTimeout(1200)
  await ashik.getByRole('button', { name: 'Switch project' }).click()
  await ashik.locator('#timer-project').selectOption({ label: 'Northwind SEO audit' })
  await ashik.fill('#timer-note', 'Header done, footer next')
  await ashik.getByRole('button', { name: 'Switch now' }).click()
  await ashik.getByText('Switched project.').waitFor()
  const rows = q(`select to_char(started_at,'HH24:MI:SS.US')||'|'||coalesce(to_char(ended_at,'HH24:MI:SS.US'),'running')||'|'||coalesce(handoff_note,'') from time_entries t join profiles p on p.id=t.user_id where p.email='ashik@coherent.test' order by started_at desc limit 2`).split('\n')
  const [newer, older] = rows.map((r) => r.split('|'))
  check(newer[1] === 'running' && older[1] === newer[0] && older[2] === 'Header done, footer next', `switch: old ended exactly when new started (${older[1]} = ${newer[0]})`)
  await ashik.getByRole('button', { name: 'Stop timer' }).click()
  await ashik.getByRole('dialog').getByRole('button', { name: 'Stop timer' }).click()
  await ashik.getByText('Timer stopped.').waitFor()
  check(q(`select count(*) from time_entries t join profiles p on p.id=t.user_id where p.email='ashik@coherent.test' and ended_at is null`) === '0', 'stop: no running timer')

  await ashik.goto(`${BASE}/team/projects/${P1}`)
  await ashik.getByRole('button', { name: 'Submit to client' }).first().click()
  await ashik.fill('#update-message', 'Home page design complete')
  await ashik.getByRole('button', { name: 'Share with client' }).click()
  await ashik.getByText('Shared with the client.').waitFor()
  check(Number(q(`select count(*) from notifications n join profiles p on p.id=n.user_id where p.email='maya@acmebakery.test' and n.type='new_update' and n.body like '%Home page design complete%'`)) === 1, 'client notified of new update')
  await ashik.context().close()
}

// --- Approval toggle
{
  q(`update projects set require_admin_approval = true where id='${P2}'`)
  const ashik = await login('ashik@coherent.test')
  await ashik.goto(`${BASE}/team/projects/${P2}`)
  await ashik.getByRole('button', { name: 'Submit to client' }).first().click()
  await ashik.fill('#update-message', 'Audit draft ready for review')
  await ashik.getByRole('button', { name: 'Send for approval' }).click()
  await ashik.getByText('Sent to an admin for approval.').waitFor()
  const leo = await login('leo@northwind.test')
  await leo.goto(`${BASE}/client/projects/${P2}`)
  check(!(await leo.getByText('Audit draft ready for review').count()), 'client does not see pending-approval update')
  const admin = await login('will@coherent.test')
  await admin.goto(`${BASE}/admin/approvals`)
  await admin.locator('li', { hasText: 'Audit draft ready for review' }).getByRole('button', { name: 'Approve' }).click()
  await admin.getByText(/Approved/).first().waitFor()
  await leo.reload()
  check(await visible(leo.getByText('Audit draft ready for review')), 'client sees update after admin approval')
  for (const p of [ashik, leo, admin]) await p.context().close()
}

await browser.close()
console.log(errors.length ? `PAGE ERRORS:\n${errors.join('\n')}` : 'No page errors.')
console.log(failures ? `${failures} FAILED` : 'ALL FLOWS PASSED')
process.exit(failures ? 1 : 0)
