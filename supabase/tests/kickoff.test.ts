import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { admin, as, asCommit, createOrgWithClient, createProject, createStaff, pool, rejects } from './helpers'

let adminId: string, teamA: string, teamB: string, outsider: string
let clientId: string, otherClient: string, orgId: string
let project: string

beforeAll(async () => {
  adminId = await createStaff('admin')
  teamA = await createStaff('team', 'sadman')
  teamB = await createStaff('team', 'ashik')
  outsider = await createStaff('team', 'outsider')
  ;({ orgId, clientId } = await createOrgWithClient('KickoffOrg'))
  ;({ clientId: otherClient } = await createOrgWithClient('OtherOrg'))
  project = await createProject(adminId, orgId, 'webflow_build', [teamA, teamB])
})

afterAll(async () => {
  await pool.end()
})

describe("Let's Go kickoff", () => {
  test('is blocked while the Webflow step is pending', async () => {
    const err = await rejects(as(clientId, (q) => q('select public.confirm_kickoff($1)', [project])))
    expect(err.message).toMatch(/Webflow access/)
    expect(err.hint).toBe('webflow_pending')
  })

  test('a client of another organization cannot start it', async () => {
    const err = await rejects(as(otherClient, (q) => q('select public.confirm_kickoff($1)', [project])))
    expect(err.hint).toBe('not_allowed')
  })

  test('is allowed once Webflow is provided, even with other steps pending (they come back as warnings)', async () => {
    await asCommit(clientId, (q) =>
      q(`update public.access_steps set status = 'provided', value_text = 'kickoff-site' where project_id = $1 and key = 'webflow'`, [project]),
    )
    const [res] = await asCommit(clientId, (q) =>
      q<{ r: { ok: boolean; pending_steps: string[] } }>('select public.confirm_kickoff($1) as r', [project]),
    )
    expect(res.r.ok).toBe(true)
    expect(res.r.pending_steps).toEqual(['domain_dns', 'gtm', 'ga4', 'gsc', 'brand_assets'])

    const [p] = await admin<{ kickoff_confirmed_at: Date; kickoff_confirmed_by: string; status: string; current_stage: string }>(
      'select kickoff_confirmed_at, kickoff_confirmed_by, status, current_stage from public.projects where id = $1',
      [project],
    )
    expect(p.kickoff_confirmed_at).not.toBeNull()
    expect(p.kickoff_confirmed_by).toBe(clientId)
    expect(p.status).toBe('kickoff_confirmed')
    expect(p.current_stage).toBe('Discovery')
  })

  test('adds a "Project started" entry to the timeline', async () => {
    const rows = await as(clientId, (q) =>
      q(`select * from public.client_updates where project_id = $1 and kind = 'milestone' and message = 'Project started'`, [project]),
    )
    expect(rows).toHaveLength(1)
  })

  test('notifies every assigned team member and admin (bell + email), not unassigned staff', async () => {
    const notified = await admin<{ user_id: string }>(
      `select user_id from public.notifications where type = 'kickoff_confirmed' and link = $1`,
      [`/team/projects/${project}`],
    )
    const ids = notified.map((n) => n.user_id)
    expect(ids).toEqual(expect.arrayContaining([teamA, teamB, adminId]))
    expect(ids).not.toContain(outsider)
    const mails = await admin<{ user_id: string }>(
      `select user_id from public.email_outbox where kind = 'kickoff_confirmed' and cta_path = $1`,
      [`/team/projects/${project}`],
    )
    expect(mails.map((m) => m.user_id)).toEqual(expect.arrayContaining([teamA, teamB, adminId]))
  })

  test('sends the client a kickoff summary email', async () => {
    const [mail] = await admin<{ body: string }>(
      `select body from public.email_outbox where user_id = $1 and kind = 'kickoff_confirmed'`,
      [clientId],
    )
    expect(mail.body).toMatch(/Start date:/)
    expect(mail.body).toMatch(/Next milestone: Design/)
    expect(mail.body).toMatch(/Due date:/)
  })

  test('cannot be confirmed twice', async () => {
    const err = await rejects(as(clientId, (q) => q('select public.confirm_kickoff($1)', [project])))
    expect(err.hint).toBe('already_confirmed')
  })
})
