import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { admin, as, asCommit, createOrgWithClient, createProject, createStaff, pool, rejects } from './helpers'

let adminId: string
let teamA: string // like Sadman: project 1 only
let teamB: string // like Ashik: both projects
let org1: string, client1: string
let org2: string, client2: string
let p1: string, p2: string

beforeAll(async () => {
  adminId = await createStaff('admin', 'will')
  teamA = await createStaff('team', 'sadman')
  teamB = await createStaff('team', 'ashik')
  ;({ orgId: org1, clientId: client1 } = await createOrgWithClient('Acme'))
  ;({ orgId: org2, clientId: client2 } = await createOrgWithClient('Northwind'))
  p1 = await createProject(adminId, org1, 'webflow_build', [teamA, teamB])
  p2 = await createProject(adminId, org2, 'seo_audit', [teamB])

  for (const [p, author] of [
    [p1, teamA],
    [p2, teamB],
  ]) {
    await admin('insert into public.internal_notes (project_id, author_id, body) values ($1, $2, $3)', [p, author, 'secret'])
    await admin(
      `insert into public.time_entries (user_id, project_id, started_at, ended_at) values ($1, $2, now() - interval '2 hours', now() - interval '1 hour')`,
      [author, p],
    )
  }
})

afterAll(async () => {
  await pool.end()
})

describe('clients only see their own organization', () => {
  test('a client cannot read another org’s projects', async () => {
    const rows = await as(client1, (q) => q<{ id: string }>('select id from public.projects'))
    expect(rows.map((r) => r.id)).toContain(p1)
    expect(rows.map((r) => r.id)).not.toContain(p2)
    const direct = await as(client1, (q) => q('select * from public.projects where id = $1', [p2]))
    expect(direct).toHaveLength(0)
  })

  test('a client cannot read another organization', async () => {
    const rows = await as(client1, (q) => q<{ id: string }>('select id from public.organizations'))
    expect(rows.map((r) => r.id)).toEqual([org1])
  })

  test('a client never sees internal notes, not even on their own project', async () => {
    const rows = await as(client1, (q) => q('select * from public.internal_notes'))
    expect(rows).toHaveLength(0)
  })

  test('a client never sees time entries, tasks or the audit log', async () => {
    await as(client1, async (q) => {
      expect(await q('select * from public.time_entries')).toHaveLength(0)
      expect(await q('select * from public.tasks')).toHaveLength(0)
      expect(await q('select * from public.audit_log')).toHaveLength(0)
      expect(await q('select * from public.email_outbox')).toHaveLength(0)
    })
  })

  test('a client cannot read another org’s access steps or stages', async () => {
    await as(client1, async (q) => {
      expect(await q('select * from public.access_steps where project_id = $1', [p2])).toHaveLength(0)
      expect(await q('select * from public.project_stages where project_id = $1', [p2])).toHaveLength(0)
      expect((await q('select * from public.access_steps where project_id = $1', [p1])).length).toBeGreaterThan(0)
    })
  })

  test('a client cannot update access steps of another org', async () => {
    const updated = await as(client1, (q) =>
      q(`update public.access_steps set status = 'provided', value_text = 'hacked' where project_id = $1 returning id`, [p2]),
    )
    expect(updated).toHaveLength(0)
    const after = await admin(`select * from public.access_steps where project_id = $1 and value_text = 'hacked'`, [p2])
    expect(after).toHaveLength(0)
  })

  test('a client can update their own access step, tagged provided_by = client', async () => {
    const [row] = await as(client1, (q) =>
      q<{ provided_by: string; updated_by: string }>(
        `update public.access_steps set status = 'provided', value_text = 'GTM-ABC123' where project_id = $1 and key = 'gtm' returning provided_by, updated_by`,
        [p1],
      ),
    )
    expect(row.provided_by).toBe('client')
    expect(row.updated_by).toBe(client1)
  })

  test('a client cannot mark a step as verified', async () => {
    const err = await rejects(
      as(client1, (q) => q(`update public.access_steps set status = 'verified' where project_id = $1 and key = 'gtm'`, [p1])),
    )
    expect(err.message).toMatch(/Only the Coherent team/)
  })

  test('skipping a step requires a note', async () => {
    const err = await rejects(
      as(client1, (q) => q(`update public.access_steps set status = 'skipped', note = '' where project_id = $1 and key = 'gsc'`, [p1])),
    )
    expect(err.message).toMatch(/skipped_needs_note/)
  })

  test('a client cannot change their own role or organization', async () => {
    const err = await rejects(as(client1, (q) => q(`update public.profiles set role = 'admin' where id = $1`, [client1])))
    expect(err.message).toMatch(/only change your own/)
    const err2 = await rejects(as(client1, (q) => q(`update public.profiles set org_id = $1 where id = $2`, [org2, client1])))
    expect(err2.message).toMatch(/only change your own/)
  })

  test('a client can edit their own profile and organization', async () => {
    await as(client1, async (q) => {
      expect(await q(`update public.profiles set full_name = 'Maya' where id = $1 returning id`, [client1])).toHaveLength(1)
      expect(await q(`update public.organizations set bio = 'Hi' where id = $1 returning id`, [org1])).toHaveLength(1)
      expect(await q(`update public.organizations set bio = 'Hi' where id = $1 returning id`, [org2])).toHaveLength(0)
    })
  })

  test('a client cannot write notifications or audit rows', async () => {
    await rejects(as(client1, (q) => q(`insert into public.notifications (user_id, type, title) values ($1, 'x', 'x')`, [client1])))
    await rejects(as(client1, (q) => q(`insert into public.audit_log (entity_type, action) values ('x', 'x')`)))
  })

  test('a client only sees staff profiles assigned to their projects', async () => {
    const rows = await as(client2, (q) => q<{ id: string }>('select id from public.profiles'))
    const ids = rows.map((r) => r.id)
    expect(ids).toContain(client2)
    expect(ids).toContain(teamB)
    expect(ids).not.toContain(teamA) // Sadman is not on Northwind's project
    expect(ids).not.toContain(client1)
  })
})

