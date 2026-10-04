import { useAccount, useAuth } from '@/features/auth/AuthProvider'
import { useTheme } from '@/app/theme'
import { Card, PageHeader } from '@/components/ui'
import { PersonForm } from '@/features/client/ProfileForms'

export default function ProfilePage() {
  const account = useAccount()
  const { refreshAccount } = useAuth()
  const { preference, setPreference } = useTheme()
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Your profile" subtitle={`${account.email} · ${account.role}`} />
      <Card>
        <PersonForm person={{ ...account, theme_preference: preference }} showTheme onTheme={(t) => setPreference(t)} onSaved={() => void refreshAccount()} />
      </Card>
    </div>
  )
}
