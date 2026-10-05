import { beforeEach, describe, expect, test } from 'vitest'
import { seed, DEMO_USERS } from './data'
import { demoSignIn, resetDemoData, supabase } from './supabaseDemo'

describe('demo data', () => {
  const db = seed()

  test('uses only fake @example.com emails', () => {
    const emails = [...db.profiles.map((p) => p.email), ...db.staff_invites.map((i) => i.email), ...db.organizations.map((o) => o.billing_email)]
    expect(emails.length).toBeGreaterThan(5)
    for (const e of emails) expect(e).toMatch(/@example\.com$/)
  })

  test('covers every state the previews need', () => {
    expect(db.projects).toHaveLength(3)
    expect(new Set(db.projects.map((p) => p.template))).toEqual(new Set(['webflow_build', 'seo_audit']))
    const inFive = new Date()
    inFive.setDate(inFive.getDate() + 5)
    const five = `${inFive.getFullYear()}-${String(inFive.getMonth() + 1).padStart(2, '0')}-${String(inFive.getDate()).padStart(2, '0')}`
    expect(db.projects.some((p) => p.due_date === five)).toBe(true)
    expect(new Set(db.access_steps.map((s) => s.status))).toEqual(new Set(['pending', 'provided', 'skipped', 'verified']))
    expect(db.time_entries.filter((t) => t.ended_at === null)).toHaveLength(1)
    expect(db.time_entries.some((t) => t.auto_stopped)).toBe(true)
    expect(db.profiles.some((p) => p.role === 'team' && p.status === 'pending')).toBe(true)
    expect(db.profiles.some((p) => p.role === 'client' && p.org_id === null)).toBe(true)
    expect(DEMO_USERS).toHaveLength(7)
  })
})

describe('demo client mirrors the database rules', () => {
  beforeEach(() => resetDemoData())

  test('a client sees only their own organization and never internal data', async () => {
    demoSignIn('client-a')
    const { data: projects } = await supabase.from('projects').select('id')
    expect(projects!.map((p: { id: string }) => p.id)).toEqual(['p-acme'])
    expect((await supabase.from('internal_notes').select('*')).data).toEqual([])
    expect((await supabase.from('time_entries').select('*')).data).toEqual([])
    expect((await supabase.from('tasks').select('*')).data).toEqual([])
  })

  test('a team member sees only assigned projects', async () => {
    demoSignIn('sadman')
    const { data } = await supabase.from('projects').select('id')
    expect(data!.map((p: { id: string }) => p.id).sort()).toEqual(['p-acme', 'p-spring'])
  })

  test("Let's Go is blocked while Webflow is pending", async () => {
    demoSignIn('client-a')
    const { error } = await supabase.rpc('confirm_kickoff', { p_project_id: 'p-acme' })
    expect((error as { hint?: string }).hint).toBe('webflow_pending')
  })

  test('a pending team member can read nothing', async () => {
    demoSignIn('pending')
    expect((await supabase.from('projects').select('*')).data).toEqual([])
    expect((await supabase.from('profiles').select('*')).data).toEqual([])
  })
})
