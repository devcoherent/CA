import { useEffect, useState } from 'react'
import { useTimer, AUTO_STOP_MS } from './TimerProvider'
import { formatClock } from '@/lib/format'
import { friendlyError } from '@/lib/errors'
import { Icon } from '@/components/Icon'
import { Modal } from '@/components/Modal'
import { useToast } from '@/components/Toast'

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [active])
  return now
}

/** Top-bar time tracker: shows the running project and elapsed time, with Start, Stop and Switch. */
export function TimerWidget() {
  const { running, projects, start, stop, switchTo, refresh } = useTimer()
  const toast = useToast()
  const now = useNow(Boolean(running))
  const [dialog, setDialog] = useState<null | 'start' | 'switch' | 'stop'>(null)
  const [projectId, setProjectId] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runningProject = projects.find((p) => p.id === running?.project_id)
  const elapsed = running ? now - new Date(running.started_at).getTime() : 0
  const nearLimit = elapsed > AUTO_STOP_MS - 30 * 60 * 1000

  const openDialog = (kind: 'start' | 'switch' | 'stop') => {
    setError(null)
    setNote('')
    setProjectId(kind === 'switch' ? (projects.find((p) => p.id !== running?.project_id)?.id ?? '') : (projects[0]?.id ?? ''))
    setDialog(kind)
    if (kind !== 'stop') void refresh()
  }

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      if (dialog === 'start') await start(projectId)
      if (dialog === 'switch') await switchTo(projectId, note)
      if (dialog === 'stop') await stop(note)
      toast(dialog === 'stop' ? 'Timer stopped.' : dialog === 'switch' ? 'Switched project.' : 'Timer started.')
      setDialog(null)
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {running ? (
        <div className="flex items-center gap-1 rounded-btn border border-border bg-surface py-1 pl-3 pr-1" aria-label="Time tracker">
          <span className="relative mr-1 flex h-2 w-2" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
          </span>
          <span className="hidden max-w-[9rem] truncate text-sm font-medium lg:inline" title={runningProject?.name}>
            {runningProject?.name ?? 'Project'}
          </span>
          <span className={`ml-1 font-mono text-sm tabular-nums ${nearLimit ? 'text-warning' : ''}`} aria-live="off" title={nearLimit ? 'Timers stop automatically after 8 hours' : undefined}>
            {formatClock(elapsed)}
          </span>
          <button type="button" className="btn-ghost btn-sm h-8 px-2" onClick={() => openDialog('switch')} title="Switch project" aria-label="Switch project">
            <Icon name="swap" size={16} />
            <span className="hidden xl:inline">Switch</span>
          </button>
          <button type="button" className="btn-ghost btn-sm h-8 px-2 text-danger hover:text-danger" onClick={() => openDialog('stop')} title="Stop timer" aria-label="Stop timer">
            <Icon name="stop" size={16} />
            <span className="hidden xl:inline">Stop</span>
          </button>
        </div>
      ) : (
        <button type="button" className="btn-secondary h-10 px-3" onClick={() => openDialog('start')}>
          <Icon name="play" size={16} /> <span className="hidden sm:inline">Start timer</span>
        </button>
      )}

      <Modal
        open={dialog !== null}
        onClose={() => setDialog(null)}
        title={dialog === 'start' ? 'Start timer' : dialog === 'switch' ? 'Switch project' : 'Stop timer'}
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setDialog(null)}>
              Cancel
            </button>
            <button type="button" className={dialog === 'stop' ? 'btn-danger' : 'btn-primary'} disabled={busy || (dialog !== 'stop' && !projectId)} onClick={submit}>
              {busy ? 'Saving…' : dialog === 'start' ? 'Start' : dialog === 'switch' ? 'Switch now' : 'Stop timer'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {dialog === 'switch' && running && (
            <p className="text-sm text-muted">
              Your time on <strong className="text-text">{runningProject?.name}</strong> stops now, and the new project starts at the same second.
            </p>
          )}
          {dialog !== 'stop' && (
            <div>
              <label htmlFor="timer-project" className="label">
                Project
              </label>
              {projects.length === 0 ? (
                <p className="text-sm text-muted">You are not assigned to any open projects yet.</p>
              ) : (
                <select id="timer-project" className="field" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                  {projects
                    .filter((p) => dialog !== 'switch' || p.id !== running?.project_id)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              )}
            </div>
          )}
          {dialog !== 'start' && (
            <div>
              <label htmlFor="timer-note" className="label">
                Handoff note (optional)
              </label>
              <textarea
                id="timer-note"
                className="field min-h-20"
                value={note}
                maxLength={1000}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Where did you leave off? e.g. Header done, footer next."
              />
            </div>
          )}
          {error && <p className="text-sm text-danger">{error}</p>}
        </div>
      </Modal>
    </>
  )
}
