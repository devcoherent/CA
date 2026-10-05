import { useEffect, useRef } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthProvider'
import { Logo } from './Logo'
import { ThemeToggle } from './ThemeToggle'
import { UserMenu } from './UserMenu'
import { NotificationBell } from '@/features/notifications/NotificationBell'
import { TimerWidget } from '@/features/time/TimerWidget'

type NavItem = { to: string; label: string; end?: boolean; also?: RegExp }

const CLIENT_NAV: NavItem[] = [
  { to: '/client', label: 'Projects', end: true, also: /^\/client\/projects\// },
  { to: '/client/request', label: 'Ask for something' },
  { to: '/client/profile', label: 'Profile' },
]
const TEAM_NAV: NavItem[] = [
  { to: '/team', label: 'My projects', end: true, also: /^\/team\/projects\// },
  { to: '/profile', label: 'Profile' },
]
const ADMIN_NAV: NavItem[] = [
  { to: '/team', label: 'Projects', end: true, also: /^\/(team\/projects|admin\/projects)\// },
  { to: '/admin', label: 'Workload', end: true },
  { to: '/admin/users', label: 'People' },
  { to: '/admin/orgs', label: 'Organizations' },
  { to: '/admin/approvals', label: 'Approvals' },
  { to: '/admin/requests', label: 'Requests' },
  { to: '/admin/templates', label: 'Templates' },
  { to: '/admin/audit', label: 'Audit log' },
]

export function AppShell() {
  const { account } = useAuth()
  const role = account?.role
  const nav = role === 'admin' ? ADMIN_NAV : role === 'team' ? TEAM_NAV : CLIENT_NAV
  const isStaff = role === 'admin' || role === 'team'
  const { pathname } = useLocation()
  const navRef = useRef<HTMLElement>(null)

  // On phones the nav scrolls sideways: keep the current page's item in view.
  useEffect(() => {
    navRef.current?.querySelector('[aria-current="page"], [data-section-active="true"]')?.scrollIntoView?.({ block: 'nearest', inline: 'center' })
  }, [pathname])

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-field focus:bg-bg focus:px-4 focus:py-2">
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-border bg-bg/90 backdrop-blur">
        <div className={`mx-auto flex h-16 items-center justify-between gap-3 px-4 sm:px-6 ${isStaff ? 'max-w-7xl' : 'max-w-5xl'}`}>
          <Logo to={role === 'client' ? '/client' : '/team'} compact={isStaff} />
          <div className="flex min-w-0 items-center gap-0.5 sm:gap-2">
            {isStaff && <TimerWidget />}
            <NotificationBell />
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
        <nav ref={navRef} aria-label="Main" className={`mx-auto -mb-px flex gap-1 overflow-x-auto px-2 sm:px-4 ${isStaff ? 'max-w-7xl' : 'max-w-5xl'}`}>
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              data-section-active={item.also?.test(pathname) ? 'true' : undefined}
              className={({ isActive }) =>
                `shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition ${isActive || item.also?.test(pathname) ? 'border-accent text-text' : 'border-transparent text-muted hover:text-text'}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main id="main" className={`mx-auto w-full flex-1 px-4 py-8 sm:px-6 sm:py-10 ${isStaff ? 'max-w-7xl' : 'max-w-5xl'}`}>
        <Outlet />
      </main>
    </div>
  )
}
