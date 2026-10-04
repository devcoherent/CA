import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { homePathFor, useAuth } from '@/features/auth/AuthProvider'
import type { Role } from '@/lib/types'
import { Spinner } from '@/components/ui'

export function FullPageLoading() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <Spinner />
    </div>
  )
}

/** Only for signed-in, approved users with one of `roles`. Roles come from the database. */
export function RequireAccount({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { session, account, loading } = useAuth()
  const location = useLocation()
  if (loading) return <FullPageLoading />
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (!account || account.status !== 'approved') return <Navigate to="/pending" replace />
  if (roles && !roles.includes(account.role)) return <Navigate to={homePathFor(account)} replace />
  return <>{children}</>
}

/** Public pages (/, /login, /signup): signed-in users go straight to their dashboard. */
export function RedirectIfSignedIn({ children }: { children: ReactNode }) {
  const { session, account, loading } = useAuth()
  if (loading) return <FullPageLoading />
  if (session && account) return <Navigate to={homePathFor(account)} replace />
  return <>{children}</>
}
