import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAsync, unwrap } from '@/lib/useAsync'
import { useAccount } from '@/features/auth/AuthProvider'
import type { Notification } from '@/lib/types'
import { formatDateTime } from '@/lib/format'
import { EmptyState, ErrorBox, LoadingList, PageHeader } from '@/components/ui'
import { friendlyError } from '@/lib/errors'

export default function NotificationsPage() {
  const account = useAccount()
  const navigate = useNavigate()
  const { data, error, loading, reload } = useAsync(
    async () =>
      unwrap(await supabase.from('notifications').select('*').eq('user_id', account.id).order('created_at', { ascending: false }).limit(200)) as Notification[],
    [account.id],
  )

  const markAll = async () => {
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', account.id).is('read_at', null)
    void reload()
  }

  return (
    <div>
      <PageHeader
        title="Notifications"
        actions={
          <button type="button" className="btn-secondary" onClick={markAll}>
            Mark all as read
          </button>
        }
      />
      {error ? (
        <ErrorBox message={friendlyError(error)} onRetry={reload} />
      ) : loading ? (
        <LoadingList rows={4} className="h-16" />
      ) : !data?.length ? (
        <EmptyState icon="bell" title="No notifications yet" body="When something happens on your projects, you will see it here." />
      ) : (
        <ul className="card divide-y divide-border">
          {data.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                className="flex w-full gap-3 px-5 py-4 text-left hover:bg-surface"
                onClick={async () => {
                  if (!n.read_at) await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', n.id)
                  if (n.link) navigate(n.link)
                  else void reload()
                }}
              >
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read_at ? 'bg-border' : 'bg-accent'}`} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{n.title}</span>
                  {n.body && <span className="mt-0.5 block whitespace-pre-line text-sm text-muted">{n.body}</span>}
                </span>
                <span className="shrink-0 text-xs text-muted">{formatDateTime(n.created_at)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
