import { supabase } from '@/lib/supabase'
import { useAsync, unwrap } from '@/lib/useAsync'
import { useAccount, useAuth } from '@/features/auth/AuthProvider'
import type { Organization } from '@/lib/types'
import { useTheme } from '@/app/theme'
import { Card, LoadingList, Notice, PageHeader } from '@/components/ui'
import { OrgForm, PersonForm } from './ProfileForms'

export default function ClientProfilePage() {
  const account = useAccount()
  const { refreshAccount } = useAuth()
  const { preference, setPreference } = useTheme()
  const { data: org, loading, reload } = useAsync(
    async () => (account.org_id ? (unwrap(await supabase.from('organizations').select('*').eq('id', account.org_id).maybeSingle()) as Organization | null) : null),
    [account.org_id],
  )

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Your profile" subtitle={account.email} />
      <div className="space-y-6">
        <Card>
          <h2 className="mb-5 text-lg font-semibold">About you</h2>
          <PersonForm person={{ ...account, theme_preference: preference }} showTheme onTheme={(t) => setPreference(t)} onSaved={() => void refreshAccount()} />
        </Card>
        <Card>
          <h2 className="mb-5 text-lg font-semibold">Your company</h2>
          {!account.org_id ? (
            <Notice tone="info">The Coherent team is setting up your company. You can edit these details once it is ready.</Notice>
          ) : loading ? (
            <LoadingList rows={1} className="h-64" />
          ) : org ? (
            <OrgForm org={org} onSaved={reload} />
          ) : null}
        </Card>
      </div>
    </div>
  )
}
