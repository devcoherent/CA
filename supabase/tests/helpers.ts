import pg from 'pg'
import { randomUUID } from 'node:crypto'

/**
 * Test helpers. Tests talk to a real Postgres with all migrations applied
 * (local Supabase: `supabase start && supabase db reset`).
 *
 * `as(user, fn)` runs queries exactly like PostgREST does for a logged-in user:
 * role `authenticated` + JWT claims, inside a transaction that is rolled back.
 */

export const DB_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
export const API_URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321'
// The well-known local development anon key (not a secret; same for every local stack).
export const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

export const pool = new pg.Pool({ connectionString: DB_URL, max: 4 })

export type Row = Record<string, unknown>

/** Query as the database owner (bypasses RLS). For setup and assertions only. */
export async function admin<T extends Row = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  const res = await pool.query(text, params)
  return res.rows as T[]
}

export interface Q {
  <T extends Row = Row>(text: string, params?: unknown[]): Promise<T[]>
}

/** Run `fn` as the given user (RLS applies). Everything is rolled back afterwards. */
export async function as<T>(userId: string, fn: (q: Q) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('begin')
    await client.query('set local role authenticated')
    await client.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: userId, role: 'authenticated' }),
    ])
    const q: Q = async (text, params = []) => (await client.query(text, params)).rows
    return await fn(q)
  } finally {
    await client.query('rollback').catch(() => undefined)
    client.release()
  }
}

/** Like `as`, but commits (for multi-step flows that must persist). */
export async function asCommit<T>(userId: string, fn: (q: Q) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('begin')
    await client.query('set local role authenticated')
    await client.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: userId, role: 'authenticated' }),
    ])
    const q: Q = async (text, params = []) => (await client.query(text, params)).rows
    const out = await fn(q)
    await client.query('commit')
    return out
  } catch (e) {
    await client.query('rollback').catch(() => undefined)
    throw e
  } finally {
    client.release()
  }
}

export const uid = () => randomUUID().slice(0, 8)

/** Create an auth user exactly like Supabase Auth does (the signup trigger runs). */
export async function createAuthUser(email: string, meta: Record<string, unknown> = {}): Promise<string> {
  const id = randomUUID()
  await admin(
    `insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', $2, $3, '{"provider":"email"}', now(), now())`,
    [id, email, JSON.stringify(meta)],
  )
  return id
}

export async function createStaff(role: 'admin' | 'team', name: string = role): Promise<string> {
  const email = `${name}-${uid()}@coherent.test`.toLowerCase()
  await admin('insert into public.staff_invites (email, role) values ($1, $2)', [email, role])
  return createAuthUser(email, { full_name: name })
}

export async function createOrgWithClient(name = 'Org'): Promise<{ orgId: string; clientId: string }> {
  const [org] = await admin<{ id: string }>('insert into public.organizations (name) values ($1) returning id', [
    `${name} ${uid()}`,
  ])
  const clientId = await createAuthUser(`client-${uid()}@client.test`, { full_name: 'Client', company_name: name })
  await admin('update public.profiles set org_id = $1 where id = $2', [org.id, clientId])
  return { orgId: org.id, clientId }
}

/** A project created through the real template RPC, acting as the given admin. */
export async function createProject(
  adminId: string,
  orgId: string,
  template: 'webflow_build' | 'seo_audit' | 'custom' = 'webflow_build',
  memberIds: string[] = [],
): Promise<string> {
  return asCommit(adminId, async (q) => {
    const [p] = await q<{ id: string }>(
      `select id from public.create_project_from_template($1, $2, $3::public.project_template, current_date, current_date + 30, $4::uuid[])`,
      [orgId, `Project ${uid()}`, template, memberIds],
    )
    return p.id
  })
}

/** Expect a promise to reject; returns the Postgres error. */
export async function rejects(p: Promise<unknown>): Promise<pg.DatabaseError> {
  try {
    await p
  } catch (e) {
    return e as pg.DatabaseError
  }
  throw new Error('Expected the query to fail, but it succeeded')
}
