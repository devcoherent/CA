import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAsync, unwrap } from '@/lib/useAsync'
import { useAccount } from '@/features/auth/AuthProvider'
import type { Project, Task } from '@/lib/types'
import { TEMPLATE_LABEL, formatDate } from '@/lib/format'
import { friendlyError } from '@/lib/errors'
import { EmptyState, ErrorBox, LoadingList, PageHeader, ProgressBar } from '@/components/ui'
import { DueCountdown, ProjectStatusBadge } from '@/components/badges'
import { Icon } from '@/components/Icon'

export default function TeamHome() {
  const account = useAccount()
  const isAdmin = account.role === 'admin'
  const [showDone, setShowDone] = useState(false)

  const { data, error, loading, reload } = useAsync(async () => {
    // RLS: team members get only assigned projects; admins get everything.
    const projects = unwrap(await supabase.from('projects').select('*, organizations(id, name, logo_url)').order('due_date', { ascending: true, nullsFirst: false })) as Project[]
    const myTasks = unwrap(
      await supabase.from('tasks').select('*').eq('assignee_id', account.id).neq('status', 'done').order('due_date', { ascending: true, nullsFirst: false }).limit(20),
    ) as Task[]
    const progress = await Promise.all(projects.map((p) => supabase.rpc('project_progress', { p_project_id: p.id })))
    return { projects: projects.map((p, i) => ({ ...p, progress: (progress[i].data as number | null) ?? 0 })), myTasks }
  }, [account.id])

  const projects = (data?.projects ?? []).filter((p) => showDone || p.status !== 'completed')
  const projectName = (id: string) => data?.projects.find((p) => p.id === id)?.name ?? ''

  return (
    <div>
      <PageHeader
        title={isAdmin ? 'All projects' : 'My projects'}
        subtitle={isAdmin ? 'Every client project.' : 'Projects you are assigned to.'}
        actions={
          <>
            <label className="flex items-center gap-2 text-sm text-muted">
              <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} className="accent-[var(--c-accent)]" />
              Show completed
            </label>
            {isAdmin && (
              <Link to="/admin/projects/new" className="btn-primary">
                <Icon name="plus" size={16} /> New project
              </Link>
            )}
          </>
        }
      />
      {error ? (
        <ErrorBox message={friendlyError(error)} onRetry={reload} />
      ) : loading ? (
        <LoadingList rows={4} className="h-16" />
      ) : !projects.length ? (
        <EmptyState icon="briefcase" title="No projects here yet" body={isAdmin ? 'Create your first project to get started.' : 'When an admin assigns you to a project, it will show up here.'} />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <caption className="sr-only">Projects</caption>
            <thead className="hidden border-b border-border bg-surface text-left text-xs uppercase tracking-wide text-muted md:table-header-group">
              <tr>
                <th className="px-4 py-3 font-medium">Project</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Stage</th>
                <th className="px-4 py-3 font-medium">Due</th>
                <th className="w-40 px-4 py-3 font-medium">Progress</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {projects.map((p) => (
                <tr key={p.id} className="flex flex-col gap-2 px-4 py-4 hover:bg-surface md:table-row md:p-0">
                  <td className="md:px-4 md:py-3">
                    <Link to={`/team/projects/${p.id}`} className="font-semibold hover:text-accent">
                      {p.name}
                    </Link>
                    <p className="text-xs text-muted">
                      {p.organizations?.name} · {TEMPLATE_LABEL[p.template]}
                    </p>
                  </td>
                  <td className="md:px-4 md:py-3">
                    <ProjectStatusBadge status={p.status} />
                  </td>
                  <td className="text-muted md:px-4 md:py-3">{p.current_stage ?? '—'}</td>
                  <td className="md:px-4 md:py-3">
                    <span className="mr-2 md:block">{formatDate(p.due_date)}</span>
                    <DueCountdown due={p.due_date} />
                  </td>
                  <td className="md:px-4 md:py-3">
                    <ProgressBar value={p.progress} label="Done" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.myTasks.length > 0 && (
        <section className="mt-10" aria-labelledby="mytasks">
          <h2 id="mytasks" className="mb-4 text-lg font-semibold">
            My open tasks
          </h2>
          <ul className="card divide-y divide-border">
            {data.myTasks.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                <span className={`badge ${t.status === 'doing' ? 'border-accent/40 text-accent' : 'text-muted'}`}>{t.status === 'doing' ? 'Doing' : 'To do'}</span>
                <Link to={`/team/projects/${t.project_id}`} className="font-medium hover:text-accent">
                  {t.title}
                </Link>
                <span className="text-muted">{projectName(t.project_id)}</span>
                {t.due_date && <span className="ml-auto text-xs text-muted">Due {formatDate(t.due_date)}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
