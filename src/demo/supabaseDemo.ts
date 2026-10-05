/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * DEMO MODE ONLY — an in-memory stand-in for the Supabase client, so the app can be previewed
 * with no Supabase and no Docker. vite.config.ts aliases `@/lib/supabase` to this file only when
 * demo mode is on; the production build never includes it.
 *
 * It mimics the parts of supabase-js the app uses (auth, from(), rpc(), realtime channel, storage)
 * and mirrors the database rules: who can see which rows (RLS), and the RPC business logic.
 * Data lives in memory and in sessionStorage (so switching users keeps your changes).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { DEMO_MARKER, DEMO_USERS, seed, type DemoUserKey, type Row, type Tables } from './data'

if (import.meta.env.MODE === 'production') throw new Error('Demo mode can never run in a production build.')

export const isSupabaseConfigured = true
export const DEMO = DEMO_MARKER

const DB_KEY = 'coherent.demo.db.v1'
const USER_KEY = 'coherent.demo.user'
const LATENCY_MS = 120 // a little delay so loading states show like on a real network

// ---------------------------------------------------------------------------- storage
const ss = {
  get(k: string) {
    try {
      return sessionStorage.getItem(k)
    } catch {
      return null
    }
  },
  set(k: string, v: string) {
    try {
      sessionStorage.setItem(k, v)
    } catch {
      // quota or blocked storage: the demo still works for this page view
    }
  },
  del(k: string) {
    try {
      sessionStorage.removeItem(k)
    } catch {
      // ignore
    }
  },
}

let db: Tables = (() => {
  const saved = ss.get(DB_KEY)
  if (saved) {
    try {
      return JSON.parse(saved) as Tables
    } catch {
      // fall through to a fresh seed
    }
  }
  return seed()
})()
let saveQueued = false
function save() {
  if (saveQueued) return
  saveQueued = true
  queueMicrotask(() => {
    saveQueued = false
    ss.set(DB_KEY, JSON.stringify(db))
  })
}

export function resetDemoData() {
  db = seed()
  ss.del(DB_KEY)
}

// ---------------------------------------------------------------------------- session
const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams()
// `?demo=<user key>` signs in instantly (used by the Demo panel and the screenshot script).
const fromUrl = params.get('demo')
if (fromUrl) {
  const u = DEMO_USERS.find((x) => x.key === fromUrl)
  if (u) ss.set(USER_KEY, u.id)
  if (fromUrl === 'signed-out') ss.del(USER_KEY)
}
if (params.get('demoReset') === '1') resetDemoData()

let currentUserId: string | null = ss.get(USER_KEY)
type AuthListener = (event: string, session: unknown) => void
const authListeners = new Set<AuthListener>()
const sessionFor = (id: string | null) =>
  id ? { access_token: 'demo', token_type: 'bearer', user: { id, email: db.profiles.find((p) => p.id === id)?.email ?? '' } } : null

function setUser(id: string | null) {
  currentUserId = id
  if (id) ss.set(USER_KEY, id)
  else ss.del(USER_KEY)
  const s = sessionFor(id)
  authListeners.forEach((l) => l(id ? 'SIGNED_IN' : 'SIGNED_OUT', s))
}

export function demoSignIn(key: DemoUserKey) {
  const u = DEMO_USERS.find((x) => x.key === key)
  if (u) setUser(u.id)
}
export function demoCurrentUser(): string | null {
  return currentUserId
}

