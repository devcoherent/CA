import { Link, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAsync, unwrap } from '@/lib/useAsync'
import type { Organization, Profile, Project } from '@/lib/types'
import { formatDate } from '@/lib/format'
import { friendlyError } from '@/lib/errors'
import { Card, EmptyState, ErrorBox, LoadingList, PageHeader } from '@/components/ui'
import { ProjectStatusBadge } from '@/components/badges'
import { OrgForm, PersonForm } from '@/features/client/ProfileForms'
import { Icon } from '@/components/Icon'

export default function OrgDetailPage() {
  const { id } = useParams()
  const { data, error, loading, reload } = useAsync(async () => {
    const [org, people, projects] = await Promise.all([
      supabase.from('organizations').select('*').eq('id', id!).maybeSingle(),
      supabase.from('profiles').select('*').eq('org_id', id!).order('full_name'),
      supabase.from('projects').select('*').eq('org_id', id!).order('created_at', { ascending: false }),
    ])
    return { org: unwrap(org) as Organization | null, people: unwrap(people) as Profile[], projects: unwrap(projects) as Project[] }
  }, [id])

  if (error) return <ErrorBox message={friendlyError(error)} onRetry={reload} />
  if (loading || !data) return <LoadingList rows={3} className="h-40" />
  if (!data.org) return <EmptyState icon="lock" title="Organization not found" />

  return (
    <div>
      <PageHeader
        back={{ to: '/admin/orgs', label: 'Organizations' }}
        title={data.org.name}
        actions={
          <Link to={`/admin/projects/new?org=${data.org.id}`} className="btn-primary">
            <Icon name="plus" size={16} /> New project
          </Link>
        }
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-5 text-lg font-semibold">Company details</h2>
          <OrgForm org={data.org} onSaved={reload} />
        </Card>
        <div className="space-y-6">
          <Card>
            <h2 className="mb-4 text-lg font-semibold">Projects</h2>
            <ul className="divide-y divide-border">
              {data.projects.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-3 py-3">
                  <Link to={`/team/projects/${p.id}`} className="min-w-0 flex-1 font-medium hover:text-accent">
                    {p.name}
                  </Link>
                  <ProjectStatusBadge status={p.status} />
                  <span className="text-xs text-muted">Due {formatDate(p.due_date)}</span>
                </li>
              ))}
              {data.projects.length === 0 && <li className="py-3 text-sm text-muted">No projects yet.</li>}
            </ul>
          </Card>
          <Card>
            <h2 className="mb-1 text-lg font-semibold">Client users</h2>
            <p className="mb-4 text-sm text-muted">You can edit their profile on their behalf.</p>
            {data.people.length === 0 && <p className="text-sm text-muted">Nobody linked yet. Link new clients under People → New clients.</p>}
            <div className="space-y-4">
              {data.people.map((p) => (
                <details key={p.id} className="rounded-field border border-border p-4">
                  <summary className="cursor-pointer font-medium">
                    {p.full_name ?? p.email} <span className="text-sm font-normal text-muted">· {p.email}</span>
                  </summary>
                  <div className="mt-4">
                    <PersonForm person={p} onSaved={reload} />
                  </div>
                </details>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
