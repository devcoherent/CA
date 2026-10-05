import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAsync, unwrap } from '@/lib/useAsync'
import { useAccount } from '@/features/auth/AuthProvider'
import type { AccessStep, ClientUpdate, InternalNote, Profile, Project, Stage, Task } from '@/lib/types'
import { TEMPLATE_LABEL, formatDate } from '@/lib/format'
import { friendlyError } from '@/lib/errors'
import { EmptyState, ErrorBox, LoadingList, PageHeader, Tabs } from '@/components/ui'
import { DueCountdown, ProjectStatusBadge } from '@/components/badges'
import { Icon } from '@/components/Icon'
import { useTimer } from '@/features/time/TimerProvider'
import { useToast } from '@/components/Toast'
import { TaskBoard } from './TaskBoard'
import { UpdatesTab } from './UpdatesTab'
import { NotesTab } from './NotesTab'
import { StagesTab } from './StagesTab'
import { SettingsTab } from './SettingsTab'
import { ProjectTimeTab } from './ProjectTimeTab'
import { StaffAccessPanel } from '@/features/access/StaffAccessPanel'
import { SubmitToClient } from '@/features/updates/SubmitToClient'

export type Member = Pick<Profile, 'id' | 'full_name' | 'email' | 'avatar_url' | 'role'>

export interface WorkspaceData {
  project: Project
  stages: Stage[]
  tasks: Task[]
  members: Member[]
  /** Everyone who appears on this page (members plus note authors such as admins), for showing names. */
  people: Member[]
  updates: ClientUpdate[]
  notes: InternalNote[]
  steps: AccessStep[]
}

type TabId = 'board' | 'updates' | 'notes' | 'access' | 'stages' | 'settings' | 'time'

export default function ProjectWorkspace() {
  const { id } = useParams()
  const account = useAccount()
  const isAdmin = account.role === 'admin'
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as TabId) || 'board'
  const [submitOpen, setSubmitOpen] = useState(false)
  const timer = useTimer()
  const toast = useToast()

  const { data, error, loading, reload, setData } = useAsync(async (): Promise<WorkspaceData | null> => {
    const [project, stages, tasks, members, updates, notes, steps] = await Promise.all([
      supabase.from('projects').select('*, organizations(id, name, logo_url)').eq('id', id!).maybeSingle(),
      supabase.from('project_stages').select('*').eq('project_id', id!).order('position'),
      supabase.from('tasks').select('*').eq('project_id', id!).order('position'),
      supabase.from('project_members').select('user_id, profiles(id, full_name, email, avatar_url, role)').eq('project_id', id!),
      supabase.from('client_updates').select('*').eq('project_id', id!).order('created_at', { ascending: false }),
      supabase.from('internal_notes').select('*').eq('project_id', id!).order('created_at', { ascending: false }),
      supabase.from('access_steps').select('*').eq('project_id', id!).order('position'),
    ])
    const p = unwrap(project) as Project | null
    if (!p) return null
    const memberList = ((unwrap(members) as unknown as { profiles: Member | null }[]) ?? []).map((m) => m.profiles).filter((m): m is Member => Boolean(m))
    const noteList = unwrap(notes) as InternalNote[]
    const missing = [...new Set(noteList.map((n) => n.author_id).filter((a): a is string => Boolean(a) && !memberList.some((m) => m.id === a)))]
    const extra = missing.length
      ? ((unwrap(await supabase.from('profiles').select('id, full_name, email, avatar_url, role').in('id', missing)) as Member[]) ?? [])
      : []
    return {
      project: p,
      stages: unwrap(stages) as Stage[],
      tasks: unwrap(tasks) as Task[],
      members: memberList,
      people: [...memberList, ...extra],
      updates: unwrap(updates) as ClientUpdate[],
      notes: noteList,
      steps: unwrap(steps) as AccessStep[],
    }
  }, [id])

  if (error) return <ErrorBox message={friendlyError(error)} onRetry={reload} />
  if (loading) return <LoadingList rows={3} className="h-32" />
  if (!data) return <EmptyState icon="lock" title="Project not found" body="It may have been removed, or you are not assigned to it." action={<Link className="btn-secondary" to="/team">Back to projects</Link>} />

  const { project } = data
  const setTab = (t: TabId) => setParams({ tab: t }, { replace: true })
  const pendingUpdates = data.updates.filter((u) => u.status === 'pending_approval').length
  const pendingSteps = data.steps.filter((s) => s.status === 'pending').length
  const timerHere = timer.running?.project_id === project.id

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: 'board', label: 'Tasks' },
    { id: 'updates', label: 'Client updates', count: pendingUpdates },
    { id: 'notes', label: 'Internal notes', count: data.notes.length },
    { id: 'access', label: 'Access', count: pendingSteps },
    { id: 'stages', label: 'Stages' },
    { id: 'settings', label: 'Settings' },
    ...(isAdmin ? [{ id: 'time' as const, label: 'Time' }] : []),
  ]

  return (
    <div>
      <PageHeader
        back={{ to: '/team', label: 'Projects' }}
        title={project.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2 text-sm">
            <span>{project.organizations?.name}</span>
            <span aria-hidden="true">·</span>
            <span>{TEMPLATE_LABEL[project.template]}</span>
            <ProjectStatusBadge status={project.status} />
            <DueCountdown due={project.due_date} />
            <span>Due {formatDate(project.due_date)}</span>
            {project.require_admin_approval && <span className="badge border-warning/50 text-warning">Updates need approval</span>}
          </span>
        }
        actions={
          <>
            {!timerHere && (
              <button
                type="button"
                className="btn-secondary"
                onClick={async () => {
                  try {
                    if (timer.running) await timer.switchTo(project.id)
                    else await timer.start(project.id)
                    toast(`Tracking time on ${project.name}.`)
                  } catch (e) {
                    toast(friendlyError(e), 'error')
                  }
                }}
              >
                <Icon name={timer.running ? 'swap' : 'play'} size={16} /> {timer.running ? 'Switch timer here' : 'Start timer'}
              </button>
            )}
            <button type="button" className="btn-primary" onClick={() => setSubmitOpen(true)}>
              <Icon name="send" size={16} /> Submit to client
            </button>
          </>
        }
      />

      <Tabs label="Project sections" tabs={tabs} value={tab} onChange={setTab} />

      {tab === 'board' && <TaskBoard data={data} reload={reload} setData={setData} />}
      {tab === 'updates' && <UpdatesTab data={data} reload={reload} onSubmit={() => setSubmitOpen(true)} />}
      {tab === 'notes' && <NotesTab data={data} reload={reload} />}
      {tab === 'access' && <StaffAccessPanel steps={data.steps} project={project} reload={reload} />}
      {tab === 'stages' && <StagesTab data={data} reload={reload} />}
      {tab === 'settings' && <SettingsTab data={data} reload={reload} />}
      {tab === 'time' && isAdmin && <ProjectTimeTab projectId={project.id} />}

      <SubmitToClient open={submitOpen} onClose={() => setSubmitOpen(false)} project={project} tasks={data.tasks} onSubmitted={reload} />
    </div>
  )
}
