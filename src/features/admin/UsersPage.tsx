import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAsync, unwrap } from '@/lib/useAsync'
import { useAccount } from '@/features/auth/AuthProvider'
import type { Organization, Profile, Role, StaffInvite } from '@/lib/types'
import { formatDate } from '@/lib/format'
import { friendlyError, isEmail } from '@/lib/errors'
import { Avatar, Badge, EmptyState, ErrorBox, LoadingList, Notice, PageHeader, Tabs } from '@/components/ui'
import { useToast } from '@/components/Toast'

type TabId = 'people' | 'pending' | 'clients' | 'invites'

export default function UsersPage() {
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as TabId) || 'people'
  const { data, error, loading, reload } = useAsync(async () => {
    const [profiles, orgs, invites] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('organizations').select('*').order('name'),
      supabase.from('staff_invites').select('*').order('created_at', { ascending: false }),
    ])
    return { profiles: unwrap(profiles) as Profile[], orgs: unwrap(orgs) as Organization[], invites: unwrap(invites) as StaffInvite[] }
  }, [])

  const pending = data?.profiles.filter((p) => p.role === 'team' && p.status === 'pending') ?? []
  const newClients = data?.profiles.filter((p) => p.role === 'client' && p.status === 'approved' && !p.org_id) ?? []

  return (
    <div>
      <PageHeader title="People" subtitle="Team members, clients and invites." />
      <Tabs
        label="People sections"
        value={tab}
        onChange={(t) => setParams({ tab: t }, { replace: true })}
        tabs={[
          { id: 'people', label: 'Everyone' },
          { id: 'pending', label: 'Pending team members', count: pending.length },
          { id: 'clients', label: 'New clients', count: newClients.length },
          { id: 'invites', label: 'Invites' },
        ]}
      />
      {error ? (
        <ErrorBox message={friendlyError(error)} onRetry={reload} />
      ) : loading || !data ? (
        <LoadingList rows={4} className="h-14" />
      ) : tab === 'people' ? (
        <PeopleTab profiles={data.profiles} orgs={data.orgs} reload={reload} />
      ) : tab === 'pending' ? (
        <PendingTab people={pending} reload={reload} />
      ) : tab === 'clients' ? (
        <NewClientsTab people={newClients} orgs={data.orgs} reload={reload} />
      ) : (
        <InvitesTab invites={data.invites} reload={reload} />
      )}
    </div>
  )
}

