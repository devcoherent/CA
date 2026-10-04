import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { friendlyError } from '@/lib/errors'
import { formatDate } from '@/lib/format'
import { StageTimeline } from '@/components/StageTimeline'
import { Badge } from '@/components/ui'
import { useToast } from '@/components/Toast'
import type { WorkspaceData } from './ProjectWorkspace'

export function StagesTab({ data, reload }: { data: WorkspaceData; reload: () => Promise<void> }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const active = data.stages.find((s) => s.status === 'active')
  const next = data.stages.find((s) => s.status === 'upcoming')

  const advance = async () => {
    const msg = active
      ? `Finish "${active.name}"${next ? ` and start "${next.name}"` : ' and complete the project'}? The client will be notified.`
      : `Start "${next?.name}"? The client will be notified.`
    if (!window.confirm(msg)) return
    setBusy(true)
    const { error } = await supabase.rpc('advance_stage', { p_project_id: data.project.id })
    setBusy(false)
    if (error) toast(friendlyError(error), 'error')
    else {
      toast('Stage updated. The client has been notified.')
      void reload()
    }
  }

  const setDue = async (id: string, due: string) => {
    const { error } = await supabase.from('project_stages').update({ due_date: due || null }).eq('id', id)
    if (error) toast(friendlyError(error), 'error')
    else void reload()
  }

  return (
    <div className="space-y-6">
      <div className="card p-5 sm:p-6">
        <StageTimeline stages={data.stages} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{active ? `Current stage: ${active.name}` : next ? 'No stage is active yet.' : 'All stages are done.'}</p>
        {(active || next) && (
          <button type="button" className="btn-primary" onClick={advance} disabled={busy}>
            {active ? (next ? `Finish ${active.name}, start ${next.name}` : `Finish ${active.name}`) : `Start ${next!.name}`}
          </button>
        )}
      </div>
      <ul className="card divide-y divide-border">
        {data.stages.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <span className="w-6 text-sm text-muted">{s.position}</span>
            <span className="min-w-0 flex-1 font-medium">{s.name}</span>
            <Badge tone={s.status === 'active' ? 'accent' : s.status === 'done' ? 'success' : 'neutral'}>{s.status === 'active' ? 'Active' : s.status === 'done' ? 'Done' : 'Upcoming'}</Badge>
            <label className="flex items-center gap-2 text-sm text-muted">
              <span className="sr-only">Planned end date for {s.name}</span>
              <input type="date" className="field w-auto py-1.5" defaultValue={s.due_date ?? ''} onBlur={(e) => e.target.value !== (s.due_date ?? '') && setDue(s.id, e.target.value)} />
            </label>
            {s.completed_at && <span className="text-xs text-muted">Done {formatDate(s.completed_at)}</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}
