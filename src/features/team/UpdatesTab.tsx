import { supabase } from '@/lib/supabase'
import { useAccount } from '@/features/auth/AuthProvider'
import { friendlyError } from '@/lib/errors'
import { ActivityFeed } from '@/features/updates/ActivityFeed'
import { Icon } from '@/components/Icon'
import { Notice } from '@/components/ui'
import { useToast } from '@/components/Toast'
import type { WorkspaceData } from './ProjectWorkspace'

export function UpdatesTab({ data, reload, onSubmit }: { data: WorkspaceData; reload: () => Promise<void>; onSubmit: () => void }) {
  const account = useAccount()
  const toast = useToast()
  const pending = data.updates.filter((u) => u.status === 'pending_approval')

  const review = async (id: string, approve: boolean) => {
    const { error } = await supabase.rpc('review_client_update', { p_update_id: id, p_approve: approve })
    if (error) toast(friendlyError(error), 'error')
    else {
      toast(approve ? 'Approved and shared with the client.' : 'Update rejected.')
      void reload()
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        {account.role === 'admin' && pending.length > 0 && (
          <div className="mb-6 space-y-3">
            <Notice tone="warning">
              {pending.length} update{pending.length === 1 ? ' is' : 's are'} waiting for your approval.
            </Notice>
            {pending.map((u) => (
              <div key={u.id} className="card flex flex-wrap items-center gap-3 p-4">
                <p className="min-w-0 flex-1 text-sm">
                  <span className="font-semibold">{u.author_name}</span>: {u.message}
                </p>
                <button type="button" className="btn-secondary btn-sm" onClick={() => review(u.id, false)}>
                  Reject
                </button>
                <button type="button" className="btn-primary btn-sm" onClick={() => review(u.id, true)}>
                  Approve
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="card p-5 sm:p-6">
          <ActivityFeed updates={data.updates} stages={data.stages} showStatus empty="No updates shared yet." />
        </div>
      </div>
      <aside className="card-surface h-fit p-5">
        <h3 className="font-semibold">Keep the client in the loop</h3>
        <p className="mt-2 text-sm text-muted">
          Short, friendly updates build trust. Clients get a bell notification and an email.
          {data.project.require_admin_approval && ' On this project an admin approves updates first.'}
        </p>
        <button type="button" className="btn-primary mt-4" onClick={onSubmit}>
          <Icon name="send" size={16} /> Submit to client
        </button>
      </aside>
    </div>
  )
}
