import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Project, Task } from '@/lib/types'
import { useAccount } from '@/features/auth/AuthProvider'
import { friendlyError } from '@/lib/errors'
import { Modal } from '@/components/Modal'
import { Notice } from '@/components/ui'
import { useToast } from '@/components/Toast'

const EXAMPLES = ['Home page design complete', 'About page is ready for your review', 'Your new site is live on the staging link']

/** "Submit to client": a short, client-friendly message that appears in the client's feed. */
export function SubmitToClient({
  open,
  onClose,
  project,
  tasks,
  initialTaskId,
  onSubmitted,
}: {
  open: boolean
  onClose: () => void
  project: Project
  tasks: Task[]
  initialTaskId?: string | null
  onSubmitted?: () => void
}) {
  const account = useAccount()
  const [message, setMessage] = useState('')
  const [taskId, setTaskId] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const toast = useToast()
  const needsApproval = project.require_admin_approval && account.role !== 'admin'

  useEffect(() => {
    if (!open) return
    const t = tasks.find((x) => x.id === initialTaskId)
    setTaskId(t?.id ?? '')
    setMessage(t ? `${t.title} complete` : '')
    setError(null)
  }, [open, initialTaskId, tasks])

  const submit = async () => {
    if (!message.trim()) return setError('Please write a short message.')
    setBusy(true)
    setError(null)
    const { error: err } = await supabase.rpc('submit_client_update', { p_project_id: project.id, p_message: message.trim(), p_task_id: taskId || null })
    setBusy(false)
    if (err) return setError(friendlyError(err))
    toast(needsApproval ? 'Sent to an admin for approval.' : 'Shared with the client.')
    onClose()
    onSubmitted?.()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Submit to client"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={submit} disabled={busy}>
            {busy ? 'Sending…' : needsApproval ? 'Send for approval' : 'Share with client'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted">
          This appears in the client&apos;s activity feed and they get a notification. Keep it short and friendly, with no internal jargon.
        </p>
        {needsApproval && <Notice tone="warning">This project needs admin approval. The client will see it once an admin approves.</Notice>}
        <div>
          <label htmlFor="update-message" className="label">
            Message for the client
          </label>
          <textarea
            id="update-message"
            className="field min-h-24"
            value={message}
            maxLength={1000}
            placeholder={`e.g. ${EXAMPLES[0]}`}
            onChange={(e) => setMessage(e.target.value)}
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {EXAMPLES.map((ex) => (
              <button key={ex} type="button" className="badge hover:bg-surface" onClick={() => setMessage(ex)}>
                {ex}
              </button>
            ))}
          </div>
        </div>
        {tasks.length > 0 && (
          <div>
            <label htmlFor="update-task" className="label">
              Related task (optional)
            </label>
            <select id="update-task" className="field" value={taskId} onChange={(e) => setTaskId(e.target.value)}>
              <option value="">None</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </div>
        )}
        {error && (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}
