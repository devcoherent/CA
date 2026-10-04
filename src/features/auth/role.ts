/**
 * The "I'm a client / I'm on the team" choice from the landing page.
 * It only changes wording and which signup form is shown. It NEVER decides
 * permissions: the real role always comes from the database.
 */
export type PortalRole = 'client' | 'team'
const KEY = 'coherent.portalRole'

export function readPortalRole(param: string | null): PortalRole {
  if (param === 'client' || param === 'team') return param
  try {
    const v = sessionStorage.getItem(KEY)
    if (v === 'client' || v === 'team') return v
  } catch {
    // ignore
  }
  return 'client'
}

export function savePortalRole(role: PortalRole) {
  try {
    sessionStorage.setItem(KEY, role)
  } catch {
    // ignore
  }
}

export function callbackUrl(): string {
  return `${window.location.origin}/auth/callback`
}
