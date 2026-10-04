import type { ClientUpdate, Stage } from '@/lib/types'
import { formatDate, relativeTime } from '@/lib/format'
import { Avatar } from '@/components/ui'
import { Icon } from '@/components/Icon'
import { UpdateStatusBadge } from '@/components/badges'

export function ActivityFeed({ updates, stages, showStatus = false, empty }: { updates: ClientUpdate[]; stages: Stage[]; showStatus?: boolean; empty: string }) {
  if (!updates.length) return <p className="py-4 text-sm text-muted">{empty}</p>
  const stageName = (id: string | null) => stages.find((s) => s.id === id)?.name
  return (
    <ol className="space-y-5">
      {updates.map((u) => {
        const when = u.published_at ?? u.created_at
        return (
          <li key={u.id} className="flex gap-3">
            {u.kind === 'milestone' ? (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-text" aria-hidden="true">
                <Icon name="flag" size={16} />
              </span>
            ) : (
              <Avatar name={u.author_name} size={32} />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm">
                <span className="font-semibold">{u.author_name ?? 'Coherent'}</span>
                <span className="text-muted"> · </span>
                <span className={u.kind === 'milestone' ? 'font-semibold' : ''}>{u.message}</span>
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                {stageName(u.stage_id) && <span>{stageName(u.stage_id)}</span>}
                {stageName(u.stage_id) && <span aria-hidden="true">·</span>}
                <time dateTime={when} title={formatDate(when)}>
                  {relativeTime(when)}
                </time>
                {showStatus && <UpdateStatusBadge status={u.status} />}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/** A short plain-English "this week" summary. */
export function weekSummary(updates: ClientUpdate[], stages: Stage[], now = Date.now()): string[] {
  const weekAgo = now - 7 * 86_400_000
  const lines: string[] = []
  const recent = updates.filter((u) => u.status === 'published' && new Date(u.published_at ?? u.created_at).getTime() >= weekAgo)
  lines.push(recent.length === 0 ? 'No new updates this week yet.' : `${recent.length} new update${recent.length === 1 ? '' : 's'} this week.`)
  for (const s of stages) {
    if (s.completed_at && new Date(s.completed_at).getTime() >= weekAgo) lines.push(`Finished ${s.name}.`)
  }
  const active = stages.find((s) => s.status === 'active')
  if (active) lines.push(`Now working on ${active.name}${active.due_date ? `, planned until ${formatDate(active.due_date)}` : ''}.`)
  return lines
}
