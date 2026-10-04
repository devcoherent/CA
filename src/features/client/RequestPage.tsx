import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAsync, unwrap } from '@/lib/useAsync'
import { useAccount } from '@/features/auth/AuthProvider'
import type { Project } from '@/lib/types'
import { copy } from '@/content/copy'
import { friendlyError } from '@/lib/errors'
import { EmptyState, Notice, PageHeader } from '@/components/ui'

export default function RequestPage() {
  const account = useAccount()
  const [params] = useSearchParams()
  const [kind, setKind] = useState<'request' | 'bug'>('request')
  const [projectId, setProjectId] = useState(params.get('project') ?? '')
  const [title, setTitle] = useState('')
  const [details, setDetails] = useState('')
  const [pageUrl, setPageUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const { data: projects } = useAsync(
    async () => unwrap(await supabase.from('projects').select('id, name').order('name')) as Pick<Project, 'id' | 'name'>[],
    [account.org_id],
  )

  if (!account.org_id) return <EmptyState title={copy.clientHome.noOrgTitle} body={copy.clientHome.noOrgBody} />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setError('Please add a short summary.')
      return
    }
    setBusy(true)
    setError(null)
    const { error: err } = await supabase.rpc('submit_client_request', {
      p_kind: kind,
      p_title: title,
      p_details: details || null,
      p_project_id: projectId || null,
      p_page_url: pageUrl || null,
    })
    setBusy(false)
    if (err) setError(friendlyError(err))
    else setSent(true)
  }

  if (sent) {
    return (
      <div className="mx-auto max-w-xl">
        <EmptyState
          icon="check"
          title={copy.request.sent}
          action={
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setSent(false)
                setTitle('')
                setDetails('')
                setPageUrl('')
              }}
            >
              Send another
            </button>
          }
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title={copy.request.title} subtitle={copy.request.intro} />
      <form onSubmit={submit} className="card space-y-5 p-5 sm:p-6" noValidate>
        <fieldset>
          <legend className="label">{copy.request.kindLabel}</legend>
          <div className="mt-1 grid gap-2 sm:grid-cols-2">
            {(['request', 'bug'] as const).map((k) => (
              <label
                key={k}
                className={`flex cursor-pointer items-center gap-2 rounded-field border px-3 py-2.5 text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent ${kind === k ? 'border-accent bg-surface font-medium' : 'border-border'}`}
              >
                <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="accent-[var(--c-accent)]" />
                {k === 'request' ? copy.request.kindRequest : copy.request.kindBug}
              </label>
            ))}
          </div>
        </fieldset>
        {projects && projects.length > 0 && (
          <div>
            <label htmlFor="req-project" className="label">
              {copy.request.projectLabel}
            </label>
            <select id="req-project" className="field" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">Not about a specific project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label htmlFor="req-title" className="label">
            {copy.request.titleLabel}
          </label>
          <input id="req-title" className="field" value={title} maxLength={200} placeholder={copy.request.titlePlaceholder} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label htmlFor="req-details" className="label">
            {copy.request.detailsLabel}
          </label>
          <textarea id="req-details" className="field min-h-28" value={details} maxLength={5000} onChange={(e) => setDetails(e.target.value)} />
        </div>
        <div>
          <label htmlFor="req-page" className="label">
            {copy.request.pageLabel}
          </label>
          <input id="req-page" className="field" type="url" value={pageUrl} placeholder="https://…" onChange={(e) => setPageUrl(e.target.value)} />
        </div>
        {error && <Notice tone="danger">{error}</Notice>}
        <button type="submit" className="btn-primary w-full sm:w-auto" disabled={busy}>
          {busy ? 'Sending…' : copy.request.submit}
        </button>
      </form>
    </div>
  )
}
