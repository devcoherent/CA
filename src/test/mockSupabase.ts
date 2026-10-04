import { vi } from 'vitest'

/**
 * A fake Supabase client for UI tests. Configure `state` per test:
 * - state.session: null (logged out) or a session object
 * - state.account: what get_my_account returns
 * - state.otp: what signInWithOtp returns
 */
export const state: {
  session: null | { user: { id: string } }
  account: unknown
  otp: { error: null | { code?: string; message: string; status?: number } }
  otpCalls: unknown[]
} = { session: null, account: null, otp: { error: null }, otpCalls: [] }

export function resetState() {
  state.session = null
  state.account = null
  state.otp = { error: null }
  state.otpCalls = []
}

/** Chainable query builder that resolves to empty data. */
function builder(): unknown {
  const result = { data: [], error: null }
  const handler: ProxyHandler<object> = {
    get(_t, prop) {
      if (prop === 'then') return (resolve: (v: unknown) => void) => resolve(result)
      if (prop === 'maybeSingle' || prop === 'single') return () => Promise.resolve({ data: null, error: null })
      return () => proxy
    },
  }
  const proxy = new Proxy({}, handler)
  return proxy
}

export const fakeSupabase = {
  auth: {
    getSession: vi.fn(async () => ({ data: { session: state.session } })),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: () => undefined } } })),
    signInWithOtp: vi.fn(async (args: unknown) => {
      state.otpCalls.push(args)
      return state.otp
    }),
    signInWithPassword: vi.fn(async () => ({ error: null })),
    signOut: vi.fn(async () => ({ error: null })),
  },
  rpc: vi.fn(async (fn: string) => (fn === 'get_my_account' ? { data: state.account, error: null } : { data: null, error: null })),
  from: vi.fn(() => builder()),
  channel: vi.fn(() => ({ on() { return this }, subscribe() { return this } })),
  removeChannel: vi.fn(async () => undefined),
  storage: { from: vi.fn() },
}
