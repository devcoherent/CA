import { Link } from 'react-router-dom'
import logoUrl from '@/assets/logo.svg'
import { brand } from '@/styles/brand'

export function Logo({ to = '/', label = brand.name }: { to?: string; label?: string }) {
  return (
    <Link to={to} className="inline-flex items-center gap-2.5 rounded-field font-heading text-lg font-semibold text-text">
      <img src={logoUrl} alt="" width={28} height={28} className="h-7 w-7" />
      <span>{label}</span>
    </Link>
  )
}
