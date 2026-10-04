import { Link, useParams } from 'react-router-dom'
import { useProjectBundle } from './useClientProject'
import { copy } from '@/content/copy'
import { formatDate } from '@/lib/format'
import { friendlyError } from '@/lib/errors'
import { EmptyState, ErrorBox, LoadingList, Notice, PageHeader, ProgressBar } from '@/components/ui'
import { DueCountdown, ProjectStatusBadge } from '@/components/badges'
import { StageTimeline } from '@/components/StageTimeline'
import { ActivityFeed, weekSummary } from '@/features/updates/ActivityFeed'
import { Icon, type IconName } from '@/components/Icon'

function QuickLink({ to, href, icon, title, body }: { to?: string; href?: string; icon: IconName; title: string; body: string }) {
  const inner = (
    <>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-field bg-surface text-accent">
        <Icon name={icon} />
      </span>
      <span className="min-w-0">
        <span className="block font-semibold">{title}</span>
        <span className="block text-sm text-muted">{body}</span>
      </span>
      <Icon name={href ? 'external' : 'arrowRight'} size={16} className="ml-auto shrink-0 text-muted" />
    </>
  )
  const cls = 'card flex items-center gap-3 p-4 transition hover:border-accent'
  return href ? (
    <a className={cls} href={href} target="_blank" rel="noreferrer">
      {inner}
    </a>
  ) : (
    <Link className={cls} to={to!}>
      {inner}
    </Link>
  )
}

export default function ClientProjectPage() {
  const { id } = useParams()
  const { data, error, loading, reload } = useProjectBundle(id)

  if (error) return <ErrorBox message={friendlyError(error)} onRetry={reload} />
  if (loading || !data) return <LoadingList rows={3} className="h-40" />
  const { project, stages, updates, steps, dueChanges, progress } = data
  if (!project) return <EmptyState icon="lock" title="Project not found" body="It may have been removed, or you may not have access." />

  const pending = steps.filter((s) => s.status === 'pending').length
  const summary = weekSummary(updates, stages)
  const latestDueChange = dueChanges[0]

  return (
    <div>
      <PageHeader
        back={{ to: '/client', label: 'All projects' }}
        title={project.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <ProjectStatusBadge status={project.status} />
            <DueCountdown due={project.due_date} />
            {project.due_date && <span className="text-sm">Due {formatDate(project.due_date)}</span>}
          </span>
        }
      />

      {!project.kickoff_confirmed_at && (
        <div className="mb-8">
          <Notice tone="info" icon="key">
            <p className="font-medium">Next step: share access</p>
            <p className="mt-1 text-muted">
              {pending > 0 ? `${pending} step${pending === 1 ? '' : 's'} to go. ` : 'All steps are done. '}
              When you are ready, press "Let's Go" and we will start.
            </p>
            <Link className="btn-primary mt-3" to={`/client/projects/${project.id}/access`}>
              Continue to access steps
            </Link>
          </Notice>
        </div>
      )}

      <section className="card mb-8 p-5 sm:p-6" aria-labelledby="stages-title">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <h2 id="stages-title" className="text-lg font-semibold">
            {copy.project.timeline}
          </h2>
          <div className="w-full sm:w-64">
            <ProgressBar value={progress} />
          </div>
        </div>
        <StageTimeline stages={stages} />
        {latestDueChange && (
          <p className="mt-6 border-t border-border pt-4 text-sm text-muted">
            {copy.project.dueHistory} on {formatDate(latestDueChange.changed_at)}: {formatDate(latestDueChange.old_date)} → {formatDate(latestDueChange.new_date)}
          </p>
        )}
      </section>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <section className="card-surface p-5 sm:p-6" aria-labelledby="week-title">
            <h2 id="week-title" className="text-lg font-semibold">
              {copy.project.thisWeek}
            </h2>
            <ul className="mt-3 space-y-1.5 text-sm">
              {summary.map((line) => (
                <li key={line} className="flex gap-2">
                  <Icon name="check" size={16} className="mt-0.5 shrink-0 text-accent" />
                  {line}
                </li>
              ))}
            </ul>
          </section>
          <section aria-labelledby="activity-title">
            <h2 id="activity-title" className="mb-4 text-lg font-semibold">
              {copy.project.activity}
            </h2>
            <div className="card p-5 sm:p-6">
              <ActivityFeed updates={updates} stages={stages} empty={copy.project.noActivity} />
            </div>
          </section>
        </div>
        <aside className="space-y-3" aria-label="Shortcuts">
          <QuickLink
            to={`/client/projects/${project.id}/access`}
            icon="key"
            title={copy.project.accessCard}
            body={pending ? `${pending} still to do` : 'All done, thank you'}
          />
          <QuickLink to={`/client/projects/${project.id}/qa`} icon="comment" title={copy.project.qaCard} body="Leave comments on your site" />
          {project.staging_url && <QuickLink href={project.staging_url} icon="globe" title={copy.project.stagingCard} body="See the work in progress" />}
          <QuickLink to={`/client/request?project=${project.id}`} icon="send" title={copy.project.requestCard} body="A change, a question, or a bug" />
        </aside>
      </div>
    </div>
  )
}
