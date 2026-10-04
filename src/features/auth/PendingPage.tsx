import { Navigate, useNavigate } from 'react-router-dom'
import { copy } from '@/content/copy'
import { AuthCard } from '@/features/landing/PublicLayout'
import { Icon } from '@/components/Icon'
import { FullPageLoading } from '@/routes/guards'
import { homePathFor, useAuth } from './AuthProvider'

export default function PendingPage() {
  const { session, account, loading, signOut } = useAuth()
  const navigate = useNavigate()
  if (loading) return <FullPageLoading />
  if (!session) return <Navigate to="/" replace />
  if (account?.status === 'approved') return <Navigate to={homePathFor(account)} replace />
  const rejected = account?.status === 'rejected'

  return (
    <AuthCard>
      <div className="card p-6 text-center sm:p-8">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface text-accent">
          <Icon name={rejected ? 'lock' : 'clock'} size={22} />
        </span>
        <h1 className="mt-5 text-2xl font-semibold">{rejected ? copy.pending.rejectedTitle : copy.pending.title}</h1>
        <p className="mt-3 text-muted">{rejected ? copy.pending.rejectedBody : copy.pending.body}</p>
        {account?.email && <p className="mt-4 text-sm text-muted">Signed in as {account.email}</p>}
        <button
          type="button"
          className="btn-secondary mt-6"
          onClick={async () => {
            await signOut()
            navigate('/', { replace: true })
          }}
        >
          {copy.pending.signOut}
        </button>
      </div>
    </AuthCard>
  )
}
