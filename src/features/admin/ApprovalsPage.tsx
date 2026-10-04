import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAsync, unwrap } from '@/lib/useAsync'
import type { ClientUpdate, Project } from '@/lib/types'
import { formatDateTime } from '@/lib/format'
import { friendlyError } from '@/lib/errors'
import { EmptyState, ErrorBox, LoadingList, PageHeader } from '@/components/ui'
import { useToast } from '@/components/Toast'

type Row = ClientUpdate & { projects: Pick<Project, 'id' | 'name'> | null }

export default function ApprovalsPage() {
  const toast = useToast()
  const { data, error, loading, reload } = useAsync(
    async () => unwrap(await supabase.from('client_updates').select('*, projects(id, name)').eq('status', 'pending_approval').order('created_at')) as Row[],
    [],
  )

  const review = async (id: string, approve: boolean) => {
    const { error: err } = await supabase.rpc('review_client_update', { p_update_id: id, p_approve: approve })
    if (err) toast(friendlyError(err), 'error')
    else {
      toast(approve ? 'Approved. The client can see it now.' : 'Rejected. The client will not see it.')
      void reload()
    }
  }

  return (
    <div>
      <PageHeader title="Approvals" subtitle="Client updates waiting for an admin (only on projects with approval turned on)." />
      {error ? (
        <ErrorBox message={friendlyError(error)} onRetry={reload} />
      ) : loading || !data ? (
        <LoadingList rows={3} className="h-20" />
      ) : !data.length ? (
        <EmptyState icon="check" title="Nothing to approve" body="Updates that need approval will show up here." />
      ) : (
        <ul className="space-y-3">
          {data.map((u) => (
            <li key={u.id} className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-muted">
                  <Link to={`/team/projects/${u.project_id}?tab=updates`} className="font-medium text-text hover:text-accent">
                    {u.projects?.name}
                  </Link>{' '}
                  · {u.author_name} · {formatDateTime(u.created_at)}
                </p>
                <p className="mt-1.5">{u.message}</p>
              </div>
              <div className="flex gap-2">
                <button type="button" className="btn-secondary" onClick={() => review(u.id, false)}>
                  Reject
                </button>
                <button type="button" className="btn-primary" onClick={() => review(u.id, true)}>
                  Approve
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