// ---------------------------------------------------------------------------- helpers
const delay = () => new Promise((r) => setTimeout(r, LATENCY_MS))
const nowIso = () => new Date().toISOString()
let idSeq = 0
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(++idSeq).toString(36)}`

class DemoError extends Error {
  code: string
  hint?: string
  constructor(message: string, code = 'P0001', hint?: string) {
    super(message)
    this.code = code
    this.hint = hint
  }
}
const fail = (hint: string, message: string): never => {
  throw new DemoError(message, 'P0001', hint)
}

// ---------------------------------------------------------------------------- "RLS"
const me = () => db.profiles.find((p) => p.id === currentUserId) ?? null
const approved = () => {
  const m = me()
  return m && m.status === 'approved' ? m : null
}
const isAdmin = () => approved()?.role === 'admin'
const isStaff = () => ['admin', 'team'].includes(approved()?.role)
const clientOrg = () => {
  const m = approved()
  return m?.role === 'client' ? (m.org_id as string | null) : null
}
const isAssigned = (projectId: string) => isStaff() && db.project_members.some((m) => m.project_id === projectId && m.user_id === currentUserId)
const canWork = (projectId: string) => isAdmin() || isAssigned(projectId)
const isProjectClient = (projectId: string) => {
  const org = clientOrg()
  return Boolean(org) && db.projects.some((p) => p.id === projectId && p.org_id === org)
}
const canView = (projectId: string) => canWork(projectId) || isProjectClient(projectId)

function canSeeProfile(p: Row): boolean {
  const m = approved()
  if (!m) return false
  if (p.id === m.id || m.role === 'admin') return true
  if (m.role === 'team') {
    if (p.role === 'admin' || p.role === 'team') return true
    const orgs = db.projects.filter((pr) => isAssigned(pr.id)).map((pr) => pr.org_id)
    return orgs.includes(p.org_id)
  }
  const org = clientOrg()
  if (!org) return false
  if (p.org_id === org) return true
  return (
    (p.role === 'admin' || p.role === 'team') &&
    p.status === 'approved' &&
    db.project_members.some((pm) => pm.user_id === p.id && db.projects.some((pr) => pr.id === pm.project_id && pr.org_id === org))
  )
}

function canSee(table: string, r: Row): boolean {
  switch (table) {
    case 'profiles':
      return canSeeProfile(r)
    case 'organizations':
      return isAdmin() || r.id === clientOrg() || (isStaff() && db.projects.some((p) => p.org_id === r.id && isAssigned(p.id)))
    case 'projects':
      return isAdmin() || isAssigned(r.id) || (clientOrg() !== null && r.org_id === clientOrg())
    case 'project_members':
    case 'project_stages':
    case 'access_steps':
    case 'project_due_date_changes':
      return canView(r.project_id)
    case 'tasks':
    case 'internal_notes':
      return canWork(r.project_id)
    case 'client_updates':
      return canWork(r.project_id) || (r.status === 'published' && isProjectClient(r.project_id))
    case 'time_entries':
      return (r.user_id === currentUserId && isStaff()) || isAdmin()
    case 'notifications':
      return r.user_id === currentUserId && approved() !== null
    case 'audit_log':
    case 'staff_invites':
    case 'email_outbox':
      return isAdmin()
    case 'project_templates':
    case 'template_items':
      return isStaff()
    case 'client_requests':
      return isAdmin() || r.org_id === clientOrg() || (r.project_id && isAssigned(r.project_id))
    default:
      return false
  }
}

function canWrite(table: string, op: 'insert' | 'update' | 'delete', r: Row): boolean {
  switch (table) {
    case 'tasks':
    case 'project_stages':
      return canWork(r.project_id)
    case 'internal_notes':
      return op === 'insert' ? canWork(r.project_id) && r.author_id === currentUserId : canWork(r.project_id) && (r.author_id === currentUserId || isAdmin())
    case 'notifications':
      return op !== 'insert' && r.user_id === currentUserId
    case 'profiles':
      return op === 'update' && ((r.id === currentUserId && approved() !== null) || isAdmin())
    case 'organizations':
      return op === 'update' ? isAdmin() || r.id === clientOrg() : isAdmin()
    case 'projects':
      return op === 'update' ? canWork(r.id) : isAdmin()
    case 'access_steps':
      return op === 'update' ? canWork(r.project_id) || isProjectClient(r.project_id) : isAdmin()
    case 'client_requests':
      return op === 'update' && (isAdmin() || (r.project_id && isAssigned(r.project_id)))
    case 'project_members':
    case 'staff_invites':
    case 'template_items':
    case 'project_templates':
    case 'time_entries':
      return isAdmin()
    default:
      return false
  }
}

// ---------------------------------------------------------------------------- notifications + realtime
type Sub = { userId: string | null; cb: (payload: { new: Row }) => void }
const subs = new Set<Sub>()

function notify(userId: string, type: string, title: string, body: string, link: string) {
  const row = { id: newId('nt'), user_id: userId, type, title, body, link, read_at: null, created_at: nowIso() }
  db.notifications.push(row)
  subs.forEach((s) => s.userId === userId && setTimeout(() => s.cb({ new: { ...row } }), 30))
}
const projectClients = (projectId: string) => {
  const p = db.projects.find((x) => x.id === projectId)
  return db.profiles.filter((u) => u.role === 'client' && u.status === 'approved' && p && u.org_id === p.org_id)
}
const projectStaff = (projectId: string) =>
  db.profiles.filter(
    (u) => u.status === 'approved' && (u.role === 'admin' || (u.role === 'team' && db.project_members.some((m) => m.project_id === projectId && m.user_id === u.id))),
  )
const admins = () => db.profiles.filter((u) => u.role === 'admin' && u.status === 'approved')
const nameOf = (id: string | null) => {
  const p = db.profiles.find((x) => x.id === id)
  return p?.full_name ?? p?.email ?? 'Someone'
}
function audit(entity_type: string, entity_id: string, action: string, old_data: Row | null, new_data: Row | null) {
  const id = (db.audit_log.reduce((m, r) => Math.max(m, r.id), 0) as number) + 1
  db.audit_log.push({ id, actor_id: currentUserId, entity_type, entity_id, action, old_data, new_data, created_at: nowIso() })
}

// ---------------------------------------------------------------------------- write rules (mirror DB triggers)
function beforeUpdate(table: string, oldRow: Row, next: Row): Row {
  const staffOnlyApi = !isAdmin()
  if (table === 'profiles' && staffOnlyApi) {
    for (const k of ['role', 'status', 'org_id', 'email', 'requested_company_name']) {
      if (next[k] !== oldRow[k]) throw new DemoError('You can only change your own name, photo, timezone and theme.', '42501')
    }
  }
  if (table === 'projects' && staffOnlyApi) {
    for (const k of ['org_id', 'name', 'template', 'start_date', 'due_date', 'require_admin_approval', 'kickoff_confirmed_at']) {
      if (next[k] !== oldRow[k]) throw new DemoError('Only an admin can change these project settings.', '42501')
    }
  }
  if (table === 'access_steps') {
    next.updated_at = nowIso()
    next.updated_by = currentUserId
    const changed = ['status', 'value_text', 'note'].some((k) => next[k] !== oldRow[k]) || JSON.stringify(next.fields) !== JSON.stringify(oldRow.fields)
    if (isAdmin()) {
      if (changed && ['provided', 'skipped'].includes(next.status)) next.provided_by = 'admin'
      else if (next.status === 'pending') next.provided_by = null
    } else if (isStaff()) {
      if (next.value_text !== oldRow.value_text || JSON.stringify(next.fields) !== JSON.stringify(oldRow.fields))
        throw new DemoError('Team members can only mark a step as verified.', '42501')
    } else {
      if (oldRow.status === 'verified' && changed) throw new DemoError('Our team already checked this step. Contact us if something changed.', '42501')
      if (next.status === 'verified') throw new DemoError('Only the Coherent team can mark a step as verified.', '42501')
      next.provided_by = ['provided', 'skipped'].includes(next.status) ? 'client' : null
    }
    if (next.status === 'skipped' && !String(next.note ?? '').trim()) throw new DemoError('violates check constraint "skipped_needs_note"', '23514')
  }
  if (table === 'project_stages' && next.status !== oldRow.status) {
    if (next.status === 'active' && !next.started_at) next.started_at = nowIso()
    next.completed_at = next.status === 'done' ? nowIso() : null
  }
  return next
}

function afterUpdate(table: string, oldRow: Row, row: Row) {
  if (table === 'projects') {
    if (row.due_date !== oldRow.due_date) {
      db.project_due_date_changes.push({ id: newId('dd'), project_id: row.id, old_date: oldRow.due_date, new_date: row.due_date, changed_by: currentUserId, changed_at: nowIso() })
      projectClients(row.id).forEach((c) =>
        notify(c.id, 'due_date_changed', `New due date for ${row.name}`, row.due_date ? `Your project is now due on ${row.due_date}.` : 'The due date was removed.', `/client/projects/${row.id}`),
      )
    }
    audit('projects', row.id, 'update', oldRow, row)
  }
  if (table === 'access_steps') audit('access_steps', row.id, 'update', oldRow, row)
  if (table === 'project_stages' && row.status === 'active' && oldRow.status !== 'active') {
    const p = db.projects.find((x) => x.id === row.project_id)
    if (p) {
      p.current_stage = row.name
      projectClients(p.id).forEach((c) => notify(c.id, 'stage_changed', `${p.name} moved to ${row.name}`, `Your project is now in the ${row.name} stage.`, `/client/projects/${p.id}`))
    }
  }
}

function afterInsert(table: string, row: Row) {
  if (table === 'staff_invites') {
    const existing = db.profiles.find((p) => p.email === row.email)
    if (existing && existing.role !== 'admin') {
      existing.role = row.role
      existing.status = 'approved'
      row.used_at = nowIso()
    }
  }
}

// ---------------------------------------------------------------------------- select parsing + embeds
type Embed = { name: string; cols: string }
function parseSelect(sel: string): { cols: string[]; embeds: Embed[] } {
  const parts: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of sel) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) {
      parts.push(cur.trim())
      cur = ''
    } else cur += ch
  }
  if (cur.trim()) parts.push(cur.trim())
  const cols: string[] = []
  const embeds: Embed[] = []
  for (const p of parts) {
    const m = p.match(/^(\w+)\((.*)\)$/s)
    if (m) embeds.push({ name: m[1], cols: m[2] })
    else cols.push(p)
  }
  return { cols, embeds }
}

const RELATIONS: Record<string, Record<string, { type: 'one' | 'many'; fk: string }>> = {
  projects: { organizations: { type: 'one', fk: 'org_id' } },
  project_members: { profiles: { type: 'one', fk: 'user_id' } },
  time_entries: { profiles: { type: 'one', fk: 'user_id' }, projects: { type: 'one', fk: 'project_id' } },
  client_updates: { projects: { type: 'one', fk: 'project_id' } },
  client_requests: { organizations: { type: 'one', fk: 'org_id' }, projects: { type: 'one', fk: 'project_id' }, profiles: { type: 'one', fk: 'author_id' } },
  organizations: { projects: { type: 'many', fk: 'org_id' }, profiles: { type: 'many', fk: 'org_id' } },
}

function project(table: string, row: Row, sel: string): Row {
  const { cols, embeds } = parseSelect(sel || '*')
  const out: Row = {}
  if (cols.includes('*')) Object.assign(out, structuredClone(row))
  for (const c of cols) if (c !== '*') out[c] = structuredClone(row[c])
  for (const e of embeds) {
    const rel = RELATIONS[table]?.[e.name]
    if (!rel) continue
    const target = (db[e.name] ?? []).filter((r) => canSee(e.name, r))
    if (rel.type === 'one') {
      const hit = target.find((r) => r.id === row[rel.fk])
      out[e.name] = hit ? project(e.name, hit, e.cols) : null
    } else {
      const many = target.filter((r) => r[rel.fk] === row.id)
      out[e.name] = e.cols.trim() === 'count' ? [{ count: many.length }] : many.map((r) => project(e.name, r, e.cols))
    }
  }
  return out
}

// ---------------------------------------------------------------------------- query builder
type Filter = (r: Row) => boolean
type Result = { data: any; error: any; count?: number | null }

class Query implements PromiseLike<Result> {
  private op: 'select' | 'insert' | 'update' | 'delete' = 'select'
  private cols = '*'
  private returning = false
  private filters: Filter[] = []
  private orders: { col: string; asc: boolean; nullsFirst?: boolean }[] = []
  private max: number | null = null
  private singleMode: 'one' | 'maybe' | null = null
  private payload: any = null
  constructor(private table: string) {}

  select(cols = '*') {
    if (this.op === 'select') this.cols = cols
    else {
      this.returning = true
      this.cols = cols
    }
    return this
  }
  insert(rows: Row | Row[]) {
    this.op = 'insert'
    this.payload = Array.isArray(rows) ? rows : [rows]
    return this
  }
  update(patch: Row) {
    this.op = 'update'
    this.payload = patch
    return this
  }
  delete() {
    this.op = 'delete'
    return this
  }
  eq(c: string, v: unknown) {
    this.filters.push((r) => r[c] === v)
    return this
  }
  neq(c: string, v: unknown) {
    this.filters.push((r) => r[c] !== v)
    return this
  }
  in(c: string, vs: unknown[]) {
    this.filters.push((r) => vs.includes(r[c]))
    return this
  }
  is(c: string, v: unknown) {
    this.filters.push((r) => (v === null ? r[c] === null || r[c] === undefined : r[c] === v))
    return this
  }
  gte(c: string, v: any) {
    this.filters.push((r) => r[c] !== null && r[c] >= v)
    return this
  }
  lt(c: string, v: any) {
    this.filters.push((r) => r[c] !== null && r[c] < v)
    return this
  }
  /** Supports the simple form used by the app: "a.is.null,b.gte.2026-01-01T00:00:00Z". */
  or(expr: string) {
    const parts = expr.split(',').map((p) => {
      const [col, op, ...rest] = p.split('.')
      const val = rest.join('.')
      return (r: Row) => (op === 'is' && val === 'null' ? r[col] == null : op === 'gte' ? r[col] != null && r[col] >= val : op === 'eq' ? String(r[col]) === val : false)
    })
    this.filters.push((r) => parts.some((f) => f(r)))
    return this
  }
  order(col: string, opts: { ascending?: boolean; nullsFirst?: boolean } = {}) {
    this.orders.push({ col, asc: opts.ascending ?? true, nullsFirst: opts.nullsFirst })
    return this
  }
  limit(n: number) {
    this.max = n
    return this
  }
  maybeSingle() {
    this.singleMode = 'maybe'
    return this
  }
  then<A = Result, B = never>(onOk?: ((v: Result) => A | PromiseLike<A>) | null, onErr?: ((e: any) => B | PromiseLike<B>) | null): PromiseLike<A | B> {
    return this.run().then(onOk, onErr)
  }
  single() {
    this.singleMode = 'one'
    return this
  }

  private sort(rows: Row[]) {
    for (const o of [...this.orders].reverse()) {
      rows.sort((a, b) => {
        const x = a[o.col]
        const y = b[o.col]
        if (x == null && y == null) return 0
        const nullsFirst = o.nullsFirst ?? !o.asc
        if (x == null) return nullsFirst ? -1 : 1
        if (y == null) return nullsFirst ? 1 : -1
        return (x < y ? -1 : x > y ? 1 : 0) * (o.asc ? 1 : -1)
      })
    }
    return rows
  }

  private finish(rows: Row[]): Result {
    let out = rows.map((r) => project(this.table, r, this.cols))
    if (this.singleMode) {
      if (this.singleMode === 'one' && out.length !== 1) return { data: null, error: new DemoError('JSON object requested, multiple (or no) rows returned', 'PGRST116') }
      return { data: out[0] ?? null, error: null }
    }
    if (this.max !== null) out = out.slice(0, this.max)
    return { data: out, error: null }
  }

  private async run(): Promise<Result> {
    await delay()
    try {
      const all = db[this.table]
      if (!all) throw new DemoError(`Unknown table ${this.table}`, '42P01')
      const visible = () => all.filter((r) => canSee(this.table, r) && this.filters.every((f) => f(r)))

      if (this.op === 'select') {
        let rows = this.sort(visible())
        if (this.max !== null && !this.singleMode) rows = rows.slice(0, this.max)
        return this.finish(rows)
      }

      if (this.op === 'insert') {
        const inserted: Row[] = []
        for (const input of this.payload as Row[]) {
          const row: Row = { id: newId(this.table.slice(0, 3)), created_at: nowIso(), ...input }
          if (this.table === 'tasks') Object.assign(row, { status: row.status ?? 'todo', updated_at: nowIso() })
          if (this.table === 'organizations') Object.assign(row, { timezone: row.timezone ?? 'UTC', bio: row.bio ?? null, logo_url: null, billing_email: row.billing_email ?? null })
          if (this.table === 'staff_invites') {
            if (all.some((r) => r.email === row.email)) throw new DemoError('duplicate key value violates unique constraint', '23505')
            Object.assign(row, { used_at: null })
          }
          if (!canWrite(this.table, 'insert', row)) throw new DemoError('new row violates row-level security policy', '42501')
          all.push(row)
          afterInsert(this.table, row)
          inserted.push(row)
        }
        save()
        return this.returning ? this.finish(inserted) : { data: null, error: null }
      }

      if (this.op === 'update') {
        const updated: Row[] = []
        for (const r of visible()) {
          if (!canWrite(this.table, 'update', r)) continue
          const oldRow = structuredClone(r)
          const next = beforeUpdate(this.table, oldRow, { ...r, ...this.payload })
          Object.assign(r, next)
          afterUpdate(this.table, oldRow, r)
          updated.push(r)
        }
        save()
        return this.returning ? this.finish(updated) : { data: null, error: null }
      }

      // delete
      const gone = visible().filter((r) => canWrite(this.table, 'delete', r))
      db[this.table] = all.filter((r) => !gone.includes(r))
      save()
      return { data: null, error: null }
    } catch (e) {
      return { data: null, error: e }
    }
  }
}

function from(table: string) {
  return new Query(table)
}

// ---------------------------------------------------------------------------- RPCs (mirror supabase/migrations)
const RPC: Record<string, (args: any) => any> = {
  get_my_account() {
    const m = me()
    if (!m) return null
    const { id, role, status, email, full_name, avatar_url, org_id, timezone, theme_preference, requested_company_name } = m
    return { id, role, status, email, full_name, avatar_url, org_id, timezone, theme_preference, requested_company_name }
  },
  keepalive: () => nowIso(),
  project_progress({ p_project_id }: { p_project_id: string }) {
    if (!canView(p_project_id)) return null
    const tasks = db.tasks.filter((t) => t.project_id === p_project_id)
    if (tasks.length) return Math.round((100 * tasks.filter((t) => t.status === 'done').length) / tasks.length)
    const stages = db.project_stages.filter((s) => s.project_id === p_project_id)
    return stages.length ? Math.round((100 * stages.filter((s) => s.status === 'done').length) / stages.length) : 0
  },
  start_timer({ p_project_id, p_task_id }: { p_project_id: string; p_task_id?: string | null }) {
    if (!canWork(p_project_id)) fail('not_allowed', 'You are not assigned to this project.')
    if (db.time_entries.some((e) => e.user_id === currentUserId && !e.ended_at)) fail('timer_running', 'A timer is already running. Stop it or switch project.')
    const row = { id: newId('te'), user_id: currentUserId, project_id: p_project_id, task_id: p_task_id ?? null, started_at: nowIso(), ended_at: null, auto_stopped: false, handoff_note: null, created_at: nowIso() }
    db.time_entries.push(row)
    return row
  },
  stop_timer({ p_handoff_note }: { p_handoff_note?: string | null }) {
    if (!isStaff()) fail('not_allowed', 'Only team members can track time.')
    const e = db.time_entries.find((x) => x.user_id === currentUserId && !x.ended_at)
    if (!e) return null
    e.ended_at = nowIso()
    if (p_handoff_note?.trim()) e.handoff_note = p_handoff_note.trim()
    return e
  },
  switch_project({ new_project_id, handoff_note }: { new_project_id: string; handoff_note?: string | null }) {
    if (!canWork(new_project_id)) fail('not_allowed', 'You are not assigned to this project.')
    const now = nowIso() // same instant for both: no gap, no overlap
    const running = db.time_entries.find((x) => x.user_id === currentUserId && !x.ended_at)
    if (running) {
      running.ended_at = now
      if (handoff_note?.trim()) running.handoff_note = handoff_note.trim()
    }
    const row = { id: newId('te'), user_id: currentUserId, project_id: new_project_id, task_id: null, started_at: now, ended_at: null, auto_stopped: false, handoff_note: null, created_at: now }
    db.time_entries.push(row)
    return row
  },
  submit_client_update({ p_project_id, p_message, p_task_id }: { p_project_id: string; p_message: string; p_task_id?: string | null }) {
    if (!canWork(p_project_id)) fail('not_allowed', 'You are not assigned to this project.')
    if (!p_message?.trim()) fail('empty_message', 'Please write a short message for the client.')
    const p = db.projects.find((x) => x.id === p_project_id)!
    const task = db.tasks.find((x) => x.id === p_task_id)
    const stageId = task?.stage_id ?? db.project_stages.find((s) => s.project_id === p_project_id && s.status === 'active')?.id ?? null
    const status = p.require_admin_approval && !isAdmin() ? 'pending_approval' : 'published'
    const row = {
      id: newId('cu'), project_id: p_project_id, task_id: p_task_id ?? null, stage_id: stageId, author_id: currentUserId, author_name: nameOf(currentUserId),
      message: p_message.trim(), kind: 'update', status, reviewed_by: null, reviewed_at: null, published_at: status === 'published' ? nowIso() : null, created_at: nowIso(),
    }
    db.client_updates.push(row)
    audit('client_updates', row.id, 'insert', null, row)
    if (status === 'published') projectClients(p.id).forEach((c) => notify(c.id, 'new_update', `New update on ${p.name}`, `${row.author_name}: ${row.message}`, `/client/projects/${p.id}`))
    else admins().forEach((a) => notify(a.id, 'update_pending_approval', 'Update waiting for approval', `${row.author_name} wrote an update for ${p.name}: ${row.message}`, '/admin/approvals'))
    return row
  },
  review_client_update({ p_update_id, p_approve }: { p_update_id: string; p_approve: boolean }) {
    if (!isAdmin()) fail('not_allowed', 'Only an admin can approve updates.')
    const u = db.client_updates.find((x) => x.id === p_update_id && x.status === 'pending_approval')
    if (!u) return fail('not_pending', 'This update is not waiting for approval.')
    u.status = p_approve ? 'published' : 'rejected'
    u.reviewed_by = currentUserId
    u.reviewed_at = nowIso()
    u.published_at = p_approve ? nowIso() : null
    const p = db.projects.find((x) => x.id === u.project_id)!
    if (p_approve) projectClients(p.id).forEach((c) => notify(c.id, 'new_update', `New update on ${p.name}`, `${u.author_name}: ${u.message}`, `/client/projects/${p.id}`))
    return u
  },
  confirm_kickoff({ p_project_id }: { p_project_id: string }) {
    if (!(isProjectClient(p_project_id) || isAdmin())) fail('not_allowed', 'You cannot start this project.')
    const p = db.projects.find((x) => x.id === p_project_id)!
    if (p.kickoff_confirmed_at) fail('already_confirmed', 'This project has already been started.')
    const steps = db.access_steps.filter((s) => s.project_id === p_project_id).sort((a, b) => a.position - b.position)
    if (steps.some((s) => s.key === 'webflow' && s.status === 'pending')) fail('webflow_pending', 'Please share Webflow access first. We need it to start.')
    const pending = steps.filter((s) => s.status === 'pending').map((s) => s.key)
    Object.assign(p, { kickoff_confirmed_at: nowIso(), kickoff_confirmed_by: currentUserId, status: 'kickoff_confirmed' })
    const stages = db.project_stages.filter((s) => s.project_id === p.id).sort((a, b) => a.position - b.position)
    if (stages.length && stages.every((s) => s.status === 'upcoming')) {
      Object.assign(stages[0], { status: 'active', started_at: nowIso() })
      p.current_stage = stages[0].name
    }
    db.client_updates.push({
      id: newId('cu'), project_id: p.id, task_id: null, stage_id: stages[0]?.id ?? null, author_id: currentUserId, author_name: nameOf(currentUserId),
      message: 'Project started', kind: 'milestone', status: 'published', reviewed_by: null, reviewed_at: null, published_at: nowIso(), created_at: nowIso(),
    })
    const org = db.organizations.find((o) => o.id === p.org_id)
    projectStaff(p.id).forEach((s) => notify(s.id, 'kickoff_confirmed', `${org?.name} is ready to start ${p.name}`, `${nameOf(currentUserId)} pressed "Let's Go".`, `/team/projects/${p.id}`))
    notify(currentUserId!, 'kickoff_confirmed', `Your project has started: ${p.name}`, `Thanks! Due date: ${p.due_date ?? 'to be confirmed'}.`, `/client/projects/${p.id}`)
    audit('projects', p.id, 'update', null, { status: 'kickoff_confirmed' })
    return { ok: true, pending_steps: pending }
  },
  create_project_from_template(a: { p_org_id: string; p_name: string; p_template: string; p_start_date?: string | null; p_due_date?: string | null; p_member_ids?: string[] }) {
    if (!isAdmin()) fail('not_allowed', 'Only an admin can create projects.')
    const id = newId('p')
    const p = {
      id, org_id: a.p_org_id, name: a.p_name.trim(), template: a.p_template, status: 'onboarding', current_stage: null, start_date: a.p_start_date ?? null,
      due_date: a.p_due_date ?? null, kickoff_confirmed_at: null, kickoff_confirmed_by: null, require_admin_approval: false, webvizio_url: null, staging_url: null,
      last_access_reminder_at: null, created_by: currentUserId, created_at: nowIso(),
    }
    db.projects.push(p)
    const tpl = db.project_templates.find((t) => t.key === a.p_template)
    const items = db.template_items.filter((i) => i.template_id === tpl?.id).sort((x, y) => x.position - y.position)
    items.filter((i) => i.kind === 'stage').forEach((i) =>
      db.project_stages.push({ id: newId('st'), project_id: id, name: i.name, position: i.position, status: 'upcoming', due_date: null, started_at: null, completed_at: null, created_at: nowIso() }),
    )
    items.filter((i) => i.kind === 'task').forEach((i) =>
      db.tasks.push({
        id: newId('task'), project_id: id, stage_id: db.project_stages.find((s) => s.project_id === id && s.name === i.stage_name)?.id ?? null, title: i.name,
        description: null, assignee_id: null, status: 'todo', due_date: null, position: i.position, created_at: nowIso(), updated_at: nowIso(),
      }),
    )
    items.filter((i) => i.kind === 'access_step').forEach((i) =>
      db.access_steps.push({ id: newId('as'), project_id: id, key: i.access_key, position: i.position, status: 'pending', value_text: null, fields: {}, note: null, provided_by: null, updated_by: null, updated_at: nowIso() }),
    )
    for (const m of a.p_member_ids ?? []) db.project_members.push({ project_id: id, user_id: m, added_at: nowIso() })
    audit('projects', id, 'insert', null, p)
    return p
  },
  advance_stage({ p_project_id }: { p_project_id: string }) {
    if (!canWork(p_project_id)) fail('not_allowed', 'You are not assigned to this project.')
    const stages = db.project_stages.filter((s) => s.project_id === p_project_id).sort((a, b) => a.position - b.position)
    const p = db.projects.find((x) => x.id === p_project_id)!
    const active = stages.find((s) => s.status === 'active')
    if (active) Object.assign(active, { status: 'done', completed_at: nowIso() })
    const next = stages.find((s) => s.status === 'upcoming' && (!active || s.position >= active.position))
    if (next) {
      const old = { ...next }
      Object.assign(next, { status: 'active', started_at: nowIso() })
      afterUpdate('project_stages', old, next)
      if (['onboarding', 'kickoff_confirmed'].includes(p.status)) p.status = 'in_progress'
    } else {
      Object.assign(p, { status: 'completed', current_stage: null })
    }
    return next ?? null
  },
  submit_client_request(a: { p_kind: string; p_title: string; p_details?: string | null; p_project_id?: string | null; p_page_url?: string | null }) {
    const org = clientOrg()
    if (!org) fail('not_allowed', 'Your account is not linked to a company yet.')
    if (!a.p_title?.trim()) fail('empty_title', 'Please add a short title.')
    const row = { id: newId('cr'), org_id: org, project_id: a.p_project_id ?? null, author_id: currentUserId, kind: a.p_kind, title: a.p_title.trim(), details: a.p_details ?? null, page_url: a.p_page_url ?? null, status: 'open', created_at: nowIso() }
    db.client_requests.push(row)
    const orgName = db.organizations.find((o) => o.id === org)?.name
    admins().forEach((ad) => notify(ad.id, a.p_kind === 'bug' ? 'client_bug' : 'client_request', `${a.p_kind === 'bug' ? 'Bug report' : 'New request'} from ${orgName}`, `${nameOf(currentUserId)}: ${row.title}`, '/admin/requests'))
    return row
  },
  review_team_member({ p_user_id, p_approve }: { p_user_id: string; p_approve: boolean }) {
    if (!isAdmin()) fail('not_allowed', 'Only an admin can do this.')
    const p = db.profiles.find((x) => x.id === p_user_id && x.status === 'pending' && x.role === 'team')
    if (!p) return fail('not_pending', 'This person is not waiting for approval.')
    p.status = p_approve ? 'approved' : 'rejected'
    return p
  },
  link_client_to_org({ p_user_id, p_org_id }: { p_user_id: string; p_org_id: string }) {
    if (!isAdmin()) fail('not_allowed', 'Only an admin can do this.')
    const p = db.profiles.find((x) => x.id === p_user_id && x.role === 'client')
    if (!p) return fail('not_client', 'Only client accounts can be linked to an organization.')
    p.org_id = p_org_id
    notify(p.id, 'client_linked', 'Your project space is ready', 'You now have access to the Coherent client portal.', '/client')
    return p
  },
  create_org_for_client({ p_user_id, p_name }: { p_user_id: string; p_name?: string | null }) {
    if (!isAdmin()) fail('not_allowed', 'Only an admin can do this.')
    const p = db.profiles.find((x) => x.id === p_user_id && x.role === 'client')
    if (!p) return fail('not_client', 'Only client accounts can be linked to an organization.')
    const org = { id: newId('org'), name: p_name?.trim() || p.requested_company_name || p.email, bio: null, logo_url: null, billing_email: p.email, timezone: p.timezone, created_at: nowIso() }
    db.organizations.push(org)
    RPC.link_client_to_org({ p_user_id, p_org_id: org.id })
    return org
  },
  admin_set_user_role({ p_user_id, p_role }: { p_user_id: string; p_role: string }) {
    if (!isAdmin()) fail('not_allowed', 'Only an admin can do this.')
    const p = db.profiles.find((x) => x.id === p_user_id)!
    if (p.role === 'admin' && p_role !== 'admin' && admins().length <= 1) fail('last_admin', 'There must always be at least one admin.')
    Object.assign(p, { role: p_role, status: 'approved', org_id: p_role === 'client' ? p.org_id : null })
    return p
  },
}

async function rpc(name: string, args: Record<string, unknown> = {}): Promise<Result> {
  await delay()
  const fn = RPC[name]
  if (!fn) return { data: null, error: new DemoError(`Function ${name} not found`, 'PGRST202') }
  try {
    const data = structuredClone(fn(args) ?? null)
    save()
    return { data, error: null }
  } catch (e) {
    return { data: null, error: e }
  }
}

// ---------------------------------------------------------------------------- auth
const knownEmail = (email: string) => db.profiles.find((p) => p.email?.toLowerCase() === email.trim().toLowerCase())

const auth = {
  async getSession() {
    return { data: { session: sessionFor(currentUserId) }, error: null }
  },
  onAuthStateChange(cb: AuthListener) {
    authListeners.add(cb)
    setTimeout(() => cb('INITIAL_SESSION', sessionFor(currentUserId)), 0)
    return { data: { subscription: { unsubscribe: () => authListeners.delete(cb) } } }
  },
  /** Magic link: no email is sent in demo mode. Unknown emails behave like the real login page. */
  async signInWithOtp({ email, options }: { email: string; options?: { shouldCreateUser?: boolean } }) {
    await delay()
    if (options?.shouldCreateUser === false && !knownEmail(email)) {
      return { data: null, error: Object.assign(new Error('Signups not allowed for otp'), { code: 'otp_disabled', status: 422 }) }
    }
    return { data: {}, error: null }
  },
  async signInWithPassword({ email }: { email: string }) {
    await delay()
    const p = knownEmail(email)
    if (!p) return { data: null, error: Object.assign(new Error('Invalid login credentials'), { code: 'invalid_credentials', status: 400 }) }
    setUser(p.id)
    return { data: { session: sessionFor(p.id) }, error: null }
  },
  async signOut() {
    setUser(null)
    return { error: null }
  },
}

// ---------------------------------------------------------------------------- realtime + storage
function channel() {
  const sub: Sub = { userId: null, cb: () => undefined }
  const ch = {
    on(_type: string, opts: { filter?: string }, cb: Sub['cb']) {
      sub.userId = opts.filter?.match(/user_id=eq\.(.+)$/)?.[1] ?? null
      sub.cb = cb
      return ch
    },
    subscribe() {
      subs.add(sub)
      return ch
    },
    _sub: sub,
  }
  return ch
}
async function removeChannel(ch: { _sub?: Sub }) {
  if (ch?._sub) subs.delete(ch._sub)
  return 'ok'
}

const files = new Map<string, string>()
const storage = {
  from(bucket: string) {
    return {
      async upload(path: string, file: File) {
        const url = await new Promise<string>((resolve) => {
          const r = new FileReader()
          r.onload = () => resolve(String(r.result))
          r.readAsDataURL(file)
        })
        files.set(`${bucket}/${path}`, url)
        return { data: { path }, error: null }
      },
      getPublicUrl(path: string) {
        return { data: { publicUrl: files.get(`${bucket}/${path}`) ?? '' } }
      },
    }
  },
}

export const supabase = { auth, from, rpc, channel, removeChannel, storage } as unknown as SupabaseClient
