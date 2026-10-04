import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthProvider'
import { Avatar } from './ui'
import { Icon } from './Icon'

export function UserMenu() {
  const { account, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!account) return null
  const profilePath = account.role === 'client' ? '/client/profile' : '/profile'

  return (
    <div className="relative" ref={ref}>
      <button type="button" className="btn-ghost h-10 gap-2 px-1.5 sm:px-2" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Avatar name={account.full_name ?? account.email} url={account.avatar_url} size={30} />
        <span className="hidden max-w-[10rem] truncate text-sm font-medium text-text md:inline">{account.full_name ?? account.email}</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-40 mt-2 w-60 rounded-card border border-border bg-bg p-1.5 shadow-xl">
          <div className="border-b border-border px-3 py-2">
            <p className="truncate text-sm font-medium">{account.full_name ?? 'Your account'}</p>
            <p className="truncate text-xs text-muted">{account.email}</p>
            <p className="mt-1 text-xs capitalize text-muted">{account.role}</p>
          </div>
          <Link role="menuitem" to={profilePath} onClick={() => setOpen(false)} className="mt-1 flex items-center gap-2 rounded-field px-3 py-2 text-sm hover:bg-surface">
            <Icon name="user" size={18} /> Your profile
          </Link>
          <Link role="menuitem" to="/notifications" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-field px-3 py-2 text-sm hover:bg-surface">
            <Icon name="bell" size={18} /> Notifications
          </Link>
          <button
            role="menuitem"
            type="button"
            onClick={async () => {
              setOpen(false)
              await signOut()
              navigate('/', { replace: true })
            }}
            className="flex w-full items-center gap-2 rounded-field px-3 py-2 text-left text-sm hover:bg-surface"
          >
            <Icon name="logout" size={18} /> Sign out
          </button>
        </div>
      )}
    </div>
  )
}
