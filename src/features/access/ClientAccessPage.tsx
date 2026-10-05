import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useProjectBundle } from '@/features/client/useClientProject'
import type { AccessStatus, AccessStep } from '@/lib/types'
import { ACCESS_EMAIL, copy } from '@/content/copy'
import { ACCESS_STEP_CONTENT, looksLikeSecret } from '@/content/accessSteps'
import { friendlyError } from '@/lib/errors'
import { kickoffState } from '@/lib/kickoff'
import { EmptyState, ErrorBox, LoadingList, Notice, PageHeader } from '@/components/ui'
import { AccessStatusBadge } from '@/components/badges'
import { Icon } from '@/components/Icon'
import { useToast } from '@/components/Toast'
import { LetsGo } from './LetsGo'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export default function ClientAccessPage() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const { data, error, loading, reload } = useProjectBundle(id)
  const [steps, setSteps] = useState<AccessStep[]>([])
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const toast = useToast()

  useEffect(() => {
    if (data) setSteps(data.steps)
  }, [data])

  const index = Math.min(Math.max(Number(params.get('step') ?? 0) || 0, 0), steps.length)
  const goTo = (i: number) => {
    setParams({ step: String(i) }, { replace: true })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const persist = useCallback(async (step: AccessStep) => {
    setSaveState('saving')
    setSaveError(null)
    const { error: err } = await supabase
      .from('access_steps')
      .update({ status: step.status, value_text: step.value_text, fields: step.fields, note: step.note })
      .eq('id', step.id)
    if (err) {
      setSaveState('error')
      setSaveError(friendlyError(err))
    } else {
      setSaveState('saved')
    }
  }, [])

  /** Update locally right away, save after a short pause (autosave). */
  const change = (step: AccessStep, patch: Partial<AccessStep>) => {
    const next = { ...step, ...patch }
    setSteps((prev) => prev.map((s) => (s.id === step.id ? next : s)))
    clearTimeout(timers.current[step.id])
    // Do not save a secret, or a "shared before" without a note yet.
    const values = [next.value_text ?? '', ...Object.values(next.fields ?? {})]
    if (values.some(looksLikeSecret)) {
      setSaveState('error')
      setSaveError(copy.access.secretWarning)
      return
    }
    if (next.status === 'skipped' && !next.note?.trim()) {
      setSaveState('idle')
      return
    }
    timers.current[step.id] = setTimeout(() => void persist(next), 700)
  }

  useEffect(() => {
    const t = timers.current
    return () => Object.values(t).forEach(clearTimeout)
  }, [])

  if (error) return <ErrorBox message={friendlyError(error)} onRetry={reload} />
  if (loading || !data) return <LoadingList rows={2} className="h-64" />
  if (!data.project) return <EmptyState icon="lock" title="Project not found" />
  const project = data.project
  if (!steps.length) return <EmptyState icon="key" title="No access steps for this project" body="The team will add them if anything is needed." />

  const state = kickoffState(steps)
  const step = steps[index] as AccessStep | undefined
  const onReview = index >= steps.length

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader back={{ to: `/client/projects/${project.id}`, label: project.name }} title={copy.access.title} subtitle={copy.access.intro} />

      {/* Progress indicator */}
      <nav aria-label="Access steps" className="mb-6">
        <p className="mb-3 text-sm text-muted">{onReview ? 'Review' : `Step ${index + 1} of ${steps.length}`}</p>
        <ol className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {steps.map((s, i) => (
            <li key={s.id} className="min-w-0">
              <button
                type="button"
                onClick={() => goTo(i)}
                aria-current={i === index ? 'step' : undefined}
                className={`flex h-full w-full flex-col gap-1.5 rounded-field border p-2 text-left text-xs transition ${i === index ? 'border-accent bg-surface' : 'border-border hover:bg-surface'}`}
              >
                <span className={`h-1.5 w-full rounded-full ${s.status === 'pending' ? 'bg-border' : s.status === 'verified' ? 'bg-success' : 'bg-accent'}`} aria-hidden="true" />
                <span className="font-medium leading-tight [overflow-wrap:anywhere]" title={ACCESS_STEP_CONTENT[s.key].title}>
                  {ACCESS_STEP_CONTENT[s.key].nav}
                </span>
                <span className="sr-only">: {s.status}</span>
              </button>
            </li>
          ))}
          <li className="min-w-0">
            <button
              type="button"
              onClick={() => goTo(steps.length)}
              aria-current={onReview ? 'step' : undefined}
              className={`flex h-full w-full flex-col gap-1.5 rounded-field border p-2 text-left text-xs transition ${onReview ? 'border-accent bg-surface' : 'border-border hover:bg-surface'}`}
            >
              <span className={`h-1.5 w-full rounded-full ${project.kickoff_confirmed_at ? 'bg-success' : 'bg-border'}`} aria-hidden="true" />
              <span className="font-medium leading-tight">{copy.access.review}</span>
            </button>
          </li>
        </ol>
      </nav>

      <div className="mb-6">
        <Notice tone="warning" icon="lock">
          <strong>{copy.access.neverPasswords}</strong>
        </Notice>
      </div>

      {step && !onReview ? (
        <StepScreen step={step} onChange={(patch) => change(step, patch)} />
      ) : (
        <ReviewScreen steps={steps} onEdit={goTo} />
      )}

      {/* Footer: autosave state + Back/Next */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <button type="button" className="btn-secondary" onClick={() => goTo(index - 1)} disabled={index === 0}>
          <Icon name="arrowLeft" size={16} /> {copy.access.back}
        </button>
        <span className="text-sm" aria-live="polite">
          {saveState === 'saving' && <span className="text-muted">{copy.access.saving}</span>}
          {saveState === 'saved' && <span className="text-success">✓ {copy.access.saved}</span>}
          {saveState === 'error' && <span className="text-danger">{saveError}</span>}
        </span>
        {!onReview && (
          <button type="button" className="btn-primary" onClick={() => goTo(index + 1)}>
            {index === steps.length - 1 ? copy.access.review : copy.access.next} <Icon name="arrowRight" size={16} />
          </button>
        )}
      </div>

      <div className="mt-10">
        <LetsGo
          project={project}
          state={state}
          onDone={() => {
            toast(copy.access.started)
            void reload()
          }}
        />
      </div>
    </div>
  )
}

