import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { copy } from '@/content/copy'
import { friendlyError, isEmail } from '@/lib/errors'
import { AuthCard } from '@/features/landing/PublicLayout'
import { Icon } from '@/components/Icon'
import { CheckEmail } from './CheckEmail'
import { callbackUrl, readPortalRole, savePortalRole } from './role'
import { homePathFor, useAuth } from './AuthProvider'

type View = 'form' | 'sent' | 'not_found'

export default function LoginPage() {
  const [params] = useSearchParams()
  const role = readPortalRole(params.get('role'))
  const [email, setEmail] = useState(params.get('email') ?? '')
  const [view, setView] = useState<View>('form')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const other = role === 'client' ? 'team' : 'client'

  useEffect(() => savePortalRole(role), [role])

  const sendLink = async () => {
    // shouldCreateUser: false — the login page never creates accounts.
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false, emailRedirectTo: callbackUrl() },
    })
    return error
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!isEmail(email)) {
      setError(copy.errors.invalidEmail)
      return
    }
    setBusy(true)
    try {
      const err = await sendLink()
      if (!err) setView('sent')
      else if (err.code === 'otp_disabled' || /signups not allowed/i.test(err.message)) setView('not_found')
      else setError(friendlyError(err))
    } catch (e2) {
      setError(friendlyError(e2))
    } finally {
      setBusy(false)
    }
  }

  if (view === 'sent') {
    return (
      <AuthCard>
        <CheckEmail
          email={email.trim()}
          onBack={() => setView('form')}
          onResend={async () => {
            const err = await sendLink()
            if (err) throw err
          }}
        />
      </AuthCard>
    )
  }

  return (
    <AuthCard>
      <Link to="/" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted hover:text-text">
        <Icon name="arrowLeft" size={16} /> {copy.login.back}
      </Link>
      <div className="card p-6 sm:p-8">
        <h1 className="text-2xl font-semibold">{role === 'client' ? copy.login.clientTitle : copy.login.teamTitle}</h1>
        <p className="mt-2 text-muted">{copy.login.intro}</p>

        {view === 'not_found' ? (
          <div className="mt-6 rounded-field border border-border bg-surface p-4" role="alert" data-testid="not-found">
            <p className="font-medium">{copy.login.notFoundTitle}</p>
            <p className="mt-1 text-sm text-muted">{copy.login.notFoundBody}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link className="btn-primary" to={`/signup?role=${role}&email=${encodeURIComponent(email.trim())}`}>
                {copy.login.createAccount}
              </Link>
              <button type="button" className="btn-ghost" onClick={() => setView('form')}>
                {copy.login.tryAnother}
              </button>
            </div>
          </div>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={submit} noValidate>
            <div>
              <label htmlFor="login-email" className="label">
                {copy.login.emailLabel}
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                inputMode="email"
                className="field"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'login-error' : undefined}
                required
              />
            </div>
            {error && (
              <p id="login-error" className="text-sm text-danger" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="btn-primary w-full" disabled={busy}>
              {busy ? copy.login.sending : copy.login.submit}
            </button>
          </form>
        )}

        <div className="mt-6 flex flex-col gap-2 border-t border-border pt-5 text-sm sm:flex-row sm:justify-between">
          {view !== 'not_found' ? (
            <p className="text-muted">
              {copy.login.noAccount}{' '}
              <Link className="link" to={`/signup?role=${role}`}>
                {copy.login.createAccount}
              </Link>
            </p>
          ) : (
            <span />
          )}
          <Link className="link" to={`/login?role=${other}`} onClick={() => savePortalRole(other)}>
            {role === 'client' ? copy.login.switchToTeam : copy.login.switchToClient}
          </Link>
        </div>
      </div>
      {import.meta.env.DEV && <DevPasswordLogin initialEmail={email} />}
    </AuthCard>
  )
}

/** DEV ONLY: email + password login for seeded test users. Never rendered in production builds. */
function DevPasswordLogin({ initialEmail }: { initialEmail: string }) {
  const [email, setEmail] = useState(initialEmail)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const { refreshAccount } = useAuth()

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (err) {
      setError(friendlyError(err) === copy.errors.generic ? 'Wrong email or password.' : friendlyError(err))
      return
    }
    const acc = await refreshAccount()
    navigate(homePathFor(acc), { replace: true })
  }

  return (
    <details className="mt-6 rounded-card border border-dashed border-warning/60 p-4">
      <summary className="cursor-pointer text-sm font-medium text-warning">{copy.login.devTitle}</summary>
      <form className="mt-4 space-y-3" onSubmit={submit}>
        <div>
          <label htmlFor="dev-email" className="label">
            {copy.login.emailLabel}
          </label>
          <input id="dev-email" className="field" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label htmlFor="dev-password" className="label">
            {copy.login.devPassword}
          </label>
          <input id="dev-password" className="field" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn-secondary w-full">
          {copy.login.devSubmit}
        </button>
      </form>
    </details>
  )
}
