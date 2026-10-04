import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { copy } from '@/content/copy'
import { AuthCard } from '@/features/landing/PublicLayout'
import { Spinner } from '@/components/ui'
import { homePathFor, useAuth } from './AuthProvider'
import { readPortalRole } from './role'

/** Magic links land here. We wait for the session, then redirect by the REAL role from the database. */
export default function AuthCallbackPage() {
  const { session, account, loading } = useAuth()
  const navigate = useNavigate()
  const [failed, setFailed] = useState(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1))
    const query = new URLSearchParams(window.location.search)
    return Boolean(hash.get('error') || query.get('error') || hash.get('error_description'))
  })

  useEffect(() => {
    if (failed || loading) return
    if (session) {
      navigate(account ? homePathFor(account) : '/pending', { replace: true })
      return
    }
    // Give supabase-js a moment to read the token from the URL.
    const t = setTimeout(async () => {
      const { data } = await supabase.auth.getSession()
      if (!data.session) setFailed(true)
    }, 4000)
    return () => clearTimeout(t)
  }, [failed, loading, session, account, navigate])

  return (
    <AuthCard>
      {failed ? (
        <div className="card p-6 text-center sm:p-8" role="alert">
          <h1 className="text-2xl font-semibold">{copy.callback.failedTitle}</h1>
          <p className="mt-3 text-muted">{copy.callback.failedBody}</p>
          <Link className="btn-primary mt-6" to={`/login?role=${readPortalRole(null)}`}>
            {copy.callback.newLink}
          </Link>
        </div>
      ) : (
        <div className="flex justify-center py-12">
          <Spinner label={copy.callback.working} />
        </div>
      )}
    </AuthCard>
  )
}
