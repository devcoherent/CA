import type { Stage } from '@/lib/types'
import { formatDate } from '@/lib/format'
import { Icon } from './Icon'

/** Stage timeline: horizontal on wide screens, vertical on phones. Current stage highlighted. */
export function StageTimeline({ stages }: { stages: Stage[] }) {
  if (!stages.length) return <p className="text-sm text-muted">Stages will appear here once the project is set up.</p>
  return (
    <ol className="grid gap-0 sm:grid-flow-col sm:auto-cols-fr" aria-label="Project stages">
      {stages.map((s, i) => {
        const active = s.status === 'active'
        const done = s.status === 'done'
        const last = i === stages.length - 1
        return (
          <li key={s.id} className="relative flex gap-3 pb-6 sm:flex-col sm:gap-0 sm:pb-0 sm:pr-3" aria-current={active ? 'step' : undefined}>
            {/* connector */}
            {!last && (
              <span
                aria-hidden="true"
                className={`absolute left-[15px] top-8 h-[calc(100%-2rem)] w-0.5 sm:left-8 sm:top-[15px] sm:h-0.5 sm:w-[calc(100%-2rem)] ${done ? 'bg-accent' : 'bg-border'}`}
              />
            )}
            <span
              className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold ${
                done ? 'border-accent bg-accent text-accent-text' : active ? 'border-accent bg-bg text-accent ring-4 ring-accent/20' : 'border-border bg-bg text-muted'
              }`}
            >
              {done ? <Icon name="check" size={16} /> : i + 1}
            </span>
            <div className="sm:mt-3">
              <p className={`text-sm font-semibold ${active ? 'text-accent' : done ? 'text-text' : 'text-muted'}`}>{s.name}</p>
              <p className="text-xs text-muted">
                {active ? 'Happening now' : done ? 'Done' : 'Coming up'}
                {s.due_date && !done ? ` · ${formatDate(s.due_date)}` : ''}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
