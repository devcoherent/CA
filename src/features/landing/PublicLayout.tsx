import type { ReactNode } from 'react'
import { Logo } from '@/components/Logo'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Icon } from '@/components/Icon'
import { COMPANY_NAME, MARKETING_SITE_URL, SUPPORT_EMAIL, copy } from '@/content/copy'

export function PublicHeader() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />
        <div className="flex items-center gap-1 sm:gap-3">
          <a href={MARKETING_SITE_URL} className="inline-flex items-center gap-1 rounded-field px-2 py-1 text-sm text-muted hover:text-text">
            <span className="hidden sm:inline">{copy.landing.visitSite}</span>
            <span className="sm:hidden">coherent.agency</span>
            <Icon name="external" size={14} />
          </a>
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}

export function PublicFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          {copy.landing.footerSupport}{' '}
          <a className="link" href={`mailto:${SUPPORT_EMAIL}`}>
            {SUPPORT_EMAIL}
          </a>
        </p>
        <div className="flex items-center gap-4">
          <a className="hover:text-text" href={MARKETING_SITE_URL}>
            coherent.agency
          </a>
          <span>
            © {new Date().getFullYear()} {COMPANY_NAME}
          </span>
        </div>
      </div>
    </footer>
  )
}

export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <PublicFooter />
    </div>
  )
}

/** Centered card layout for login/signup. */
export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <PublicLayout>
      <div className="mx-auto w-full max-w-md px-4 py-12 sm:py-20">{children}</div>
    </PublicLayout>
  )
}
