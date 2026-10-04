import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAsync, unwrap } from '@/lib/useAsync'
import type { Organization, Profile, Project, ProjectTemplate, ProjectTemplateKey } from '@/lib/types'
import { friendlyError } from '@/lib/errors'
import { Card, LoadingList, PageHeader } from '@/components/ui'
import { useToast } from '@/components/Toast'

export default function NewProjectPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [orgId, setOrgId] = useState(params.get('org') ?? '')
  const [name, setName] = useState('')
  const [template, setTemplate] = useState<ProjectTemplateKey>('webflow_build')
  const [start, setStart] = useState('')
  const [due, setDue] = useState('')
  const [members, setMembers] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data, loading } = useAsync(async () => {
    const [orgs, templates, staff] = await Promise.all([
      supabase.from('organizations').select('id, name').order('name'),
      supabase.from('project_templates').select('*').order('name'),
      supabase.from('profiles').select('id, full_name, email, role').in('role', ['admin', 'team']).eq('status', 'approved').order('full_name'),
    ])
    return {
      orgs: unwrap(orgs) as Pick<Organization, 'id' | 'name'>[],
      templates: unwrap(templates) as ProjectTemplate[],
      staff: unwrap(staff) as Pick<Profile, 'id' | 'full_name' | 'email' | 'role'>[],
    }
  }, [])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!orgId || !name.trim()) return setError('Please choose an organization and enter a name.')
    setBusy(true)
    setError(null)
    const { data: project, error: err } = await supabase.rpc('create_project_from_template', {
      p_org_id: orgId,
      p_name: name.trim(),
      p_template: template,
      p_start_date: start || null,
      p_due_date: due || null,
      p_member_ids: members,
    })
    setBusy(false)
    if (err) return setError(friendlyError(err))
    toast('Project created with its stages, tasks and access steps.')
    navigate(`/team/projects/${(project as Project).id}`)
  }

  if (loading || !data) return <LoadingList rows={1} className="h-96" />

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader back={{ to: '/team', label: 'Projects' }} title="New project" subtitle="The template adds default stages, tasks and access steps." />
      <Card>
        <form onSubmit={submit} className="space-y-5">
          <div>
            <label htmlFor="np-org" className="label">
              Organization
            </label>
            <select id="np-org" className="field" value={orgId} onChange={(e) => setOrgId(e.target.value)}>
              <option value="">Choose…</option>
              {data.orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="np-name" className="label">
              Project name
            </label>
            <input id="np-name" className="field" value={name} maxLength={200} onChange={(e) => setName(e.target.value)} placeholder="e.g. Acme website redesign" />
          </div>
          <fieldset>
            <legend className="label">Template</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {data.templates.map((t) => (
                <label key={t.id} className={`cursor-pointer rounded-field border p-3 text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent ${template === t.key ? 'border-accent bg-surface' : 'border-border'}`}>
                  <input type="radio" name="template" className="sr-only" checked={template === t.key} onChange={() => setTemplate(t.key)} />
                  <span className="block font-medium">{t.name}</span>
                  <span className="mt-1 block text-xs text-muted">{t.description}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="np-start" className="label">
                Start date
              </label>
              <input id="np-start" type="date" className="field" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div>
              <label htmlFor="np-due" className="label">
                Due date
              </label>
              <input id="np-due" type="date" className="field" value={due} min={start || undefined} onChange={(e) => setDue(e.target.value)} />
            </div>
          </div>
          <fieldset>
            <legend className="label">Assign team</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {data.staff.map((s) => (
                <label key={s.id} className="flex items-center gap-2 rounded-field border border-border px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    className="accent-[var(--c-accent)]"
                    checked={members.includes(s.id)}
                    onChange={(e) => setMembers((m) => (e.target.checked ? [...m, s.id] : m.filter((x) => x !== s.id)))}
                  />
                  {s.full_name ?? s.email} <span className="text-xs capitalize text-muted">({s.role})</span>
                </label>
              ))}
            </div>
          </fieldset>
          {error && (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Creating…' : 'Create project'}
          </button>
        </form>
      </Card>
    </div>
  )
}
