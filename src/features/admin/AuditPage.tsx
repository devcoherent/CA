import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAsync, unwrap } from '@/lib/useAsync'
import type { AuditEntry, Profile } from '@/lib/types'
import { formatDateTime, toDateInput } from '@/lib/format'
import { friendlyError } from '@/lib/errors'
import { Badge, EmptyState, ErrorBox, LoadingList, PageHeader } from '@/components/ui'

const ENTITY_LABEL: Record<string, string> = {
  access_steps: 'Access step',
  projects: 'Project',
  project_due_date_changes: 'Due date change',
  client_updates: 'Client update',
}

function changedKeys(e: AuditEntry): string[] {
  if (e.action !== 'update' || !e.old_data || !e.new_data) return []
  return Object.keys(e.new_data).filter((k) => k !== 'updated_at' && JSON.stringify(e.new_data![k]) !== JSON.stringify(e.old_data![k]))
}

export default function AuditPage() {
  const [entity, setEntity] = useState('')
  const [actor, setActor] = useState('')
  const [action, setAction] = useState('')
  const [from, setFrom] = useState(toDateInput(new Date(Date.now() - 30 * 86_400_000)))
  const [to, setTo] = useState(toDateInput(new Date()))

  const { data: people } = useAsync(async () => unwrap(await supabase.from('profiles').select('id, full_name, email').order('full_name')) as Pick<Profile, 'id' | 'full_name' | 'email'>[], [])

  const { data, error, loading, reload } = useAsync(async () => {
    let q = supabase
      .from('audit_log')
      .select('*')
      .gte('created_at', new Date(`${from}T00:00:00`).toISOString())
      .lt('created_at', new Date(new Date(`${to}T00:00:00`).getTime() + 86_400_000).toISOString())
      .order('created_at', { ascending: false })
      .limit(300)
    if (entity) q = q.eq('entity_type', entity)
    if (actor) q = q.eq('actor_id', actor)
    if (action) q = q.eq('action', action)
    return unwrap(await q) as AuditEntry[]
  }, [entity, actor, action, from, to])

  const who = (id: string | null) => (id ? (people?.find((p) => p.id === id)?.full_name ?? people?.find((p) => p.id === id)?.email ?? 'Someone') : 'System')

  return (
    <div>
      <PageHeader title="Audit log" subtitle="Every change to projects, access steps, due dates and client updates." />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <label htmlFor="au-entity" className="label">
            What
          </label>
          <select id="au-entity" className="field" value={entity} onChange={(e) => setEntity(e.target.value)}>
            <option value="">Everything</option>
            {Object.entries(ENTITY_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="au-actor" className="label">
            Who
          </label>
          <select id="au-actor" className="field" value={actor} onChange={(e) => setActor(e.target.value)}>
            <option value="">Anyone</option>
            {people?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name ?? p.email}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="au-action" className="label">
            Action
          </label>
          <select id="au-action" className="field" value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="">Any</option>
            <option value="insert">Created</option>
            <option value="update">Changed</option>
            <option value="delete">Deleted</option>
          </select>
        </div>
        <div>
          <label htmlFor="au-from" className="label">
            From
          </label>
          <input id="au-from" type="date" className="field" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label htmlFor="au-to" className="label">
            To
          </label>
          <input id="au-to" type="date" className="field" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>
      {error ? (
        <ErrorBox message={friendlyError(error)} onRetry={reload} />
      ) : loading || !data ? (
        <LoadingList rows={5} className="h-12" />
      ) : !data.length ? (
        <EmptyState icon="note" title="No changes match these filters" />
      ) : (
        <ul className="card divide-y divide-border">
          {data.map((e) => {
            const keys = changedKeys(e)
            const name = (e.new_data?.name ?? e.old_data?.name ?? e.new_data?.key ?? e.new_data?.message ?? '') as string
            return (
              <li key={e.id} className="px-4 py-3">
                <details>
                  <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-sm">
                    <span className="text-xs text-muted">{formatDateTime(e.created_at)}</span>
                    <Badge tone={e.action === 'delete' ? 'danger' : e.action === 'insert' ? 'success' : 'neutral'}>{e.action}</Badge>
                    <span className="font-medium">{ENTITY_LABEL[e.entity_type] ?? e.entity_type}</span>
                    {name && <span className="max-w-xs truncate text-muted">“{String(name)}”</span>}
                    <span className="text-muted">by {who(e.actor_id)}</span>
                    {keys.length > 0 && <span className="text-xs text-muted">changed: {keys.join(', ')}</span>}
                  </summary>
                  <div className="mt-3 grid gap-3 text-xs md:grid-cols-2">
                    {e.old_data && (
                      <pre className="overflow-x-auto rounded-field bg-surface p-3">
                        <span className="font-sans font-semibold">Before</span>
                        {'\n'}
                        {JSON.stringify(keys.length ? Object.fromEntries(keys.map((k) => [k, e.old_data![k]])) : e.old_data, null, 2)}
                      </pre>
                    )}
                    {e.new_data && (
                      <pre className="overflow-x-auto rounded-field bg-surface p-3">
                        <span className="font-sans font-semibold">After</span>
                        {'\n'}
                        {JSON.stringify(keys.length ? Object.fromEntries(keys.map((k) => [k, e.new_data![k]])) : e.new_data, null, 2)}
                      </pre>
                    )}
                  </div>
                </details>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
