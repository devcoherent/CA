import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAsync, unwrap } from '@/lib/useAsync'
import type { ClientRequest, Organization, Profile, Project } from '@/lib/types'
import { formatDateTime } from '@/lib/format'
import { friendlyError } from '@/lib/errors'
import { Badge, EmptyState, ErrorBox, LoadingList, PageHeader } from '@/components/ui'
import { useToast } from '@/components/Toast'

type Row = ClientRequest & {
  organizations: Pick<Organization, 'name'> | null
  projects: Pick<Project, 'name'> | null
  profiles: Pick<Profile, 'full_name' | 'email'> | null
}

export default function RequestsPage() {
  const toast = useToast()
  const [showDone, setShowDone] = useState(false)
  const { data, error, loading, reload } = useAsync(
    async () =>
      unwrap(
        await supabase.from('client_requests').select('*, organizations(name), projects(name), profiles(full_name, email)').order('created_at', { ascending: false }),
      ) as Row[],
    [],
  )

  const setStatus = async (id: string, status: 'open' | 'done') => {
    const { error: err } = await supabase.from('client_requests').update({ status }).eq('id', id)
    if (err) toast(friendlyError(err), 'error')
    else void reload()
  }

  const rows = (data ?? []).filter((r) => showDone || r.status === 'open')
  return (
    <div>
      <PageHeader
        title="Client requests"
        subtitle="New requests and bug reports sent from the client portal."
        actions={
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" className="accent-[var(--c-accent)]" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> Show done
          </label>
        }
      />
      {error ? (
        <ErrorBox message={friendlyError(error)} onRetry={reload} />
      ) : loading ? (
        <LoadingList rows={3} className="h-20" />
      ) : !rows.length ? (
        <EmptyState icon="send" title="No open requests" />
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="card p-5">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge tone={r.kind === 'bug' ? 'danger' : 'accent'}>{r.kind === 'bug' ? 'Bug' : 'Request'}</Badge>
                <span className="font-medium">{r.organizations?.name}</span>
                {r.projects?.name && <span className="text-muted">· {r.projects.name}</span>}
                <span className="text-muted">
                  · {r.profiles?.full_name ?? r.profiles?.email} · {formatDateTime(r.created_at)}
                </span>
                {r.status === 'done' && <Badge tone="success">Done</Badge>}
              </div>
              <p className="mt-2 font-semibold">{r.title}</p>
              {r.details && <p className="mt-1 whitespace-pre-line text-sm text-muted">{r.details}</p>}
              {r.page_url && (
                <a className="link mt-1 inline-block break-all text-sm" href={r.page_url} target="_blank" rel="noreferrer">
                  {r.page_url}
                </a>
              )}
              <div className="mt-3">
                <button type="button" className="btn-secondary btn-sm" onClick={() => setStatus(r.id, r.status === 'open' ? 'done' : 'open')}>
                  {r.status === 'open' ? 'Mark done' : 'Reopen'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
