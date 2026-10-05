import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'
import type { Notification } from '@/lib/types'
import { relativeTime } from '@/lib/format'
import { Icon } from '@/components/Icon'

export function NotificationBell() {
  const { account } = useAuth()
  const [items, setItems] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const userId = account?.id

  const load = useCallback(async () => {
    if (!userId) return
    const { data } = await supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(15)
    setItems((data as Notification[]) ?? [])
  }, [userId])

  useEffect(() => {
    if (!userId) return
    void load()
    // Realtime: new notifications appear instantly (RLS still applies to the stream).
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, (payload) => {
        setItems((prev) => [payload.new as Notification, ...prev].slice(0, 15))
      })
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [userId, load])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const unread = items.filter((n) => !n.read_at).length

  const markAllRead = async () => {
    if (!userId) return
    const now = new Date().toISOString()
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? now })))
    await supabase.from('notifications').update({ read_at: now }).eq('user_id', userId).is('read_at', null)
  }

  const openItem = async (n: Notification) => {
    setOpen(false)
    if (!n.read_at) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)))
      await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', n.id)
    }
    if (n.link) navigate(n.link)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="btn-ghost relative h-10 w-10 p-0"
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="bell" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-text">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="fixed inset-x-4 top-16 z-40 rounded-card border border-border bg-bg shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-[22rem]">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">Notifications</h2>
            {unread > 0 && (
              <button type="button" className="text-xs font-medium text-accent hover:underline" onClick={markAllRead}>
                Mark all as read
              </button>
            )}
          </div>
          <ul className="max-h-96 overflow-y-auto py-1">
            {items.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted">You are all caught up.</li>}
            {items.map((n) => (
              <li key={n.id}>
                <button type="button" onClick={() => openItem(n)} className="flex w-full gap-3 px-4 py-3 text-left hover:bg-surface">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read_at ? 'bg-transparent' : 'bg-accent'}`} aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{n.title}</span>
                    {n.body && <span className="mt-0.5 line-clamp-2 block text-xs text-muted">{n.body}</span>}
                    <span className="mt-1 block text-xs text-muted">{relativeTime(n.created_at)}</span>
                  </span>
                  {!n.read_at && <span className="sr-only">(unread)</span>}
                </button>
              </li>
            ))}
          </ul>
          <div className="border-t border-border px-4 py-2.5 text-center">
            <Link to="/notifications" onClick={() => setOpen(false)} className="text-sm font-medium text-accent hover:underline">
              See all
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
