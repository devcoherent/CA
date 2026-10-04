import { Badge } from './ui'
import { PROJECT_STATUS_LABEL, countdownText, daysUntil } from '@/lib/format'
import type { AccessStatus, ProjectStatus, UpdateStatus } from '@/lib/types'

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const tone = status === 'completed' ? 'success' : status === 'on_hold' ? 'warning' : status === 'onboarding' ? 'neutral' : 'accent'
  return <Badge tone={tone}>{PROJECT_STATUS_LABEL[status] ?? status}</Badge>
}

export function DueCountdown({ due }: { due: string | null }) {
  if (!due) return <Badge>Due date to be confirmed</Badge>
  const d = daysUntil(due)
  const tone = d < 0 ? 'danger' : d <= 7 ? 'warning' : 'neutral'
  return <Badge tone={tone}>{countdownText(due)}</Badge>
}

export const ACCESS_STATUS_LABEL: Record<AccessStatus, string> = {
  pending: 'Not done yet',
  provided: 'Done',
  skipped: 'Shared before',
  verified: 'Checked by us',
}

export function AccessStatusBadge({ status }: { status: AccessStatus }) {
  const tone = status === 'verified' ? 'success' : status === 'provided' ? 'accent' : status === 'skipped' ? 'neutral' : 'warning'
  return <Badge tone={tone}>{ACCESS_STATUS_LABEL[status]}</Badge>
}

export function UpdateStatusBadge({ status }: { status: UpdateStatus }) {
  if (status === 'published') return <Badge tone="success">Shared with client</Badge>
  if (status === 'pending_approval') return <Badge tone="warning">Waiting for approval</Badge>
  return <Badge tone="danger">Not approved</Badge>
}
