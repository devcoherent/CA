/**
 * DEMO MODE ONLY — floating panel to sign in as any fake user instantly and switch theme.
 * Rendered by App.tsx only when __DEMO__ is true; the production build never includes it.
 */
import { useState } from 'react'
import { useTheme } from '@/app/theme'
import { DEMO_USERS, type DemoUserKey } from './data'
import { demoCurrentUser, demoSignIn, resetDemoData } from './supabaseDemo'

const HOME: Record<DemoUserKey, string> = {
  admin: '/team',
  sadman: '/team',
  ashik: '/team',
  'client-a': '/client',
  'client-b': '/client',
  pending: '/pending',
  'new-client': '/client',
}

function hidden(): boolean {
  try {
    const p = new URLSearchParams(window.location.search).get('demoUi')
    if (p === '0') sessionStorage.setItem('coherent.demo.hideUi', '1')
    if (p === '1') sessionStorage.removeItem('coherent.demo.hideUi')
    return sessionStorage.getItem('coherent.demo.hideUi') === '1'
  } catch {
    return false
  }
}

export default function DemoSwitcher() {
  const [open, setOpen] = useState(false)
  const { theme, setPreference } = useTheme()
  if (hidden()) return null
  const current = demoCurrentUser()

  const signInAs = (key: DemoUserKey) => {
    demoSignIn(key)
    // Full reload so every screen starts clean as the new user (demo data is kept for this tab).
    window.location.assign(HOME[key])
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 flex flex-col items-start gap-2" data-testid="demo-switcher">
      {open && (
        <div id="demo-panel" className="w-64 rounded-card border-2 border-dashed border-warning/70 bg-bg p-3 text-sm shadow-2xl">
          <p className="px-1 pb-2 text-xs font-semibold uppercase tracking-wide text-muted">Sign in as</p>
          <ul className="grid gap-1">
            {DEMO_USERS.map((u) => (
              <li key={u.key}>
                <button
                  type="button"
                  onClick={() => signInAs(u.key)}
                  aria-current={current === u.id ? 'true' : undefined}
                  className={`w-full rounded-field px-2.5 py-1.5 text-left transition hover:bg-surface ${current === u.id ? 'bg-surface font-semibold text-accent' : ''}`}
                >
                  {u.label}
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center gap-1 border-t border-border pt-3" role="group" aria-label="Theme">
            {(['light', 'dark'] as const).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={theme === t}
                onClick={() => setPreference(t)}
                className={`flex-1 rounded-field px-2 py-1.5 capitalize ${theme === t ? 'bg-accent text-accent-text' : 'hover:bg-surface'}`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="mt-2 flex justify-between gap-2 px-1 text-xs">
            <button
              type="button"
              className="text-muted hover:text-text"
              onClick={() => window.location.assign('/?demo=signed-out')}
            >
              Sign out
            </button>
            <button
              type="button"
              className="text-muted hover:text-text"
              onClick={() => {
                resetDemoData()
                window.location.reload()
              }}
            >
              Reset demo data
            </button>
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="demo-panel"
        className="rounded-full border-2 border-dashed border-warning/70 bg-bg px-4 py-2 text-sm font-semibold text-text shadow-lg hover:bg-surface"
      >
        Demo {open ? '▾' : '▴'}
      </button>
    </div>
  )
}
