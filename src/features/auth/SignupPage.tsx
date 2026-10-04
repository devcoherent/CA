import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { copy } from '@/content/copy'
import { friendlyError, isEmail } from '@/lib/errors'
import { AuthCard } from '@/features/landing/PublicLayout'
import { Icon } from '@/components/Icon'
import { CheckEmail } from './CheckEmail'
import { callbackUrl, readPortalRole, savePortalRole } from './role'

export default function SignupPage() {
  const [params] = useSearchParams()
  const role = readPortalRole(params.get('role'))
  const [fullName, setFullName] = useState('')
  const [company, setCompany] = useState('')
  const [email, setEmail] = useState(params.get('email') ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  useEffect(() => savePortalRole(role), [role])

  const send = async () => {
    // Only the name (and company for clients) go in metadata. The database decides the role:
    // the browser cannot choose it. See supabase/migrations/*_signup_and_roles.sql.
    const data: Record<string, string> = { full_name: fullName.trim() }
    if (role === 'client') data.company_name = company.trim()
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true, emailRedirectTo: callbackUrl(), data },
    })
    if (error) throw error
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)
    const next: Record<string, string> = {}
    if (!fullName.trim()) next.fullName = copy.errors.required
    if (role === 'client' && !company.trim()) next.company = copy.errors.required
    if (!isEmail(email)) next.email = copy.errors.invalidEmail
    setErrors(next)
    if (Object.keys(next).length) return
    setBusy(true)
    try {
      await send()
      // Same screen whether or not the email already exists or was invited: we never reveal that.
      setSent(true)
    } catch (err) {
      setFormError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <AuthCard>
        <CheckEmail email={email.trim()} onBack={() => setSent(false)} onResend={send} />
      </AuthCard>
    )
  }

  const input = (id: string, label: string, value: string, set: (v: string) => void, props: Record<string, string> = {}) => (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <input
        id={id}
        className="field"
        value={value}
        onChange={(e) => set(e.target.value)}
        aria-invalid={Boolean(errors[id])}
        aria-describedby={errors[id] ? `${id}-error` : undefined}
        {...props}
      />
      {errors[id] && (
        <p id={`${id}-error`} className="mt-1 text-xs text-danger">
          {errors[id]}
        </p>
      )}
    </div>
  )

  return (
    <AuthCard>
      <Link to="/" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted hover:text-text">
        <Icon name="arrowLeft" size={16} /> {copy.login.back}
      </Link>
      <div className="card p-6 sm:p-8">
        <h1 className="text-2xl font-semibold">{role === 'client' ? copy.signup.clientTitle : copy.signup.teamTitle}</h1>
        <p className="mt-2 text-muted">{role === 'client' ? copy.signup.clientIntro : copy.signup.teamIntro}</p>
        <form className="mt-6 space-y-4" onSubmit={submit} noValidate>
          {input('fullName', copy.signup.fullName, fullName, setFullName, { autoComplete: 'name', maxLength: '200' })}
          {role === 'client' && input('company', copy.signup.companyName, company, setCompany, { autoComplete: 'organization', maxLength: '200' })}
          {input('email', copy.signup.email, email, setEmail, { type: 'email', autoComplete: 'email', inputMode: 'email' })}
          {formError && (
            <p className="text-sm text-danger" role="alert">
              {formError}
            </p>
          )}
          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? copy.signup.submitting : copy.signup.submit}
          </button>
        </form>
        <p className="mt-6 border-t border-border pt-5 text-sm text-muted">
          {copy.signup.haveAccount}{' '}
          <Link className="link" to={`/login?role=${role}`}>
            {copy.signup.logIn}
          </Link>
        </p>
      </div>
    </AuthCard>
  )
}
