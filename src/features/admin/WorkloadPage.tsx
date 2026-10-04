import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAsync, unwrap } from '@/lib/useAsync'
import type { Profile, Project, TimeEntry } from '@/lib/types'
import { formatClock, formatDateTime, formatDuration, startOfDay, startOfWeek, toDateInput } from '@/lib/format'
import { friendlyError } from '@/lib/errors'
import { toCsv, downloadFile } from '@/lib/csv'
import { Avatar, Badge, EmptyState, ErrorBox, LoadingList, PageHeader } from '@/components/ui'
import { Icon } from '@/components/Icon'

type Entry = TimeEntry & {
  profiles: Pick<Profile, 'id' | 'full_name' | 'email' | 'avatar_url'> | null
  projects: Pick<Project, 'id' | 'name'> | null
}

const dur = (e: TimeEntry, now: number) => (e.ended_at ? new Date(e.ended_at).getTime() : now) - new Date(e.started_at).getTime()

/** Milliseconds of an entry that fall inside [from, to). */
function overlap(e: TimeEntry, from: number, to: number, now: number) {
  const s = new Date(e.started_at).getTime()
  const end = e.ended_at ? new Date(e.ended_at).getTime() : now
  return Math.max(0, Math.min(end, to) - Math.max(s, from))
}