describe('team members only see assigned projects', () => {
  test('a team member cannot read unassigned projects', async () => {
    const rows = await as(teamA, (q) => q<{ id: string }>('select id from public.projects'))
    expect(rows.map((r) => r.id)).toContain(p1)
    expect(rows.map((r) => r.id)).not.toContain(p2)
    await as(teamA, async (q) => {
      expect(await q('select * from public.tasks where project_id = $1', [p2])).toHaveLength(0)
      expect(await q('select * from public.internal_notes where project_id = $1', [p2])).toHaveLength(0)
      expect(await q('select * from public.access_steps where project_id = $1', [p2])).toHaveLength(0)
      expect(await q('select * from public.organizations where id = $1', [org2])).toHaveLength(0)
    })
  })

  test('a member of both projects sees both', async () => {
    const rows = await as(teamB, (q) => q<{ id: string }>('select id from public.projects'))
    expect(rows.map((r) => r.id)).toEqual(expect.arrayContaining([p1, p2]))
  })

  test('team members only see their own time entries; admin sees all', async () => {
    const mine = await as(teamA, (q) => q<{ user_id: string }>('select user_id from public.time_entries'))
    expect(mine.every((r) => r.user_id === teamA)).toBe(true)
    const all = await as(adminId, (q) => q<{ user_id: string }>('select user_id from public.time_entries'))
    expect(all.map((r) => r.user_id)).toEqual(expect.arrayContaining([teamA, teamB]))
  })

  test('team can mark a step verified but cannot change its value', async () => {
    await asCommit(client1, (q) =>
      q(`update public.access_steps set status = 'provided', value_text = 'acme.webflow.io' where project_id = $1 and key = 'webflow'`, [p1]),
    )
    const [v] = await as(teamA, (q) =>
      q<{ status: string }>(`update public.access_steps set status = 'verified' where project_id = $1 and key = 'webflow' returning status`, [p1]),
    )
    expect(v.status).toBe('verified')
    const err = await rejects(
      as(teamA, (q) => q(`update public.access_steps set value_text = 'x' where project_id = $1 and key = 'webflow'`, [p1])),
    )
    expect(err.message).toMatch(/only mark a step as verified/)
  })

  test('team cannot read the audit log or change admin-only project fields', async () => {
    expect(await as(teamA, (q) => q('select * from public.audit_log'))).toHaveLength(0)
    const err = await rejects(as(teamA, (q) => q(`update public.projects set require_admin_approval = true where id = $1`, [p1])))
    expect(err.message).toMatch(/Only an admin/)
  })

  test('team cannot create projects', async () => {
    const err = await rejects(
      as(teamA, (q) => q(`select public.create_project_from_template($1, 'x', 'custom')`, [org1])),
    )
    expect(err.message).toMatch(/Only an admin/)
  })
})

describe('admin', () => {
  test('admin edits an access step on behalf of the client, tagged provided_by = admin', async () => {
    const [row] = await as(adminId, (q) =>
      q<{ provided_by: string }>(
        `update public.access_steps set status = 'provided', value_text = 'G-12345' where project_id = $1 and key = 'ga4' returning provided_by`,
        [p2],
      ),
    )
    expect(row.provided_by).toBe('admin')
  })

  test('admin sees the audit log, filled by triggers', async () => {
    const rows = await as(adminId, (q) =>
      q<{ entity_type: string }>(`select entity_type from public.audit_log where entity_id = $1`, [p1]),
    )
    expect(rows.map((r) => r.entity_type)).toContain('projects')
  })
})

describe('logged-out visitors', () => {
  test('anon cannot read anything', async () => {
    const client = await pool.connect()
    try {
      await client.query('begin')
      await client.query('set local role anon')
      await expect(client.query('select * from public.projects')).rejects.toThrow(/permission denied/)
      await client.query('rollback')
      await client.query('begin')
      await client.query('set local role anon')
      const r = await client.query('select public.keepalive() as t')
      expect(r.rows[0].t).toBeTruthy()
    } finally {
      await client.query('rollback')
      client.release()
    }
  })
})
