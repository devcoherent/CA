import { supabase } from '@/lib/supabase'
import { useAsync, unwrap } from '@/lib/useAsync'
import type { AccessStep, ClientUpdate, DueDateChange, Project, Stage } from '@/lib/types'

/** Everything a client (or staff) page needs about one project. RLS limits what comes back. */
export function useProjectBundle(projectId: string | undefined) {
  return useAsync(async () => {
    if (!projectId) throw new Error('missing id')
    const [project, stages, updates, steps, dueChanges, progress] = await Promise.all([
      supabase.from('projects').select('*, organizations(id, name, logo_url)').eq('id', projectId).maybeSingle(),
      supabase.from('project_stages').select('*').eq('project_id', projectId).order('position'),
      supabase.from('client_updates').select('*').eq('project_id', projectId).order('created_at', { ascending: false }).limit(100),
      supabase.from('access_steps').select('*').eq('project_id', projectId).order('position'),
      supabase.from('project_due_date_changes').select('*').eq('project_id', projectId).order('changed_at', { ascending: false }).limit(5),
      supabase.rpc('project_progress', { p_project_id: projectId }),
    ])
    return {
      project: unwrap(project) as Project | null,
      stages: unwrap(stages) as Stage[],
      updates: (unwrap(updates) as ClientUpdate[]).sort(
        (a, b) => new Date(b.published_at ?? b.created_at).getTime() - new Date(a.published_at ?? a.created_at).getTime(),
      ),
      steps: unwrap(steps) as AccessStep[],
      dueChanges: unwrap(dueChanges) as DueDateChange[],
      progress: (progress.data as number | null) ?? 0,
    }
  }, [projectId])
}
