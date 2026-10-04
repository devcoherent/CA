const dateFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
const dateTimeFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

/** Parses a 'YYYY-MM-DD' date as a local date (no timezone shift). */
export function parseDateOnly(value: string): Date {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return 'Not set'
  return dateFmt.format(value.length === 10 ? parseDateOnly(value) : new Date(value))
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return ''
  return dateTimeFmt.format(new Date(value))
}

export function daysUntil(dateOnly: string, now = new Date()): number {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((parseDateOnly(dateOnly).getTime() - today.getTime()) / 86_400_000)
}

/** Plain-English countdown, e.g. "Due in 12 days", "Due today", "3 days overdue". */
export function countdownText(dateOnly: string | null | undefined, now = new Date()): string {
  if (!dateOnly) return 'Due date to be confirmed'
  const d = daysUntil(dateOnly, now)
  if (d === 0) return 'Due today'
  if (d === 1) return 'Due tomorrow'
  if (d > 1) return `Due in ${d} days`
  if (d === -1) return '1 day overdue'
  return `${-d} days overdue`
}

/** "2h 05m" style durations. */
export function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000))
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return `${h}h ${String(m).padStart(2, '0')}m`
}

/** "01:02:03" clock for running timers. */
export function formatClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const hh = String(Math.floor(s / 3600)).padStart(2, '0')
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

export function relativeTime(value: string, now = Date.now()): string {
  const diff = Math.round((now - new Date(value).getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`
  if (diff < 86_400) return `${Math.floor(diff / 3600)} h ago`
  if (diff < 7 * 86_400) return `${Math.floor(diff / 86_400)} d ago`
  return formatDate(value)
}

export function initials(name: string | null | undefined): string {
  if (!name) return '?'
  return name
    .split(/\s+|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('')
}

export const PROJECT_STATUS_LABEL: Record<string, string> = {
  onboarding: 'Getting set up',
  kickoff_confirmed: 'Kickoff confirmed',
  in_progress: 'In progress',
  on_hold: 'On hold',
  completed: 'Completed',
}

export const TEMPLATE_LABEL: Record<string, string> = {
  webflow_build: 'Webflow Build',
  seo_audit: 'SEO Audit',
  custom: 'Custom',
}

/** Start of the current week (Monday 00:00 local). */
export function startOfWeek(now = new Date()): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const day = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - day)
  return d
}

export function startOfDay(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

export function toDateInput(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const TIMEZONES: string[] = (() => {
  try {
    const fn = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf
    if (fn) return fn('timeZone')
  } catch {
    // ignore
  }
  return ['UTC', 'Europe/London', 'Europe/Berlin', 'America/New_York', 'America/Los_Angeles', 'Asia/Dhaka', 'Asia/Kolkata', 'Australia/Sydney']
})()
