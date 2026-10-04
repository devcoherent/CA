import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { useAsync, unwrap } from '@/lib/useAsync'
import { useAccount } from '@/features/auth/AuthProvider'
import type { ProjectStatus } from '@/lib/types'
import { PROJECT_STATUS_LABEL } from '@/lib/format'
import { friendlyError } from '@/lib/errors'
import { Avatar, Card, Notice } from '@/components/ui'
import { useToast } from '@/components/Toast'
import type { Member, WorkspaceData } from './ProjectWorkspace'

export function SettingsTab({ data, reload }: { data: WorkspaceData; reload: () => Promise<void> }) {
  const account = useAccount()
  const isAdmin = account.role === 'admin'
  const p = data.project
  const toast = useToast()
  const [form, setForm] = useState({
    name: p.name,
    status: p.status,
    start_date: p.start_date ?? '',
    due_date: p.due_date ?? '',
    require_admin_approval: p.require_admin_approval,
    webvizio_url: p.webvizio_url ?? '',
    staging_url: p.staging_url ?? '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setForm({
      name: p.name,
      status: p.status,
      start_date: p.start_date ?? '',
      due_date: p.due_date ?? '',
      require_admin_approval: p.require_admin_approval,
      webvizio_url: p.webvizio_url ?? '',
      staging_url: p.staging_url ?? '',
    })
  }, [p])

  const save = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const shared = { status: form.status, webvizio_url: form.webvizio_url.trim() || null, staging_url: form.staging_url.trim() || null }
    const update = isAdmin
      ? { ...shared, name: form.name.trim(), start_date: form.start_date || null, due_date: form.due_date || null, require_admin_approval: form.require_admin_approval }
      : shared
    const { error: err } = await supabase.from('projects').update(update).eq('id', p.id)
    setBusy(false)
    if (err) return setError(friendlyError(err))
    toast(form.due_date !== (p.due_date ?? '') ? 'Saved. The client has been told about the new due date.' : 'Project settings saved.')
    void reload()
  }

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <form className="space-y-5" onSubmit={save}>
          {!isAdmin && <Notice tone="info">Only an admin can change the name, dates and approval setting.</Notice>}
          <div>
            <label htmlFor="p-name" className="label">
              Project name
            </label>
            <input id="p-name" className="field" value={form.name} onChange={set('name')} disabled={!isAdmin} />
          </div>
          <div className="grid gap-5 sm:grid-cols-3">
            <div>
              <label htmlFor="p-status" className="label">
                Status
              </label>
              <select id="p-status" className="field" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as ProjectStatus }))}>
                {Object.entries(PROJECT_STATUS_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="p-start" className="label">
                Start date
              </label>
              <input id="p-start" type="date" className="field" value={form.start_date} onChange={set('start_date')} disabled={!isAdmin} />
            </div>
            <div>
              <label htmlFor="p-due" className="label">
                Due date
              </label>
              <input id="p-due" type="date" className="field" value={form.due_date} onChange={set('due_date')} disabled={!isAdmin} aria-describedby="p-due-hint" />
              <p id="p-due-hint" className="hint">
                The client is emailed when this changes.
              </p>
            </div>
          </div>
          <div>
            <label htmlFor="p-webvizio" className="label">
              Webvizio link (for client feedback)
            </label>
            <input id="p-webvizio" type="url" className="field" value={form.webvizio_url} onChange={set('webvizio_url')} placeholder="https://app.webvizio.com/…" />
          </div>
          <div>
            <label htmlFor="p-staging" className="label">
              Staging link
            </label>
            <input id="p-staging" type="url" className="field" value={form.staging_url} onChange={set('staging_url')} placeholder="https://your-site.webflow.io" />
          </div>
          <div className="flex items-start gap-3">
            <input
              id="p-approval"
              type="checkbox"
              className="mt-1 accent-[var(--c-accent)]"
              checked={form.require_admin_approval}
              disabled={!isAdmin}
              aria-describedby="p-approval-hint"
              onChange={(e) => setForm((f) => ({ ...f, require_admin_approval: e.target.checked }))}
            />
            <div>
              <label htmlFor="p-approval" className="block text-sm font-medium">
                Require admin approval for client updates
              </label>
              <p id="p-approval-hint" className="text-xs text-muted">
                When on, team updates wait until an admin approves them.
              </p>
            </div>
          </div>
          {error && (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save settings'}
          </button>
        </form>
      </Card>
      <MembersCard data={data} reload={reload} canEdit={isAdmin} />
    </div>
  )
}

function MembersCard({ data, reload, canEdit }: { data: WorkspaceData; reload: () => Promise<void>; canEdit: boolean }) {
  const toast = useToast()
  const [pick, setPick] = useState('')
  const { data: staff } = useAsync(
    async () =>
      canEdit
        ? (unwrap(await supabase.from('profiles').select('id, full_name, email, avatar_url, role').in('role', ['admin', 'team']).eq('status', 'approved').order('full_name')) as Member[])
        : [],
    [canEdit],
  )
  const available = (staff ?? []).filter((s) => !data.members.some((m) => m.id === s.id))

  const add = async () => {
    if (!pick) return
    const { error } = await supabase.from('project_members').insert({ project_id: data.project.id, user_id: pick })
    if (error) return toast(friendlyError(error), 'error')
    setPick('')
    void reload()
  }
  const remove = async (userId: string) => {
    const { error } = await supabase.from('project_members').delete().eq('project_id', data.project.id).eq('user_id', userId)
    if (error) return toast(friendlyError(error), 'error')
    void reload()
  }

  return (
    <Card className="h-fit">
      <h3 className="font-semibold">Team on this project</h3>
      <ul className="mt-4 space-y-3">
        {data.members.map((m) => (
          <li key={m.id} className="flex items-center gap-3 text-sm">
            <Avatar name={m.full_name ?? m.email} url={m.avatar_url} size={28} />
            <span className="min-w-0 flex-1 truncate">
              {m.full_name ?? m.email} <span className="text-xs capitalize text-muted">· {m.role}</span>
            </span>
            {canEdit && (
              <button type="button" className="text-xs text-muted hover:text-danger" onClick={() => remove(m.id)} aria-label={`Remove ${m.full_name ?? m.email}`}>
                Remove
              </button>
            )}
          </li>
        ))}
        {data.members.length === 0 && <li className="text-sm text-muted">Nobody assigned yet.</li>}
      </ul>
      {canEdit && (
        <div className="mt-5 flex gap-2">
          <label htmlFor="add-member" className="sr-only">
            Add a team member
          </label>
          <select id="add-member" className="field" value={pick} onChange={(e) => setPick(e.target.value)}>
            <option value="">Add someone…</option>
            {available.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name ?? s.email}
              </option>
            ))}
          </select>
          <button type="button" className="btn-secondary" onClick={add} disabled={!pick}>
            Add
          </button>
        </div>
      )}
    </Card>
  )
}
