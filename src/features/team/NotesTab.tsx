import { useState, type FormEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { useAccount } from '@/features/auth/AuthProvider'
import { formatDateTime } from '@/lib/format'
import { friendlyError } from '@/lib/errors'
import { Avatar, Notice } from '@/components/ui'
import type { WorkspaceData } from './ProjectWorkspace'

export function NotesTab({ data, reload }: { data: WorkspaceData; reload: () => Promise<void> }) {
  const account = useAccount()
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const author = (id: string | null) => data.people.find((m) => m.id === id)

  const add = async (e: FormEvent) => {
    e.preventDefault()
    if (!body.trim()) return
    setBusy(true)
    setError(null)
    const { error: err } = await supabase.from('internal_notes').insert({ project_id: data.project.id, author_id: account.id, body: body.trim() })
    setBusy(false)
    if (err) return setError(friendlyError(err))
    setBody('')
    void reload()
  }

  const remove = async (id: string) => {
    if (!window.confirm('Delete this note?')) return
    const { error: err } = await supabase.from('internal_notes').delete().eq('id', id)
    if (err) setError(friendlyError(err))
    else void reload()
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Notice tone="info" icon="lock">
        Internal notes are only visible to the Coherent team. Clients never see them.
      </Notice>
      <form onSubmit={add} className="card space-y-3 p-4">
        <label htmlFor="note-body" className="label">
          Add a note
        </label>
        <textarea id="note-body" className="field min-h-24" value={body} maxLength={5000} onChange={(e) => setBody(e.target.value)} placeholder="Context, decisions, gotchas…" />
        {error && <p className="text-sm text-danger">{error}</p>}
        <button type="submit" className="btn-primary" disabled={busy || !body.trim()}>
          {busy ? 'Saving…' : 'Add note'}
        </button>
      </form>
      <ul className="space-y-3">
        {data.notes.map((n) => {
          const who = author(n.author_id)
          return (
            <li key={n.id} className="card p-4">
              <div className="flex items-center gap-2 text-sm">
                <Avatar name={who?.full_name ?? who?.email ?? 'Team'} url={who?.avatar_url} size={24} />
                <span className="font-medium">{who?.full_name ?? who?.email ?? 'Team member'}</span>
                <span className="text-xs text-muted">{formatDateTime(n.created_at)}</span>
                {(n.author_id === account.id || account.role === 'admin') && (
                  <button type="button" className="ml-auto text-xs text-muted hover:text-danger" onClick={() => remove(n.id)}>
                    Delete
                  </button>
                )}
              </div>
              <p className="mt-2 whitespace-pre-line text-sm">{n.body}</p>
            </li>
          )
        })}
        {data.notes.length === 0 && <li className="py-6 text-center text-sm text-muted">No notes yet.</li>}
      </ul>
    </div>
  )
}
