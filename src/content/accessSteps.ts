import type { AccessKey } from '@/lib/types'
import { ACCESS_EMAIL } from './copy'

/**
 * Access onboarding steps: titles, plain instructions and the ID-only fields
 * we ask for. Edit wording here. NEVER add a password or token field.
 */

export interface AccessField {
  /** 'value' is stored in access_steps.value_text; anything else in access_steps.fields. */
  name: string
  label: string
  placeholder?: string
  help?: string
  /** Optional format check, shown as a friendly hint (does not block saving). */
  pattern?: RegExp
  patternHint?: string
  type?: 'text' | 'url'
}

export interface AccessStepContent {
  title: string
  /** Short label for the step tabs. */
  nav: string
  short: string
  why: string
  instructions: string[]
  fields: AccessField[]
}

export const ACCESS_STEP_CONTENT: Record<AccessKey, AccessStepContent> = {
  webflow: {
    title: 'Webflow',
    nav: 'Webflow',
    short: 'Invite us to your Webflow site',
    why: 'We need this to design and build your site. This is the only step we need before we can start.',
    instructions: [
      'Open Webflow and go to your Workspace settings.',
      'Choose "Members" (or "Guests" if we are outside your workspace).',
      `Invite ${ACCESS_EMAIL} with Editor or Admin access to this site.`,
      'Paste your site name or the site link below.',
    ],
    fields: [{ name: 'value', label: 'Webflow site name or link', placeholder: 'your-site.webflow.io' }],
  },
  domain_dns: {
    title: 'Domain and DNS',
    nav: 'Domain',
    short: 'Tell us where your domain lives',
    why: 'We need to point your domain at the new site on launch day.',
    instructions: [
      'Find where you bought your domain (for example GoDaddy, Namecheap or Google Domains).',
      `If your registrar allows it, add ${ACCESS_EMAIL} as a delegate or team member.`,
      'If not, no problem. Just fill in the details below and we will send you the exact records to add.',
    ],
    fields: [
      { name: 'value', label: 'Your domain', placeholder: 'example.com', pattern: /^[a-z0-9.-]+\.[a-z]{2,}$/i, patternHint: 'Looks like a domain, e.g. example.com' },
      { name: 'registrar', label: 'Where you bought it (registrar)', placeholder: 'e.g. Namecheap' },
      { name: 'dns_host', label: 'DNS provider, if different (optional)', placeholder: 'e.g. Cloudflare' },
    ],
  },
  gtm: {
    title: 'Google Tag Manager',
    nav: 'Tag Manager',
    short: 'Add us to Tag Manager',
    why: 'We use Tag Manager to set up tracking without touching your site code.',
    instructions: [
      'Open Google Tag Manager and choose your container.',
      'Go to Admin, then User Management.',
      `Add ${ACCESS_EMAIL} with "Publish" permission.`,
      'Copy your Container ID (it starts with GTM-) into the box below.',
    ],
    fields: [
      { name: 'value', label: 'GTM Container ID', placeholder: 'GTM-XXXXXXX', pattern: /^GTM-[A-Z0-9]{4,}$/i, patternHint: 'Usually looks like GTM-ABC1234' },
    ],
  },
  ga4: {
    title: 'Google Analytics 4',
    nav: 'Analytics',
    short: 'Add us to Google Analytics',
    why: 'So we can check traffic and make sure tracking works after launch.',
    instructions: [
      'Open Google Analytics and click Admin (the gear icon).',
      'Under Property, choose "Property access management".',
      `Add ${ACCESS_EMAIL} with the "Editor" role.`,
      'Copy your Property ID (a number) into the box below.',
    ],
    fields: [
      { name: 'value', label: 'GA4 Property ID', placeholder: '123456789', pattern: /^\d{6,12}$/, patternHint: 'Usually 9 digits, e.g. 345678901' },
      { name: 'measurement_id', label: 'Measurement ID (optional)', placeholder: 'G-XXXXXXXXXX' },
    ],
  },
  gsc: {
    title: 'Google Search Console',
    nav: 'Search Console',
    short: 'Add us to Search Console',
    why: 'This shows how Google sees your site, so we can fix search issues.',
    instructions: [
      'Open Google Search Console and choose your property.',
      'Go to Settings, then "Users and permissions".',
      `Add ${ACCESS_EMAIL} as a "Full" user.`,
      'Type the property below (your domain or site address).',
    ],
    fields: [{ name: 'value', label: 'Search Console property', placeholder: 'example.com or https://www.example.com/' }],
  },
  brand_assets: {
    title: 'Brand assets',
    nav: 'Brand',
    short: 'Share your logo and brand files',
    why: 'So the new site matches your brand exactly.',
    instructions: [
      'Put your logo files, fonts and any brand guidelines in one folder.',
      'Share the folder (Google Drive, Dropbox or Figma) so anyone with the link can view it.',
      'Paste the link below.',
    ],
    fields: [{ name: 'value', label: 'Link to your brand files', placeholder: 'https://drive.google.com/…', type: 'url' }],
  },
}

/** Very simple check so people do not paste secrets by accident. */
export function looksLikeSecret(value: string): boolean {
  const v = value.trim()
  if (!v) return false
  if (/\b(pass(word|wd)?|pwd|secret|token|api[_ -]?key)\b\s*[:=]/i.test(v)) return true
  if (/^(sk|pk|rk)_(live|test)_[A-Za-z0-9]{10,}$/.test(v)) return true
  if (/^[A-Za-z0-9_-]{32,}$/.test(v) && /\d/.test(v) && /[A-Z]/.test(v) && /[a-z]/.test(v)) return true
  return false
}
