import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type Theme = 'light' | 'dark'

interface ThemeContextValue {
  /** The theme currently shown. */
  theme: Theme
  /** 'system' when following the device setting. */
  preference: Theme | 'system'
  setPreference: (p: Theme | 'system') => void
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)
const STORAGE_KEY = 'theme'

function systemTheme(): Theme {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function readStored(): Theme | 'system' {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

/**
 * Theme lives on <html data-theme="…">. index.html sets it before first paint
 * from localStorage, so there is no flash. Signed-in users also get it saved to
 * profiles.theme_preference (see AuthProvider: onPreferenceChange).
 */
export function ThemeProvider({ children, onPreferenceChange }: { children: ReactNode; onPreferenceChange?: (p: Theme | 'system') => void }) {
  const [preference, setPref] = useState<Theme | 'system'>(readStored)
  const [system, setSystem] = useState<Theme>(systemTheme)

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!mq) return
    const onChange = () => setSystem(mq.matches ? 'dark' : 'light')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const theme: Theme = preference === 'system' ? system : preference

  useEffect(() => {
    const root = document.documentElement
    if (preference === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', preference)
    try {
      if (preference === 'system') localStorage.removeItem(STORAGE_KEY)
      else localStorage.setItem(STORAGE_KEY, preference)
    } catch {
      // storage can be unavailable (private mode); the theme still works for this visit
    }
  }, [preference])

  const setPreference = useCallback(
    (p: Theme | 'system') => {
      setPref(p)
      onPreferenceChange?.(p)
    },
    [onPreferenceChange],
  )

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, preference, setPreference, toggle: () => setPreference(theme === 'dark' ? 'light' : 'dark') }),
    [theme, preference, setPreference],
  )
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}