function StepScreen({ step, onChange }: { step: AccessStep; onChange: (patch: Partial<AccessStep>) => void }) {
  const content = ACCESS_STEP_CONTENT[step.key]
  const verified = step.status === 'verified'
  const [copied, setCopied] = useState(false)

  const setField = (name: string, value: string) => {
    if (name === 'value') onChange({ value_text: value })
    else onChange({ fields: { ...(step.fields ?? {}), [name]: value } })
  }
  const fieldValue = (name: string) => (name === 'value' ? (step.value_text ?? '') : (step.fields?.[name] ?? ''))

  const statusOptions: { value: AccessStatus; label: string }[] = [
    { value: 'pending', label: copy.access.statusPending },
    { value: 'provided', label: copy.access.statusProvided },
    { value: 'skipped', label: copy.access.statusSkipped },
  ]

  return (
    <section className="card p-5 sm:p-8" aria-labelledby="step-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="step-title" className="text-xl font-semibold">
            {content.short}
          </h2>
          <p className="mt-1 text-sm text-muted">{content.why}</p>
        </div>
        <AccessStatusBadge status={step.status} />
      </div>

      {verified && (
        <div className="mt-5">
          <Notice tone="success">{copy.access.verifiedNote}</Notice>
        </div>
      )}

      <ol className="mt-6 list-decimal space-y-2 pl-5 text-sm leading-relaxed marker:font-semibold marker:text-accent">
        {content.instructions.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ol>

      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-field bg-surface px-4 py-3">
        <span className="text-sm text-muted">{copy.access.inviteEmailLabel}:</span>
        <code className="font-mono text-sm font-semibold">{ACCESS_EMAIL}</code>
        <button
          type="button"
          className="btn-ghost btn-sm ml-auto"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(ACCESS_EMAIL)
              setCopied(true)
              setTimeout(() => setCopied(false), 2000)
            } catch {
              // clipboard not available; the address is visible anyway
            }
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <div className="mt-6 space-y-4">
        {content.fields.map((f) => {
          const id = `field-${step.key}-${f.name}`
          const v = fieldValue(f.name)
          const secret = looksLikeSecret(v)
          const formatOff = Boolean(v && f.pattern && !f.pattern.test(v.trim()))
          // The "never share passwords" notice above already covers the general rule, so a hint shows only when useful.
          const hint = secret ? copy.access.secretWarning : formatOff ? f.patternHint : f.help
          return (
            <div key={f.name}>
              <label htmlFor={id} className="label">
                {f.label}
              </label>
              <input
                id={id}
                className="field"
                type={f.type ?? 'text'}
                value={v}
                placeholder={f.placeholder}
                disabled={verified}
                maxLength={f.name === 'value' ? 500 : 200}
                autoComplete="off"
                spellCheck={false}
                aria-invalid={secret}
                aria-describedby={hint ? `${id}-hint` : undefined}
                onChange={(e) => setField(f.name, e.target.value)}
              />
              {hint && (
                <p id={`${id}-hint`} className={`mt-1 text-xs ${secret ? 'text-danger' : 'text-muted'}`}>
                  {hint}
                </p>
              )}
            </div>
          )
        })}
      </div>

      {!verified && (
        <fieldset className="mt-8">
          <legend className="label">{copy.access.statusLabel}</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {statusOptions.map((o) => (
              <label
                key={o.value}
                className={`flex cursor-pointer items-center gap-2 rounded-field border px-3 py-2.5 text-sm transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent ${
                  step.status === o.value ? 'border-accent bg-surface font-medium' : 'border-border hover:bg-surface'
                }`}
              >
                <input
                  type="radio"
                  name={`status-${step.key}`}
                  value={o.value}
                  checked={step.status === o.value}
                  onChange={() => onChange({ status: o.value })}
                  className="accent-[var(--c-accent)]"
                />
                {o.label}
              </label>
            ))}
          </div>
          {step.status === 'skipped' && (
            <div className="mt-4">
              <label htmlFor={`note-${step.key}`} className="label">
                {copy.access.skippedNote}
              </label>
              <input
                id={`note-${step.key}`}
                className="field"
                value={step.note ?? ''}
                maxLength={1000}
                placeholder={copy.access.skippedNotePlaceholder}
                onChange={(e) => onChange({ note: e.target.value })}
                aria-describedby={`note-${step.key}-hint`}
              />
              <p id={`note-${step.key}-hint`} className="hint">
                Required, so our team knows where to look.
              </p>
            </div>
          )}
        </fieldset>
      )}
    </section>
  )
}

function ReviewScreen({ steps, onEdit }: { steps: AccessStep[]; onEdit: (i: number) => void }) {
  return (
    <section className="card divide-y divide-border" aria-label="Review your access steps">
      {steps.map((s, i) => (
        <div key={s.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="font-medium">{ACCESS_STEP_CONTENT[s.key].title}</p>
            <p className="truncate text-sm text-muted">{s.status === 'skipped' ? s.note : s.value_text || '—'}</p>
          </div>
          <AccessStatusBadge status={s.status} />
          <button type="button" className="btn-ghost btn-sm" onClick={() => onEdit(i)}>
            {s.status === 'verified' ? 'View' : 'Edit'}
          </button>
        </div>
      ))}
      <div className="px-5 py-4">
        <Link to="/client/request" className="text-sm text-muted hover:text-text">
          Stuck on a step? Ask us for help.
        </Link>
      </div>
    </section>
  )
}
