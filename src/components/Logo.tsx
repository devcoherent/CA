import { Link } from 'react-router-dom'
import logoUrl from '@/assets/logo.svg'
import { brand } from '@/styles/brand'

/** `compact`: show only the mark on phones (used in the busy staff header). */
export function Logo({ to = '/', label = brand.name, compact = false }: { to?: string; label?: string; compact?: boolean }) {
  return (
    <Link to={to} aria-label={compact ? label : undefined} className="inline-flex shrink-0 items-center gap-2.5 rounded-field font-heading text-lg font-semibold text-text">
      <img src={logoUrl} alt="" width={28} height={28} className="h-7 w-7" />
      <span className={compact ? 'hidden sm:inline' : undefined}>{label}</span>
    </Link>
  )
}
