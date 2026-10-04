import { useEffect, useState } from 'react'
import { copy } from '@/content/copy'
import { friendlyError } from '@/lib/errors'
import { Icon } from '@/components/Icon'

export const RESEND_COOLDOWN_S = 30

/** "Check your email" screen with a resend button (30 second cooldown). */
export function CheckEmail({ email, onResend, onBack }: { email: string; onResend: () => Promise<void>; onBack: () => void }) {
  const [left, setLeft] = useState(RESEND_COOLDOWN_S)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (left <= 0) return
    const t = setTimeout(() => setLeft((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [left])

  const resend = async () => {
    setError(null)
    setStatus(null)
    try {
      await onResend()
      setStatus(copy.checkEmail.resent)
      setLeft(RESEND_COOLDOWN_S)
    } catch (e) {
      setError(friendlyError(e))
    }
  }

  return (
    <div className="card p-6 text-center sm:p-8" aria-live="polite">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface text-accent">
        <Icon name="send" size={22} />
      </span>
      <h1 className="mt-5 text-2xl font-semibold">{copy.checkEmail.title}</h1>
      <p className="mt-3 text-muted">{copy.checkEmail.body(email)}</p>
      <p className="mt-2 text-sm text-muted">{copy.checkEmail.hint}</p>
      <div className="mt-6 flex flex-col gap-2">
        <button type="button" className="btn-secondary w-full" disabled={left > 0} onClick={resend}>
          {left > 0 ? copy.checkEmail.resendIn(left) : copy.checkEmail.resend}
        </button>
        <button type="button" className="btn-ghost w-full" onClick={onBack}>
          {copy.checkEmail.useDifferent}
        </button>
      </div>
      {status && <p className="mt-4 text-sm text-success">{status}</p>}
      {error && (
        <p className="mt-4 text-sm text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
