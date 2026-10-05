import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAsync, unwrap } from '@/lib/useAsync'
import type { Organization } from '@/lib/types'
import { friendlyError } from '@/lib/errors'
import { EmptyState, ErrorBox, LoadingList, PageHeader } from '@/components/ui'
import { Icon } from '@/components/Icon'

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

type Row = Organization & { projects: { count: number }[]; profiles: { count: number }[] }

export default function OrgsPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const { data, error: loadError, loading, reload } = useAsync(
    async () => unwrap(await supabase.from('organizations').select('*, projects(count), profiles(count)').order('name')) as Row[],
    [],
  )

  const create = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    const { data: org, error: err } = await supabase.from('organizations').insert({ name: name.trim() }).select().single()
    if (err) return setError(friendlyError(err))
    navigate(`/admin/orgs/${(org as Organization).id}`)
  }

  return (
    <div>
      <PageHeader title="Organizations" subtitle="Client companies." />
      <form onSubmit={create} className="card mb-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="org-new" className="label">
            New organization
          </label>
          <input id="org-new" className="field" value={name} maxLength={200} onChange={(e) => setName(e.target.value)} placeholder="Company name" />
        </div>
        <button type="submit" className="btn-primary" disabled={!name.trim()}>
          <Icon name="plus" size={16} /> Create
        </button>
      </form>
      {error && <p className="mb-4 text-sm text-danger">{error}</p>}
      {loadError ? (
        <ErrorBox message={friendlyError(loadError)} onRetry={reload} />
      ) : loading || !data ? (
        <LoadingList rows={3} className="h-14" />
      ) : !data.length ? (
        <EmptyState icon="briefcase" title="No organizations yet" />
      ) : (
        <ul className="card divide-y divide-border">
          {data.map((o) => (
            <li key={o.id}>
              <Link to={`/admin/orgs/${o.id}`} className="flex items-center gap-4 px-4 py-4 hover:bg-surface">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-field border border-border bg-surface">
                  {o.logo_url ? <img src={o.logo_url} alt="" className="h-full w-full object-cover" /> : <Icon name="briefcase" size={18} className="text-muted" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{o.name}</span>
                  <span className="block text-sm text-muted">
                    {plural(o.projects?.[0]?.count ?? 0, 'project')} · {plural(o.profiles?.[0]?.count ?? 0, 'client user')}
                  </span>
                </span>
                <Icon name="arrowRight" size={16} className="text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
