import { useEffect, useRef, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Icon, type IconName } from './Icon'
import { initials } from '@/lib/format'

export function PageHeader({ title, subtitle, actions, back }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; back?: { to: string; label: string } }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back && (
          <Link to={back.to} className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-text">
            <Icon name="arrowLeft" size={16} /> {back.label}
          </Link>
        )}
        <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
        {subtitle && <div className="mt-1.5 text-muted">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function EmptyState({ icon = 'sparkle', title, body, action }: { icon?: IconName; title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="card-surface flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-bg text-accent">
        <Icon name={icon} size={24} />
      </div>
      <h2 className="text-lg font-semibold">{title}</h2>
      {body && <div className="mt-2 max-w-md text-muted">{body}</div>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-field border border-danger/40 px-4 py-3 text-sm text-danger">
      <span className="flex items-center gap-2">
        <Icon name="alert" size={18} /> {message}
      </span>
      {onRetry && (
        <button type="button" className="btn-secondary btn-sm" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  )
}

export function Notice({ tone = 'info', children, icon }: { tone?: 'info' | 'warning' | 'success' | 'danger'; children: ReactNode; icon?: IconName }) {
  const cls = {
    info: 'border-accent/30 text-text',
    warning: 'border-warning/40 text-text',
    success: 'border-success/40 text-text',
    danger: 'border-danger/40 text-text',
  }[tone]
  const iconCls = { info: 'text-accent', warning: 'text-warning', success: 'text-success', danger: 'text-danger' }[tone]
  return (
    <div className={`flex gap-3 rounded-field border bg-surface px-4 py-3 text-sm ${cls}`}>
      <Icon name={icon ?? (tone === 'success' ? 'check' : tone === 'info' ? 'info' : 'alert')} size={18} className={`mt-0.5 shrink-0 ${iconCls}`} />
      <div>{children}</div>
    </div>
  )
}

export function Skeleton({ className = 'h-24' }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />
}

export function LoadingList({ rows = 3, className = 'h-24' }: { rows?: number; className?: string }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className={className} />
      ))}
    </div>
  )
}

export function ProgressBar({ value, label }: { value: number; label?: string }) {
  const v = Math.max(0, Math.min(100, Math.round(value)))
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-xs text-muted">
        <span>{label ?? 'Progress'}</span>
        <span className="font-medium text-text">{v}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface" role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} aria-label={label ?? 'Progress'}>
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${v}%` }} />
      </div>
    </div>
  )
}

const BADGE_TONES = {
  neutral: 'text-muted',
  accent: 'border-accent/40 text-accent',
  success: 'border-success/40 text-success',
  warning: 'border-warning/50 text-warning',
  danger: 'border-danger/40 text-danger',
} as const

export function Badge({ tone = 'neutral', children }: { tone?: keyof typeof BADGE_TONES; children: ReactNode }) {
  return <span className={`badge ${BADGE_TONES[tone]}`}>{children}</span>
}

export function Avatar({ name, url, size = 32 }: { name?: string | null; url?: string | null; size?: number }) {
  if (url) return <img src={url} alt="" width={size} height={size} className="shrink-0 rounded-full border border-border object-cover" style={{ width: size, height: size }} />
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-surface font-semibold text-muted"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials(name)}
    </span>
  )
}

export function Tabs<T extends string>({ tabs, value, onChange, label }: { tabs: { id: T; label: string; count?: number }[]; value: T; onChange: (id: T) => void; label: string }) {
  const ref = useRef<HTMLDivElement>(null)
  // On phones the tab row scrolls sideways: keep the selected tab visible.
  useEffect(() => {
    ref.current?.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest', inline: 'center' })
  }, [value])
  return (
    <div ref={ref} role="tablist" aria-label={label} className="-mx-4 mb-6 flex gap-1 overflow-x-auto border-b border-border px-4 sm:mx-0 sm:px-0">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          type="button"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          onKeyDown={(e) => {
            const i = tabs.findIndex((x) => x.id === value)
            if (e.key === 'ArrowRight') onChange(tabs[(i + 1) % tabs.length].id)
            if (e.key === 'ArrowLeft') onChange(tabs[(i - 1 + tabs.length) % tabs.length].id)
          }}
          className={`-mb-px shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition ${
            value === t.id ? 'border-accent text-text' : 'border-transparent text-muted hover:text-text'
          }`}
        >
          {t.label}
          {t.count !== undefined && t.count > 0 && <span className="ml-1.5 rounded-full bg-surface px-1.5 text-xs">{t.count}</span>}
        </button>
      ))}
    </div>
  )
}

export function Field({ label, htmlFor, hint, error, children }: { label: string; htmlFor: string; hint?: ReactNode; error?: string | null; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="label">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="mt-1 text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="hint">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`card p-5 sm:p-6 ${className}`}>{children}</div>
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-sm text-muted">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-accent" aria-hidden="true" />
      {label}
    </span>
  )
}
