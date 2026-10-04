import { supabase } from '@/lib/supabase'
import { useAsync, unwrap } from '@/lib/useAsync'
import type { Profile, TimeEntry } from '@/lib/types'
import { formatDateTime, formatDuration } from '@/lib/format'
import { friendlyError } from '@/lib/errors'
import { Badge, ErrorBox, LoadingList } from '@/components/ui'

type Row = TimeEntry & { profiles: Pick<Profile, 'full_name' | 'email'> | null }

/** Admin only: time logged on one project. */
export function ProjectTimeTab({ projectId }: { projectId: string }) {
  const { data, error, loading, reload } = useAsync(
    async () =>
      unwrap(await supabase.from('time_entries').select('*, profiles(full_name, email)').eq('project_id', projectId).order('started_at', { ascending: false }).limit(200)) as Row[],
    [projectId],
  )
  if (error) return <ErrorBox message={friendlyError(error)} onRetry={reload} />
  if (loading || !data) return <LoadingList rows={3} className="h-12" />
  const total = data.reduce((sum, e) => sum + ((e.ended_at ? new Date(e.ended_at).getTime() : Date.now()) - new Date(e.started_at).getTime()), 0)

  return (
    <div>
      <p className="mb-4 text-sm text-muted">
        Total logged: <strong className="text-text">{formatDuration(total)}</strong> across {data.length} entries.
      </p>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[40rem] text-sm">
          <thead className="border-b border-border bg-surface text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Person</th>
              <th className="px-4 py-3 font-medium">Started</th>
              <th className="px-4 py-3 font-medium">Ended</th>
              <th className="px-4 py-3 font-medium">Duration</th>
              <th className="px-4 py-3 font-medium">Handoff note</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.map((e) => (
              <tr key={e.id} className={e.auto_stopped ? 'bg-warning/10' : ''}>
                <td className="px-4 py-3">{e.profiles?.full_name ?? e.profiles?.email}</td>
                <td className="px-4 py-3">{formatDateTime(e.started_at)}</td>
                <td className="px-4 py-3">{e.ended_at ? formatDateTime(e.ended_at) : <Badge tone="success">Running</Badge>}</td>
                <td className="px-4 py-3">
                  {formatDuration((e.ended_at ? new Date(e.ended_at).getTime() : Date.now()) - new Date(e.started_at).getTime())}
                  {e.auto_stopped && (
                    <span className="ml-2">
                      <Badge tone="warning">Auto-stopped</Badge>
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted">{e.handoff_note ?? ''}</td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted">
                  No time logged yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
