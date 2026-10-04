import { useCallback, useEffect, useRef, useState } from 'react'

/** Minimal data loader: runs `fn` when deps change; exposes reload(). */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | undefined>(undefined)
  const [error, setError] = useState<unknown>(null)
  const [loading, setLoading] = useState(true)
  const fnRef = useRef(fn)
  fnRef.current = fn
  const seq = useRef(0)

  const run = useCallback(async (silent = false) => {
    const id = ++seq.current
    if (!silent) setLoading(true)
    try {
      const result = await fnRef.current()
      if (id === seq.current) {
        setData(result)
        setError(null)
      }
    } catch (e) {
      if (id === seq.current) setError(e)
    } finally {
      if (id === seq.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { data, error, loading, reload: () => run(true), setData }
}

/** Throws Supabase errors so useAsync can catch them. */
export function unwrap<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw res.error
  return res.data as T
}
