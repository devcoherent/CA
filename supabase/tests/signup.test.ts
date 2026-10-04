import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import {
  ANON_KEY,
  API_URL,
  admin,
  as,
  asCommit,
  createAuthUser,
  createOrgWithClient,
  createProject,
  createStaff,
  pool,
  rejects,
  uid,
} from './helpers'

let adminId: string
let orgId: string
let project: string
let otherProject: string

type Profile = { role: string; status: string; org_id: string | null; requested_company_name: string | null }
const profileOf = async (id: string) =>
  (await admin<Profile>('select role, status, org_id, requested_company_name from public.profiles where id = $1', [id]))[0]

beforeAll(async () => {
  adminId = await createStaff('admin')
  ;({ orgId } = await createOrgWithClient('SignupOrg'))
  project = await createProject(adminId, orgId, 'custom')
  otherProject = await createProject(adminId, orgId, 'custom')
})

afterAll(async () => {
  await pool.end()
})

describe('client signup', () => {
  test('creates a client profile with org_id NULL that sees nothing', async () => {
    const id = await createAuthUser(`new-${uid()}@client.test`, { full_name: 'New Client', company_name: 'Fresh Co' })
    expect(await profileOf(id)).toEqual({ role: 'client', status: 'approved', org_id: null, requested_company_name: 'Fresh Co' })
    await as(id, async (q) => {
      expect(await q('select * from public.projects')).toHaveLength(0)
      expect(await q('select * from public.organizations')).toHaveLength(0)
      expect(await q('select * from public.access_steps')).toHaveLength(0)
      expect(await q('select * from public.client_updates')).toHaveLength(0)
    })
  })

  test('admins are told a new client signed up', async () => {
    const id = await createAuthUser(`n-${uid()}@client.test`, { full_name: 'Notify Me', company_name: 'Notify Co' })
    const notes = await admin(`select * from public.notifications where user_id = $1 and type = 'new_client_signup' and body like '%Notify Co%'`, [adminId])
    expect(notes.length).toBe(1)
    expect(id).toBeTruthy()
  })

  test('admin can link the client to an organization; then the client sees its projects', async () => {
    const id = await createAuthUser(`link-${uid()}@client.test`, { full_name: 'Linky', company_name: 'SignupOrg' })
    await asCommit(adminId, (q) => q('select public.link_client_to_org($1, $2)', [id, orgId]))
    const rows = await as(id, (q) => q<{ id: string }>('select id from public.projects'))
    expect(rows.map((r) => r.id)).toEqual(expect.arrayContaining([project, otherProject]))
    const mail = await admin(`select * from public.email_outbox where user_id = $1 and kind = 'client_linked'`, [id])
    expect(mail).toHaveLength(1)
  })

  test('admin can create a new organization from the requested company name', async () => {
    const id = await createAuthUser(`org-${uid()}@client.test`, { full_name: 'Org Maker', company_name: 'Brand New Ltd' })
    const [org] = await asCommit(adminId, (q) => q<{ name: string }>('select (o).name from (select public.create_org_for_client($1) as o) x', [id]))
    expect(org.name).toBe('Brand New Ltd')
    expect((await profileOf(id)).org_id).not.toBeNull()
  })

  test('a client cannot link themselves to an organization', async () => {
    const id = await createAuthUser(`self-${uid()}@client.test`, { company_name: 'Sneaky' })
    const err = await rejects(as(id, (q) => q('update public.profiles set org_id = $1 where id = $2', [orgId, id])))
    expect(err.message).toMatch(/only change your own/)
    const err2 = await rejects(as(id, (q) => q('select public.link_client_to_org($1, $2)', [id, orgId])))
    expect(err2.message).toMatch(/Only an admin/)
  })
})

