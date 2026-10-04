import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { admin, as, asCommit, createOrgWithClient, createProject, createStaff, pool, rejects } from './helpers'

let adminId: string, team: string, clientId: string, orgId: string, project: string

beforeAll(async () => {
  adminId = await createStaff('admin')
  team = await createStaff('team')
  ;({ orgId, clientId } = await createOrgWithClient('RulesOrg'))
  project = await createProject(adminId, orgId, 'seo_audit', [team])
})

afterAll(async () => {
  await pool.end()
})

describe('templates', () => {
  test('creating a project from a template creates stages, tasks and access steps', async () => {
    const [c] = await admin<{ stages: number; tasks: number; steps: number }>(
      `select (select count(*) from public.project_stages where project_id = $1)::int as stages,
              (select count(*) from public.tasks where project_id = $1)::int as tasks,
              (select count(*) from public.access_steps where project_id = $1)::int as steps`,
      [project],
    )
    expect(c).toEqual({ stages: 5, tasks: 8, steps: 5 })
  })
})

describe('due dates', () => {
  test('changing the due date records history, notifies the client and is audited', async () => {
    await asCommit(adminId, (q) => q(`update public.projects set due_date = current_date + 90 where id = $1`, [project]))
    const history = await as(clientId, (q) => q('select * from public.project_due_date_changes where project_id = $1', [project]))
    expect(history).toHaveLength(1)
    const notes = await admin(`select * from public.notifications where user_id = $1 and type = 'due_date_changed'`, [clientId])
    expect(notes).toHaveLength(1)
    const mails = await admin(`select * from public.email_outbox where user_id = $1 and kind = 'due_date_changed'`, [clientId])
    expect(mails).toHaveLength(1)
    const audit = await admin(`select * from public.audit_log where entity_type = 'project_due_date_changes' and new_data->>'project_id' = $1`, [project])
    expect(audit).toHaveLength(1)
  })

  test('team members cannot change the due date', async () => {
    const err = await rejects(as(team, (q) => q(`update public.projects set due_date = current_date where id = $1`, [project])))
    expect(err.message).toMatch(/Only an admin/)
  })
})

describe('stages', () => {
  test('advancing a stage notifies the client', async () => {
    await asCommit(team, (q) => q('select public.advance_stage($1)', [project]))
    await asCommit(team, (q) => q('select public.advance_stage($1)', [project]))
    const [p] = await admin<{ current_stage: string; status: string }>('select current_stage, status from public.projects where id = $1', [project])
    expect(p.current_stage).toBe('Technical audit')
    expect(p.status).toBe('in_progress')
    const notes = await admin(`select * from public.notifications where user_id = $1 and type = 'stage_changed'`, [clientId])
    expect(notes.length).toBe(2)
  })
})

describe('access reminders', () => {
  test('emails the client about pending steps 3 days after creation, at most once every 3 days', async () => {
    await admin(`update public.projects set created_at = now() - interval '4 days' where id = $1`, [project])
    await admin('select private.queue_access_reminders()')
    await admin('select private.queue_access_reminders()')
    const mails = await admin(`select * from public.email_outbox where user_id = $1 and kind = 'access_reminder'`, [clientId])
    expect(mails).toHaveLength(1)
  })
})

describe('client requests', () => {
  test('a client request notifies admins', async () => {
    await asCommit(clientId, (q) => q(`select public.submit_client_request('bug', 'Footer link broken', 'On the About page', $1)`, [project]))
    const notes = await admin(`select * from public.notifications where user_id = $1 and type = 'client_bug'`, [adminId])
    expect(notes.length).toBeGreaterThanOrEqual(1)
  })
})
