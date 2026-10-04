import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'
import type { Project, TimeEntry } from '@/lib/types'

export const AUTO_STOP_MS = 8 * 3600 * 1000

interface TimerContextValue {
  running: TimeEntry | null
  projects: Pick<Project, 'id' | 'name'>[]
  start: (projectId: string, taskId?: string | null) => Promise<void>
  stop: (handoffNote?: string) => Promise<void>
  switchTo: (projectId: string, handoffNote?: string) => Promise<void>
  refresh: () => Promise<void>
}

const TimerContext = createContext<TimerContextValue | null>(null)

export function TimerProvider({ children }: { children: ReactNode }) {
  const { account } = useAuth()
  const [running, setRunning] = useState<TimeEntry | null>(null)
  const [projects, setProjects] = useState<Pick<Project, 'id' | 'name'>[]>([])
  const isStaff = account?.status === 'approved' && (account.role === 'admin' || account.role === 'team')
  const userId = account?.id

  const refresh = useCallback(async () => {
    if (!isStaff || !userId) return
    const [{ data: entry }, { data: projs }] = await Promise.all([
      supabase.from('time_entries').select('*').eq('user_id', userId).is('ended_at', null).maybeSingle(),
      // RLS returns only assigned projects for team members, all projects for admins.
      supabase.from('projects').select('id, name').neq('status', 'completed').order('name'),
    ])
    setRunning((entry as TimeEntry | null) ?? null)
    setProjects((projs as Pick<Project, 'id' | 'name'>[]) ?? [])
  }, [isStaff, userId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const start = useCallback(async (projectId: string, taskId?: string | null) => {
    const { data, error } = await supabase.rpc('start_timer', { p_project_id: projectId, p_task_id: taskId ?? null })
    if (error) throw error
    setRunning(data as TimeEntry)
  }, [])

  const stop = useCallback(async (handoffNote?: string) => {
    const { error } = await supabase.rpc('stop_timer', { p_handoff_note: handoffNote ?? null })
    if (error) throw error
    setRunning(null)
  }, [])

  const switchTo = useCallback(async (projectId: string, handoffNote?: string) => {
    const { data, error } = await supabase.rpc('switch_project', { new_project_id: projectId, handoff_note: handoffNote ?? null })
    if (error) throw error
    setRunning(data as TimeEntry)
  }, [])

  const value = useMemo(() => ({ running, projects, start, stop, switchTo, refresh }), [running, projects, start, stop, switchTo, refresh])
  return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>
}

export function useTimer(): TimerContextValue {
  const ctx = useContext(TimerContext)
  if (!ctx) throw new Error('useTimer must be used inside TimerProvider')
  return ctx
}
