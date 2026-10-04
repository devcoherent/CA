import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '@/lib/supabase'
import type { Organization, Profile, ThemePreference } from '@/lib/types'
import { TIMEZONES } from '@/lib/format'
import { friendlyError } from '@/lib/errors'
import { ImageUpload } from '@/components/ImageUpload'
import { useToast } from '@/components/Toast'

type PersonFields = Pick<Profile, 'id' | 'full_name' | 'avatar_url' | 'timezone'> & { theme_preference?: ThemePreference }

/** Edit a person's name, photo and timezone. Used by the person themself and by admins. */
export function PersonForm({ person, onSaved, showTheme = false, onTheme }: { person: PersonFields; onSaved?: () => void; showTheme?: boolean; onTheme?: (t: ThemePreference) => void }) {
  const [fullName, setFullName] = useState(person.full_name ?? '')
  const [timezone, setTimezone] = useState(person.timezone || 'UTC')
  const [avatar, setAvatar] = useState(person.avatar_url)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const toast = useToast()

  useEffect(() => {
    setFullName(person.full_name ?? '')
    setTimezone(person.timezone || 'UTC')
    setAvatar(person.avatar_url)
  }, [person])

  const save = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error: err } = await supabase.from('profiles').update({ full_name: fullName.trim() || null, timezone }).eq('id', person.id)
    setBusy(false)
    if (err) return setError(friendlyError(err))
    toast('Profile saved.')
    onSaved?.()
  }

  const id = person.id.slice(0, 8)
  return (
    <form onSubmit={save} className="space-y-5">
      <ImageUpload
        bucket="avatars"
        folder={person.id}
        currentUrl={avatar}
        label="Change photo"
        onUploaded={async (url) => {
          const { error: err } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', person.id)
          if (err) setError(friendlyError(err))
          else {
            setAvatar(url)
            onSaved?.()
          }
        }}
      />
      <div>
        <label htmlFor={`name-${id}`} className="label">
          Full name
        </label>
        <input id={`name-${id}`} className="field" value={fullName} maxLength={200} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
      </div>
      <div>
        <label htmlFor={`tz-${id}`} className="label">
          Timezone
        </label>
        <select id={`tz-${id}`} className="field" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
          {(TIMEZONES.includes(timezone) ? TIMEZONES : [timezone, ...TIMEZONES]).map((tz) => (
            <option key={tz} value={tz}>
              {tz.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      </div>
      {showTheme && onTheme && (
        <div>
          <label htmlFor={`theme-${id}`} className="label">
            Theme
          </label>
          <select id={`theme-${id}`} className="field" value={person.theme_preference ?? 'system'} onChange={(e) => onTheme(e.target.value as ThemePreference)}>
            <option value="system">Same as my device</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
      )}
      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn-primary" disabled={busy}>
        {busy ? 'Saving…' : 'Save'}
      </button>
    </form>
  )
}

/** Edit company details. Clients edit their own; admins edit any. */
export function OrgForm({ org, onSaved }: { org: Organization; onSaved?: () => void }) {
  const [name, setName] = useState(org.name)
  const [bio, setBio] = useState(org.bio ?? '')
  const [billing, setBilling] = useState(org.billing_email ?? '')
  const [timezone, setTimezone] = useState(org.timezone || 'UTC')
  const [logo, setLogo] = useState(org.logo_url)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const toast = useToast()

  useEffect(() => {
    setName(org.name)
    setBio(org.bio ?? '')
    setBilling(org.billing_email ?? '')
    setTimezone(org.timezone || 'UTC')
    setLogo(org.logo_url)
  }, [org])

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return setError('Company name is required.')
    setBusy(true)
    setError(null)
    const { error: err } = await supabase
      .from('organizations')
      .update({ name: name.trim(), bio: bio.trim() || null, billing_email: billing.trim() || null, timezone })
      .eq('id', org.id)
    setBusy(false)
    if (err) return setError(friendlyError(err))
    toast('Company details saved.')
    onSaved?.()
  }

  const id = org.id.slice(0, 8)
  return (
    <form onSubmit={save} className="space-y-5">
      <ImageUpload
        bucket="logos"
        folder={org.id}
        shape="square"
        currentUrl={logo}
        label="Change logo"
        onUploaded={async (url) => {
          const { error: err } = await supabase.from('organizations').update({ logo_url: url }).eq('id', org.id)
          if (err) setError(friendlyError(err))
          else {
            setLogo(url)
            onSaved?.()
          }
        }}
      />
      <div>
        <label htmlFor={`org-name-${id}`} className="label">
          Company name
        </label>
        <input id={`org-name-${id}`} className="field" value={name} maxLength={200} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label htmlFor={`org-bio-${id}`} className="label">
          About the company
        </label>
        <textarea id={`org-bio-${id}`} className="field min-h-24" value={bio} maxLength={2000} onChange={(e) => setBio(e.target.value)} />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor={`org-billing-${id}`} className="label">
            Billing email
          </label>
          <input id={`org-billing-${id}`} className="field" type="email" value={billing} onChange={(e) => setBilling(e.target.value)} />
        </div>
        <div>
          <label htmlFor={`org-tz-${id}`} className="label">
            Company timezone
          </label>
          <select id={`org-tz-${id}`} className="field" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
            {(TIMEZONES.includes(timezone) ? TIMEZONES : [timezone, ...TIMEZONES]).map((tz) => (
              <option key={tz} value={tz}>
                {tz.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
      </div>
      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn-primary" disabled={busy}>
        {busy ? 'Saving…' : 'Save company details'}
      </button>
    </form>
  )
}