export default function WorkloadPage() {
  const [from, setFrom] = useState(toDateInput(startOfWeek()))
  const [to, setTo] = useState(toDateInput(new Date()))
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const fromTs = new Date(`${from}T00:00:00`).getTime()
  const toTs = new Date(`${to}T00:00:00`).getTime() + 86_400_000

  const { data, error, loading, reload } = useAsync(async () => {
    const weekStart = Math.min(fromTs, startOfWeek().getTime())
    const [range, running] = await Promise.all([
      supabase
        .from('time_entries')
        .select('*, profiles(id, full_name, email, avatar_url), projects(id, name)')
        .lt('started_at', new Date(toTs).toISOString())
        .or(`ended_at.is.null,ended_at.gte.${new Date(weekStart).toISOString()}`)
        .order('started_at', { ascending: false })
        .limit(2000),
      supabase.from('time_entries').select('*, profiles(id, full_name, email, avatar_url), projects(id, name)').is('ended_at', null),
    ])
    return { entries: unwrap(range) as Entry[], running: unwrap(running) as Entry[] }
  }, [from, to])

  const stats = useMemo(() => {
    if (!data) return null
    const today = startOfDay().getTime()
    const week = startOfWeek().getTime()
    const people = new Map<string, { person: Entry['profiles']; today: number; week: number; range: number }>()
    const projects = new Map<string, { name: string; range: number; people: Set<string> }>()
    for (const e of data.entries) {
      const pid = e.user_id
      const p = people.get(pid) ?? { person: e.profiles, today: 0, week: 0, range: 0 }
      p.today += overlap(e, today, today + 86_400_000, now)
      p.week += overlap(e, week, week + 7 * 86_400_000, now)
      const inRange = overlap(e, fromTs, toTs, now)
      p.range += inRange
      people.set(pid, p)
      if (inRange > 0) {
        const pr = projects.get(e.project_id) ?? { name: e.projects?.name ?? 'Project', range: 0, people: new Set<string>() }
        pr.range += inRange
        pr.people.add(e.profiles?.full_name ?? e.profiles?.email ?? '')
        projects.set(e.project_id, pr)
      }
    }
    const inRangeEntries = data.entries.filter((e) => overlap(e, fromTs, toTs, now) > 0)
    return {
      people: [...people.values()].sort((a, b) => b.range - a.range),
      projects: [...projects.values()].sort((a, b) => b.range - a.range),
      entries: inRangeEntries,
      autoStopped: inRangeEntries.filter((e) => e.auto_stopped).length,
    }
  }, [data, now, fromTs, toTs])

  const exportCsv = () => {
    if (!stats) return
    const rows = stats.entries.map((e) => ({
      person: e.profiles?.full_name ?? e.profiles?.email ?? '',
      email: e.profiles?.email ?? '',
      project: e.projects?.name ?? '',
      started_at: e.started_at,
      ended_at: e.ended_at ?? '',
      hours: (dur(e, now) / 3_600_000).toFixed(2),
      auto_stopped: e.auto_stopped ? 'yes' : 'no',
      handoff_note: e.handoff_note ?? '',
    }))
    downloadFile(`time-entries_${from}_to_${to}.csv`, toCsv(rows, ['person', 'email', 'project', 'started_at', 'ended_at', 'hours', 'auto_stopped', 'handoff_note']))
  }

  return (
    <div>
      <PageHeader
        title="Workload"
        subtitle="Who is working on what, and where the hours go."
        actions={
          <button type="button" className="btn-secondary" onClick={exportCsv} disabled={!stats?.entries.length}>
            <Icon name="download" size={16} /> Export CSV
          </button>
        }
      />

      <div className="mb-8 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="wl-from" className="label">
            From
          </label>
          <input id="wl-from" type="date" className="field" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label htmlFor="wl-to" className="label">
            To
          </label>
          <input id="wl-to" type="date" className="field" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </div>
        <button type="button" className="btn-ghost" onClick={() => { setFrom(toDateInput(startOfWeek())); setTo(toDateInput(new Date())) }}>
          This week
        </button>
        <button type="button" className="btn-ghost" onClick={() => { const d = new Date(); setFrom(toDateInput(new Date(d.getFullYear(), d.getMonth(), 1))); setTo(toDateInput(d)) }}>
          This month
        </button>
      </div>

      {error ? (
        <ErrorBox message={friendlyError(error)} onRetry={reload} />
      ) : loading || !stats || !data ? (
        <LoadingList rows={3} className="h-32" />
      ) : (
        <div className="space-y-10">
          <section aria-labelledby="now-title">
            <h2 id="now-title" className="mb-4 text-lg font-semibold">
              Working right now
            </h2>
            {data.running.length === 0 ? (
              <p className="text-sm text-muted">Nobody has a timer running.</p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.running.map((e) => (
                  <li key={e.id} className="card flex items-center gap-3 p-4">
                    <Avatar name={e.profiles?.full_name ?? e.profiles?.email} url={e.profiles?.avatar_url} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{e.profiles?.full_name ?? e.profiles?.email}</p>
                      <p className="truncate text-sm text-muted">{e.projects?.name}</p>
                    </div>
                    <span className="font-mono text-sm tabular-nums">{formatClock(dur(e, now))}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="grid gap-8 lg:grid-cols-2">
            <section aria-labelledby="people-title">
              <h2 id="people-title" className="mb-4 text-lg font-semibold">
                Hours per person
              </h2>
              <div className="card overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-surface text-left text-xs uppercase tracking-wide text-muted">
                    <tr>
                      <th className="px-4 py-3 font-medium">Person</th>
                      <th className="px-4 py-3 text-right font-medium">Today</th>
                      <th className="px-4 py-3 text-right font-medium">This week</th>
                      <th className="px-4 py-3 text-right font-medium">Selected range</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {stats.people.map((p) => (
                      <tr key={p.person?.id}>
                        <td className="px-4 py-3">{p.person?.full_name ?? p.person?.email}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{formatDuration(p.today)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{formatDuration(p.week)}</td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums">{formatDuration(p.range)}</td>
                      </tr>
                    ))}
                    {stats.people.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-muted">
                          No time logged.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
            <section aria-labelledby="projects-title">
              <h2 id="projects-title" className="mb-4 text-lg font-semibold">
                Hours per project
              </h2>
              <ul className="card divide-y divide-border">
                {stats.projects.map((p) => {
                  const max = stats.projects[0]?.range || 1
                  return (
                    <li key={p.name} className="px-4 py-3">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{p.name}</span>
                        <span className="tabular-nums">{formatDuration(p.range)}</span>
                      </div>
                      <div className="mt-2 h-1.5 rounded-full bg-surface" aria-hidden="true">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${(p.range / max) * 100}%` }} />
                      </div>
                      <p className="mt-1 text-xs text-muted">{[...p.people].join(', ')}</p>
                    </li>
                  )
                })}
                {stats.projects.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted">No time logged.</li>}
              </ul>
            </section>
          </div>

          <section aria-labelledby="entries-title">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <h2 id="entries-title" className="text-lg font-semibold">
                Time entries
              </h2>
              {stats.autoStopped > 0 && <Badge tone="warning">{stats.autoStopped} auto-stopped</Badge>}
            </div>
            {stats.entries.length === 0 ? (
              <EmptyState icon="clock" title="No time entries in this range" />
            ) : (
              <div className="card overflow-x-auto">
                <table className="w-full min-w-[48rem] text-sm">
                  <thead className="border-b border-border bg-surface text-left text-xs uppercase tracking-wide text-muted">
                    <tr>
                      <th className="px-4 py-3 font-medium">Person</th>
                      <th className="px-4 py-3 font-medium">Project</th>
                      <th className="px-4 py-3 font-medium">Started</th>
                      <th className="px-4 py-3 font-medium">Ended</th>
                      <th className="px-4 py-3 text-right font-medium">Duration</th>
                      <th className="px-4 py-3 font-medium">Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {stats.entries.map((e) => (
                      <tr key={e.id} className={e.auto_stopped ? 'bg-warning/10' : ''}>
                        <td className="px-4 py-3">{e.profiles?.full_name ?? e.profiles?.email}</td>
                        <td className="px-4 py-3">{e.projects?.name}</td>
                        <td className="px-4 py-3">{formatDateTime(e.started_at)}</td>
                        <td className="px-4 py-3">{e.ended_at ? formatDateTime(e.ended_at) : <Badge tone="success">Running</Badge>}</td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatDuration(dur(e, now))}
                          {e.auto_stopped && (
                            <span className="ml-2">
                              <Badge tone="warning">Auto-stopped</Badge>
                            </span>
                          )}
                        </td>
                        <td className="max-w-xs truncate px-4 py-3 text-muted" title={e.handoff_note ?? ''}>
                          {e.handoff_note}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