function PeopleTab({ profiles, orgs, reload }: { profiles: Profile[]; orgs: Organization[]; reload: () => Promise<void> }) {
  const me = useAccount()
  const toast = useToast()
  const [filter, setFilter] = useState<'all' | Role>('all')
  const orgName = (id: string | null) => orgs.find((o) => o.id === id)?.name
  const shown = profiles.filter((p) => filter === 'all' || p.role === filter)

  const setRole = async (p: Profile, role: Role) => {
    if (role === p.role) return
    if (!window.confirm(`Change ${p.full_name ?? p.email} to ${role}?`)) return
    const { error } = await supabase.rpc('admin_set_user_role', { p_user_id: p.id, p_role: role })
    if (error) toast(friendlyError(error), 'error')
    else {
      toast('Role updated.')
      void reload()
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {(['all', 'admin', 'team', 'client'] as const).map((f) => (
          <button key={f} type="button" className={f === filter ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'} onClick={() => setFilter(f)} aria-pressed={f === filter}>
            {f === 'all' ? 'Everyone' : f === 'admin' ? 'Admins' : f === 'team' ? 'Team' : 'Clients'}
          </button>
        ))}
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[40rem] text-sm">
          <thead className="border-b border-border bg-surface text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Organization</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Role</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {shown.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={p.full_name ?? p.email} url={p.avatar_url} size={28} />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{p.full_name ?? '—'}</p>
                      <p className="truncate text-xs text-muted">{p.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {p.org_id ? (
                    <Link className="hover:text-accent" to={`/admin/orgs/${p.org_id}`}>
                      {orgName(p.org_id)}
                    </Link>
                  ) : p.role === 'client' ? (
                    <span className="text-muted">Not linked ({p.requested_company_name})</span>
                  ) : (
                    <span className="text-muted">Coherent</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={p.status === 'approved' ? 'success' : p.status === 'pending' ? 'warning' : 'danger'}>{p.status}</Badge>
                </td>
                <td className="px-4 py-3">
                  <label className="sr-only" htmlFor={`role-${p.id}`}>
                    Role for {p.full_name ?? p.email}
                  </label>
                  <select id={`role-${p.id}`} className="field w-auto py-1.5" value={p.role} disabled={p.id === me.id} onChange={(e) => setRole(p, e.target.value as Role)}>
                    <option value="admin">Admin</option>
                    <option value="team">Team</option>
                    <option value="client">Client</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PendingTab({ people, reload }: { people: Profile[]; reload: () => Promise<void> }) {
  const toast = useToast()
  const review = async (p: Profile, approve: boolean) => {
    if (!approve && !window.confirm(`Reject ${p.email}?`)) return
    const { error } = await supabase.rpc('review_team_member', { p_user_id: p.id, p_approve: approve })
    if (error) toast(friendlyError(error), 'error')
    else {
      toast(approve ? `${p.full_name ?? p.email} is now on the team. We emailed them.` : 'Request rejected.')
      void reload()
    }
  }
  if (!people.length) return <EmptyState icon="users" title="Nobody is waiting" body="New team signups that were not invited show up here." />
  return (
    <ul className="card divide-y divide-border">
      {people.map((p) => (
        <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-4">
          <Avatar name={p.full_name ?? p.email} size={36} />
          <div className="min-w-0 flex-1">
            <p className="font-medium">{p.full_name ?? 'No name given'}</p>
            <p className="text-sm text-muted">
              {p.email} · signed up {formatDate(p.created_at)}
            </p>
          </div>
          <button type="button" className="btn-secondary btn-sm" onClick={() => review(p, false)}>
            Reject
          </button>
          <button type="button" className="btn-primary btn-sm" onClick={() => review(p, true)}>
            Approve as team
          </button>
        </li>
      ))}
    </ul>
  )
}

function NewClientsTab({ people, orgs, reload }: { people: Profile[]; orgs: Organization[]; reload: () => Promise<void> }) {
  const toast = useToast()
  const [choice, setChoice] = useState<Record<string, string>>({})

  const link = async (p: Profile, orgId: string) => {
    if (!orgId) return
    const { error } = orgId === 'new'
      ? await supabase.rpc('create_org_for_client', { p_user_id: p.id, p_name: p.requested_company_name })
      : await supabase.rpc('link_client_to_org', { p_user_id: p.id, p_org_id: orgId })
    if (error) toast(friendlyError(error), 'error')
    else {
      toast(`${p.full_name ?? p.email} is linked. We emailed them that their space is ready.`)
      void reload()
    }
  }

  if (!people.length) return <EmptyState icon="briefcase" title="No new clients" body="Clients who sign up appear here until you link them to an organization." />
  return (
    <div className="space-y-4">
      <Notice tone="info">New clients cannot see anything until you link them to an organization. They typed the company name themselves, so check it first.</Notice>
      <ul className="card divide-y divide-border">
        {people.map((p) => {
          const match = orgs.find((o) => o.name.toLowerCase() === (p.requested_company_name ?? '').toLowerCase())
          const value = choice[p.id] ?? (match ? match.id : '')
          return (
            <li key={p.id} className="flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-center">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{p.full_name ?? 'No name given'}</p>
                <p className="text-sm text-muted">
                  {p.email} · says they are from <strong className="text-text">{p.requested_company_name ?? '—'}</strong> · {formatDate(p.created_at)}
                </p>
              </div>
              <div className="flex gap-2">
                <label htmlFor={`org-${p.id}`} className="sr-only">
                  Organization for {p.email}
                </label>
                <select id={`org-${p.id}`} className="field" value={value} onChange={(e) => setChoice((c) => ({ ...c, [p.id]: e.target.value }))}>
                  <option value="">Choose…</option>
                  <option value="new">Create new: “{p.requested_company_name}”</option>
                  {orgs.map((o) => (
                    <option key={o.id} value={o.id}>
                      Link to {o.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn-primary shrink-0"
                  disabled={!value}
                  onClick={() => void link(p, value)}
                >
                  Link
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function InvitesTab({ invites, reload }: { invites: StaffInvite[]; reload: () => Promise<void> }) {
  const me = useAccount()
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'team' | 'admin'>('team')
  const [error, setError] = useState<string | null>(null)

  const add = async (e: FormEvent) => {
    e.preventDefault()
    if (!isEmail(email)) return setError('Please enter a valid email address.')
    setError(null)
    const { error: err } = await supabase.from('staff_invites').insert({ email: email.trim().toLowerCase(), role, invited_by: me.id })
    if (err) return setError(err.code === '23505' ? 'This email is already invited.' : friendlyError(err))
    toast('Invite saved. We emailed them a signup link.')
    setEmail('')
    void reload()
  }
  const remove = async (id: string) => {
    const { error: err } = await supabase.from('staff_invites').delete().eq('id', id)
    if (err) toast(friendlyError(err), 'error')
    else void reload()
  }

  return (
    <div className="space-y-6">
      <form onSubmit={add} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="invite-email" className="label">
            Email to invite
          </label>
          <input id="invite-email" type="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@coherent.agency" />
        </div>
        <div>
          <label htmlFor="invite-role" className="label">
            Role
          </label>
          <select id="invite-role" className="field" value={role} onChange={(e) => setRole(e.target.value as 'team' | 'admin')}>
            <option value="team">Team</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <button type="submit" className="btn-primary">
          Invite
        </button>
      </form>
      {error && <p className="text-sm text-danger">{error}</p>}
      <p className="text-sm text-muted">Invited people sign up at /signup?role=team with this exact email and get their role automatically.</p>
      <ul className="card divide-y divide-border">
        {invites.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
            <span className="min-w-0 flex-1 truncate font-medium">{i.email}</span>
            <Badge tone={i.role === 'admin' ? 'accent' : 'neutral'}>{i.role}</Badge>
            {i.used_at ? <Badge tone="success">Joined {formatDate(i.used_at)}</Badge> : <Badge tone="warning">Not joined yet</Badge>}
            {!i.used_at && (
              <button type="button" className="text-xs text-muted hover:text-danger" onClick={() => remove(i.id)}>
                Cancel invite
              </button>
            )}
          </li>
        ))}
        {invites.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted">No invites yet.</li>}
      </ul>
    </div>
  )
}
