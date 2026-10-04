import type { AccessKey, AccessStatus } from './types'

export interface KickoffState {
  /** True when the "Let's Go" button may be pressed. */
  canStart: boolean
  /** Set when blocked: only the Webflow step being Pending blocks kickoff. */
  blockedBy: AccessKey | null
  /** Steps still Pending (shown as a warning, but do not block). */
  pendingKeys: AccessKey[]
  allDone: boolean
}

/** Mirrors the database rule in public.confirm_kickoff. */
export function kickoffState(steps: { key: AccessKey; status: AccessStatus }[]): KickoffState {
  const pendingKeys = steps.filter((s) => s.status === 'pending').map((s) => s.key)
  const webflowPending = steps.some((s) => s.key === 'webflow' && s.status === 'pending')
  return {
    canStart: !webflowPending,
    blockedBy: webflowPending ? 'webflow' : null,
    pendingKeys,
    allDone: pendingKeys.length === 0,
  }
}