describe('team signup', () => {
  test('a non-invited team signup is pending and can read nothing at all', async () => {
    const id = await createAuthUser(`team-${uid()}@coherent.test`, { full_name: 'Pending Person' })
    expect(await profileOf(id)).toMatchObject({ role: 'team', status: 'pending' })
    await as(id, async (q) => {
      for (const table of [
        'projects', 'organizations', 'profiles', 'project_members', 'project_stages', 'tasks',
        'client_updates', 'internal_notes', 'access_steps', 'time_entries', 'notifications',
        'audit_log', 'project_templates', 'template_items', 'client_requests', 'staff_invites',
      ]) {
        expect(await q(`select * from public.${table}`), table).toHaveLength(0)
      }
      // The only thing they can read is their own status, through this function.
      const [acc] = await q<{ a: { status: string; role: string } }>('select public.get_my_account() as a')
      expect(acc.a.status).toBe('pending')
      // They cannot even update their own profile.
      expect(await q(`update public.profiles set full_name = 'x' where id = $1 returning id`, [id])).toHaveLength(0)
      // Or start a timer.
      await expect(q('select public.start_timer($1)', [project])).rejects.toThrow(/not assigned/)
    })
  })

  test('an invited team signup becomes team and sees only assigned projects', async () => {
    const email = `invited-${uid()}@coherent.test`
    await admin(`insert into public.staff_invites (email, role, invited_by) values ($1, 'team', $2)`, [email, adminId])
    const id = await createAuthUser(email, { full_name: 'Invited' })
    expect(await profileOf(id)).toMatchObject({ role: 'team', status: 'approved' })
    const [inv] = await admin<{ used_at: Date | null }>('select used_at from public.staff_invites where email = $1', [email])
    expect(inv.used_at).not.toBeNull()

    expect(await as(id, (q) => q('select * from public.projects'))).toHaveLength(0)
    await admin('insert into public.project_members (project_id, user_id) values ($1, $2)', [project, id])
    const rows = await as(id, (q) => q<{ id: string }>('select id from public.projects'))
    expect(rows.map((r) => r.id)).toEqual([project])
  })

  test('admin can approve or reject pending team members', async () => {
    const a = await createAuthUser(`approve-${uid()}@coherent.test`)
    const r = await createAuthUser(`reject-${uid()}@coherent.test`)
    await asCommit(adminId, async (q) => {
      await q('select public.review_team_member($1, true)', [a])
      await q('select public.review_team_member($1, false)', [r])
    })
    expect(await profileOf(a)).toMatchObject({ role: 'team', status: 'approved' })
    expect(await profileOf(r)).toMatchObject({ status: 'rejected' })
    expect(await as(r, (q) => q('select * from public.projects'))).toHaveLength(0)
  })

  test('inviting someone who already signed up (pending) approves them', async () => {
    const email = `late-${uid()}@coherent.test`
    const id = await createAuthUser(email)
    await asCommit(adminId, (q) => q(`insert into public.staff_invites (email, role) values ($1, 'team')`, [email]))
    expect(await profileOf(id)).toMatchObject({ role: 'team', status: 'approved' })
  })
})

describe('roles cannot be set from the browser', () => {
  test('role in user metadata is ignored', async () => {
    const team = await createAuthUser(`meta-${uid()}@x.test`, { full_name: 'Hacker', role: 'admin', status: 'approved' })
    expect(await profileOf(team)).toMatchObject({ role: 'team', status: 'pending' })
    const client = await createAuthUser(`meta2-${uid()}@x.test`, { company_name: 'Evil', role: 'admin', org_id: orgId })
    expect(await profileOf(client)).toEqual({ role: 'client', status: 'approved', org_id: null, requested_company_name: 'Evil' })
  })

  test('users cannot promote themselves or invite themselves', async () => {
    const id = await createAuthUser(`promo-${uid()}@x.test`, { company_name: 'Promo' })
    const err = await rejects(as(id, (q) => q(`update public.profiles set role = 'admin', status = 'approved' where id = $1`, [id])))
    expect(err.message).toMatch(/only change your own/)
    await rejects(as(id, (q) => q(`insert into public.staff_invites (email, role) values ('me@x.test', 'admin')`)))
    const err3 = await rejects(as(id, (q) => q(`select public.admin_set_user_role($1, 'admin')`, [id])))
    expect(err3.message).toMatch(/Only an admin/)
  })

  test('there must always be at least one admin', async () => {
    const count = (await admin<{ n: number }>(`select count(*)::int as n from public.profiles where role = 'admin' and status = 'approved'`))[0].n
    if (count === 1) {
      const err = await rejects(as(adminId, (q) => q(`select public.admin_set_user_role($1, 'team')`, [adminId])))
      expect(err.message).toMatch(/at least one admin/)
    } else {
      expect(count).toBeGreaterThan(1)
    }
  })
})

describe('real Supabase Auth (magic link API)', () => {
  const sb = () => createClient(API_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

  test('client signup through signInWithOtp creates a client profile, ignoring a role in metadata', async () => {
    const email = `otp-client-${uid()}@client.test`
    const { error } = await sb().auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true, data: { full_name: 'Otp Client', company_name: 'Otp Co', role: 'admin' } },
    })
    expect(error).toBeNull()
    const [p] = await admin<Profile>(
      'select role, status, org_id, requested_company_name from public.profiles where email = $1',
      [email],
    )
    expect(p).toEqual({ role: 'client', status: 'approved', org_id: null, requested_company_name: 'Otp Co' })
  })

  test('team signup through signInWithOtp (not invited) is pending', async () => {
    const email = `otp-team-${uid()}@coherent.test`
    const { error } = await sb().auth.signInWithOtp({ email, options: { shouldCreateUser: true, data: { full_name: 'Otp Team' } } })
    expect(error).toBeNull()
    const [p] = await admin<Profile>('select role, status from public.profiles where email = $1', [email])
    expect(p).toMatchObject({ role: 'team', status: 'pending' })
  })

  test('login with an unknown email returns otp_disabled (the app shows "Create account")', async () => {
    const { error } = await sb().auth.signInWithOtp({ email: `nobody-${uid()}@nowhere.test`, options: { shouldCreateUser: false } })
    expect(error).not.toBeNull()
    expect(error?.code).toBe('otp_disabled')
  })
})
