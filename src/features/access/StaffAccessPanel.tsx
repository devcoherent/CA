import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAccount } from '@/features/auth/AuthProvider'
import type { AccessStatus, AccessStep, Project } from '@/lib/types'
import { ACCESS_STEP_CONTENT, looksLikeSecret } from '@/content/accessSteps'
import { copy } from '@/content/copy'
import { formatDateTime } from '@/lib/format'
import { friendlyError } from '@/lib/errors'
import { kickoffState } from '@/lib/kickoff'
import { Badge, Notice } from '@/components/ui'
import { AccessStatusBadge } from '@/components/badges'
import { Modal } from '@/components/Modal'
import { useToast } from '@/components/Toast'

/** Team/admin view of a project's access steps. Team can mark Verified; admin can edit anything for the client. */
export function StaffAccessPanel({ steps, project, reload }: { steps: AccessStep[]; project: Project; reload: () => Promise<void> }) {
  const account = useAccount()
  const isAdmin = account.role === 'admin'
  const toast = useToast()
  const [editing, setEditing] = useState<AccessStep | null>(null)
  const ko = kickoffState(steps)

  const setStatus = async (step: AccessStep, status: AccessStatus) => {
    const { error } = await supabase.from('access_steps').update({ status }).eq('id', step.id)
    if (error) toast(friendlyError(error), 'error')
    else {
      toast(status === 'verified' ? 'Marked as verified.' : 'Status updated.')
      void reload()
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {project.kickoff_confirmed_at ? (
          <Badge tone="success">Kickoff confirmed {formatDateTime(project.kickoff_confirmed_at)}</Badge>
        ) : ko.blockedBy ? (
          <Badge tone="warning">Let&apos;s Go blocked: Webflow is pending</Badge>
        ) : (
          <Badge tone="accent">Client can press Let&apos;s Go</Badge>
        )}
        <span className="text-muted">{steps.filter((s) => s.status === 'pending').length} pending</span>
      </div>
      <ul className="card divide-y divide-border">
        {steps.map((s) => {
          const c = ACCESS_STEP_CONTENT[s.key]
          const extra = Object.entries(s.fields ?? {}).filter(([, v]) => v)
          return (
            <li key={s.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{c.title}</p>
                  <AccessStatusBadge status={s.status} />
                  {s.provided_by === 'admin' && <Badge>Entered by admin</Badge>}
                </div>
                <p className="mt-1 break-all font-mono text-sm">{s.value_text || <span className="font-sans text-muted">No ID yet</span>}</p>
                {extra.length > 0 && (
                  <p className="mt-0.5 text-xs text-muted">
                    {extra.map(([k, v]) => `${c.fields.find((f) => f.name === k)?.label ?? k}: ${v}`).join(' · ')}
                  </p>
                )}
                {s.note && <p className="mt-0.5 text-xs text-muted">Note: {s.note}</p>}
                <p className="mt-0.5 text-xs text-muted">Updated {formatDateTime(s.updated_at)}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                {s.status === 'provided' || s.status === 'skipped' ? (
                  <button type="button" className="btn-secondary btn-sm" onClick={() => setStatus(s, 'verified')}>
                    Mark verified
                  </button>
                ) : s.status === 'verified' ? (
                  <button type="button" className="btn-ghost btn-sm" onClick={() => setStatus(s, 'provided')}>
                    Undo verify
                  </button>
                ) : null}
                {isAdmin && (
                  <button type="button" className="btn-secondary btn-sm" onClick={() => setEditing(s)}>
                    Edit for client
                  </button>
                )}
              </div>
            </li>
          )
        })}
        {steps.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted">No access steps on this project.</li>}
      </ul>
      {isAdmin && <AdminStepEditor step={editing} onClose={() => setEditing(null)} onSaved={reload} />}
    </div>
  )
}

function AdminStepEditor({ step, onClose, onSaved }: { step: AccessStep | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const [draft, setDraft] = useState<AccessStep | null>(null)
  const [forId, setForId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  if ((step?.id ?? null) !== forId) {
    setForId(step?.id ?? null)
    setDraft(step)
    setError(null)
  }
  if (!step || !draft) return <Modal open={false} onClose={onClose} title="">{null}</Modal>
  const c = ACCESS_STEP_CONTENT[step.key]

  const save = async () => {
    const values = [draft.value_text ?? '', ...Object.values(draft.fields ?? {})]
    if (values.some(looksLikeSecret)) return setError(copy.access.secretWarning)
    setBusy(true)
    const { error: err } = await supabase
      .from('access_steps')
      .update({ status: draft.status, value_text: draft.value_text || null, fields: draft.fields, note: draft.note || null })
      .eq('id', step.id)
    setBusy(false)
    if (err) return setError(friendlyError(err))
    toast('Saved on behalf of the client.')
    onClose()
    void onSaved()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Edit ${c.title} for the client`}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={save} disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Notice tone="warning" icon="lock">
          IDs and links only. Never store passwords or tokens. Your changes are tagged “entered by admin”.
        </Notice>
        {c.fields.map((f) => {
          const id = `admin-${step.key}-${f.name}`
          const v = f.name === 'value' ? (draft.value_text ?? '') : (draft.fields?.[f.name] ?? '')
          return (
            <div key={f.name}>
              <label htmlFor={id} className="label">
                {f.label}
              </label>
              <input
                id={id}
                className="field"
                value={v}
                placeholder={f.placeholder}
                autoComplete="off"
                onChange={(e) =>
                  setDraft(f.name === 'value' ? { ...draft, value_text: e.target.value } : { ...draft, fields: { ...(draft.fields ?? {}), [f.name]: e.target.value } })
                }
              />
            </div>
          )
        })}
        <div>
          <label htmlFor="admin-status" className="label">
            Status
          </label>
          <select id="admin-status" className="field" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as AccessStatus })}>
            <option value="pending">Pending</option>
            <option value="provided">Provided</option>
            <option value="skipped">Skipped (already shared)</option>
            <option value="verified">Verified</option>
          </select>
        </div>
        <div>
          <label htmlFor="admin-note" className="label">
            Note {draft.status === 'skipped' && '(required: to whom and when)'}
          </label>
          <input id="admin-note" className="field" value={draft.note ?? ''} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
        </div>
        {error && (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}
