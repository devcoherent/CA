import { copy } from '@/content/copy'

interface MaybeError {
  message?: string
  code?: string
  hint?: string
  status?: number
  name?: string
}

/** Turns Supabase/Postgres/network errors into a friendly sentence. Never shows raw codes. */
export function friendlyError(err: unknown): string {
  if (!err) return copy.errors.generic
  const e = err as MaybeError
  const code = e.code ?? ''
  const msg = e.message ?? ''

  if (e.status === 429 || /rate.?limit/i.test(code) || /rate limit|too many/i.test(msg)) return copy.errors.rateLimit
  if (e.name === 'AuthRetryableFetchError' || /Failed to fetch|NetworkError|Load failed/i.test(msg)) return copy.errors.network
  if (code === 'email_address_invalid' || /invalid.*email|email.*invalid/i.test(msg)) return copy.errors.invalidEmail
  // Our own database functions raise friendly messages with a code in `hint`.
  if (e.hint && e.code === 'P0001' && msg) return msg
  // Friendly messages raised by guards (permission errors with our wording).
  if (code === '42501' && msg && !/permission denied|row-level security/i.test(msg)) return msg
  if (code === '42501' || /row-level security|permission denied/i.test(msg)) return copy.errors.permission
  if (code === '23505') return 'That already exists.'
  if (code === '23514' && /skipped_needs_note/.test(msg)) return 'Please add a short note: who you shared it with, and when.'
  if (code === '23514') return 'Some of the information is not valid. Please check and try again.'
  return copy.errors.generic
}

/** Code from our database functions (e.g. "webflow_pending"), if any. */
export function errorCode(err: unknown): string | undefined {
  const e = err as MaybeError | null
  return e?.hint ?? e?.code
}

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim())
}
