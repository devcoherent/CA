/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * DEMO MODE ONLY — fake data. Never imported by the production build.
 * All people, emails (@example.com) and companies are fictional.
 * Dates are relative to "now" so countdowns always look realistic.
 */

export const DEMO_MARKER = 'coherent-demo-mode-data' // scripts/check-prod-bundle.mjs fails if this reaches production

export type Row = Record<string, any>
export type Tables = Record<string, Row[]>

/** People you can switch to from the Demo panel. */
export const DEMO_USERS = [
  { key: 'admin', id: 'u-will', label: 'Admin (Will)' },
  { key: 'sadman', id: 'u-sadman', label: 'Team (Sadman)' },
  { key: 'ashik', id: 'u-ashik', label: 'Team (Ashik)' },
  { key: 'client-a', id: 'u-maya', label: 'Client A (Acme Bakery)' },
  { key: 'client-b', id: 'u-leo', label: 'Client B (Northwind)' },
  { key: 'pending', id: 'u-riley', label: 'Pending team user' },
  { key: 'new-client', id: 'u-nina', label: 'New client (no org)' },
] as const
export type DemoUserKey = (typeof DEMO_USERS)[number]['key']

export function seed(nowMs = Date.now()): Tables {
  const now = new Date(nowMs)
  const H = 3600_000
  const D = 24 * H
  const iso = (ms: number) => new Date(ms).toISOString()
  const ago = (ms: number) => iso(nowMs - ms)
  const day = (offset: number) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  // ---------------------------------------------------------------- people
  const profile = (p: Row): Row => ({
    avatar_url: null, org_id: null, timezone: 'Europe/London', theme_preference: 'system',
    requested_company_name: null, signup_source: 'invite', status: 'approved', created_at: ago(90 * D), ...p,
  })
  const profiles = [
    profile({ id: 'u-will', role: 'admin', full_name: 'Will', email: 'will@example.com' }),
    profile({ id: 'u-sadman', role: 'team', full_name: 'Sadman', email: 'sadman@example.com', timezone: 'Asia/Dhaka' }),
    profile({ id: 'u-ashik', role: 'team', full_name: 'Ashik', email: 'ashik@example.com', timezone: 'Asia/Dhaka' }),
    profile({ id: 'u-maya', role: 'client', full_name: 'Maya Chen', email: 'maya@example.com', org_id: 'org-acme', requested_company_name: 'Acme Bakery', signup_source: 'client_form' }),
    profile({ id: 'u-tom', role: 'client', full_name: 'Tom Reyes', email: 'tom@example.com', org_id: 'org-acme', requested_company_name: 'Acme Bakery', signup_source: 'client_form' }),
    profile({ id: 'u-leo', role: 'client', full_name: 'Leo Martins', email: 'leo@example.com', org_id: 'org-northwind', timezone: 'America/New_York', requested_company_name: 'Northwind Outdoors', signup_source: 'client_form' }),
    profile({ id: 'u-riley', role: 'team', status: 'pending', full_name: 'Riley Park', email: 'riley@example.com', signup_source: 'team_form', created_at: ago(5 * H) }),
    profile({ id: 'u-nina', role: 'client', full_name: 'Nina Okafor', email: 'nina@example.com', requested_company_name: 'Freshleaf Studio', signup_source: 'client_form', created_at: ago(26 * H) }),
  ]

  const organizations = [
    { id: 'org-acme', name: 'Acme Bakery', bio: 'Family bakery with three shops and a growing online order book.', logo_url: null, billing_email: 'accounts@example.com', timezone: 'Europe/London', created_at: ago(40 * D) },
    { id: 'org-northwind', name: 'Northwind Outdoors', bio: 'Outdoor gear for hikers and climbers, sold online and in two stores.', logo_url: null, billing_email: 'billing@example.com', timezone: 'America/New_York', created_at: ago(60 * D) },
  ]

  // ---------------------------------------------------------------- projects
  const project = (p: Row): Row => ({
    current_stage: null, kickoff_confirmed_at: null, kickoff_confirmed_by: null, require_admin_approval: false,
    webvizio_url: null, staging_url: null, last_access_reminder_at: null, created_by: 'u-will', ...p,
  })
  const projects = [
    project({ id: 'p-acme', org_id: 'org-acme', name: 'Acme Bakery website', template: 'webflow_build', status: 'onboarding', start_date: day(3), due_date: day(58), webvizio_url: 'https://app.webvizio.com/', staging_url: 'https://acme-bakery-demo.webflow.io', created_at: ago(4 * D) }),
    project({ id: 'p-seo', org_id: 'org-northwind', name: 'Northwind SEO audit', template: 'seo_audit', status: 'in_progress', current_stage: 'Technical audit', start_date: day(-14), due_date: day(21), kickoff_confirmed_at: ago(13 * D), kickoff_confirmed_by: 'u-leo', staging_url: 'https://northwind-demo.webflow.io', created_at: ago(15 * D) }),
    project({ id: 'p-spring', org_id: 'org-northwind', name: 'Northwind spring campaign site', template: 'webflow_build', status: 'in_progress', current_stage: 'QA', start_date: day(-34), due_date: day(5), kickoff_confirmed_at: ago(33 * D), kickoff_confirmed_by: 'u-leo', require_admin_approval: true, webvizio_url: 'https://app.webvizio.com/', staging_url: 'https://northwind-spring-demo.webflow.io', created_at: ago(36 * D) }),
  ]

  const project_members = [
    { project_id: 'p-acme', user_id: 'u-sadman', added_at: ago(4 * D) },
    { project_id: 'p-acme', user_id: 'u-ashik', added_at: ago(4 * D) },
    { project_id: 'p-seo', user_id: 'u-ashik', added_at: ago(15 * D) },
    { project_id: 'p-spring', user_id: 'u-sadman', added_at: ago(36 * D) },
    { project_id: 'p-spring', user_id: 'u-ashik', added_at: ago(36 * D) },
  ]

  // ---------------------------------------------------------------- stages
  const stageRows = (projectId: string, list: [string, string, number | null, number | null][]) =>
    list.map(([name, status, due, doneAgoDays], i) => ({
      id: `${projectId}-s${i + 1}`, project_id: projectId, name, position: i + 1, status,
      due_date: due === null ? null : day(due),
      started_at: status === 'upcoming' ? null : ago(((doneAgoDays ?? 0) + 6) * D),
      completed_at: status === 'done' ? ago((doneAgoDays ?? 0) * D) : null,
      created_at: ago(40 * D),
    }))
  const project_stages = [
    ...stageRows('p-acme', [['Discovery', 'upcoming', 10, null], ['Design', 'upcoming', 25, null], ['Development', 'upcoming', 45, null], ['QA', 'upcoming', 52, null], ['Launch', 'upcoming', 58, null]]),
    ...stageRows('p-seo', [['Discovery', 'done', -7, 4], ['Technical audit', 'active', 5, null], ['Content audit', 'upcoming', 12, null], ['Report', 'upcoming', 18, null], ['Handover', 'upcoming', 21, null]]),
    ...stageRows('p-spring', [['Discovery', 'done', -28, 27], ['Design', 'done', -18, 17], ['Development', 'done', -3, 2], ['QA', 'active', 3, null], ['Launch', 'upcoming', 5, null]]),
  ]

  // ---------------------------------------------------------------- tasks
  let t = 0
  const task = (projectId: string, stageIdx: number, title: string, status = 'todo', assignee: string | null = null, due: number | null = null): Row => ({
    id: `task-${++t}`, project_id: projectId, stage_id: `${projectId}-s${stageIdx}`, title, description: null,
    assignee_id: assignee, status, due_date: due === null ? null : day(due), position: t, created_at: ago(30 * D), updated_at: ago(2 * D),
  })
  const tasks = [
    task('p-acme', 1, 'Kickoff call', 'todo', 'u-sadman', 4),
    task('p-acme', 1, 'Sitemap and content plan', 'todo', 'u-ashik', 8),
    task('p-acme', 2, 'Home page design', 'todo', 'u-sadman', 18),
    task('p-acme', 2, 'Inner pages design'),
    task('p-acme', 3, 'Style guide and components in Webflow'),
    task('p-acme', 3, 'Build pages in Webflow'),
    task('p-acme', 3, 'CMS setup'),
    task('p-acme', 4, 'Cross-browser and mobile QA'),
    task('p-acme', 5, 'Connect domain and publish'),
    task('p-seo', 1, 'Kickoff call and goals', 'done', 'u-ashik'),
    task('p-seo', 2, 'Crawl the site', 'done', 'u-ashik'),
    task('p-seo', 2, 'Core Web Vitals review', 'doing', 'u-ashik', 2),
    task('p-seo', 2, 'Indexing and sitemap review', 'todo', 'u-ashik', 5),
    task('p-seo', 3, 'Keyword and content gap analysis'),
    task('p-seo', 3, 'On-page review of key pages'),
    task('p-seo', 4, 'Write the audit report'),
    task('p-seo', 5, 'Walkthrough call'),
    task('p-spring', 1, 'Campaign brief and goals', 'done', 'u-sadman'),
    task('p-spring', 2, 'Landing page design', 'done', 'u-sadman'),
    task('p-spring', 3, 'Build landing page in Webflow', 'done', 'u-ashik'),
    task('p-spring', 3, 'Product grid with CMS', 'done', 'u-ashik'),
    task('p-spring', 4, 'Cross-browser and mobile QA', 'doing', 'u-sadman', 2),
    task('p-spring', 4, 'Fix feedback from client review', 'todo', 'u-ashik', 3),
    task('p-spring', 5, 'Connect domain and publish', 'todo', 'u-ashik', 5),
  ]

  // ---------------------------------------------------------------- client updates (activity feed)
  const update = (id: string, projectId: string, author: string, name: string, message: string, hoursAgo: number, extra: Row = {}): Row => ({
    id, project_id: projectId, task_id: null, stage_id: null, author_id: author, author_name: name, message, kind: 'update',
    status: 'published', reviewed_by: null, reviewed_at: null, published_at: ago(hoursAgo * H), created_at: ago(hoursAgo * H), ...extra,
  })
  const client_updates = [
    update('cu-1', 'p-seo', 'u-leo', 'Leo Martins', 'Project started', 13 * 24, { kind: 'milestone', stage_id: 'p-seo-s1' }),
    update('cu-2', 'p-seo', 'u-ashik', 'Ashik', 'Kickoff call done. We agreed on the five pages that matter most.', 11 * 24, { stage_id: 'p-seo-s1' }),
    update('cu-3', 'p-seo', 'u-ashik', 'Ashik', 'Completed the full site crawl. 412 pages checked.', 30, { stage_id: 'p-seo-s2', task_id: 'task-11' }),
    update('cu-4', 'p-seo', 'u-ashik', 'Ashik', 'Core Web Vitals review has started.', 5, { stage_id: 'p-seo-s2' }),
    update('cu-5', 'p-spring', 'u-leo', 'Leo Martins', 'Project started', 33 * 24, { kind: 'milestone', stage_id: 'p-spring-s1' }),
    update('cu-6', 'p-spring', 'u-sadman', 'Sadman', 'Landing page design approved. Moving to development.', 17 * 24, { stage_id: 'p-spring-s2' }),
    update('cu-7', 'p-spring', 'u-ashik', 'Ashik', 'The landing page and product grid are built. Preview link is ready.', 2 * 24, { stage_id: 'p-spring-s3' }),
    update('cu-8', 'p-spring', 'u-sadman', 'Sadman', 'QA started on desktop and mobile. We will share fixes by Thursday.', 20, { stage_id: 'p-spring-s4' }),
    update('cu-9', 'p-spring', 'u-sadman', 'Sadman', 'Mobile menu fixed and checked on iPhone and Android.', 2, { stage_id: 'p-spring-s4', status: 'pending_approval', published_at: null }),
  ]

  const internal_notes = [
    { id: 'n-1', project_id: 'p-seo', author_id: 'u-ashik', body: 'Client CMS has 40 draft items with no meta descriptions. Flag in the report, not urgent.', created_at: ago(28 * H) },
    { id: 'n-2', project_id: 'p-seo', author_id: 'u-will', body: 'Leo prefers a short Loom walkthrough over a long PDF. Keep the report to 10 pages.', created_at: ago(6 * D) },
    { id: 'n-3', project_id: 'p-acme', author_id: 'u-will', body: 'Maya prefers email over calls. Budget is fixed, so keep scope tight.', created_at: ago(3 * D) },
    { id: 'n-4', project_id: 'p-spring', author_id: 'u-sadman', body: 'Launch is Friday. Domain is on the client side, so we need their DNS person on standby.', created_at: ago(1 * D) },
  ]

  // ---------------------------------------------------------------- access steps (mixed statuses)
  const step = (projectId: string, key: string, position: number, status: string, extra: Row = {}): Row => ({
    id: `${projectId}-a-${key}`, project_id: projectId, key, position, status, value_text: null, fields: {}, note: null,
    provided_by: status === 'pending' ? null : 'client', updated_by: null, updated_at: ago(2 * D), ...extra,
  })
  const access_steps = [
    step('p-acme', 'webflow', 1, 'pending'),
    step('p-acme', 'domain_dns', 2, 'provided', { value_text: 'acmebakery.example', fields: { registrar: 'Namecheap' }, updated_by: 'u-maya' }),
    step('p-acme', 'gtm', 3, 'pending'),
    step('p-acme', 'ga4', 4, 'skipped', { note: 'Shared with Sadman by email last Monday', updated_by: 'u-maya' }),
    step('p-acme', 'gsc', 5, 'pending'),
    step('p-acme', 'brand_assets', 6, 'provided', { value_text: 'https://drive.example.com/acme-brand-kit', updated_by: 'u-maya' }),
    step('p-seo', 'webflow', 1, 'verified', { value_text: 'northwind-outdoors', updated_by: 'u-ashik' }),
    step('p-seo', 'domain_dns', 2, 'provided', { value_text: 'northwind.example', fields: { registrar: 'GoDaddy', dns_host: 'Cloudflare' } }),
    step('p-seo', 'gtm', 3, 'provided', { value_text: 'GTM-NW12345' }),
    step('p-seo', 'ga4', 4, 'provided', { value_text: '345678901', provided_by: 'admin', updated_by: 'u-will' }),
    step('p-seo', 'gsc', 5, 'pending'),
    step('p-spring', 'webflow', 1, 'verified', { value_text: 'northwind-spring' }),
    step('p-spring', 'domain_dns', 2, 'verified', { value_text: 'spring.northwind.example', fields: { registrar: 'GoDaddy' } }),
    step('p-spring', 'gtm', 3, 'skipped', { note: 'Same container as the main site, shared in March' }),
    step('p-spring', 'ga4', 4, 'verified', { value_text: '345678901' }),
    step('p-spring', 'gsc', 5, 'provided', { value_text: 'northwind.example' }),
    step('p-spring', 'brand_assets', 6, 'provided', { value_text: 'https://drive.example.com/northwind-spring' }),
  ]

  // ---------------------------------------------------------------- time (one running, one auto-stopped)
  const entry = (id: string, user: string, projectId: string, start: string, end: string | null, extra: Row = {}): Row => ({
    id, user_id: user, project_id: projectId, task_id: null, started_at: start, ended_at: end, auto_stopped: false, handoff_note: null, created_at: start, ...extra,
  })
  // Anchored to "now" (not calendar days) so the default "This week" view always shows them.
  const time_entries = [
    entry('te-1', 'u-ashik', 'p-seo', ago(83 * 60_000), null), // running timer
    entry('te-2', 'u-ashik', 'p-spring', ago(6 * H), ago(3.5 * H), { handoff_note: 'Product grid filters done. Sorting next.' }),
    entry('te-3', 'u-sadman', 'p-spring', ago(5.5 * H), ago(2 * H)),
    entry('te-7', 'u-sadman', 'p-spring', ago(14 * H), ago(6 * H), { auto_stopped: true }), // the 8-hour rule stopped this one
    entry('te-4', 'u-sadman', 'p-acme', ago(27 * H), ago(23 * H), { handoff_note: 'Moodboard is in Figma.' }),
    entry('te-5', 'u-ashik', 'p-seo', ago(26 * H), ago(22.5 * H)),
    entry('te-6', 'u-will', 'p-seo', ago(30 * H), ago(28 * H)),
    entry('te-8', 'u-ashik', 'p-spring', ago(32 * H), ago(27 * H)),
  ]

  // ---------------------------------------------------------------- notifications
  let n = 0
  const note = (user: string, type: string, title: string, body: string, link: string, hoursAgo: number, read = false): Row => ({
    id: `nt-${++n}`, user_id: user, type, title, body, link, read_at: read ? ago(hoursAgo * H - 60_000) : null, created_at: ago(hoursAgo * H),
  })
  const notifications = [
    note('u-will', 'team_signup_pending', 'Team signup waiting for approval', 'Riley Park (riley@example.com) asked to join the team.', '/admin/users?tab=pending', 5),
    note('u-will', 'update_pending_approval', 'Update waiting for approval', 'Sadman wrote an update for Northwind spring campaign site: Mobile menu fixed and checked on iPhone and Android.', '/admin/approvals', 2),
    note('u-will', 'new_client_signup', 'New client signed up', 'Nina Okafor from Freshleaf Studio is waiting to be linked to an organization.', '/admin/users?tab=clients', 26),
    note('u-will', 'client_bug', 'Bug report from Northwind Outdoors', 'Leo Martins: Contact form does not send on mobile', '/admin/requests', 30, true),
    note('u-ashik', 'kickoff_confirmed', 'Northwind Outdoors is ready to start Northwind SEO audit', 'Leo Martins pressed "Let\'s Go".', '/team/projects/p-seo', 13 * 24, true),
    note('u-sadman', 'timer_auto_stopped', 'Your timer was stopped after 8 hours', 'It looked like the timer was left running, so we stopped it at 8 hours.', '/team', 3 * 24),
    note('u-leo', 'new_update', 'New update on Northwind SEO audit', 'Ashik: Core Web Vitals review has started.', '/client/projects/p-seo', 5),
    note('u-leo', 'new_update', 'New update on Northwind SEO audit', 'Ashik: Completed the full site crawl. 412 pages checked.', '/client/projects/p-seo', 30),
    note('u-leo', 'due_date_changed', 'New due date for Northwind spring campaign site', 'Your project is now due in 5 days.', '/client/projects/p-spring', 3 * 24, true),
    note('u-leo', 'stage_changed', 'Northwind spring campaign site moved to QA', 'Your project is now in the QA stage.', '/client/projects/p-spring', 2 * 24, true),
    note('u-maya', 'access_reminder', 'A few access steps are still waiting', '3 access steps for Acme Bakery website still need your help. It only takes a few minutes.', '/client/projects/p-acme/access', 20),
  ]

  const project_due_date_changes = [
    { id: 'dd-1', project_id: 'p-spring', old_date: day(2), new_date: day(5), changed_by: 'u-will', changed_at: ago(3 * D) },
  ]

  const client_requests = [
    { id: 'cr-1', org_id: 'org-northwind', project_id: 'p-spring', author_id: 'u-leo', kind: 'bug', title: 'Contact form does not send on mobile', details: 'Tried on iPhone Safari. Nothing happens after pressing Submit.', page_url: 'https://northwind-spring-demo.webflow.io/contact', status: 'open', created_at: ago(30 * H) },
    { id: 'cr-2', org_id: 'org-acme', project_id: 'p-acme', author_id: 'u-maya', kind: 'request', title: 'Add our new weekend opening hours', details: 'We now open at 8am on Saturdays.', page_url: null, status: 'open', created_at: ago(2 * D) },
  ]

  const staff_invites = [
    { id: 'si-1', email: 'will@example.com', role: 'admin', invited_by: null, created_at: ago(90 * D), used_at: ago(90 * D) },
    { id: 'si-2', email: 'sadman@example.com', role: 'team', invited_by: 'u-will', created_at: ago(80 * D), used_at: ago(80 * D) },
    { id: 'si-3', email: 'ashik@example.com', role: 'team', invited_by: 'u-will', created_at: ago(80 * D), used_at: ago(79 * D) },
    { id: 'si-4', email: 'jordan@example.com', role: 'team', invited_by: 'u-will', created_at: ago(2 * D), used_at: null },
  ]

  let a = 0
  const audit = (actor: string, entity_type: string, entity_id: string, action: string, old_data: Row | null, new_data: Row | null, hoursAgo: number): Row => ({
    id: ++a, actor_id: actor, entity_type, entity_id, action, old_data, new_data, created_at: ago(hoursAgo * H),
  })
  const audit_log = [
    audit('u-sadman', 'client_updates', 'cu-9', 'insert', null, { message: 'Mobile menu fixed and checked on iPhone and Android.', status: 'pending_approval' }, 2),
    audit('u-ashik', 'client_updates', 'cu-4', 'insert', null, { message: 'Core Web Vitals review has started.', status: 'published' }, 5),
    audit('u-maya', 'access_steps', 'p-acme-a-ga4', 'update', { key: 'ga4', status: 'pending', note: null }, { key: 'ga4', status: 'skipped', note: 'Shared with Sadman by email last Monday' }, 48),
    audit('u-maya', 'access_steps', 'p-acme-a-domain_dns', 'update', { key: 'domain_dns', status: 'pending', value_text: null }, { key: 'domain_dns', status: 'provided', value_text: 'acmebakery.example' }, 50),
    audit('u-will', 'projects', 'p-spring', 'update', { name: 'Northwind spring campaign site', due_date: day(2) }, { name: 'Northwind spring campaign site', due_date: day(5) }, 72),
    audit('u-will', 'project_due_date_changes', 'dd-1', 'insert', null, { project_id: 'p-spring', old_date: day(2), new_date: day(5) }, 72),
    audit('u-will', 'access_steps', 'p-seo-a-ga4', 'update', { key: 'ga4', status: 'pending', provided_by: null }, { key: 'ga4', status: 'provided', provided_by: 'admin' }, 96),
    audit('u-will', 'projects', 'p-acme', 'insert', null, { name: 'Acme Bakery website', template: 'webflow_build' }, 96),
    audit('u-ashik', 'access_steps', 'p-seo-a-webflow', 'update', { key: 'webflow', status: 'provided' }, { key: 'webflow', status: 'verified' }, 12 * 24),
  ]

  // ---------------------------------------------------------------- templates (same defaults as the real migrations)
  const project_templates = [
    { id: 'tpl-webflow', key: 'webflow_build', name: 'Webflow Build', description: 'Design and build a new Webflow website.', created_at: ago(90 * D) },
    { id: 'tpl-seo', key: 'seo_audit', name: 'SEO Audit', description: 'Technical and content SEO audit with a clear action plan.', created_at: ago(90 * D) },
    { id: 'tpl-custom', key: 'custom', name: 'Custom', description: 'Start from a blank project with the basic access steps.', created_at: ago(90 * D) },
  ]
  let ti = 0
  const items = (template_id: string, stages: string[], taskList: [string, string][], keys: string[]): Row[] => [
    ...stages.map((name, i) => ({ id: `ti-${++ti}`, template_id, kind: 'stage', name, position: i + 1, stage_name: null, access_key: null })),
    ...taskList.map(([name, stage], i) => ({ id: `ti-${++ti}`, template_id, kind: 'task', name, position: i + 1, stage_name: stage, access_key: null })),
    ...keys.map((k, i) => ({ id: `ti-${++ti}`, template_id, kind: 'access_step', name: ACCESS_TITLES[k], position: i + 1, stage_name: null, access_key: k })),
  ]
  const template_items = [
    ...items('tpl-webflow', ['Discovery', 'Design', 'Development', 'QA', 'Launch'], [
      ['Kickoff call', 'Discovery'], ['Sitemap and content plan', 'Discovery'], ['Home page design', 'Design'], ['Inner pages design', 'Design'],
      ['Style guide and components in Webflow', 'Development'], ['Build pages in Webflow', 'Development'], ['CMS setup', 'Development'],
      ['Cross-browser and mobile QA', 'QA'], ['Client review round', 'QA'], ['Connect domain and publish', 'Launch'], ['Post-launch checks (forms, analytics, redirects)', 'Launch'],
    ], ['webflow', 'domain_dns', 'gtm', 'ga4', 'gsc', 'brand_assets']),
    ...items('tpl-seo', ['Discovery', 'Technical audit', 'Content audit', 'Report', 'Handover'], [
      ['Kickoff call and goals', 'Discovery'], ['Crawl the site', 'Technical audit'], ['Core Web Vitals review', 'Technical audit'], ['Indexing and sitemap review', 'Technical audit'],
      ['Keyword and content gap analysis', 'Content audit'], ['On-page review of key pages', 'Content audit'], ['Write the audit report', 'Report'], ['Walkthrough call', 'Handover'],
    ], ['webflow', 'domain_dns', 'gtm', 'ga4', 'gsc']),
    ...items('tpl-custom', ['Discovery', 'In progress', 'Review', 'Done'], [], ['webflow']),
  ]

  return {
    profiles, organizations, projects, project_members, project_stages, tasks, client_updates, internal_notes,
    access_steps, time_entries, notifications, project_due_date_changes, client_requests, staff_invites,
    audit_log, project_templates, template_items, email_outbox: [],
  }
}

export const ACCESS_TITLES: Record<string, string> = {
  webflow: 'Webflow', domain_dns: 'Domain / DNS', gtm: 'Google Tag Manager', ga4: 'Google Analytics 4', gsc: 'Google Search Console', brand_assets: 'Brand assets',
}
