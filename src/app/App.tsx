import { lazy, Suspense, useCallback, useEffect, useRef, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider'
import { ThemeProvider, useTheme, type Theme } from './theme'
import { ToastProvider } from '@/components/Toast'
import { AppShell } from '@/components/AppShell'
import { FullPageLoading, RedirectIfSignedIn, RequireAccount } from '@/routes/guards'
import { TimerProvider } from '@/features/time/TimerProvider'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { copy } from '@/content/copy'

import LandingPage from '@/features/landing/LandingPage'
import LoginPage from '@/features/auth/LoginPage'
import SignupPage from '@/features/auth/SignupPage'
import AuthCallbackPage from '@/features/auth/AuthCallbackPage'
import PendingPage from '@/features/auth/PendingPage'

const NotificationsPage = lazy(() => import('@/features/notifications/NotificationsPage'))
const ClientHome = lazy(() => import('@/features/client/ClientHome'))
const ClientProjectPage = lazy(() => import('@/features/client/ClientProjectPage'))
const ClientAccessPage = lazy(() => import('@/features/access/ClientAccessPage'))
const QAPage = lazy(() => import('@/features/client/QAPage'))
const RequestPage = lazy(() => import('@/features/client/RequestPage'))
const ClientProfilePage = lazy(() => import('@/features/client/ClientProfilePage'))
const ProfilePage = lazy(() => import('@/features/team/ProfilePage'))
const TeamHome = lazy(() => import('@/features/team/TeamHome'))
const ProjectWorkspace = lazy(() => import('@/features/team/ProjectWorkspace'))
const WorkloadPage = lazy(() => import('@/features/admin/WorkloadPage'))
const UsersPage = lazy(() => import('@/features/admin/UsersPage'))
const OrgsPage = lazy(() => import('@/features/admin/OrgsPage'))
const OrgDetailPage = lazy(() => import('@/features/admin/OrgDetailPage'))
const NewProjectPage = lazy(() => import('@/features/admin/NewProjectPage'))
const ApprovalsPage = lazy(() => import('@/features/admin/ApprovalsPage'))
const RequestsPage = lazy(() => import('@/features/admin/RequestsPage'))
const TemplatesPage = lazy(() => import('@/features/admin/TemplatesPage'))
const AuditPage = lazy(() => import('@/features/admin/AuditPage'))
// Demo panel: only exists when __DEMO__ is true. In production __DEMO__ is the constant `false`,
// so this import is removed from the bundle entirely.
const DemoSwitcher = __DEMO__ ? lazy(() => import('@/demo/DemoSwitcher')) : null

/** Saves theme changes to the profile, and applies the saved profile theme after login. */
function ThemeBridge({ children }: { children: ReactNode }) {
  const { account } = useAuth()
  const accountId = account?.id
  const save = useCallback(
    (p: Theme | 'system') => {
      if (accountId) void supabase.from('profiles').update({ theme_preference: p }).eq('id', accountId)
    },
    [accountId],
  )
  return (
    <ThemeProvider onPreferenceChange={save}>
      <ApplySavedTheme />
      {children}
    </ThemeProvider>
  )
}

function ApplySavedTheme() {
  const { account } = useAuth()
  const { preference, setPreference } = useTheme()
  const applied = useRef<string | null>(null)
  useEffect(() => {
    if (!account || applied.current === account.id) return
    applied.current = account.id
    const saved = account.theme_preference
    if ((saved === 'light' || saved === 'dark') && saved !== preference) setPreference(saved)
  }, [account, preference, setPreference])
  return null
}

function NotConfigured() {
  return (
    <div className="mx-auto max-w-lg p-8">
      <h1 className="text-2xl font-semibold">Almost there</h1>
      <p className="mt-3 text-muted">{copy.errors.notConfigured}</p>
    </div>
  )
}

function NotFound() {
  return (
    <div className="mx-auto max-w-lg p-8 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="mt-3 text-muted">This page does not exist.</p>
      <a className="btn-primary mt-6" href="/">
        Go to the start
      </a>
    </div>
  )
}

const staff = ['admin', 'team'] as const

export function AppRoutes() {
  return (
    <Suspense fallback={<FullPageLoading />}>
      <Routes>
        <Route path="/" element={<RedirectIfSignedIn><LandingPage /></RedirectIfSignedIn>} />
        <Route path="/login" element={<RedirectIfSignedIn><LoginPage /></RedirectIfSignedIn>} />
        <Route path="/signup" element={<RedirectIfSignedIn><SignupPage /></RedirectIfSignedIn>} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/pending" element={<PendingPage />} />

        <Route element={<RequireAccount><TimerProvider><AppShell /></TimerProvider></RequireAccount>}>
          <Route path="/notifications" element={<NotificationsPage />} />

          <Route path="/client" element={<RequireAccount roles={['client']}><ClientHome /></RequireAccount>} />
          <Route path="/client/projects/:id" element={<RequireAccount roles={['client']}><ClientProjectPage /></RequireAccount>} />
          <Route path="/client/projects/:id/access" element={<RequireAccount roles={['client']}><ClientAccessPage /></RequireAccount>} />
          <Route path="/client/projects/:id/qa" element={<RequireAccount roles={['client']}><QAPage /></RequireAccount>} />
          <Route path="/client/request" element={<RequireAccount roles={['client']}><RequestPage /></RequireAccount>} />
          <Route path="/client/profile" element={<RequireAccount roles={['client']}><ClientProfilePage /></RequireAccount>} />

          <Route path="/team" element={<RequireAccount roles={[...staff]}><TeamHome /></RequireAccount>} />
          <Route path="/team/projects/:id" element={<RequireAccount roles={[...staff]}><ProjectWorkspace /></RequireAccount>} />
          <Route path="/profile" element={<RequireAccount roles={[...staff]}><ProfilePage /></RequireAccount>} />

          <Route path="/admin" element={<RequireAccount roles={['admin']}><WorkloadPage /></RequireAccount>} />
          <Route path="/admin/users" element={<RequireAccount roles={['admin']}><UsersPage /></RequireAccount>} />
          <Route path="/admin/orgs" element={<RequireAccount roles={['admin']}><OrgsPage /></RequireAccount>} />
          <Route path="/admin/orgs/:id" element={<RequireAccount roles={['admin']}><OrgDetailPage /></RequireAccount>} />
          <Route path="/admin/projects/new" element={<RequireAccount roles={['admin']}><NewProjectPage /></RequireAccount>} />
          <Route path="/admin/approvals" element={<RequireAccount roles={['admin']}><ApprovalsPage /></RequireAccount>} />
          <Route path="/admin/requests" element={<RequireAccount roles={['admin']}><RequestsPage /></RequireAccount>} />
          <Route path="/admin/templates" element={<RequireAccount roles={['admin']}><TemplatesPage /></RequireAccount>} />
          <Route path="/admin/audit" element={<RequireAccount roles={['admin']}><AuditPage /></RequireAccount>} />
        </Route>

        <Route path="/home" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  )
}

export function App() {
  if (!isSupabaseConfigured) return <NotConfigured />
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeBridge>
          <ToastProvider>
            <AppRoutes />
            {DemoSwitcher && (
              <Suspense fallback={null}>
                <DemoSwitcher />
              </Suspense>
            )}
          </ToastProvider>
        </ThemeBridge>
      </AuthProvider>
    </BrowserRouter>
  )
}
