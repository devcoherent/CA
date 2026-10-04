import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { admin, as, asCommit, createOrgWithClient, createProject, createStaff, pool, rejects } from './helpers'

let adminId: string, team: string, other: string, clientId: string
let p1: string, p2: string, p3: string

beforeAll(async () => {
  adminId = await createStaff('admin')
  team = await createStaff('team', 'timer')
  other = await createStaff('team', 'other')
  const o = await createOrgWithClient('TimeOrg')
  clientId = o.clientId
  p1 = await createProject(adminId, o.orgId, 'custom', [team])
  p2 = await createProject(adminId, o.orgId, 'custom', [team])
  p3 = await createProject(adminId, o.orgId, 'custom', [other]) // team is NOT assigned
})

afterAll(async () => {
  await pool.end()
})

describe('time tracking', () => {
  test('a user cannot have two running time entries', async () => {
    await as(team, async (q) => {
      await q('select public.start_timer($1)', [p1])
      const err = await rejects(q('select public.start_timer($1)', [p2]))
      expect(err.message).toMatch(/already running/)
    })
  })

  test('the database itself blocks a second running entry (partial unique index)', async () => {
    await admin('insert into public.time_entries (user_id, project_id) values ($1, $2)', [other, p3])
    const err = await rejects(admin('insert into public.time_entries (user_id, project_id) values ($1, $2)', [other, p3]))
    expect(err.message).toMatch(/time_entries_one_running_per_user/)
    await admin('delete from public.time_entries where user_id = $1', [other])
  })

  test('switch_project stops the old entry and starts the new one with no gap', async () => {
    await as(team, async (q) => {
      const [first] = await q<{ id: string }>('select (public.start_timer($1)).id as id', [p1])
      const [next] = await q<{ id: string; started_at: Date; project_id: string }>(
        `select (s).id, (s).started_at, (s).project_id from (select public.switch_project($1, 'Handing off the header work') as s) x`,
        [p2],
      )
      const [old] = await q<{ ended_at: Date; handoff_note: string }>(
        'select ended_at, handoff_note from public.time_entries where id = $1',
        [first.id],
      )
      expect(old.ended_at).not.toBeNull()
      expect(old.ended_at.getTime()).toBe(next.started_at.getTime()) // no gap, no overlap
      expect(old.handoff_note).toBe('Handing off the header work')
      expect(next.project_id).toBe(p2)
      const running = await q('select * from public.time_entries where user_id = $1 and ended_at is null', [team])
      expect(running).toHaveLength(1)
    })
  })

  test('switch_project with nothing running just starts a timer', async () => {
    await as(team, async (q) => {
      const rows = await q('select public.switch_project($1)', [p1])
      expect(rows).toHaveLength(1)
      expect(await q('select * from public.time_entries where user_id = $1 and ended_at is null', [team])).toHaveLength(1)
    })
  })

  test('stop_timer ends the running entry', async () => {
    await as(team, async (q) => {
      await q('select public.start_timer($1)', [p1])
      await q('select public.stop_timer()')
      expect(await q('select * from public.time_entries where user_id = $1 and ended_at is null', [team])).toHaveLength(0)
    })
  })

  test('cannot track time on an unassigned project', async () => {
    const err = await rejects(as(team, (q) => q('select public.start_timer($1)', [p3])))
    expect(err.message).toMatch(/not assigned/)
    const err2 = await rejects(as(team, (q) => q('select public.switch_project($1)', [p3])))
    expect(err2.message).toMatch(/not assigned/)
  })

  test('clients cannot track time', async () => {
    const err = await rejects(as(clientId, (q) => q('select public.start_timer($1)', [p1])))
    expect(err.message).toMatch(/not assigned/)
  })

  test('timers running over 8 hours are auto-stopped and flagged', async () => {
    const [e] = await admin<{ id: string }>(
      `insert into public.time_entries (user_id, project_id, started_at) values ($1, $2, now() - interval '9 hours') returning id`,
      [other, p3],
    )
    await admin('select private.auto_stop_long_timers()')
    const [row] = await admin<{ started_at: Date; ended_at: Date; auto_stopped: boolean }>(
      'select started_at, ended_at, auto_stopped from public.time_entries where id = $1',
      [e.id],
    )
    expect(row.auto_stopped).toBe(true)
    expect(row.ended_at.getTime() - row.started_at.getTime()).toBe(8 * 3600 * 1000)
  })

  test('users cannot edit time entries directly (only through the timer functions)', async () => {
    await asCommit(team, (q) => q('select public.start_timer($1)', [p1]))
    const rows = await as(team, (q) =>
      q(`update public.time_entries set started_at = now() - interval '5 days' where user_id = $1 returning id`, [team]),
    )
    expect(rows).toHaveLength(0)
    await asCommit(team, (q) => q('select public.stop_timer()'))
  })
})
