import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { admin, as, asCommit, createOrgWithClient, createProject, createStaff, pool, rejects } from './helpers'

let adminId: string, team: string, outsider: string, clientId: string, orgId: string
let project: string

beforeAll(async () => {
  adminId = await createStaff('admin')
  team = await createStaff('team', 'ashik')
  outsider = await createStaff('team', 'outsider')
  ;({ orgId, clientId } = await createOrgWithClient('UpdatesOrg'))
  project = await createProject(adminId, orgId, 'webflow_build', [team])
})

afterAll(async () => {
  await pool.end()
})

describe('Submit to client', () => {
  test('creates a published update and notifies the client (bell + email)', async () => {
    const [u] = await asCommit(team, (q) =>
      q<{ id: string; status: string }>(
        `select (u).id, (u).status from (select public.submit_client_update($1, 'Home page design complete') as u) x`,
        [project],
      ),
    )
    expect(u.status).toBe('published')

    const seen = await as(clientId, (q) => q<{ message: string; author_name: string }>('select message, author_name from public.client_updates where id = $1', [u.id]))
    expect(seen).toEqual([{ message: 'Home page design complete', author_name: 'ashik' }])

    const notes = await admin(`select * from public.notifications where user_id = $1 and type = 'new_update'`, [clientId])
    expect(notes.length).toBe(1)
    const mail = await admin(`select * from public.email_outbox where user_id = $1 and kind = 'new_update'`, [clientId])
    expect(mail.length).toBe(1)
  })

  test('a team member not on the project cannot submit', async () => {
    const err = await rejects(as(outsider, (q) => q(`select public.submit_client_update($1, 'hi')`, [project])))
    expect(err.message).toMatch(/not assigned/)
  })

  test('clients cannot insert updates directly', async () => {
    await rejects(
      as(clientId, (q) =>
        q(`insert into public.client_updates (project_id, message, status) values ($1, 'fake', 'published')`, [project]),
      ),
    )
  })
})

describe('require_admin_approval', () => {
  let pending: string

  beforeAll(async () => {
    await asCommit(adminId, (q) => q('update public.projects set require_admin_approval = true where id = $1', [project]))
    const [u] = await asCommit(team, (q) =>
      q<{ id: string; status: string }>(
        `select (u).id, (u).status from (select public.submit_client_update($1, 'About page draft ready') as u) x`,
        [project],
      ),
    )
    expect(u.status).toBe('pending_approval')
    pending = u.id
  })

  test('the client does not see the update until approved', async () => {
    expect(await as(clientId, (q) => q('select * from public.client_updates where id = $1', [pending]))).toHaveLength(0)
    const notes = await admin(
      `select * from public.notifications where user_id = $1 and body like '%About page draft ready%'`,
      [clientId],
    )
    expect(notes).toHaveLength(0)
  })

  test('admins are told an update is waiting', async () => {
    const notes = await admin(`select * from public.notifications where user_id = $1 and type = 'update_pending_approval'`, [adminId])
    expect(notes.length).toBeGreaterThan(0)
  })

  test('team members cannot approve', async () => {
    const err = await rejects(as(team, (q) => q('select public.review_client_update($1, true)', [pending])))
    expect(err.message).toMatch(/Only an admin/)
  })

  test('after admin approval the client sees it and is notified', async () => {
    await asCommit(adminId, (q) => q('select public.review_client_update($1, true)', [pending]))
    expect(await as(clientId, (q) => q('select * from public.client_updates where id = $1', [pending]))).toHaveLength(1)
    const notes = await admin(
      `select * from public.notifications where user_id = $1 and body like '%About page draft ready%'`,
      [clientId],
    )
    expect(notes).toHaveLength(1)
  })

  test('a rejected update stays hidden from the client', async () => {
    const [u] = await asCommit(team, (q) =>
      q<{ id: string }>(`select (u).id from (select public.submit_client_update($1, 'Oops, internal wording') as u) x`, [project]),
    )
    await asCommit(adminId, (q) => q('select public.review_client_update($1, false)', [u.id]))
    expect(await as(clientId, (q) => q('select * from public.client_updates where id = $1', [u.id]))).toHaveLength(0)
  })
})
