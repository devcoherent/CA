import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Project } from '@/lib/types'
import type { KickoffState } from '@/lib/kickoff'
import { copy } from '@/content/copy'
import { ACCESS_STEP_CONTENT } from '@/content/accessSteps'
import { formatDateTime } from '@/lib/format'
import { friendlyError } from '@/lib/errors'
import { Modal } from '@/components/Modal'
import { Icon } from '@/components/Icon'

/** The big "Let's Go" kickoff button with its confirm dialog. */
export function LetsGo({ project, state, onDone }: { project: Project; state: KickoffState; onDone: () => void }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (project.kickoff_confirmed_at) {
    return (
      <div className="card-surface flex items-center gap-4 p-5 sm:p-6" data-testid="kickoff-done">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-success text-white">
          <Icon name="check" />
        </span>
        <div>
          <p className="font-semibold">{copy.access.alreadyStarted}</p>
          <p className="text-sm text-muted">Confirmed {formatDateTime(project.kickoff_confirmed_at)}</p>
        </div>
      </div>
    )
  }

  const confirm = async () => {
    setBusy(true)
    setError(null)
    const { error: err } = await supabase.rpc('confirm_kickoff', { p_project_id: project.id })
    setBusy(false)
    if (err) {
      setError(friendlyError(err))
      return
    }
    setOpen(false)
    onDone()
  }

  return (
    <section className="card border-accent/40 p-5 sm:p-8" aria-labelledby="letsgo-title">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="letsgo-title" className="text-xl font-semibold">
            {copy.access.letsGoHelp}
          </h2>
          {state.blockedBy ? (
            <p className="mt-1.5 flex items-center gap-2 text-sm text-warning" data-testid="letsgo-blocked">
              <Icon name="lock" size={16} /> {copy.access.letsGoBlocked}
            </p>
          ) : !state.allDone ? (
            <p className="mt-1.5 flex items-center gap-2 text-sm text-warning">
              <Icon name="alert" size={16} /> {copy.access.letsGoWarning}
            </p>
          ) : (
            <p className="mt-1.5 text-sm text-muted">Everything is ready. Thank you!</p>
          )}
        </div>
        <button
          type="button"
          className="btn-primary px-8 py-3.5 text-base"
          disabled={!state.canStart}
          onClick={() => {
            setError(null)
            setOpen(true)
          }}
        >
          {copy.access.letsGo} <Icon name="arrowRight" size={18} />
        </button>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={copy.access.confirmTitle}
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
              {copy.access.cancel}
            </button>
            <button type="button" className="btn-primary" onClick={confirm} disabled={busy}>
              {busy ? 'Starting…' : copy.access.confirm}
            </button>
          </>
        }
      >
        <p>{copy.access.confirmBody}</p>
        {state.pendingKeys.length > 0 && (
          <div className="mt-4 rounded-field border border-warning/40 bg-surface p-4 text-sm">
            <p className="font-medium">{copy.access.confirmPendingIntro}</p>
            <ul className="mt-2 list-disc pl-5 text-muted">
              {state.pendingKeys.map((k) => (
                <li key={k}>{ACCESS_STEP_CONTENT[k].title}</li>
              ))}
            </ul>
          </div>
        )}
        {error && (
          <p className="mt-4 text-sm text-danger" role="alert">
            {error}
          </p>
        )}
      </Modal>
    </section>
  )
}
