import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAsync, unwrap } from '@/lib/useAsync'
import type { Project } from '@/lib/types'
import { copy } from '@/content/copy'
import { QA_GUIDE } from '@/content/qaGuide'
import { friendlyError } from '@/lib/errors'
import { EmptyState, ErrorBox, LoadingList, Notice, PageHeader } from '@/components/ui'
import { Icon } from '@/components/Icon'

export default function QAPage() {
  const { id } = useParams()
  const [showEmbed, setShowEmbed] = useState(false)
  const { data: project, error, loading, reload } = useAsync(
    async () => unwrap(await supabase.from('projects').select('id, name, webvizio_url, staging_url').eq('id', id!).maybeSingle()) as Pick<Project, 'id' | 'name' | 'webvizio_url' | 'staging_url'> | null,
    [id],
  )

  if (error) return <ErrorBox message={friendlyError(error)} onRetry={reload} />
  if (loading) return <LoadingList rows={2} className="h-40" />
  if (!project) return <EmptyState icon="lock" title="Project not found" />

  return (
    <div>
      <PageHeader
        back={{ to: `/client/projects/${project.id}`, label: project.name }}
        title={copy.qa.title}
        subtitle={copy.qa.intro}
        actions={
          project.webvizio_url ? (
            <a className="btn-primary" href={project.webvizio_url} target="_blank" rel="noreferrer">
              {copy.qa.open} <Icon name="external" size={16} />
            </a>
          ) : undefined
        }
      />

      {!project.webvizio_url && (
        <div className="mb-8">
          <Notice tone="info">{copy.qa.notReady}</Notice>
        </div>
      )}

      <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {QA_GUIDE.map((step, i) => (
          <li key={step.title} className="card p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-field bg-surface text-accent">
                <Icon name={step.icon} />
              </span>
              <span className="text-sm font-semibold text-muted">Step {i + 1}</span>
            </div>
            <h2 className="mt-4 font-semibold">{step.title}</h2>
            <p className="mt-1.5 text-sm text-muted">{step.body}</p>
          </li>
        ))}
      </ol>

      {project.webvizio_url && (
        <div className="mt-8">
          <button type="button" className="btn-secondary" onClick={() => setShowEmbed((s) => !s)} aria-expanded={showEmbed}>
            {showEmbed ? copy.qa.hide : copy.qa.showHere}
          </button>
          {showEmbed && (
            <div className="mt-4">
              <p className="mb-2 text-sm text-muted">{copy.qa.embedNote}</p>
              <iframe
                title="Webvizio review"
                src={project.webvizio_url}
                className="h-[70dvh] w-full rounded-card border border-border bg-surface"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                referrerPolicy="no-referrer"
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
