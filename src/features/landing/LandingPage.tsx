import { useNavigate } from 'react-router-dom'
import { PublicLayout } from './PublicLayout'
import { Icon, type IconName } from '@/components/Icon'
import { copy } from '@/content/copy'
import { savePortalRole, type PortalRole } from '@/features/auth/role'

function RoleCard({ portalRole: role, icon, title, body, cta }: { portalRole: PortalRole; icon: IconName; title: string; body: string; cta: string }) {
  const navigate = useNavigate()
  const go = () => {
    savePortalRole(role)
    navigate(`/login?role=${role}`)
  }
  // The whole card is one link-like button: one tab stop, Enter/Space activate it.
  return (
    <button
      type="button"
      onClick={go}
      data-testid={`role-card-${role}`}
      className="group card flex h-full w-full flex-col items-start p-6 text-left transition hover:-translate-y-0.5 hover:border-accent hover:shadow-lg focus-visible:border-accent sm:p-8"
    >
      <span className="mb-6 flex h-12 w-12 items-center justify-center rounded-card bg-surface text-accent transition group-hover:bg-accent group-hover:text-accent-text">
        <Icon name={icon} size={24} />
      </span>
      <span className="font-heading text-xl font-semibold sm:text-2xl">{title}</span>
      <span className="mt-2 text-muted">{body}</span>
      <span className="mt-8 inline-flex items-center gap-2 rounded-btn bg-accent px-4 py-2.5 text-sm font-semibold text-accent-text">
        {cta}
        <Icon name="arrowRight" size={16} className="transition group-hover:translate-x-0.5" />
      </span>
    </button>
  )
}

export default function LandingPage() {
  const l = copy.landing
  return (
    <PublicLayout>
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-14 sm:px-6 sm:pt-24">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">{l.headline}</h1>
          <p className="mt-4 text-lg text-muted sm:text-xl">{l.support}</p>
        </div>

        <h2 className="sr-only">{l.chooseLabel}</h2>
        <div className="mx-auto mt-12 grid max-w-4xl gap-4 sm:mt-16 sm:grid-cols-2 sm:gap-6">
          <RoleCard portalRole="client" icon="briefcase" title={l.client.title} body={l.client.body} cta={l.client.cta} />
          <RoleCard portalRole="team" icon="users" title={l.team.title} body={l.team.body} cta={l.team.cta} />
        </div>
      </section>

      <section className="border-t border-border bg-surface" aria-labelledby="how-title">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <h2 id="how-title" className="text-center text-2xl font-semibold">
            {l.howTitle}
          </h2>
          <ol className="mx-auto mt-10 grid max-w-4xl gap-8 sm:grid-cols-3">
            {l.how.map((step, i) => (
              <li key={step.title} className="text-center sm:text-left">
                <span className="mx-auto flex h-9 w-9 items-center justify-center rounded-full border border-border bg-bg font-heading font-semibold text-accent sm:mx-0">
                  {i + 1}
                </span>
                <h3 className="mt-4 font-semibold">{step.title}</h3>
                <p className="mt-1.5 text-sm text-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </PublicLayout>
  )
}
