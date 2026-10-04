import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type { Account } from '@/lib/types'

interface AuthContextValue {
  session: Session | null
  /** The signed-in user's profile, read from the database (the only source of truth for role). */
  account: Account | null
  /** True until we know whether someone is signed in (and have loaded their account). */
  loading: boolean
  refreshAccount: () => Promise<Account | null>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export async function fetchAccount(): Promise<Account | null> {
  const { data, error } = await supabase.rpc('get_my_account')
  if (error) throw error
  return (data as Account | null) ?? null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [account, setAccount] = useState<Account | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  // undefined = we have not checked yet; null = checked, nobody signed in.
  const lastUserId = useRef<string | null | undefined>(undefined)

  const refreshAccount = useCallback(async () => {
    try {
      const acc = await fetchAccount()
      setAccount(acc)
      return acc
    } catch {
      setAccount(null)
      return null
    }
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let active = true

    const apply = async (s: Session | null) => {
      if (!active) return
      setSession(s)
      const userId = s?.user.id ?? null
      // Same user as before (e.g. token refresh): nothing to reload, and do not touch
      // `loading` — an account fetch for this user may still be in flight.
      if (userId === lastUserId.current) return
      lastUserId.current = userId
      if (userId) {
        setLoading(true)
        await refreshAccount()
      } else {
        setAccount(null)
      }
      if (active && lastUserId.current === userId) setLoading(false)
    }

    supabase.auth.getSession().then(({ data }) => apply(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      // Defer: never await Supabase calls inside this callback (supabase-js deadlock rule).
      setTimeout(() => void apply(s), 0)
    })
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [refreshAccount])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    lastUserId.current = null
    setSession(null)
    setAccount(null)
  }, [])

  const value = useMemo(() => ({ session, account, loading, refreshAccount, signOut }), [session, account, loading, refreshAccount, signOut])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

/** Convenience for pages that are only rendered for signed-in users. */
export function useAccount(): Account {
  const { account } = useAuth()
  if (!account) throw new Error('useAccount used without an account')
  return account
}

/** Where each kind of user lands after login. Uses the role stored in the database only. */
export function homePathFor(account: Account | null): string {
  if (!account) return '/'
  if (account.status !== 'approved') return '/pending'
  return account.role === 'client' ? '/client' : '/team'
}

export { AuthContext }
