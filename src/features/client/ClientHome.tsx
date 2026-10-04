import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAsync, unwrap } from '@/lib/useAsync'
import { useAccount } from '@/features/auth/AuthProvider'
import type { AccessStep, Project } from '@/lib/types'
import { copy } from '@/content/copy'
import { formatDate } from '@/lib/format'
import { friendlyError } from '@/lib/errors'
import { EmptyState, ErrorBox, LoadingList, PageHeader, ProgressBar } from '@/components/ui'
import { DueCountdown, ProjectStatusBadge } from '@/components/badges'
import { Icon } from '@/components/Icon'

interface Row extends Project {
  progress: number
  pendingSteps: number
}

export default function ClientHome() {
  const account = useAccount()
  const { data, error, loading, reload } = useAsync(async (): Promise<Row[]> => {
    if (!account.org_id) return []
    const projects = unwrap(await supabase.from('projects').select('*').order('created_at', { ascending: false })) as Project[]
    const steps = unwrap(await supabase.from('access_steps').select('project_id, status')) as Pick<AccessStep, 'project_id' | 'status'>[]
    const progress = await Promise.all(projects.map((p) => supabase.rpc('project_progress', { p_project_id: p.id })))
    return projects.map((p, i) => ({
      ...p,
      progress: (progress[i].data as number | null) ?? 0,
      pendingSteps: steps.filter((s) => s.project_id === p.id && s.status === 'pending').length,
    }))
  }, [account.org_id])

  if (!account.org_id) {
    return (
      <div className="py-6">
        <EmptyState icon="sparkle" title={copy.clientHome.noOrgTitle} body={copy.clientHome.noOrgBody} />
      </div>
    )
  }

  return (
    <div>
      <PageHeader title={copy.clientHome.title} subtitle={account.full_name ? `Hi ${account.full_name.split(' ')[0]}, here is where things stand.` : undefined} />
      {error ? (
        <ErrorBox message={friendlyError(error)} onRetry={reload} />
      ) : loading ? (
        <LoadingList rows={2} className="h-56" />
      ) : !data?.length ? (
        <EmptyState icon="briefcase" title="No projects yet" body={copy.clientHome.noProjects} />
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {data.map((p) => (
            <article key={p.id} className="card flex flex-col p-6">
              <div className="flex flex-wrap items-center gap-2">
                <ProjectStatusBadge status={p.status} />
                <DueCountdown due={p.due_date} />
              </div>
              <h2 className="mt-4 text-xl font-semibold">{p.name}</h2>
              <p className="mt-1 text-sm text-muted">
                {p.current_stage ? (
                  <>
                    Current stage: <span className="font-medium text-text">{p.current_stage}</span>
                  </>
                ) : (
                  'Not started yet'
                )}
                {p.due_date && <> · Due {formatDate(p.due_date)}</>}
              </p>
              <div className="mt-5">
                <ProgressBar value={p.progress} />
              </div>
              {!p.kickoff_confirmed_at && p.pendingSteps > 0 && (
                <p className="mt-5 flex items-center gap-2 rounded-field bg-surface px-3 py-2 text-sm">
                  <Icon name="key" size={16} className="text-warning" />
                  {p.pendingSteps} access step{p.pendingSteps === 1 ? '' : 's'} still need your help.
                </p>
              )}
              <div className="mt-6 flex flex-wrap gap-2 pt-1">
                <Link className="btn-primary" to={`/client/projects/${p.id}`}>
                  {copy.clientHome.open}
                </Link>
                {!p.kickoff_confirmed_at && (
                  <Link className="btn-secondary" to={`/client/projects/${p.id}/access`}>
                    {copy.clientHome.shareAccess}
                  </Link>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
